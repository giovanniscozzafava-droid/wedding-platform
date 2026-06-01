-- ============================================================================
-- Crediti tra fornitori (rete P2P che si auto-organizza senza capostipite)
-- ----------------------------------------------------------------------------
-- Se il fornitore A segnala il fornitore B a un cliente, B riconosce ad A un
-- CREDITO (default ~100€). Ogni professionista decide come "spenderlo":
--   • in denaro (CASH)
--   • restituendo la segnalazione (RECIPROCAL): B segnala A su un'altra coppia/
--     battesimo/laurea → il credito si compensa.
-- Il ledger tiene sempre traccia di chi è CREDITORE e chi è DEBITORE.
-- ============================================================================

create table if not exists public.supplier_credits (
  id             uuid primary key default gen_random_uuid(),
  creditor_id    uuid not null references public.profiles(id) on delete cascade,  -- chi ha segnalato (a credito)
  debtor_id      uuid not null references public.profiles(id) on delete cascade,  -- chi ha ricevuto la segnalazione (a debito)
  amount         numeric(10,2) not null default 100 check (amount >= 0),
  currency       text not null default 'EUR',
  reason         text,
  event_kind     text,
  client_label   text,                  -- riferimento cliente/evento (no PII obbligatoria)
  status         text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','SETTLED','CANCELLED','DISPUTED')),
  settlement_type text check (settlement_type in ('CASH','RECIPROCAL')),
  offset_credit_id uuid references public.supplier_credits(id) on delete set null, -- credito reciproco che compensa
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  settled_at     timestamptz,
  check (creditor_id <> debtor_id)
);
create index if not exists idx_supplier_credits_creditor on public.supplier_credits(creditor_id, status);
create index if not exists idx_supplier_credits_debtor on public.supplier_credits(debtor_id, status);

drop trigger if exists trg_supplier_credits_upd on public.supplier_credits;
create trigger trg_supplier_credits_upd before update on public.supplier_credits
  for each row execute function public.set_updated_at();

alter table public.supplier_credits enable row level security;
-- Entrambe le parti vedono il credito; scrittura via RPC SECURITY DEFINER.
drop policy if exists "credits_parties_select" on public.supplier_credits;
create policy "credits_parties_select" on public.supplier_credits
  for select using (creditor_id = auth.uid() or debtor_id = auth.uid() or is_admin());

-- Registra una segnalazione → nuovo credito (io sono il creditore/segnalatore)
create or replace function public.log_supplier_referral(
  p_debtor_id uuid, p_amount numeric default 100, p_reason text default null,
  p_event_kind text default null, p_client_label text default null
)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_debtor_id is null or p_debtor_id = v_uid then return jsonb_build_object('error','invalid_debtor'); end if;
  if not exists (select 1 from public.profiles where id = p_debtor_id and role = 'FORNITORE') then
    return jsonb_build_object('error','debtor_not_supplier');
  end if;
  insert into public.supplier_credits(creditor_id, debtor_id, amount, reason, event_kind, client_label, created_by, status)
  values (v_uid, p_debtor_id, coalesce(p_amount,100), p_reason, p_event_kind, p_client_label, v_uid, 'PENDING')
  returning id into v_id;
  perform public.push_user_notification(p_debtor_id, 'CREDIT_NEW',
    'Nuova segnalazione ricevuta',
    'Un collega ti ha segnalato a un cliente: hai un credito da riconoscere di ' || coalesce(p_amount,100)::text || '€',
    '/crediti', v_id);
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.log_supplier_referral(uuid, numeric, text, text, text) to authenticated;

-- Conferma il debito (il debitore accetta la segnalazione)
create or replace function public.accept_supplier_credit(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.supplier_credits%rowtype;
begin
  select * into v_c from public.supplier_credits where id = p_id;
  if v_c.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_c.debtor_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','not_debtor'); end if;
  update public.supplier_credits set status = 'ACCEPTED' where id = p_id and status = 'PENDING';
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.accept_supplier_credit(uuid) to authenticated;

-- Salda un credito: in denaro o restituendo la segnalazione (reciproco).
-- Per il reciproco, p_offset_id è un credito in cui i ruoli sono invertiti.
create or replace function public.settle_supplier_credit(p_id uuid, p_type text, p_offset_id uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.supplier_credits%rowtype; v_o public.supplier_credits%rowtype;
begin
  if p_type not in ('CASH','RECIPROCAL') then return jsonb_build_object('error','invalid_type'); end if;
  select * into v_c from public.supplier_credits where id = p_id;
  if v_c.id is null then return jsonb_build_object('error','not_found'); end if;
  -- Entrambe le parti possono registrare il saldo (rete fiduciaria)
  if v_uid not in (v_c.creditor_id, v_c.debtor_id) and not public.is_admin() then
    return jsonb_build_object('error','not_party');
  end if;

  if p_type = 'RECIPROCAL' and p_offset_id is not null then
    select * into v_o from public.supplier_credits where id = p_offset_id;
    -- il credito di compensazione deve avere i ruoli invertiti
    if v_o.id is null or v_o.creditor_id <> v_c.debtor_id or v_o.debtor_id <> v_c.creditor_id then
      return jsonb_build_object('error','invalid_offset');
    end if;
    update public.supplier_credits set status='SETTLED', settlement_type='RECIPROCAL',
           offset_credit_id = p_offset_id, settled_at = now() where id = p_id;
    update public.supplier_credits set status='SETTLED', settlement_type='RECIPROCAL',
           offset_credit_id = p_id, settled_at = now() where id = p_offset_id and status <> 'SETTLED';
  else
    update public.supplier_credits set status='SETTLED', settlement_type = p_type, settled_at = now()
     where id = p_id;
  end if;

  perform public.push_user_notification(
    case when v_uid = v_c.debtor_id then v_c.creditor_id else v_c.debtor_id end,
    'CREDIT_SETTLED', 'Credito saldato',
    'Un credito tra colleghi è stato segnato come saldato (' || p_type || ')', '/crediti', p_id);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.settle_supplier_credit(uuid, text, uuid) to authenticated;

create or replace function public.cancel_supplier_credit(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_c public.supplier_credits%rowtype;
begin
  select * into v_c from public.supplier_credits where id = p_id;
  if v_c.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_uid not in (v_c.creditor_id, v_c.debtor_id) and not public.is_admin() then return jsonb_build_object('error','not_party'); end if;
  update public.supplier_credits set status='CANCELLED' where id = p_id and status in ('PENDING','ACCEPTED','DISPUTED');
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.cancel_supplier_credit(uuid) to authenticated;

-- Bilanci netti per controparte (chi mi deve / a chi devo)
create or replace function public.supplier_credit_balances()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(jsonb_agg(row order by abs(net) desc), '[]'::jsonb) into v_res
  from (
    select jsonb_build_object(
      'counterpart_id', cp,
      'counterpart_name', coalesce(pr.business_name, pr.full_name),
      'subrole', pr.subrole,
      'net', net,                         -- >0 = la controparte mi deve; <0 = io devo
      'open_count', open_count
    ) as row, net
    from (
      select cp,
        sum(case when role_self='creditor' then amount else -amount end) as net,
        count(*) as open_count
      from (
        select debtor_id as cp, amount, 'creditor' as role_self
          from public.supplier_credits where creditor_id = v_uid and status in ('PENDING','ACCEPTED')
        union all
        select creditor_id as cp, amount, 'debtor' as role_self
          from public.supplier_credits where debtor_id = v_uid and status in ('PENDING','ACCEPTED')
      ) x group by cp
    ) agg join public.profiles pr on pr.id = agg.cp
    where net <> 0
  ) q;
  return jsonb_build_object('ok', true, 'balances', v_res);
end$$;
grant execute on function public.supplier_credit_balances() to authenticated;

-- Lista crediti (per la pagina), con nomi controparte
create or replace function public.list_supplier_credits()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'amount', c.amount, 'status', c.status, 'reason', c.reason,
    'event_kind', c.event_kind, 'client_label', c.client_label,
    'settlement_type', c.settlement_type, 'created_at', c.created_at, 'settled_at', c.settled_at,
    'i_am_creditor', (c.creditor_id = v_uid),
    'creditor_name', coalesce(pc.business_name, pc.full_name),
    'debtor_name', coalesce(pd.business_name, pd.full_name),
    'counterpart_id', case when c.creditor_id = v_uid then c.debtor_id else c.creditor_id end
  ) order by c.created_at desc), '[]'::jsonb) into v_res
  from public.supplier_credits c
  join public.profiles pc on pc.id = c.creditor_id
  join public.profiles pd on pd.id = c.debtor_id
  where c.creditor_id = v_uid or c.debtor_id = v_uid;
  return jsonb_build_object('ok', true, 'credits', v_res);
end$$;
grant execute on function public.list_supplier_credits() to authenticated;

comment on table public.supplier_credits is
  'Ledger crediti tra fornitori: A segnala B → B deve un credito ad A. Saldabile in denaro o con segnalazione reciproca. Tiene traccia di creditore/debitore.';
