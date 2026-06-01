-- ============================================================================
-- Team / sotto-fornitori: ogni fornitore costruisce il proprio team (es. band
-- con più musicisti, fotografo con secondo shooter / aiutanti) e per ogni
-- "turno"/evento segna presente/assente, per esportare un PDF da condividere.
-- ----------------------------------------------------------------------------
--  1) supplier_team_members      → anagrafica del team
--  2) supplier_team_events       → i turni/eventi gestiti dal fornitore
--  3) supplier_team_assignments  → presenza di ciascun membro a ciascun evento
-- ============================================================================

-- 1) Membri del team --------------------------------------------------------
create table if not exists public.supplier_team_members (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  full_name   text not null,
  role_label  text,            -- es. "Chitarra", "Secondo fotografo", "Aiuto"
  phone       text,
  email       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_team_members_supplier on public.supplier_team_members(supplier_id, active);

-- 2) Eventi / turni ---------------------------------------------------------
create table if not exists public.supplier_team_events (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  event_date  date,
  call_time   text,            -- es. "16:30 ritrovo"
  location    text,
  notes       text,
  quote_id    uuid references public.quotes(id) on delete set null,  -- collegamento opzionale a un preventivo
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_team_events_supplier on public.supplier_team_events(supplier_id, event_date);

-- 3) Presenza per evento ----------------------------------------------------
create table if not exists public.supplier_team_assignments (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.supplier_team_events(id) on delete cascade,
  member_id   uuid not null references public.supplier_team_members(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  presence    text not null default 'PRESENTE',  -- 'PRESENTE' | 'ASSENTE' | 'FORSE'
  role_label  text,             -- override del ruolo per quel turno
  note        text,
  updated_at  timestamptz not null default now(),
  unique (event_id, member_id)
);
create index if not exists idx_team_assign_event on public.supplier_team_assignments(event_id);

-- Trigger updated_at
do $$
begin
  perform 1;
end$$;
drop trigger if exists trg_team_members_upd on public.supplier_team_members;
create trigger trg_team_members_upd before update on public.supplier_team_members
  for each row execute function set_updated_at();
drop trigger if exists trg_team_events_upd on public.supplier_team_events;
create trigger trg_team_events_upd before update on public.supplier_team_events
  for each row execute function set_updated_at();
drop trigger if exists trg_team_assign_upd on public.supplier_team_assignments;
create trigger trg_team_assign_upd before update on public.supplier_team_assignments
  for each row execute function set_updated_at();

-- RLS: tutto scoperto solo al fornitore proprietario (supplier_id = auth.uid())
alter table public.supplier_team_members enable row level security;
alter table public.supplier_team_events enable row level security;
alter table public.supplier_team_assignments enable row level security;

drop policy if exists "team_members_own" on public.supplier_team_members;
create policy "team_members_own" on public.supplier_team_members
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

drop policy if exists "team_events_own" on public.supplier_team_events;
create policy "team_events_own" on public.supplier_team_events
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

drop policy if exists "team_assign_own" on public.supplier_team_assignments;
create policy "team_assign_own" on public.supplier_team_assignments
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

comment on table public.supplier_team_members is 'Team del fornitore (sotto-fornitori/collaboratori): band→musicisti, fotografo→secondo shooter/aiutanti.';
comment on table public.supplier_team_events is 'Turni/eventi gestiti dal fornitore per cui comporre la presenza del team.';
comment on table public.supplier_team_assignments is 'Presenza (PRESENTE/ASSENTE/FORSE) di ciascun membro del team a ciascun turno/evento.';
