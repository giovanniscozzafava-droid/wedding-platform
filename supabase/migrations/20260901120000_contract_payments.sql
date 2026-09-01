-- PAGAMENTI (Giovanni, 01/09/2026): i pagamenti NON sono una proprietà delle voci di
-- preventivo (le pastiglie "Non pagato/Acconto/Saldato" su ogni voce sono un residuo
-- e vanno via). I pagamenti nascono DAL CONTRATTO e ne seguono la creazione: se il
-- contratto prevede 3 rate, nell'app compaiono quelle 3 rate con la cifra ESATTA del
-- contratto, e il professionista ci registra sopra l'incasso avvenuto (data, metodo,
-- numero di fattura / riferimento del pagamento).
--
-- La rata è la PROIEZIONE dell'Art. 2.2 del contratto:
--   a) acconto  pay_deposit_pct  — alla sottoscrizione
--   b) 2a rata  pay_second_pct   — entro 60 giorni prima dell'Evento
--   c) saldo    il resto         — entro 7 giorni prima dell'Evento
-- Stessa aritmetica di build_contract_sections (r3 = totale - r1 - r2, così la somma
-- delle rate fa SEMPRE il totale al centesimo, senza derive di arrotondamento).

create table if not exists public.contract_payments (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references public.contracts(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  seq          smallint not null,
  label        text not null,
  percent      numeric(6,2),
  amount       numeric(12,2) not null default 0,
  due_hint     text,
  due_date     date,
  paid         boolean not null default false,
  paid_at      date,
  paid_amount  numeric(12,2),
  method       text,
  reference    text,                       -- numero fattura / riferimento pagamento
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (contract_id, seq)
);

create index if not exists idx_contract_payments_contract on public.contract_payments(contract_id);
create index if not exists idx_contract_payments_owner on public.contract_payments(owner_id, paid);

alter table public.contract_payments enable row level security;

-- Il denaro incassato è del professionista: legge e scrive solo lui (o un admin).
drop policy if exists contract_payments_owner_all on public.contract_payments;
create policy contract_payments_owner_all on public.contract_payments
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop trigger if exists trg_contract_payments_updated_at on public.contract_payments;
create trigger trg_contract_payments_updated_at before update on public.contract_payments
  for each row execute function public.set_updated_at();

-- Genera (o riallinea) le rate di un contratto dal suo totale e dal piano del pro.
-- Riallinea SOLO le rate non ancora incassate: una rata già registrata non si tocca
-- mai, altrimenti un ricalcolo cancellerebbe un incasso reale.
create or replace function public.contract_payments_sync(p_contract_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_c record; v_o record;
  v_dep numeric; v_sec numeric; v_bal numeric;
  v_r1 numeric; v_r2 numeric; v_r3 numeric;
  v_ev date; v_n int;
begin
  select c.* into v_c from contracts c where c.id = p_contract_id;
  if v_c.id is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_c.owner_id = auth.uid() or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;

  select p.pay_deposit_pct, p.pay_second_pct into v_o from profiles p where p.id = v_c.owner_id;
  v_dep := coalesce(v_o.pay_deposit_pct, 30);
  v_sec := coalesce(v_o.pay_second_pct, 50);
  v_bal := 100 - v_dep - v_sec;

  v_r1 := round(coalesce(v_c.total_amount,0) * v_dep / 100.0, 2);
  v_r2 := round(coalesce(v_c.total_amount,0) * v_sec / 100.0, 2);
  v_r3 := round(coalesce(v_c.total_amount,0) - v_r1 - v_r2, 2);
  v_ev := v_c.event_date;

  insert into contract_payments (contract_id, owner_id, seq, label, percent, amount, due_hint, due_date)
  values
    (p_contract_id, v_c.owner_id, 1, 'Acconto alla firma', v_dep, v_r1,
     'alla sottoscrizione del contratto', v_c.signed_at::date),
    (p_contract_id, v_c.owner_id, 2, 'Seconda rata', v_sec, v_r2,
     'entro 60 giorni prima dell''Evento', case when v_ev is not null then v_ev - 60 end),
    (p_contract_id, v_c.owner_id, 3, 'Saldo', v_bal, v_r3,
     'entro 7 giorni prima dell''Evento', case when v_ev is not null then v_ev - 7 end)
  on conflict (contract_id, seq) do update
     set label     = excluded.label,
         percent   = excluded.percent,
         amount    = excluded.amount,
         due_hint  = excluded.due_hint,
         due_date  = coalesce(contract_payments.due_date, excluded.due_date),
         updated_at = now()
   where contract_payments.paid = false;   -- una rata incassata NON si riscrive mai

  select count(*) into v_n from contract_payments where contract_id = p_contract_id;
  return jsonb_build_object('ok', true, 'rate', v_n, 'totale', coalesce(v_c.total_amount,0));
end$$;

revoke all on function public.contract_payments_sync(uuid) from public;
grant execute on function public.contract_payments_sync(uuid) to authenticated;

-- Il contratto nasce → le sue rate nascono con lui. Il professionista le trova già
-- pronte nell'app, senza doverle ribattere a mano (era lo scadenzario manuale).
create or replace function public.tg_contract_payments_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_dep numeric; v_sec numeric; v_r1 numeric; v_r2 numeric;
begin
  select coalesce(p.pay_deposit_pct,30), coalesce(p.pay_second_pct,50)
    into v_dep, v_sec from profiles p where p.id = new.owner_id;
  v_dep := coalesce(v_dep, 30); v_sec := coalesce(v_sec, 50);
  v_r1 := round(coalesce(new.total_amount,0) * v_dep / 100.0, 2);
  v_r2 := round(coalesce(new.total_amount,0) * v_sec / 100.0, 2);

  insert into contract_payments (contract_id, owner_id, seq, label, percent, amount, due_hint, due_date)
  values
    (new.id, new.owner_id, 1, 'Acconto alla firma', v_dep, v_r1,
     'alla sottoscrizione del contratto', new.signed_at::date),
    (new.id, new.owner_id, 2, 'Seconda rata', v_sec, v_r2,
     'entro 60 giorni prima dell''Evento',
     case when new.event_date is not null then new.event_date - 60 end),
    (new.id, new.owner_id, 3, 'Saldo', 100 - v_dep - v_sec,
     round(coalesce(new.total_amount,0) - v_r1 - v_r2, 2),
     'entro 7 giorni prima dell''Evento',
     case when new.event_date is not null then new.event_date - 7 end)
  on conflict (contract_id, seq) do nothing;
  return null;
exception when others then
  -- Un effetto collaterale non deve MAI impedire la creazione di un contratto.
  raise warning 'tg_contract_payments_on_insert: %', sqlerrm;
  return null;
end$$;

drop trigger if exists trg_contract_payments_on_insert on public.contracts;
create trigger trg_contract_payments_on_insert
  after insert on public.contracts
  for each row execute function public.tg_contract_payments_on_insert();

comment on table public.contract_payments is
  'Rate del contratto (proiezione dell''Art. 2.2) su cui il professionista registra gli incassi.';
