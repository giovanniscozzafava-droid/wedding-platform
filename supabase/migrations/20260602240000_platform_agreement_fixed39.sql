-- ============================================================================
-- Condizioni della piattaforma (il "contratto che i professionisti firmano con
-- noi"): crediti 39€ fissi, commissione futura riservata, trattamento dati.
-- Il professionista le spunta (e le apre) in registrazione e nel profilo.
-- + Credito segnalazione FISSO a 39€ ; saldo reciproco solo a PARI IMPORTO.
-- ============================================================================

alter table public.profiles
  add column if not exists platform_terms_accepted_at timestamptz,
  add column if not exists platform_terms_version int;

-- Testo ufficiale delle condizioni (versione corrente = 1)
create or replace function public.platform_agreement()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'version', 1,
    'title', 'Condizioni di utilizzo di Planfully',
    'clauses', jsonb_build_array(
      jsonb_build_object('key','credits',
        'text','Crediti tra professionisti: per ogni segnalazione di un collega che si trasforma in un contratto firmato è riconosciuto un credito FISSO di 39€ tra i professionisti coinvolti.'),
      jsonb_build_object('key','future_commission',
        'text','Commissione della piattaforma: Planfully (Fuyue Srl) si riserva il diritto di introdurre e/o modificare in futuro una commissione sulle segnalazioni e, più in generale, le condizioni economiche e di servizio. Tutto può cambiare e ci riserviamo di farlo.'),
      jsonb_build_object('key','data',
        'text','Trattamento dati: i dati inseriti e gestiti tramite Planfully sono trattati da Fuyue Srl, titolare del marchio, secondo l''informativa privacy e per le finalità del servizio.'),
      jsonb_build_object('key','updates',
        'text','Aggiornamenti: le presenti condizioni potranno essere aggiornate. L''uso continuato del servizio costituisce accettazione delle versioni aggiornate.')
    )
  );
$$;
grant execute on function public.platform_agreement() to anon, authenticated;

create or replace function public.accept_platform_agreement()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  update public.profiles
     set platform_terms_accepted_at = now(),
         platform_terms_version = (public.platform_agreement()->>'version')::int
   where id = v_uid;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.accept_platform_agreement() to authenticated;

-- handle_new_auth_user: registra l'accettazione delle condizioni se fornita
create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare v_role user_role; v_subrole text; v_full text; v_invite supplier_invites%rowtype; v_token_text text; v_accept boolean; v_terms boolean;
begin
  v_role    := coalesce((new.raw_user_meta_data->>'role')::user_role, 'WEDDING_PLANNER');
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';
  v_accept  := (new.raw_user_meta_data->>'accept_referrals')::boolean;
  v_terms   := coalesce((new.raw_user_meta_data->>'platform_terms')::boolean, false);
  if v_token_text is not null then
    select * into v_invite from supplier_invites where token = v_token_text::uuid and status = 'PENDING' and expires_at > now() limit 1;
    if found then v_role := 'FORNITORE'; if v_subrole is null then v_subrole := v_invite.subrole_hint; end if; end if;
  end if;
  insert into public.profiles (id, role, subrole, full_name, onboarding_complete, accept_referrals,
                               platform_terms_accepted_at, platform_terms_version)
  values (new.id, v_role, v_subrole, v_full, (v_role = 'CLIENT'), coalesce(v_accept,false),
          case when v_terms then now() else null end, case when v_terms then 1 else null end)
  on conflict (id) do update
    set role = excluded.role,
        subrole = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name),
        accept_referrals = coalesce(v_accept, profiles.accept_referrals),
        platform_terms_accepted_at = coalesce(excluded.platform_terms_accepted_at, profiles.platform_terms_accepted_at),
        platform_terms_version = coalesce(excluded.platform_terms_version, profiles.platform_terms_version);
  return new;
end$$;

-- 39€ FISSO: il credito segnalazione è sempre 39, non personalizzabile
update public.profiles set referral_credit = 39 where referral_credit is distinct from 39;

create or replace function public.log_supplier_referral(
  p_debtor_id uuid, p_amount numeric default null, p_reason text default null,
  p_event_kind text default null, p_client_label text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_accept boolean; v_amt numeric := 39;  -- FISSO
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_debtor_id is null or p_debtor_id = v_uid then return jsonb_build_object('error','invalid_debtor'); end if;
  select accept_referrals into v_accept from public.profiles where id = p_debtor_id and role = 'FORNITORE';
  if v_accept is null then return jsonb_build_object('error','debtor_not_supplier'); end if;
  if coalesce(v_accept,false) = false then return jsonb_build_object('error','debtor_not_referrable'); end if;
  insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, reason, event_kind, client_label, created_by, status)
  values (v_uid, p_debtor_id, v_amt, public.referral_commission_for(v_amt), p_reason, p_event_kind, p_client_label, v_uid, 'PENDING')
  returning id into v_id;
  perform public.push_user_notification(p_debtor_id, 'CREDIT_NEW', 'Nuova segnalazione ricevuta',
    'Un collega ti ha segnalato a un cliente: credito da riconoscere di 39€', '/crediti', v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.log_supplier_referral(uuid, numeric, text, text, text) to authenticated;

create or replace function public.autocredit_on_referred_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_credit uuid; v_amt numeric := 39; v_first boolean := true;  -- FISSO 39
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.client_email is not null then
    for r in
      select * from public.supplier_referrals
       where suggested_id = new.owner_id and lower(client_email) = lower(new.client_email) and status = 'SUGGESTED'
       order by created_at asc
    loop
      if v_first then
        insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, reason, event_kind, client_label, created_by, status)
        values (r.referrer_id, new.owner_id, v_amt, public.referral_commission_for(v_amt),
                'Segnalazione convertita in contratto', coalesce(new.event_kind, r.event_kind), coalesce(new.client_name, r.client_name), r.referrer_id, 'ACCEPTED')
        returning id into v_credit;
        update public.supplier_referrals set status='CONVERTED', credit_id=v_credit, contract_id=new.id, converted_at=now() where id = r.id;
        perform public.push_user_notification(r.referrer_id, 'CREDIT_AUTO', 'Segnalazione andata a buon fine',
          'Un cliente che hai segnalato ha firmato un contratto: +39€ di credito', '/crediti', v_credit);
        v_first := false;
      else
        update public.supplier_referrals set status='CONVERTED', contract_id=new.id, converted_at=now() where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end$$;

-- Saldo reciproco solo a PARI IMPORTO
create or replace function public.settle_supplier_credit(p_id uuid, p_type text, p_offset_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.supplier_credits%rowtype; v_o public.supplier_credits%rowtype;
begin
  if p_type not in ('CASH','RECIPROCAL') then return jsonb_build_object('error','invalid_type'); end if;
  select * into v_c from public.supplier_credits where id = p_id;
  if v_c.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_c.status = 'SETTLED' then return jsonb_build_object('error','already_settled'); end if;
  if v_uid not in (v_c.creditor_id, v_c.debtor_id) and not public.is_admin() then return jsonb_build_object('error','not_party'); end if;

  if p_type = 'RECIPROCAL' and p_offset_id is not null then
    select * into v_o from public.supplier_credits where id = p_offset_id;
    if v_o.id is null or v_o.creditor_id <> v_c.debtor_id or v_o.debtor_id <> v_c.creditor_id then
      return jsonb_build_object('error','invalid_offset');
    end if;
    if v_o.status in ('SETTLED','CANCELLED') then return jsonb_build_object('error','offset_not_open'); end if;
    if v_o.amount <> v_c.amount then return jsonb_build_object('error','offset_amount_mismatch'); end if;  -- pari importo
    update public.supplier_credits set status='SETTLED', settlement_type='RECIPROCAL', offset_credit_id = p_offset_id, settled_at = now() where id = p_id;
    update public.supplier_credits set status='SETTLED', settlement_type='RECIPROCAL', offset_credit_id = p_id, settled_at = now() where id = p_offset_id;
  else
    update public.supplier_credits set status='SETTLED', settlement_type = p_type, settled_at = now() where id = p_id;
  end if;
  perform public.push_user_notification(case when v_uid = v_c.debtor_id then v_c.creditor_id else v_c.debtor_id end,
    'CREDIT_SETTLED', 'Credito saldato', 'Un credito tra colleghi è stato segnato come saldato (' || p_type || ')', '/crediti', p_id);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.settle_supplier_credit(uuid, text, uuid) to authenticated;

comment on function public.platform_agreement() is 'Testo ufficiale delle condizioni piattaforma che i professionisti accettano (crediti 39€, commissione futura riservata, dati, aggiornamenti).';
