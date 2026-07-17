-- ============================================================================
-- MAESTRANZE — bacheca di competenze CHIUSA (solo utenti registrati).
-- Architettura "legale by design": bacheca informativa, NON intermediazione.
-- Rif: docs/PRP-Maestranze-Bacheca-v1.1.md
--
-- Vincoli architetturali (non preferenze):
--  1. Nessun ranking: ordine casuale stabile per sessione. Nessuna colonna di merito.
--  2. Nessun matching: la ricerca è pull dell'utente, con filtri informativi.
--  3. Nessuna transazione economica: fascia_prezzo è testo, mai filtro né calcolo.
--  4. Nessuna verifica: tutto autodichiarato, etichettato come tale in UI.
--  5. Feedback privato senza campo numerico (niente numero = niente media = niente ranking).
--  6. La chiusura vale anche per i FILE: bucket privato + signed URL. Un URL pubblico che
--     restituisce il volto di una maestranza renderebbe falsa la frase su cui poggia tutto.
-- ============================================================================

-- ---------------------------------------------------------------- competenze
create table if not exists public.maestranze_skills (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(80) not null unique,
  famiglia    varchar(60) not null,   -- tassonomia INFORMATIVA (non è un ranking): raggruppa
                                      -- ~200 mestieri in famiglie navigabili
  is_standard boolean not null default false,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_skills_famiglia on public.maestranze_skills(famiglia);

-- ------------------------------------------------------------------ profilo
create table if not exists public.maestranze_profiles (
  id                   uuid primary key references public.profiles(id) on delete cascade,
  display_name         varchar(120) not null,
  photo_path           text,                    -- PATH nel bucket PRIVATO, mai URL pubblico
  provincia            varchar(4) not null references public.province_regioni(provincia),
  raggio_disponibilita text not null default 'PROVINCIA'
                       check (raggio_disponibilita in ('PROVINCIA','REGIONE','NAZIONALE')),
  bio                  text check (char_length(bio) <= 1200),
  anni_esperienza      smallint check (anni_esperienza between 0 and 60),
  fascia_prezzo        varchar(80),             -- testo libero opzionale, MAI filtrabile
  disponibilita_note   text check (char_length(disponibilita_note) <= 300),
  telefono             text,                    -- NON esposto in v1 (fase 2, dietro parere legale)
  is_published         boolean not null default false,
  published_at         timestamptz,
  anonymized_at        timestamptz,             -- diritto all'oblio senza DELETE
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists idx_maestranze_provincia on public.maestranze_profiles(provincia)
  where is_published;

create table if not exists public.maestranze_profile_skills (
  profile_id uuid not null references public.maestranze_profiles(id) on delete cascade,
  skill_id   uuid not null references public.maestranze_skills(id),
  primary key (profile_id, skill_id)
);
create index if not exists idx_profile_skills_lookup on public.maestranze_profile_skills(skill_id);

-- ------------------------------------------- dichiarazione (strato legale 2)
-- Snapshot immutabile: si aggiunge una riga, non si aggiorna mai.
-- NIENTE on delete cascade: la dichiarazione sopravvive (valore probatorio).
-- La cancellazione utente passa da anonimizzazione, non da DELETE.
create table if not exists public.maestranze_declarations (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.maestranze_profiles(id) on delete no action,
  regime        text not null check (regime in
                  ('PARTITA_IVA','SUBORDINATO_DISPONIBILE','SOLO_CONTRATTI_REGOLARI','NON_DICHIARO')),
  checkbox_text text not null,          -- testo ESATTO mostrato all'utente
  tos_version   varchar(20) not null,
  declared_at   timestamptz not null default now()
);
create index if not exists idx_declarations_profile on public.maestranze_declarations(profile_id, declared_at desc);

-- ============================================================================ RLS
alter table public.maestranze_skills          enable row level security;
alter table public.maestranze_profiles        enable row level security;
alter table public.maestranze_profile_skills  enable row level security;
alter table public.maestranze_declarations    enable row level security;

-- Competenze: leggibili dai registrati (servono ai filtri). Scrittura solo admin.
drop policy if exists "skills_lettura_registrati" on public.maestranze_skills;
create policy "skills_lettura_registrati" on public.maestranze_skills
  for select to authenticated using (true);
drop policy if exists "skills_scrive_admin" on public.maestranze_skills;
create policy "skills_scrive_admin" on public.maestranze_skills
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Profili: bacheca CHIUSA. Mai il ruolo anon.
drop policy if exists "bacheca_solo_registrati" on public.maestranze_profiles;
create policy "bacheca_solo_registrati" on public.maestranze_profiles
  for select to authenticated
  using ((is_published and anonymized_at is null) or id = auth.uid());
drop policy if exists "maestranza_gestisce_proprio_profilo" on public.maestranze_profiles;
create policy "maestranza_gestisce_proprio_profilo" on public.maestranze_profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Competenze del profilo: chiunque sia registrato le legge (sono in vetrina);
-- le scrive solo il proprietario del profilo.
drop policy if exists "profile_skills_lettura_registrati" on public.maestranze_profile_skills;
create policy "profile_skills_lettura_registrati" on public.maestranze_profile_skills
  for select to authenticated using (true);
drop policy if exists "profile_skills_scrive_proprietario" on public.maestranze_profile_skills;
create policy "profile_skills_scrive_proprietario" on public.maestranze_profile_skills
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Dichiarazioni: insert solo propria, select solo propria o admin.
-- Nessuna policy UPDATE/DELETE = immutabili per chiunque dal client (RLS nega di default).
drop policy if exists "dichiarazione_insert_propria" on public.maestranze_declarations;
create policy "dichiarazione_insert_propria" on public.maestranze_declarations
  for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists "dichiarazione_select_propria_o_admin" on public.maestranze_declarations;
create policy "dichiarazione_select_propria_o_admin" on public.maestranze_declarations
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

-- ====================================================== publish guard (trigger)
-- Doppia cintura: il profilo non si pubblica senza dichiarazione, foto, provincia,
-- almeno una competenza. Enforcement server-side, non solo in UI.
create or replace function public.maestranza_publish_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_published and not coalesce(old.is_published, false) then
    if new.photo_path is null then
      raise exception 'Serve una foto per pubblicare il profilo.';
    end if;
    if not exists (select 1 from maestranze_profile_skills where profile_id = new.id) then
      raise exception 'Serve almeno una competenza per pubblicare il profilo.';
    end if;
    if not exists (select 1 from maestranze_declarations where profile_id = new.id) then
      raise exception 'Serve la dichiarazione di regime per pubblicare il profilo.';
    end if;
    new.published_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_maestranza_publish_guard on public.maestranze_profiles;
create trigger trg_maestranza_publish_guard
  before insert or update on public.maestranze_profiles
  for each row execute function public.maestranza_publish_guard();

-- ============================================ storage: bucket PRIVATO + policy
-- NON pubblico: sono volti di persone, dato personale, su una bacheca dichiarata chiusa.
-- (Nel repo 7 bucket su 10 sono public=true: qui no, e non è una svista da "uniformare".)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('maestranze-photos','maestranze-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Path convenzionale: <profile_id>/<file> → la prima cartella è l'owner.
drop policy if exists "maestranza_scrive_propria_foto" on storage.objects;
create policy "maestranza_scrive_propria_foto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'maestranze-photos'
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "maestranza_aggiorna_propria_foto" on storage.objects;
create policy "maestranza_aggiorna_propria_foto" on storage.objects
  for update to authenticated
  using (bucket_id = 'maestranze-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "maestranza_elimina_propria_foto" on storage.objects;
create policy "maestranza_elimina_propria_foto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'maestranze-photos'
         and (storage.foldername(name))[1] = auth.uid()::text);
-- Lettura: SOLO registrati, e solo di profili pubblicati e non anonimizzati.
drop policy if exists "foto_leggibili_dai_registrati" on storage.objects;
create policy "foto_leggibili_dai_registrati" on storage.objects
  for select to authenticated
  using (bucket_id = 'maestranze-photos' and exists (
    select 1 from public.maestranze_profiles mp
    where mp.id::text = (storage.foldername(name))[1]
      and mp.anonymized_at is null
      and (mp.is_published or mp.id = auth.uid())));

comment on table public.maestranze_profiles is
  'Bacheca maestranze: profili AUTODICHIARATI, mai verificati da Planfully. Nessun ranking, '
  'nessun matching, nessuna commissione. Vedi docs/PRP-Maestranze-Bacheca-v1.1.md';
