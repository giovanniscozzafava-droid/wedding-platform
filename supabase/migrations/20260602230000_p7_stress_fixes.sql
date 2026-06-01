-- ============================================================================
-- P7 — Fix emersi dal mega stress test
-- ============================================================================

-- 1) quote_get_by_token: rifiuta token revocati/scaduti + maschera i prezzi
--    finché il cliente non ha registrato il consenso (regola "prezzo solo dopo
--    iscrizione"). Prezzi visibili se: consenso registrato OPPURE preventivo
--    già deciso (ACCETTATO/RIFIUTATO/CONVERTITO — il prezzo non è più sensibile).
create or replace function public.quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_quote quotes%rowtype; v_items jsonb; v_owner record;
  v_business_model text := 'GLOBAL'; v_reveal boolean;
begin
  select * into v_quote from public.quotes where access_token = p_token;
  if v_quote.id is null then return null; end if;
  -- Token revocato o scaduto → non accessibile
  if v_quote.token_revoked_at is not null
     or (v_quote.access_token_expires_at is not null and v_quote.access_token_expires_at <= now()) then
    return jsonb_build_object('error','token_not_valid');
  end if;

  v_reveal := v_quote.status not in ('BOZZA','INVIATO')
              or exists (select 1 from public.quote_view_consents c where c.quote_id = v_quote.id);

  select ce.business_model into v_business_model
    from public.calendar_entries ce where ce.quote_id = v_quote.id limit 1;
  v_business_model := coalesce(v_business_model, 'GLOBAL');

  select jsonb_agg(
           case when v_business_model = 'GLOBAL'
                then (to_jsonb(qi) - 'supplier_id') else to_jsonb(qi) end
           - (case when v_reveal then '__none__' else 'line_client' end)
           order by qi.sort_order)
    into v_items
    from public.quote_items qi where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url, brand_primary_color,
         brand_secondary_color, role, subrole, city
    into v_owner from public.profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id', v_quote.id, 'title', v_quote.title, 'client_name', v_quote.client_name,
    'client_email', v_quote.client_email, 'event_date', v_quote.event_date,
    'event_kind', v_quote.event_kind, 'event_location', v_quote.event_location,
    'guest_count', v_quote.guest_count, 'status', v_quote.status, 'revision', v_quote.revision,
    'total_client', case when v_reveal then v_quote.total_client else null end,
    'price_locked', not v_reveal,
    'pdf_url', case when v_reveal then v_quote.pdf_url else null end,
    'pdf_variant', v_quote.pdf_variant, 'direct_client_id', v_quote.direct_client_id,
    'business_model', v_business_model, 'owner', to_jsonb(v_owner),
    'items', coalesce(v_items, '[]'::jsonb)
  );
end$$;
grant execute on function public.quote_get_by_token(uuid) to anon, authenticated;

-- 2) party_kind guard anche su UPDATE (prima solo INSERT)
drop trigger if exists trg_contracts_party_kind on public.contracts;
create trigger trg_contracts_party_kind before insert or update of party_kind, direct_client_id on public.contracts
  for each row execute function public.enforce_contract_party_kind();

-- 3) handle_new_auth_user: preserva accept_referrals se non fornito (re-auth)
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_role user_role; v_subrole text; v_full text; v_invite supplier_invites%rowtype; v_token_text text; v_accept boolean;
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';
  v_accept  := (new.raw_user_meta_data->>'accept_referrals')::boolean;  -- può essere null
  if v_token_text is not null then
    select * into v_invite from supplier_invites where token = v_token_text::uuid and status = 'PENDING' and expires_at > now() limit 1;
    if found then v_role := 'FORNITORE'; if v_subrole is null then v_subrole := v_invite.subrole_hint; end if; end if;
  end if;
  insert into public.profiles (id, role, subrole, full_name, onboarding_complete, accept_referrals)
  values (new.id, v_role, v_subrole, v_full, (v_role = 'CLIENT'), coalesce(v_accept,false))
  on conflict (id) do update
    set role = excluded.role,
        subrole = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name),
        accept_referrals = coalesce(v_accept, profiles.accept_referrals);
  return new;
end$$;

-- 4) Contratto FIRMATO capacity-aware: crea appuntamento EVENTO + recompute
create or replace function auto_block_availability_from_contract()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status <> 'FIRMATO' or NEW.event_date is null then return NEW; end if;
  if NEW.direct_client_id is not null then
    insert into public.supplier_appointments(owner_id, kind, title, date, source_contract_id, notes)
    select NEW.owner_id, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.id, 'Da contratto firmato'
    where not exists (select 1 from public.supplier_appointments where source_contract_id = NEW.id);
    perform public.recompute_day_availability(NEW.owner_id, NEW.event_date);
  end if;
  if NEW.direct_client_id is null and NEW.quote_id is not null then
    insert into public.supplier_appointments(owner_id, kind, title, date, source_contract_id, notes)
    select distinct qi.supplier_id, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.id, 'Voce contratto firmato'
      from public.quote_items qi where qi.quote_id = NEW.quote_id and qi.supplier_id is not null
        and not exists (select 1 from public.supplier_appointments a where a.source_contract_id = NEW.id and a.owner_id = qi.supplier_id);
    perform public.recompute_day_availability(s.supplier_id, NEW.event_date)
      from (select distinct supplier_id from public.quote_items where quote_id = NEW.quote_id and supplier_id is not null) s;
  end if;
  return NEW;
end$$;

-- 5) Rilascio su regressione: elimina anche l'appuntamento orfano + recompute
create or replace function public.release_availability_on_quote_regression()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_has_signed boolean;
begin
  if (old.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
     and (new.status not in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
     and new.event_date is not null then
    select exists(select 1 from public.contracts c where c.quote_id = new.id and c.status = 'FIRMATO') into v_has_signed;
    if not v_has_signed then
      -- rimuovi l'appuntamento EVENTO agganciato a questo preventivo
      delete from public.supplier_appointments where source_quote_id = new.id;
      perform public.recompute_day_availability(new.owner_id, new.event_date);
      update public.supplier_availability sa
         set status = 'AVAILABLE'::supplier_avail_status, notes = 'Liberata: trattativa non confermata', updated_at = now()
       where sa.fornitore_id = new.owner_id and sa.date = new.event_date
         and sa.status in ('BUSY','BLOCKED_BY_ACCEPTED_QUOTE','TENTATIVE')
         and not exists (select 1 from public.quotes q2 where q2.owner_id = new.owner_id and q2.event_date = new.event_date and q2.id <> new.id and q2.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO'))
         and not exists (select 1 from public.supplier_appointments a where a.owner_id = new.owner_id and a.date = new.event_date and a.kind in ('EVENTO','APPUNTAMENTO','BLOCCO','VACANZA'));
      perform public.log_access('quotes', new.id::text, 'WRITE', jsonb_build_object('op','availability_released_on_regression'));
    end if;
  end if;
  return new;
end$$;

-- 6) autocredit: UN SOLO credito per conversione (il debitore paga una volta)
create or replace function public.autocredit_on_referred_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_credit uuid; v_amt numeric; v_first boolean := true;
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.client_email is not null then
    select coalesce(referral_credit, 39) into v_amt from public.profiles where id = new.owner_id;
    for r in
      select * from public.supplier_referrals
       where suggested_id = new.owner_id and lower(client_email) = lower(new.client_email) and status = 'SUGGESTED'
       order by created_at asc
    loop
      if v_first then
        insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, reason, event_kind, client_label, created_by, status)
        values (r.referrer_id, new.owner_id, coalesce(v_amt,39), public.referral_commission_for(coalesce(v_amt,39)),
                'Segnalazione convertita in contratto', coalesce(new.event_kind, r.event_kind), coalesce(new.client_name, r.client_name), r.referrer_id, 'ACCEPTED')
        returning id into v_credit;
        update public.supplier_referrals set status='CONVERTED', credit_id=v_credit, contract_id=new.id, converted_at=now() where id = r.id;
        perform public.push_user_notification(r.referrer_id, 'CREDIT_AUTO', 'Segnalazione andata a buon fine',
          'Un cliente che hai segnalato ha firmato un contratto: +' || coalesce(v_amt,39)::text || '€ di credito', '/crediti', v_credit);
        v_first := false;
      else
        -- altre segnalazioni per lo stesso cliente/collega: convertite senza ulteriore credito
        update public.supplier_referrals set status='CONVERTED', contract_id=new.id, converted_at=now() where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end$$;

-- 7) create_quote_from_supplier_lead: email vuota → null (non '')
create or replace function public.create_quote_from_supplier_lead(p_lead_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_lead public.supplier_leads%rowtype; v_client public.supplier_clients%rowtype; v_quote uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_lead from public.supplier_leads where id = p_lead_id;
  if v_lead.id is null then return jsonb_build_object('error','lead_not_found'); end if;
  if v_lead.supplier_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  if v_lead.converted_quote_id is not null then return jsonb_build_object('ok', true, 'quote_id', v_lead.converted_quote_id, 'reused', true); end if;
  if v_lead.supplier_client_id is not null then select * into v_client from public.supplier_clients where id = v_lead.supplier_client_id; end if;

  insert into public.quotes (owner_id, title, client_name, client_email, event_date, event_location, event_kind,
    status, revision, default_markup_percent, total_cost, total_client, margin_amount, margin_percent, direct_client_id, quote_origin)
  values (v_uid, coalesce(nullif(trim(v_client.full_name),''), 'Nuovo cliente') || ' — preventivo',
    v_client.full_name, nullif(trim(coalesce(v_client.email,'')),''), v_lead.event_date_from, v_lead.event_location,
    coalesce(v_lead.event_kind,'altro'), 'BOZZA', 1, 0, 0, 0, 0, 0, v_lead.supplier_client_id, 'SUPPLIER_PUBLIC_LEAD')
  returning id into v_quote;

  if v_lead.questionnaire_payload is not null and v_lead.questionnaire_payload <> '{}'::jsonb then
    insert into public.quote_questionnaire_answers (quote_id, event_kind, answers, completed_at)
    values (v_quote, coalesce(v_lead.event_kind,'altro'), v_lead.questionnaire_payload, null)
    on conflict (quote_id) do update set answers = excluded.answers, event_kind = excluded.event_kind;
  end if;
  update public.supplier_leads set status = 'QUOTE_CREATED', converted_quote_id = v_quote, converted_at = now() where id = p_lead_id;
  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'reused', false);
end$$;
grant execute on function public.create_quote_from_supplier_lead(uuid) to authenticated;
