-- ════════════════════════════════════════════════════════════════════════════
-- PILASTRO 2 — DENARO DI RETE (decisione: "conti + cruscotto", pagamenti a mano).
-- Finora la direzione del denaro BUNDLE/ITEMIZED era una promessa senza registro:
-- il fornitore consegnava dentro un pacchetto e rincorreva i soldi offline.
-- Qui creiamo il registro:
--   • BUNDLE  (blind): il capostipite incassa dal cliente e DEVE al fornitore il COSTO.
--   • ITEMIZED (voci): il fornitore incassa dal cliente e DEVE al capostipite il MARGINE.
-- Popolato all'accettazione. Pagamenti segnati a mano (Stripe un domani). Tutto dietro
-- il flag network_finance (spento in beta): la tabella/trigger esistono ma il cruscotto
-- si accende quando vuoi.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.network_settlements (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null references public.quotes(id) on delete cascade,
  entry_id       uuid references public.calendar_entries(id) on delete set null,
  capostipite_id uuid not null references public.profiles(id) on delete cascade,
  supplier_id    uuid not null references public.profiles(id) on delete cascade,
  direction      text not null check (direction in ('CAPOSTIPITE_OWES_SUPPLIER','SUPPLIER_OWES_CAPOSTIPITE')),
  amount_due     numeric(12,2) not null default 0 check (amount_due >= 0),
  amount_paid    numeric(12,2) not null default 0 check (amount_paid >= 0),
  status         text not null default 'MATURATO' check (status in ('MATURATO','PARZIALE','SALDATO')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (quote_id, supplier_id)
);
create index if not exists idx_network_settlements_capo on public.network_settlements(capostipite_id);
create index if not exists idx_network_settlements_supp on public.network_settlements(supplier_id);

alter table public.network_settlements enable row level security;
-- Lettura: il capostipite vede i propri conti, il fornitore quelli che lo riguardano, admin tutto.
-- Scrittura: SOLO via le RPC/trigger SECURITY DEFINER (nessuna policy insert/update per authenticated).
drop policy if exists ns_select on public.network_settlements;
create policy ns_select on public.network_settlements for select using (
  capostipite_id = auth.uid() or supplier_id = auth.uid() or public.is_admin()
);

-- ── Popolamento: una riga per (preventivo, fornitore terzo), all'accettazione. ──
create or replace function public._populate_network_settlements(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mode text; v_entry uuid;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return; end if;
  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from public.profiles where id = v_owner;
  select id into v_entry from public.calendar_entries where quote_id = p_quote_id limit 1;

  insert into public.network_settlements (quote_id, entry_id, capostipite_id, supplier_id, direction, amount_due)
  select p_quote_id, v_entry, v_owner, t.supplier_id, t.direction, t.amount
  from (
    select qi.supplier_id,
           case when v_mode = 'ITEMIZED' then 'SUPPLIER_OWES_CAPOSTIPITE' else 'CAPOSTIPITE_OWES_SUPPLIER' end as direction,
           -- BUNDLE: il capostipite deve il COSTO; ITEMIZED: il fornitore deve il MARGINE.
           case when v_mode = 'ITEMIZED' then round(sum(qi.line_client - qi.line_cost), 2)
                else round(sum(qi.line_cost), 2) end as amount
      from public.quote_items qi
     where qi.quote_id = p_quote_id
       and qi.supplier_id is not null
       and qi.supplier_id <> v_owner                            -- non con te stesso
       and coalesce(qi.erogatore_e_capostipite, false) = false  -- non i servizi propri
     group by qi.supplier_id
  ) t
  where t.amount > 0
  on conflict (quote_id, supplier_id) do update
    set amount_due = excluded.amount_due,
        direction  = excluded.direction,
        status     = case when public.network_settlements.amount_paid >= excluded.amount_due then 'SALDATO'
                          when public.network_settlements.amount_paid > 0 then 'PARZIALE'
                          else 'MATURATO' end,
        updated_at = now();
end$$;

create or replace function public._tg_network_settlements_on_accept()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ACCETTATO' and coalesce(old.status::text, '') <> 'ACCETTATO' then
    perform public._populate_network_settlements(new.id);
  end if;
  return new;
end$$;

drop trigger if exists trg_network_settlements_on_accept on public.quotes;
create trigger trg_network_settlements_on_accept
  after update of status on public.quotes
  for each row execute function public._tg_network_settlements_on_accept();

-- ── Segna un pagamento a mano (solo il capostipite proprietario del conto). ──
create or replace function public.mark_settlement_paid(p_id uuid, p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_row public.network_settlements%rowtype;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_row from public.network_settlements where id = p_id;
  if v_row.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_row.capostipite_id <> v_uid and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('error','bad_amount'); end if;

  update public.network_settlements
     set amount_paid = least(amount_due, amount_paid + p_amount),
         status = case when amount_paid + p_amount >= amount_due then 'SALDATO'
                       when amount_paid + p_amount > 0 then 'PARZIALE' else 'MATURATO' end,
         updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.mark_settlement_paid(uuid, numeric) to authenticated;

-- ── Cruscotto: dati per la schermata Finanze rete (gated sul flag). ──
create or replace function public.network_finance_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if not public.feature_enabled('network_finance') then return jsonb_build_object('error','disabled'); end if;
  return jsonb_build_object(
    'ok', true,
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'quote_id', s.quote_id, 'entry_id', s.entry_id,
        'supplier_id', s.supplier_id,
        'supplier', coalesce(p.business_name, p.full_name),
        'direction', s.direction,
        'amount_due', s.amount_due, 'amount_paid', s.amount_paid,
        'residuo', round(s.amount_due - s.amount_paid, 2),
        'status', s.status,
        'quote_title', q.title, 'event_date', q.event_date
      ) order by s.status, q.event_date nulls last)
      from public.network_settlements s
      join public.profiles p on p.id = s.supplier_id
      join public.quotes q on q.id = s.quote_id
      where s.capostipite_id = v_uid
    ), '[]'::jsonb),
    'totals', (
      select jsonb_build_object(
        'da_pagare',       coalesce(sum(amount_due - amount_paid) filter (where direction = 'CAPOSTIPITE_OWES_SUPPLIER'), 0),
        'da_incassare',    coalesce(sum(amount_due - amount_paid) filter (where direction = 'SUPPLIER_OWES_CAPOSTIPITE'), 0),
        'maturato_totale', coalesce(sum(amount_due), 0),
        'saldato_totale',  coalesce(sum(amount_paid), 0)
      ) from public.network_settlements where capostipite_id = v_uid
    )
  );
end$$;
grant execute on function public.network_finance_overview() to authenticated;

-- ── Flag: spento in beta. ──
insert into public.feature_flags(key, enabled, description)
values ('network_finance', false, 'Cruscotto Finanze rete (denaro capostipite<->fornitori). Spento in beta.')
on conflict (key) do nothing;
