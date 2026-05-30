-- FASE 3.4 — Consenso segnalazione coppia -> fornitore.
-- Nel modello SEGNALAZIONE la coppia firma direttamente coi fornitori. Per
-- consentire al WP di trasmettere il minimo necessario (nome, contatto, data,
-- localita`, voci collegate) serve un consenso esplicito della coppia per ogni
-- fornitore. Una riga = un consenso (entry, coppia, fornitore).
-- La RPC supplier_view_couple_minimal espone al fornitore solo i dati
-- consentiti, solo se il consenso e` attivo (dato_il valorizzato, revocato_il
-- nullo).

-- 1) Tabella ----------------------------------------------------------------
create table if not exists public.consenso_segnalazione (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references public.calendar_entries(id) on delete cascade,
  couple_user_id  uuid not null references public.profiles(id) on delete cascade,
  supplier_id     uuid not null references public.profiles(id) on delete cascade,
  versione        text not null default 'v1.0',
  dato_il         timestamptz,
  revocato_il     timestamptz,
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (entry_id, couple_user_id, supplier_id)
);

comment on table public.consenso_segnalazione is
  'FASE 3: consenso esplicito della coppia a condividere i propri dati minimi con un fornitore segnalato dal WP.';
comment on column public.consenso_segnalazione.dato_il is
  'Timestamp del consenso. NULL = non ancora dato. Settato a now() quando la coppia conferma.';
comment on column public.consenso_segnalazione.revocato_il is
  'Timestamp di revoca. Se valorizzato, il consenso non e` piu` attivo.';

create index if not exists idx_consenso_entry      on public.consenso_segnalazione(entry_id);
create index if not exists idx_consenso_supplier   on public.consenso_segnalazione(supplier_id);
create index if not exists idx_consenso_couple     on public.consenso_segnalazione(couple_user_id);
create index if not exists idx_consenso_active
  on public.consenso_segnalazione(entry_id, supplier_id)
  where dato_il is not null and revocato_il is null;

-- 2) updated_at trigger -----------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'trg_consenso_updated_at') then
    create function public.trg_consenso_updated_at()
      returns trigger language plpgsql as
      $body$ begin new.updated_at := now(); return new; end $body$;
  end if;
end$$;

drop trigger if exists trg_consenso_updated on public.consenso_segnalazione;
create trigger trg_consenso_updated before update on public.consenso_segnalazione
  for each row execute function public.trg_consenso_updated_at();

-- 3) RLS --------------------------------------------------------------------
alter table public.consenso_segnalazione enable row level security;

-- Select: coppia vede i propri; supplier vede solo per se`; WP owner vede tutti; admin vede tutti.
drop policy if exists "consenso_select" on public.consenso_segnalazione;
create policy "consenso_select" on public.consenso_segnalazione
  for select using (
    is_admin()
    or couple_user_id = auth.uid()
    or supplier_id = auth.uid()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- Insert: WP del wedding o la coppia stessa.
drop policy if exists "consenso_insert" on public.consenso_segnalazione;
create policy "consenso_insert" on public.consenso_segnalazione
  for insert with check (
    is_admin()
    or couple_user_id = auth.uid()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- Update: la coppia (per dare/revocare consenso) o il WP del wedding.
drop policy if exists "consenso_update" on public.consenso_segnalazione;
create policy "consenso_update" on public.consenso_segnalazione
  for update using (
    is_admin()
    or couple_user_id = auth.uid()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  ) with check (
    is_admin()
    or couple_user_id = auth.uid()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- Delete: solo WP del wedding o admin.
drop policy if exists "consenso_delete" on public.consenso_segnalazione;
create policy "consenso_delete" on public.consenso_segnalazione
  for delete using (
    is_admin()
    or exists (
      select 1 from public.calendar_entries ce
      where ce.id = entry_id and ce.owner_id = auth.uid()
    )
  );

-- 4) RPC supplier_view_couple_minimal --------------------------------------
-- Ritorna i dati minimi della coppia per un evento, SOLO se esiste un consenso
-- attivo (dato_il not null, revocato_il null) per il fornitore chiamante.
-- related_items elenca le voci preventivo assegnate al fornitore per quel
-- preventivo, gia` visibili al fornitore dalle policy esistenti.
create or replace function public.supplier_view_couple_minimal(p_entry uuid)
returns table (
  couple_name    text,
  contact_email  text,
  date_from      date,
  location_short text,
  related_items  jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_supplier   uuid := auth.uid();
  v_entry      public.calendar_entries%rowtype;
  v_has_consent boolean;
begin
  if v_supplier is null then
    raise exception 'unauthorized';
  end if;

  select * into v_entry from public.calendar_entries where id = p_entry;
  if v_entry.id is null then
    return; -- empty
  end if;

  select exists (
    select 1 from public.consenso_segnalazione cs
    where cs.entry_id = p_entry
      and cs.supplier_id = v_supplier
      and cs.dato_il is not null
      and cs.revocato_il is null
  ) into v_has_consent;

  if not v_has_consent then
    -- nessun consenso attivo: non esponiamo nulla
    return;
  end if;

  return query
  select
    coalesce(v_entry.client_name, 'Cliente')::text                       as couple_name,
    v_entry.client_email::text                                           as contact_email,
    v_entry.date_from                                                    as date_from,
    -- location_short: ricavata da notes/title (best effort) — niente dati
    -- aggiuntivi sensibili come indirizzo civico.
    coalesce(
      nullif(regexp_replace(coalesce(v_entry.title, ''), '\s+', ' ', 'g'), ''),
      'Italia'
    )::text                                                              as location_short,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',          qi.id,
        'name',        qi.name_snapshot,
        'unit',        qi.unit_snapshot::text,
        'quantity',    qi.quantity,
        'confirmed_at', qi.supplier_confirmed_at
      ) order by qi.sort_order)
      from public.quote_items qi
      where qi.supplier_id = v_supplier
        and qi.quote_id = v_entry.quote_id
    ), '[]'::jsonb)                                                       as related_items;
end$$;

grant execute on function public.supplier_view_couple_minimal(uuid) to authenticated;

comment on function public.supplier_view_couple_minimal(uuid) is
  'FASE 3.4: ritorna dati minimi coppia per il fornitore chiamante, solo se consenso_segnalazione attivo per (entry, supplier).';
