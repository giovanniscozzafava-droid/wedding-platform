-- ============================================================================
-- PREVENTIVO VIVO — completamento:
--  1) 3° stato per-voce "FORSE" (in forse)
--  2) contracted_at: marca le voci effettivamente firmate (badge "Firmato")
--  3) il CLIENTE può concludere il preventivo → firma l'addendum nella sua area
--  4) niente costo/ricarico esposto alla coppia (couple_get_quote_for_entry)
-- ----------------------------------------------------------------------------

-- 1) Terzo stato per-voce: FORSE -------------------------------------------------
alter table public.quote_items drop constraint if exists quote_items_client_decision_check;
alter table public.quote_items add constraint quote_items_client_decision_check
  check (client_decision in ('IN_ATTESA','ACCETTATO','RIFIUTATO','FORSE'));

-- 2) contracted_at: voce parte del contratto/addendum firmato --------------------
alter table public.quote_items add column if not exists contracted_at timestamptz;
comment on column public.quote_items.contracted_at is
  'Valorizzato quando la voce entra in un contratto/addendum FIRMATO. NULL = aggiunta live non ancora firmata.';

-- Trigger: alla firma del CONTRATTO, le voci presenti diventano "firmate".
create or replace function public.stamp_contracted_on_contract_sign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.quote_id is not null then
    update public.quote_items set contracted_at = coalesce(contracted_at, now())
     where quote_id = new.quote_id and contracted_at is null;
  end if;
  return new;
end$$;
drop trigger if exists trg_stamp_contracted_contract on public.contracts;
create trigger trg_stamp_contracted_contract after update of status on public.contracts
  for each row execute function public.stamp_contracted_on_contract_sign();

-- Trigger: alla firma di un ADDENDUM, le voci ACCETTATE diventano "firmate".
create or replace function public.stamp_contracted_on_addendum_sign()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.quote_id is not null then
    update public.quote_items set contracted_at = coalesce(contracted_at, now())
     where quote_id = new.quote_id and client_decision = 'ACCETTATO' and contracted_at is null;
  end if;
  return new;
end$$;
drop trigger if exists trg_stamp_contracted_addendum on public.contract_addendums;
create trigger trg_stamp_contracted_addendum after update of status on public.contract_addendums
  for each row execute function public.stamp_contracted_on_addendum_sign();

-- Backfill: per i contratti già firmati marca le voci (per sort_order) fino a
-- coprire il totale del contratto → tipicamente solo lo scope originale.
do $$
declare r record; it record; cum numeric;
begin
  for r in select quote_id, total_amount from public.contracts
            where status = 'FIRMATO' and quote_id is not null loop
    cum := 0;
    for it in select id, line_client from public.quote_items
               where quote_id = r.quote_id order by sort_order, created_at loop
      exit when cum >= coalesce(r.total_amount, 0) - 0.01;
      update public.quote_items set contracted_at = coalesce(contracted_at, now()) where id = it.id;
      cum := cum + coalesce(it.line_client, 0);
    end loop;
  end loop;
end$$;

-- 3) client_decide_quote_item: accetta anche FORSE ------------------------------
create or replace function public.client_decide_quote_item(
  p_item_id uuid, p_decision text, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_quote uuid; v_owner text; v_closed timestamptz;
  v_accepted numeric; v_pending numeric; v_forse numeric;
begin
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  if p_decision not in ('ACCETTATO','RIFIUTATO','IN_ATTESA','FORSE') then
    return jsonb_build_object('error','bad_decision');
  end if;

  select qi.quote_id, lower(q.client_email), q.closed_at
    into v_quote, v_owner, v_closed
    from public.quote_items qi join public.quotes q on q.id = qi.quote_id
   where qi.id = p_item_id;
  if v_quote is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner is distinct from v_email then return jsonb_build_object('error','forbidden'); end if;
  if v_closed is not null then return jsonb_build_object('error','closed'); end if;

  update public.quote_items
     set client_decision = p_decision, client_decided_at = now(),
         client_decline_reason = case when p_decision = 'RIFIUTATO' then p_reason else null end
   where id = p_item_id;

  select coalesce(sum(line_client) filter (where client_decision='ACCETTATO'),0),
         coalesce(sum(line_client) filter (where client_decision='IN_ATTESA'),0),
         coalesce(sum(line_client) filter (where client_decision='FORSE'),0)
    into v_accepted, v_pending, v_forse
    from public.quote_items where quote_id = v_quote;
  return jsonb_build_object('ok', true, 'accepted_total', v_accepted,
                            'pending_total', v_pending, 'forse_total', v_forse);
end$$;
revoke all on function public.client_decide_quote_item(uuid, text, text) from public;
grant execute on function public.client_decide_quote_item(uuid, text, text) to authenticated;

-- 4) Addendum: logica condivisa (no gate) + wrapper owner + wrapper cliente ------
create or replace function public._addendum_build(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_contract record; v_base numeric; v_new_total numeric; v_delta numeric;
  v_items jsonb; v_add_id uuid; v_token uuid; v_num int; v_body text; v_date_fmt text;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('created', false, 'reason','not_found'); end if;

  select id, total_amount, created_at, title into v_contract
    from public.contracts where quote_id = p_quote_id and status = 'FIRMATO'
    order by signed_at desc nulls last, created_at desc limit 1;
  if v_contract.id is null then return jsonb_build_object('created', false, 'reason','no_signed_contract'); end if;

  v_base := coalesce(v_contract.total_amount,0)
          + coalesce((select sum(amount_delta) from public.contract_addendums
                       where contract_id = v_contract.id and status='FIRMATO'),0);

  select coalesce(sum(line_client) filter (where client_decision='ACCETTATO'),0),
         coalesce(jsonb_agg(jsonb_build_object('name', name_snapshot, 'qty', quantity,
           'line_client', line_client, 'decision', client_decision)
           order by sort_order, created_at) filter (where client_decision in ('ACCETTATO','RIFIUTATO')), '[]'::jsonb)
    into v_new_total, v_items
    from public.quote_items where quote_id = p_quote_id;

  v_delta := v_new_total - v_base;
  if abs(v_delta) < 0.01 then return jsonb_build_object('created', false, 'reason','no_change'); end if;

  v_date_fmt := to_char(v_contract.created_at, 'DD/MM/YYYY');
  v_body :=
    'Con il presente atto integrativo le parti concordano la modifica dell''oggetto e del corrispettivo del contratto "'
    || coalesce(v_contract.title,'Contratto') || '" del ' || v_date_fmt || '.' || chr(10) || chr(10)
    || 'Nuovo corrispettivo complessivo concordato: € ' || public.fmt_eur_it(v_new_total) || '.' || chr(10)
    || 'Variazione rispetto al precedente accordo: € ' || public.fmt_eur_it(v_delta) || '.' || chr(10) || chr(10)
    || 'Resta fermo e invariato ogni altro patto e condizione del contratto originario.';

  select id into v_add_id from public.contract_addendums
   where contract_id = v_contract.id and status in ('BOZZA','INVIATO')
   order by addendum_number desc limit 1;

  if v_add_id is not null then
    update public.contract_addendums
       set quote_id = p_quote_id, title='Addendum al contratto', body = v_body, amount_delta = v_delta,
           service_changes = jsonb_build_object('old_total', v_base, 'new_total', v_new_total, 'delta', v_delta, 'items', v_items),
           access_token = gen_random_uuid(), access_token_expires_at = now() + interval '30 days',
           status='BOZZA', updated_at = now()
     where id = v_add_id returning access_token into v_token;
  else
    select coalesce(max(addendum_number),0)+1 into v_num from public.contract_addendums where contract_id = v_contract.id;
    insert into public.contract_addendums(contract_id, quote_id, addendum_number, status, title, body,
      amount_delta, service_changes, created_by, access_token, access_token_expires_at)
    values (v_contract.id, p_quote_id, v_num, 'BOZZA', 'Addendum al contratto', v_body, v_delta,
      jsonb_build_object('old_total', v_base, 'new_total', v_new_total, 'delta', v_delta, 'items', v_items),
      v_owner, gen_random_uuid(), now() + interval '30 days')
    returning id, access_token into v_add_id, v_token;
  end if;

  return jsonb_build_object('created', true, 'addendum_id', v_add_id, 'token', v_token, 'amount_delta', v_delta);
end$$;
revoke all on function public._addendum_build(uuid) from public, anon, authenticated;

create or replace function public.addendum_create_if_changed(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner is distinct from auth.uid() and not is_admin() then return jsonb_build_object('error','forbidden'); end if;
  return public._addendum_build(p_quote_id);
end$$;
revoke all on function public.addendum_create_if_changed(uuid) from public;
grant execute on function public.addendum_create_if_changed(uuid) to authenticated;

-- Il CLIENTE conclude il preventivo: chiude + genera addendum (se serve) e
-- restituisce il token per firmarlo subito nella sua area.
create or replace function public.quote_conclude_by_client(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_owner_email text; v_add jsonb;
begin
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  select lower(client_email) into v_owner_email from public.quotes where id = p_quote_id;
  if v_owner_email is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner_email is distinct from v_email then return jsonb_build_object('error','forbidden'); end if;

  update public.quotes set closed_at = coalesce(closed_at, now()) where id = p_quote_id;
  v_add := public._addendum_build(p_quote_id);
  return jsonb_build_object('ok', true, 'closed', true, 'addendum', v_add);
end$$;
revoke all on function public.quote_conclude_by_client(uuid) from public;
grant execute on function public.quote_conclude_by_client(uuid) to authenticated;

-- 5) couple_get_quote_for_entry: WHITELIST (no costo/markup) + campi live --------
create or replace function public.couple_get_quote_for_entry(p_entry_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_quote quotes%rowtype; v_entry calendar_entries%rowtype; v_items jsonb; v_owner record;
  v_business_model text := 'GLOBAL';
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if not exists (select 1 from public.wedding_couple_members m where m.entry_id = p_entry_id and m.user_id = v_uid) then
    return jsonb_build_object('error','not_couple_member');
  end if;
  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null or v_entry.quote_id is null then return jsonb_build_object('error','no_quote'); end if;
  select * into v_quote from public.quotes where id = v_entry.quote_id;
  if v_quote.id is null then return jsonb_build_object('error','quote_not_found'); end if;
  v_business_model := coalesce(v_entry.business_model, 'GLOBAL');

  select jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name_snapshot', qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'unit_snapshot', qi.unit_snapshot,
           'quantity', qi.quantity,
           'line_client', qi.line_client,
           'sort_order', qi.sort_order,
           'client_decision', qi.client_decision,
           'client_decline_reason', qi.client_decline_reason,
           'contracted_at', qi.contracted_at,
           'created_at', qi.created_at,
           'supplier_id', case when v_business_model = 'GLOBAL' then null else qi.supplier_id end
         ) order by qi.sort_order)
    into v_items from public.quote_items qi where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, role, subrole, city
    into v_owner from public.profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id', v_quote.id, 'access_token', v_quote.access_token, 'title', v_quote.title,
    'client_name', v_quote.client_name, 'client_email', v_quote.client_email,
    'event_date', v_quote.event_date, 'event_kind', v_quote.event_kind, 'event_location', v_quote.event_location,
    'guest_count', v_quote.guest_count, 'status', v_quote.status, 'revision', v_quote.revision,
    'total_client', v_quote.total_client, 'pdf_url', v_quote.pdf_url, 'accepted_at', v_quote.accepted_at,
    'closed_at', v_quote.closed_at, 'business_model', v_business_model,
    'owner', to_jsonb(v_owner), 'items', coalesce(v_items, '[]'::jsonb)
  );
end$$;
grant execute on function public.couple_get_quote_for_entry(uuid) to authenticated;
