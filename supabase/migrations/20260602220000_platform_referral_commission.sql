-- ============================================================================
-- Commissione FUTURA della piattaforma sulle segnalazioni tra fornitori.
-- Importo ancora da definire: si tiene traccia di una commissione per ogni
-- credito generato da una segnalazione. La percentuale è in platform_config
-- (default 0 = nessuna commissione finché non verrà decisa).
-- ============================================================================

create table if not exists public.platform_config (
  key       text primary key,
  num_value numeric,
  note      text,
  updated_at timestamptz not null default now()
);
alter table public.platform_config enable row level security;
drop policy if exists "platform_config_read" on public.platform_config;
create policy "platform_config_read" on public.platform_config for select using (true);
drop policy if exists "platform_config_admin" on public.platform_config;
create policy "platform_config_admin" on public.platform_config for all using (is_admin()) with check (is_admin());

insert into public.platform_config(key, num_value, note) values
  ('referral_commission_pct', 0, 'Commissione % della piattaforma per ogni segnalazione tra fornitori. Da definire.')
on conflict (key) do nothing;

-- Commissione registrata su ogni credito da segnalazione
alter table public.supplier_credits add column if not exists platform_commission numeric(10,2) not null default 0;
comment on column public.supplier_credits.platform_commission is 'Commissione piattaforma (futura) calcolata sul credito. Per ora 0 finché la percentuale non è definita.';

create or replace function public.referral_commission_for(p_amount numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select round(coalesce(p_amount,0) * coalesce((select num_value from public.platform_config where key='referral_commission_pct'),0) / 100.0, 2);
$$;

-- log manuale: registra anche la commissione piattaforma
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
  insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, reason, event_kind, client_label, created_by, status)
  values (v_uid, p_debtor_id, v_amt, public.referral_commission_for(v_amt), p_reason, p_event_kind, p_client_label, v_uid, 'PENDING')
  returning id into v_id;
  perform public.push_user_notification(p_debtor_id, 'CREDIT_NEW', 'Nuova segnalazione ricevuta',
    'Un collega ti ha segnalato a un cliente: credito da riconoscere di ' || v_amt::text || '€', '/crediti', v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.log_supplier_referral(uuid, numeric, text, text, text) to authenticated;

-- autocredit: registra la commissione piattaforma
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
      insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, reason, event_kind, client_label, created_by, status)
      values (r.referrer_id, new.owner_id, coalesce(v_amt,39), public.referral_commission_for(coalesce(v_amt,39)),
              'Segnalazione convertita in contratto', coalesce(new.event_kind, r.event_kind),
              coalesce(new.client_name, r.client_name), r.referrer_id, 'ACCEPTED')
      returning id into v_credit;
      update public.supplier_referrals set status='CONVERTED', credit_id=v_credit, contract_id=new.id, converted_at=now() where id = r.id;
      perform public.push_user_notification(r.referrer_id, 'CREDIT_AUTO', 'Segnalazione andata a buon fine',
        'Un cliente che hai segnalato ha firmato un contratto: +' || coalesce(v_amt,39)::text || '€ di credito', '/crediti', v_credit);
    end loop;
  end if;
  return new;
end$$;

comment on table public.platform_config is 'Configurazioni piattaforma (es. percentuale commissione segnalazioni, ancora da definire).';
