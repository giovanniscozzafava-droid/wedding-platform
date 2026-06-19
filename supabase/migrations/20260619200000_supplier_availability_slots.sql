-- CALENDARIO PROFESSIONISTI — più blocchi di disponibilità nello STESSO giorno.
-- `supplier_availability` resta lo stato GROSSO del giorno (un solo record/giorno, usato dal motore
-- preventivi via i trigger di auto-block: NON lo tocchiamo). Qui aggiungiamo un layer additivo di
-- FASCE ORARIE: il professionista può dichiarare più finestre nello stesso giorno
-- (es. "Libero 9–13", "Occupato 14–18", "Forse 19–22"). Riusa l'enum supplier_avail_status.
create table if not exists public.supplier_availability_slots (
  id            uuid primary key default gen_random_uuid(),
  fornitore_id  uuid not null references public.profiles(id) on delete cascade,
  date          date not null,
  start_time    time,                              -- null = inizio giornata
  end_time      time,                              -- null = fine giornata
  status        public.supplier_avail_status not null default 'AVAILABLE', -- AVAILABLE|BUSY|TENTATIVE
  label         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_avail_slots_forn_date on public.supplier_availability_slots(fornitore_id, date);

alter table public.supplier_availability_slots enable row level security;
drop policy if exists avail_slots_own on public.supplier_availability_slots;
create policy avail_slots_own on public.supplier_availability_slots for all
  using (fornitore_id = auth.uid() or public.is_admin())
  with check (fornitore_id = auth.uid() or public.is_admin());

-- Lettura per il CAPOSTIPITE che pianifica un preventivo: vede le fasce dei fornitori in una data
-- (solo finestre di disponibilità, nessun dato sensibile). SECURITY DEFINER → bypassa la RLS owner.
create or replace function public.supplier_day_slots(p_ids uuid[], p_date date)
returns table (fornitore_id uuid, start_time time, end_time time, status text, label text)
language sql stable security definer set search_path = public as $$
  select s.fornitore_id, s.start_time, s.end_time, s.status::text, s.label
    from public.supplier_availability_slots s
   where s.fornitore_id = any(p_ids) and s.date = p_date
   order by s.start_time nulls first;
$$;
grant execute on function public.supplier_day_slots(uuid[], date) to authenticated;
