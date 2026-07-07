-- PRIMA NOTA — registro cronologico di cassa della LOCATION (capostipite).
-- Ibrido: righe MANUALI (inserite dalla location) + righe AUTO sincronizzate dai dati esistenti
-- (ENTRATE = pagamenti registrati sulle voci di preventivo; USCITE = ordini F&B ricevuti).
-- RLS owner-only + admin. Nessun vincolo bloccante: il "devono fare" è promemoria lato UI.

create table if not exists public.prima_nota_entries (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  entry_date    date not null default current_date,
  direction     text not null check (direction in ('ENTRATA','USCITA')),
  amount        numeric(12,2) not null check (amount >= 0),
  description   text not null,
  category      text,
  method        text check (method in ('CONTANTI','BONIFICO','POS','ASSEGNO','ALTRO')),
  event_id      uuid references public.calendar_entries(id) on delete set null,
  source        text not null default 'MANUAL' check (source in ('MANUAL','QUOTE_ITEM','FB_PO')),
  source_ref_id uuid,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- una sola riga AUTO per sorgente (le manuali non hanno vincolo di unicità)
create unique index if not exists uq_prima_nota_source
  on public.prima_nota_entries(owner_id, source, source_ref_id)
  where source <> 'MANUAL';
create index if not exists idx_prima_nota_owner_date
  on public.prima_nota_entries(owner_id, entry_date desc);

drop trigger if exists trg_prima_nota_upd on public.prima_nota_entries;
create trigger trg_prima_nota_upd before update on public.prima_nota_entries
  for each row execute function public.set_updated_at();

alter table public.prima_nota_entries enable row level security;

drop policy if exists prima_nota_owner on public.prima_nota_entries;
create policy prima_nota_owner on public.prima_nota_entries for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists prima_nota_admin on public.prima_nota_entries;
create policy prima_nota_admin on public.prima_nota_entries for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

grant select, insert, update, delete on public.prima_nota_entries to authenticated;

-- ── Sincronizzazione AUTO (idempotente) ────────────────────────────────────
-- Precarica/aggiorna le righe AUTO per il chiamante (auth.uid()). Ritorna quante entrate
-- sono state toccate. Le righe AUTO restano allineate ai dati di origine ad ogni run.
create or replace function public.prima_nota_sync()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_count int := 0;
begin
  if v_owner is null then return 0; end if;

  -- ENTRATE: pagamenti già registrati sulle voci di preventivo di questa location
  insert into public.prima_nota_entries
    (owner_id, entry_date, direction, amount, description, category, method, source, source_ref_id)
  select q.owner_id,
         coalesce(qi.paid_at::date, current_date),
         'ENTRATA',
         qi.paid_amount,
         coalesce(nullif(q.client_name, ''), 'Cliente') || ' — ' || qi.name_snapshot,
         'Incasso preventivo',
         case upper(coalesce(qi.payment_method, ''))
           when 'CONTANTI' then 'CONTANTI'
           when 'BONIFICO' then 'BONIFICO'
           when 'POS'      then 'POS'
           when 'ASSEGNO'  then 'ASSEGNO'
           else null end,
         'QUOTE_ITEM',
         qi.id
  from public.quote_items qi
  join public.quotes q on q.id = qi.quote_id
  where q.owner_id = v_owner and qi.paid_amount > 0
  on conflict (owner_id, source, source_ref_id) where source <> 'MANUAL'
  do update set amount      = excluded.amount,
                entry_date  = excluded.entry_date,
                description = excluded.description,
                method      = excluded.method,
                updated_at  = now();
  get diagnostics v_count = row_count;

  -- USCITE: ordini materie prime ricevuti dal gestionale F&B
  insert into public.prima_nota_entries
    (owner_id, entry_date, direction, amount, description, category, source, source_ref_id)
  select po.location_id,
         coalesce(po.expected_date, po.created_at::date),
         'USCITA',
         po.total_cost,
         'Ordine materie prime — ' || coalesce(s.name, 'fornitore'),
         'Acquisti F&B',
         'FB_PO',
         po.id
  from public.fb_purchase_orders po
  left join public.fb_suppliers s on s.id = po.supplier_id
  where po.location_id = v_owner
    and po.status in ('RICEVUTO', 'RICEVUTO_PARZIALE')
    and po.total_cost > 0
  on conflict (owner_id, source, source_ref_id) where source <> 'MANUAL'
  do update set amount      = excluded.amount,
                entry_date  = excluded.entry_date,
                description = excluded.description,
                updated_at  = now();

  return v_count;
end $$;

grant execute on function public.prima_nota_sync() to authenticated;

-- ── Promemoria (nudge non bloccante) ───────────────────────────────────────
-- Quanti movimenti AUTO del mese corrente NON sono ancora in prima nota.
create or replace function public.prima_nota_pending_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select (
    (select count(*)
       from public.quote_items qi
       join public.quotes q on q.id = qi.quote_id
      where q.owner_id = auth.uid()
        and qi.paid_amount > 0
        and date_trunc('month', coalesce(qi.paid_at, now())) = date_trunc('month', now())
        and not exists (
          select 1 from public.prima_nota_entries pn
           where pn.owner_id = auth.uid() and pn.source = 'QUOTE_ITEM' and pn.source_ref_id = qi.id))
    +
    (select count(*)
       from public.fb_purchase_orders po
      where po.location_id = auth.uid()
        and po.status in ('RICEVUTO', 'RICEVUTO_PARZIALE')
        and po.total_cost > 0
        and date_trunc('month', coalesce(po.expected_date::timestamptz, po.created_at)) = date_trunc('month', now())
        and not exists (
          select 1 from public.prima_nota_entries pn
           where pn.owner_id = auth.uid() and pn.source = 'FB_PO' and pn.source_ref_id = po.id))
  )::int
$$;

grant execute on function public.prima_nota_pending_count() to authenticated;
