-- ============================================================================
-- CLUSTER 2 — "I numeri accettati sono congelati"
-- Invariante: quando una quote è ACCETTATO o CONVERTITO_IN_CONTRATTO, gli importi
-- concordati sono immutabili; nessun trigger di markup li ricalcola in silenzio,
-- e non si può concludere/riaprire/ri-decidere fuori stato.
-- Chiude: BRK-E-SNAPSHOT-02/03 · BRK-A-12/14/15.
-- ============================================================================

-- ── SNAPSHOT-02 · quotes_default_markup_after_update: niente ricalcolo di
--    line_client se la quote è già accettata/convertita (prezzo congelato) ────
create or replace function public.quotes_default_markup_after_update()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  -- quote congelata: il markup di default non tocca più gli importi concordati
  if new.status in ('ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status) then
    return new;
  end if;
  if new.default_markup_percent is distinct from old.default_markup_percent then
    update quote_items set updated_at = now() where quote_id = new.id;
    perform quotes_recalc_totals(new.id);
  end if;
  return new;
end$function$;

-- ── SNAPSHOT-03 · quote_supplier_markup_after_change: idem per gli override
--    markup-per-fornitore ──────────────────────────────────────────────────
create or replace function public.quote_supplier_markup_after_change()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_quote uuid; v_status quote_status;
begin
  v_quote := coalesce(new.quote_id, old.quote_id);
  select status into v_status from public.quotes where id = v_quote;
  -- quote congelata: l'override non ricalcola gli importi concordati
  if v_status in ('ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status) then
    return coalesce(new, old);
  end if;
  update quote_items
     set updated_at = now()
   where quote_id = v_quote
     and (supplier_id = coalesce(new.supplier_id, old.supplier_id));
  perform quotes_recalc_totals(v_quote);
  return coalesce(new, old);
end$function$;

-- ── A-15 · quote_reopen: non si riapre una quote CONVERTITO_IN_CONTRATTO ─────
create or replace function public.quote_reopen(p_quote_id uuid)
returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid;
begin
  update public.quotes
     set closed_at = null
   where id = p_quote_id
     and (owner_id = auth.uid() or is_admin())
     and status <> 'CONVERTITO_IN_CONTRATTO'::quote_status   -- già a contratto: niente riapertura
   returning id into v_id;
  return v_id is not null;
end$function$;

-- ── A-14 · quote_conclude_by_client: si conclude solo una quote ACCETTATO/
--    CONVERTITO (non una INVIATO mai accettata) ───────────────────────────────
create or replace function public.quote_conclude_by_client(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_owner_email text; v_status quote_status; v_add jsonb;
begin
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  select lower(client_email), status into v_owner_email, v_status from public.quotes where id = p_quote_id;
  if v_owner_email is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner_email is distinct from v_email then return jsonb_build_object('error','forbidden'); end if;
  if v_status not in ('ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status) then
    return jsonb_build_object('error','not_accepted');   -- non si congela un preventivo non accettato
  end if;

  update public.quotes set closed_at = coalesce(closed_at, now()) where id = p_quote_id;
  v_add := public._addendum_build(p_quote_id);
  return jsonb_build_object('ok', true, 'closed', true, 'addendum', v_add);
end$function$;

-- ── A-12 · client_decide_quote_item: non si ridecide una voce già a contratto
--    (contracted_at valorizzato) o su quote CONVERTITO_IN_CONTRATTO ───────────
create or replace function public.client_decide_quote_item(p_item_id uuid, p_decision text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_quote uuid; v_owner text; v_closed timestamptz; v_qstatus quote_status; v_contracted timestamptz;
  v_accepted numeric; v_pending numeric; v_forse numeric;
begin
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  if p_decision not in ('ACCETTATO','RIFIUTATO','IN_ATTESA','FORSE') then
    return jsonb_build_object('error','bad_decision');
  end if;

  select qi.quote_id, lower(q.client_email), q.closed_at, q.status, qi.contracted_at
    into v_quote, v_owner, v_closed, v_qstatus, v_contracted
    from public.quote_items qi join public.quotes q on q.id = qi.quote_id
   where qi.id = p_item_id;
  if v_quote is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner is distinct from v_email then return jsonb_build_object('error','forbidden'); end if;
  if v_closed is not null then return jsonb_build_object('error','closed'); end if;
  -- voce già contrattualizzata / quote a contratto: decisione congelata
  if v_contracted is not null or v_qstatus = 'CONVERTITO_IN_CONTRATTO'::quote_status then
    return jsonb_build_object('error','contracted');
  end if;

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
end$function$;
