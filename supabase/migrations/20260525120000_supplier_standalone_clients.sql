-- ============================================================================
-- SUPPLIER STANDALONE: fornitori possono creare quote+contratti per clienti
-- terzi (non legati a un wedding/WP). Modello SaaS B2B autonomo.
--
-- Nota: quotes e contracts sono GIÀ standalone in schema (owner_id + client_*).
-- Questa migration aggiunge:
--  1. Anagrafica supplier_clients (per follow-up, ripetuti, analytics fornitore)
--  2. FK opzionale direct_client_id su quotes + contracts
--  3. RLS supplier_clients
--  4. Verifica policy quote/contract supporti owner_id=fornitore (già OK)
-- ============================================================================

-- 1. supplier_clients: anagrafica clienti diretti del fornitore -------------
create table if not exists supplier_clients (
  id               uuid primary key default gen_random_uuid(),
  supplier_id      uuid not null references profiles(id) on delete cascade,
  full_name        varchar(160) not null,
  email            varchar(200),
  phone            varchar(40),
  fiscal_code      varchar(32),
  partner_name     varchar(160),
    -- nome del/la partner (es. "Marco & Lucia")
  event_date       date,
  event_kind       varchar(40),
    -- 'matrimonio' | 'battesimo' | 'cresima' | 'comunione' | 'compleanno' | 'altro'
  location_text    text,
  guest_estimate   int,
  budget_min       numeric(12,2),
  budget_max       numeric(12,2),
  notes            text,
  tags             text[] not null default '{}',
  source           varchar(40),
    -- 'instagram' | 'passaparola' | 'fiera' | 'sito_web' | 'altro'
  status           varchar(20) not null default 'LEAD',
    -- 'LEAD' | 'TRATTATIVA' | 'CLIENTE' | 'ARCHIVIATO'
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_sclients_supplier on supplier_clients(supplier_id, status);
create index if not exists idx_sclients_event_date on supplier_clients(event_date);

create trigger trg_sclients_updated_at before update on supplier_clients
  for each row execute function set_updated_at();

-- 2. Link opzionale quote/contract --> supplier_clients ---------------------
alter table quotes
  add column if not exists direct_client_id uuid references supplier_clients(id) on delete set null;

alter table contracts
  add column if not exists direct_client_id uuid references supplier_clients(id) on delete set null;

create index if not exists idx_quotes_direct_client on quotes(direct_client_id) where direct_client_id is not null;
create index if not exists idx_contracts_direct_client on contracts(direct_client_id) where direct_client_id is not null;

-- 3. RLS supplier_clients ----------------------------------------------------
alter table supplier_clients enable row level security;

drop policy if exists "sclients_select_own" on supplier_clients;
create policy "sclients_select_own" on supplier_clients
  for select using (supplier_id = auth.uid());

drop policy if exists "sclients_insert_own" on supplier_clients;
create policy "sclients_insert_own" on supplier_clients
  for insert with check (supplier_id = auth.uid());

drop policy if exists "sclients_update_own" on supplier_clients;
create policy "sclients_update_own" on supplier_clients
  for update using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

drop policy if exists "sclients_delete_own" on supplier_clients;
create policy "sclients_delete_own" on supplier_clients
  for delete using (supplier_id = auth.uid());

drop policy if exists "sclients_admin_all" on supplier_clients;
create policy "sclients_admin_all" on supplier_clients
  for all using (is_admin()) with check (is_admin());

-- 4. Helper view: dashboard fornitore (clienti + n. quote + revenue) --------
create or replace view supplier_clients_dashboard as
  select
    sc.id,
    sc.supplier_id,
    sc.full_name,
    sc.partner_name,
    sc.email,
    sc.phone,
    sc.event_date,
    sc.event_kind,
    sc.status,
    sc.tags,
    sc.created_at,
    coalesce((
      select count(*) from quotes q where q.direct_client_id = sc.id
    ), 0) as quote_count,
    coalesce((
      select sum(q.total_client) from quotes q
       where q.direct_client_id = sc.id and q.status in ('INVIATO','ACCETTATO')
    ), 0) as quoted_amount,
    coalesce((
      select count(*) from contracts c where c.direct_client_id = sc.id and c.status = 'FIRMATO'
    ), 0) as signed_contracts
  from supplier_clients sc;

comment on table supplier_clients is
  'Anagrafica clienti diretti di un fornitore in modalità SaaS standalone (no WP, no wedding). Permette al fornitore di gestire preventivi/contratti autonomi.';

comment on column quotes.direct_client_id is
  'Riferimento opzionale a supplier_clients quando il preventivo è autonomo (no WP, no wedding). NULL se il quote è dentro un flusso WP/wedding tradizionale.';

comment on column contracts.direct_client_id is
  'Riferimento opzionale a supplier_clients per contratti autonomi (flusso SaaS fornitore standalone).';

-- 5. Tabella beta_status per gestire periodi gratuiti / pricing in arrivo --
-- Permette di mostrare banner contestuale "Beta gratuita fino al DD/MM/YYYY"
-- senza hardcoding nel frontend.
create table if not exists beta_status (
  role             varchar(20) primary key,
    -- 'supplier' | 'wedding_planner' | 'couple' | 'location'
  is_beta          boolean not null default true,
  free_until       date,
  planned_price    numeric(8,2),
  planned_currency varchar(3) default 'EUR',
  planned_period   varchar(20) default 'mensile',
  message_short    text,
  message_long     text,
  updated_at       timestamptz not null default now()
);

alter table beta_status enable row level security;

drop policy if exists "beta_status_read_all" on beta_status;
create policy "beta_status_read_all" on beta_status
  for select using (true);

drop policy if exists "beta_status_admin_write" on beta_status;
create policy "beta_status_admin_write" on beta_status
  for all using (is_admin()) with check (is_admin());

create trigger trg_beta_status_updated_at before update on beta_status
  for each row execute function set_updated_at();

-- Seed: fornitore in beta gratuita fino 2026-09-30, poi €29/mese ----------
insert into beta_status (role, is_beta, free_until, planned_price, planned_period, message_short, message_long)
values
  ('supplier', true, '2026-09-30', 29.00, 'mensile',
   'Sei in Beta gratuita. Da ottobre 2026: €29/mese.',
   'Stai usando Planfully durante la fase beta privata. L''utilizzo è gratuito fino al 30 settembre 2026. A partire da ottobre 2026 sarà attivo il piano Pro a €29/mese (illimitato). I dati che inserisci ora rimarranno tuoi e migreranno automaticamente sul piano a pagamento.'),
  ('wedding_planner', true, null, null, null,
   'Sei in Beta. Il servizio resterà gratuito per i partner fondatori.',
   'Come WP partner fondatrice, l''utilizzo di Planfully resterà gratuito anche dopo la fase beta. Ti ringraziamo per il prezioso feedback.')
on conflict (role) do update
  set is_beta = excluded.is_beta,
      free_until = excluded.free_until,
      planned_price = excluded.planned_price,
      planned_period = excluded.planned_period,
      message_short = excluded.message_short,
      message_long = excluded.message_long;

comment on table beta_status is
  'Stato beta e pricing pianificato per ruolo. Letto dal frontend per banner contestuali. Modificabile solo da admin.';
