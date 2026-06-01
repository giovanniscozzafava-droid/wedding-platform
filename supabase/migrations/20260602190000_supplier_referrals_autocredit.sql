-- ============================================================================
-- Segnalazioni fornitore → cliente + accredito automatico del credito
-- ----------------------------------------------------------------------------
-- Dentro un preventivo/contratto firmato, il fornitore (o WP) suggerisce al
-- cliente alcuni COLLEGHI CHE SEGUE (relazione follows, non "in pancia").
-- Se il cliente poi firma un contratto con uno di quei colleghi (stessa email),
-- si accredita IN AUTOMATICO un credito di 100€ a chi ha segnalato.
-- Decisioni: match per email cliente · 100€ fisso · disponibile dopo firma
-- preventivo (ACCETTATO) o contratto (FIRMATO).
-- ============================================================================

create table if not exists public.supplier_referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.profiles(id) on delete cascade,  -- chi suggerisce (segue il collega)
  suggested_id uuid not null references public.profiles(id) on delete cascade,  -- il collega suggerito
  client_email text not null,
  client_name  text,
  quote_id     uuid references public.quotes(id) on delete set null,
  contract_id  uuid references public.contracts(id) on delete set null,
  event_kind   text,
  status       text not null default 'SUGGESTED' check (status in ('SUGGESTED','CONVERTED','CANCELLED')),
  credit_id    uuid references public.supplier_credits(id) on delete set null,
  created_at   timestamptz not null default now(),
  converted_at timestamptz,
  unique (referrer_id, suggested_id, client_email),
  check (referrer_id <> suggested_id)
);
create index if not exists idx_referrals_suggested_email on public.supplier_referrals(suggested_id, lower(client_email)) where status = 'SUGGESTED';
create index if not exists idx_referrals_referrer on public.supplier_referrals(referrer_id);

alter table public.supplier_referrals enable row level security;
-- Vedono la segnalazione: chi segnala, il collega suggerito, admin.
drop policy if exists "referrals_parties_select" on public.supplier_referrals;
create policy "referrals_parties_select" on public.supplier_referrals
  for select using (referrer_id = auth.uid() or suggested_id = auth.uid() or is_admin());

-- Suggerisci una lista di colleghi (che SEGUI) al cliente del preventivo.
create or replace function public.suggest_suppliers_to_client(p_quote_id uuid, p_suggested_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_q public.quotes%rowtype;
  v_signed boolean;
  v_count int := 0;
  v_sid uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_q from public.quotes where id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','quote_not_found'); end if;
  if v_q.owner_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_owner'); end if;
  -- Disponibile solo dopo firma preventivo o contratto
  select exists(select 1 from public.contracts c where c.quote_id = p_quote_id and c.status = 'FIRMATO') into v_signed;
  if not (v_q.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') or v_signed) then
    return jsonb_build_object('error','quote_not_signed');
  end if;
  if v_q.client_email is null then return jsonb_build_object('error','no_client_email'); end if;

  foreach v_sid in array coalesce(p_suggested_ids, '{}') loop
    -- Solo colleghi che il referrer SEGUE (follows APPROVED) e che sono fornitori
    if v_sid <> v_uid
       and exists (select 1 from public.follows f where f.follower_id = v_uid and f.followed_id = v_sid and f.status = 'APPROVED')
       and exists (select 1 from public.profiles p where p.id = v_sid and p.role = 'FORNITORE')
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

-- I colleghi che seguo (per la UI di selezione)
create or replace function public.followed_suppliers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', coalesce(p.business_name, p.full_name), 'subrole', p.subrole, 'city', p.city
  ) order by coalesce(p.business_name, p.full_name)), '[]'::jsonb) into v_res
  from public.follows f join public.profiles p on p.id = f.followed_id
  where f.follower_id = v_uid and f.status = 'APPROVED' and p.role = 'FORNITORE';
  return jsonb_build_object('ok', true, 'suppliers', v_res);
end$$;
grant execute on function public.followed_suppliers() to authenticated;

-- Fornitori consigliati al cliente (vista lato area cliente, per email verificata)
create or replace function public.client_suggested_suppliers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_email text; v_res jsonb;
begin
  begin v_email := lower(coalesce(nullif(current_setting('request.jwt.claims', true),'')::jsonb ->> 'email','')); exception when others then v_email := ''; end;
  if v_email = '' then return jsonb_build_object('error','no_email'); end if;
  select coalesce(jsonb_agg(distinct jsonb_build_object(
    'suggested_id', p.id, 'name', coalesce(p.business_name, p.full_name), 'subrole', p.subrole,
    'slug', p.slug, 'suggested_by', coalesce(pr.business_name, pr.full_name)
  )), '[]'::jsonb) into v_res
  from public.supplier_referrals r
  join public.profiles p on p.id = r.suggested_id
  join public.profiles pr on pr.id = r.referrer_id
  where lower(r.client_email) = v_email and r.status in ('SUGGESTED','CONVERTED');
  return jsonb_build_object('ok', true, 'suppliers', v_res);
end$$;
grant execute on function public.client_suggested_suppliers() to authenticated;

-- ── Accredito AUTOMATICO: quando il collega suggerito firma un contratto con
--    lo stesso cliente (stessa email) → credito al referrer. ─────────────────
create or replace function public.autocredit_on_referred_contract()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; v_credit uuid;
begin
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.client_email is not null then
    for r in
      select * from public.supplier_referrals
       where suggested_id = new.owner_id
         and lower(client_email) = lower(new.client_email)
         and status = 'SUGGESTED'
    loop
      insert into public.supplier_credits(creditor_id, debtor_id, amount, reason, event_kind, client_label, created_by, status)
      values (r.referrer_id, new.owner_id, 100, 'Segnalazione convertita in contratto', coalesce(new.event_kind, r.event_kind),
              coalesce(new.client_name, r.client_name), r.referrer_id, 'ACCEPTED')
      returning id into v_credit;
      update public.supplier_referrals set status='CONVERTED', credit_id=v_credit, contract_id=new.id, converted_at=now()
       where id = r.id;
      perform public.push_user_notification(r.referrer_id, 'CREDIT_AUTO',
        'Segnalazione andata a buon fine',
        'Un cliente che hai segnalato ha firmato un contratto: +100€ di credito', '/crediti', v_credit);
    end loop;
  end if;
  return new;
end$$;
drop trigger if exists trg_autocredit_referred_contract on public.contracts;
create trigger trg_autocredit_referred_contract after update of status on public.contracts
  for each row execute function public.autocredit_on_referred_contract();

comment on table public.supplier_referrals is
  'Segnalazioni: il referrer suggerisce al cliente colleghi che SEGUE. Se il cliente firma un contratto col collega (stessa email), credito automatico di 100€ al referrer.';
