-- ============================================================================
-- Centro Assistenza: ticket di supporto aperti dagli utenti.
-- L'utente apre/legge i PROPRI ticket; l'admin li vede tutti.
-- ----------------------------------------------------------------------------

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  reparto     text not null default 'GENERALE',
  subject     text not null,
  message     text not null,
  status      text not null default 'APERTO',  -- APERTO / IN_LAVORAZIONE / CHIUSO
  created_at  timestamptz not null default now()
);

create index if not exists idx_support_tickets_user on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "support_tickets_insert_own" on public.support_tickets;
create policy "support_tickets_insert_own" on public.support_tickets
  for insert with check (user_id = auth.uid());

drop policy if exists "support_tickets_select_own_or_admin" on public.support_tickets;
create policy "support_tickets_select_own_or_admin" on public.support_tickets
  for select using (user_id = auth.uid() or is_admin());

drop policy if exists "support_tickets_update_admin" on public.support_tickets;
create policy "support_tickets_update_admin" on public.support_tickets
  for update using (is_admin());
