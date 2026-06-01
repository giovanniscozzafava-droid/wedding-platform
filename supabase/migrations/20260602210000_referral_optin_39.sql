-- ============================================================================
-- Opt-in segnalazioni + credito 39€
-- ----------------------------------------------------------------------------
-- In creazione profilo il fornitore sceglie esplicitamente se vuole ESSERE
-- SUGGERITO da altri fornitori, riconoscendo 39€ di credito per ogni
-- segnalazione andata a buon fine. Solo chi accetta può essere suggerito.
-- ============================================================================

alter table public.profiles
  add column if not exists accept_referrals boolean not null default false,
  add column if not exists referral_credit numeric(10,2) not null default 39;

comment on column public.profiles.accept_referrals is 'Il fornitore accetta di essere suggerito da altri fornitori, riconoscendo un credito a segnalazione.';
comment on column public.profiles.referral_credit is 'Credito riconosciuto per ogni segnalazione andata a buon fine (default 39€).';

-- Imposta l'opt-in (per i fornitori esistenti, dalla pagina Crediti)
create or replace function public.set_accept_referrals(p_value boolean, p_credit numeric default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  update public.profiles
     set accept_referrals = coalesce(p_value, false),
         referral_credit = coalesce(p_credit, referral_credit, 39)
   where id = v_uid;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.set_accept_referrals(boolean, numeric) to authenticated;

-- log manuale: importo di default = credito del debitore (opt-in) o 39
create or replace function public.log_supplier_referral(
  p_debtor_id uuid, p_amount numeric default null, p_reason text default null,
  p_event_kind text default null, p_client_label text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_amt numeric; v_accept boolean;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_debtor_id is null or p_debtor_id = v_uid then return jsonb_build_object('error','invalid_debtor'); end if;
  select accept_referrals, coalesce(referral_credit,39) into v_accept, v_amt
    from public.profiles where id = p_debtor_id and role = 'FORNITORE';
  if v_amt is null then return jsonb_build_object('error','debtor_not_supplier'); end if;
  if coalesce(v_accept,false) = false then return jsonb_build_object('error','debtor_not_referrable'); end if;
  v_amt := coalesce(p_amount, v_amt, 39);
  insert into public.supplier_credits(creditor_id, debtor_id, amount, reason, event_kind, client_label, created_by, status)
  values (v_uid, p_debtor_id, v_amt, p_reason, p_event_kind, p_client_label, v_uid, 'PENDING')
  returning id into v_id;
  perform public.push_user_notification(p_debtor_id, 'CREDIT_NEW',
    'Nuova segnalazione ricevuta',
    'Un collega ti ha segnalato a un cliente: credito da riconoscere di ' || v_amt::text || '€',
    '/crediti', v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.log_supplier_referral(uuid, numeric, text, text, text) to authenticated;

-- suggest: solo colleghi che SEGUI e che hanno accettato di essere suggeriti
create or replace function public.suggest_suppliers_to_client(p_quote_id uuid, p_suggested_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q public.quotes%rowtype; v_signed boolean; v_count int := 0; v_sid uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','quote_not_found'); end if;
  if v_q.owner_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  select exists(select 1 from public.contracts c where c.quote_id = p_quote_id and c.status = 'FIRMATO') into v_signed;
  if not (v_q.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') or v_signed) then
    return jsonb_build_object('error','quote_not_signed');
  end if;
  if v_q.client_email is null then return jsonb_build_object('error','no_client_email'); end if;

  foreach v_sid in array coalesce(p_suggested_ids, '{}') loop
    if v_sid <> v_uid
       and exists (select 1 from public.follows f where f.follower_id = v_uid and f.followed_id = v_sid and f.status = 'APPROVED')
       and exists (select 1 from public.profiles p where p.id = v_sid and p.role = 'FORNITORE' and p.accept_referrals = true)
    then
      insert into public.supplier_referrals(referrer_id, suggested_id, client_email, client_name, quote_id, event_kind)
      values (v_uid, v_sid, lower(v_q.client_email), v_q.client_name, p_quote_id, v_q.event_kind)
      on conflict (referrer_id, suggested_id, client_email) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'suggested', v_count);
end$$;
grant execute on function public.suggest_suppliers_to_client(uuid, uuid[]) to authenticated;

-- followed_suppliers: mostra solo i colleghi seguiti che accettano segnalazioni
create or replace function public.followed_suppliers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', coalesce(p.business_name, p.full_name), 'subrole', p.subrole, 'city', p.city,
    'credit', p.referral_credit
  ) order by coalesce(p.business_name, p.full_name)), '[]'::jsonb) into v_res
  from public.follows f join public.profiles p on p.id = f.followed_id
  where f.follower_id = v_uid and f.status = 'APPROVED' and p.role = 'FORNITORE' and p.accept_referrals = true;
  return jsonb_build_object('ok', true, 'suppliers', v_res);
end$$;
grant execute on function public.followed_suppliers() to authenticated;

-- autocredit: usa il credito dichiarato dal collega suggerito (default 39)
create or replace function public.autocredit_on_referred_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_credit uuid; v_amt numeric;
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.client_email is not null then
    select coalesce(referral_credit, 39) into v_amt from public.profiles where id = new.owner_id;
    for r in
      select * from public.supplier_referrals
       where suggested_id = new.owner_id and lower(client_email) = lower(new.client_email) and status = 'SUGGESTED'
    loop
      insert into public.supplier_credits(creditor_id, debtor_id, amount, reason, event_kind, client_label, created_by, status)
      values (r.referrer_id, new.owner_id, coalesce(v_amt,39), 'Segnalazione convertita in contratto',
              coalesce(new.event_kind, r.event_kind), coalesce(new.client_name, r.client_name), r.referrer_id, 'ACCEPTED')
      returning id into v_credit;
      update public.supplier_referrals set status='CONVERTED', credit_id=v_credit, contract_id=new.id, converted_at=now() where id = r.id;
      perform public.push_user_notification(r.referrer_id, 'CREDIT_AUTO',
        'Segnalazione andata a buon fine',
        'Un cliente che hai segnalato ha firmato un contratto: +' || coalesce(v_amt,39)::text || '€ di credito', '/crediti', v_credit);
    end loop;
  end if;
  return new;
end$$;
