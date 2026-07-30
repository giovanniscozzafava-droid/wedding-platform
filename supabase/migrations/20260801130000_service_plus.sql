-- "Plus" del servizio: sotto-voci opzionali con prezzo proprio (es. Album → "Copertina legno +80",
-- "Pagina extra +12"). Nel catalogo il prezzo mostra "A partire da X €" = min(base, min plus).
-- Modello dedicato (NON i modificatori, che restano per sconti/supplementi con date).
create table if not exists public.service_plus (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  name varchar(120) not null,
  price numeric(10,2) not null default 0 check (price >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_service_plus_service on public.service_plus(service_id);

alter table public.service_plus enable row level security;

-- Lettura: come i servizi/modificatori (proprietario, collaborazione attiva, admin).
drop policy if exists "plus_select_via_service" on public.service_plus;
create policy "plus_select_via_service"
  on public.service_plus for select
  using (
    exists (
      select 1 from public.services s
      where s.id = service_plus.service_id
        and (s.fornitore_id = auth.uid() or has_active_collab_with_supplier(s.fornitore_id) or is_admin())
    )
  );

-- Scrittura: solo il proprietario del servizio.
drop policy if exists "plus_modify_owner_service" on public.service_plus;
create policy "plus_modify_owner_service"
  on public.service_plus for all
  using (
    exists (select 1 from public.services s where s.id = service_plus.service_id and s.fornitore_id = auth.uid())
  )
  with check (
    exists (select 1 from public.services s where s.id = service_plus.service_id and s.fornitore_id = auth.uid())
  );

grant select, insert, update, delete on public.service_plus to authenticated;
