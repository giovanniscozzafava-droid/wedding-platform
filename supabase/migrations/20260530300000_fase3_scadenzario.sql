-- FASE 3.1 — Scadenzario pagamenti per evento.
-- Una riga per ogni movimento di denaro previsto/effettuato: acconti, saldi,
-- rate, penali, rimborsi. Sopra ai "pagamenti per quote_item" gia` esistenti
-- (vedi payments_finance.sql), questa tabella fornisce la vista commerciale
-- per coppia + WP + fornitori, con scadenze, debitore/creditore espliciti,
-- titolo umano e stato `pagato`.
--
-- Esempi di uso:
--   - "Acconto 30% del preventivo" (debitore=coppia, creditore=WP)
--   - "Saldo fotografo" (debitore=coppia o WP, creditore=fotografo)
--   - "Penale recesso" (debitore=coppia, creditore=WP)
--   - "Rimborso da fornitore" (debitore=fornitore, creditore=coppia)

-- 1) Enum tipo voce ---------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'scadenza_tipo') then
    create type public.scadenza_tipo as enum (
      'ACCONTO', 'SALDO', 'RATA', 'PENALE', 'RIMBORSO'
    );
  end if;
end$$;

comment on type public.scadenza_tipo is
  'Tipologia di voce di scadenzario: ACCONTO|SALDO|RATA|PENALE|RIMBORSO.';

-- 2) Tabella ----------------------------------------------------------------
create table if not exists public.scadenzario_voci (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.calendar_entries(id) on delete cascade,
  titolo        text not null,
  descrizione   text,
  importo_eur   numeric(10,2) not null check (importo_eur >= 0),
  tipo          public.scadenza_tipo not null,
  debitore_id   uuid references public.profiles(id) on delete set null,
  creditore_id  uuid references public.profiles(id) on delete set null,
  scadenza      date,
  pagato        boolean not null default false,
  pagato_il     timestamptz,
  metodo        text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.scadenzario_voci is
  'FASE 3: scadenzario commerciale dei pagamenti per ogni evento. Una riga = una scadenza.';
comment on column public.scadenzario_voci.tipo is
  'ACCONTO|SALDO|RATA|PENALE|RIMBORSO.';
comment on column public.scadenzario_voci.debitore_id is
  'Chi deve pagare. Es. coppia, fornitore, WP.';
comment on column public.scadenzario_voci.creditore_id is
  'Chi riceve. Es. WP, fornitore, coppia (caso rimborso).';

create index if not exists idx_scad_entry      on public.scadenzario_voci(entry_id, scadenza);
create index if not exists idx_scad_debitore   on public.scadenzario_voci(debitore_id) where debitore_id is not null;
create index if not exists idx_scad_creditore  on public.scadenzario_voci(creditore_id) where creditore_id is not null;
create index if not exists idx_scad_open       on public.scadenzario_voci(entry_id, pagato) where pagato = false;

-- 3) Trigger updated_at -----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'trg_scad_updated_at') then
    create function public.trg_scad_updated_at()
      returns trigger language plpgsql as
      $body$ begin new.updated_at := now(); return new; end $body$;
  end if;
end$$;

drop trigger if exists trg_scad_updated on public.scadenzario_voci;
create trigger trg_scad_updated before update on public.scadenzario_voci
  for each row execute function public.trg_scad_updated_at();

-- Auto-set pagato_il quando pagato passa a true e viceversa lo azzera
create or replace function public.trg_scad_pagato_il()
returns trigger language plpgsql as $$
begin
  if new.pagato = true and (old.pagato is distinct from true) and new.pagato_il is null then
    new.pagato_il := now();
  end if;
  if new.pagato = false then
    new.pagato_il := null;
  end if;
  return new;
end$$;

drop trigger if exists trg_scad_pagato_il on public.scadenzario_voci;
create trigger trg_scad_pagato_il before insert or update on public.scadenzario_voci
  for each row execute function public.trg_scad_pagato_il();

-- 4) RLS --------------------------------------------------------------------
alter table public.scadenzario_voci enable row level security;

-- Select: owner del wedding RW; debitore + creditore in lettura; admin tutto.
drop policy if exists "scad_select" on public.scadenzario_voci;
create policy "scad_select" on public.scadenzario_voci
  for select using (
    is_admin()
    or debitore_id = auth.uid()
    or creditore_id = auth.uid()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- Insert/Update/Delete: solo owner del wedding (o admin).
drop policy if exists "scad_insert_owner" on public.scadenzario_voci;
create policy "scad_insert_owner" on public.scadenzario_voci
  for insert with check (
    is_admin()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

drop policy if exists "scad_update_owner" on public.scadenzario_voci;
create policy "scad_update_owner" on public.scadenzario_voci
  for update using (
    is_admin()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  ) with check (
    is_admin()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

drop policy if exists "scad_delete_owner" on public.scadenzario_voci;
create policy "scad_delete_owner" on public.scadenzario_voci
  for delete using (
    is_admin()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );
