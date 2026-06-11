-- ============================================================================
-- Sistema consegna/condivisione foto-video — SPINA (schema + RLS BLINDATISSIMO).
-- Cloud-del-professionista: Planfully NON ospita i file (solo token cifrato +
-- riferimenti cartelle + metadati chi-vede-cosa). Tre porte (sposi/fornitori/
-- invitati), due livelli (lavoro intero a 3 consensi in serie / lavorazione a 1),
-- cartella invitati con tag nome-cognome, vendita per-file DIETRO FLAG (OFF).
-- OAuth Drive + plance + anello = step successivi che si innestano qui.
-- ============================================================================

create type gallery_folder_level as enum ('LAVORO_INTERO','LAVORAZIONE','INVITATI');
create type gallery_media_type   as enum ('PHOTO','VIDEO');

-- ── Drive del professionista (token SENSIBILI: cifrati a riposo dall'edge OAuth,
--    mai scritti in chiaro; scope minimo drive.file) ──────────────────────────
create table public.drive_connections (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'google_drive',
  access_token_enc  bytea,          -- AES app-side (edge), MAI plaintext
  refresh_token_enc bytea,
  scope text not null default 'drive.file',
  drive_root_folder_id text,
  email text,
  connected_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (professional_id, provider)
);

create table public.event_galleries (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,   -- il professionista
  title text not null default 'Galleria evento',
  kind text not null default 'MIXED',
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.event_galleries(entry_id);

create table public.gallery_folders (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.event_galleries(id) on delete cascade,
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,  -- denorm per RLS
  name text not null,
  level gallery_folder_level not null,
  assigned_subrole text,                                   -- LAVORAZIONE: ruolo competente
  assigned_to uuid references public.profiles(id) on delete set null,  -- LAVORAZIONE: fornitore specifico
  shared boolean not null default false,                   -- LAVORO_INTERO: il fotografo ha condiviso
  drive_folder_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.gallery_folders(gallery_id);

create table public.gallery_media (
  id uuid primary key default gen_random_uuid(),
  folder_id  uuid not null references public.gallery_folders(id) on delete cascade,
  gallery_id uuid not null references public.event_galleries(id) on delete cascade,
  entry_id   uuid not null references public.calendar_entries(id) on delete cascade,  -- denorm per RLS
  drive_file_id text not null,
  thumbnail_link text,
  media_type gallery_media_type not null default 'PHOTO',
  guest_tag_name text,             -- INVITATI: nome+cognome del ritratto (il "tag")
  price_cents int,                 -- null = gratis
  is_for_sale boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.gallery_media(folder_id);
create index on public.gallery_media(entry_id);
create index on public.gallery_media(guest_tag_name);

-- Consenso sposi al LAVORO_INTERO: registrato (chi/cosa/quando) e REVOCABILE
create table public.gallery_consents (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  scope gallery_folder_level not null default 'LAVORO_INTERO',
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id),
  unique (entry_id, scope)
);

-- Invitati registrati (porta pubblica CON registrazione: nessun accesso anonimo)
create table public.gallery_guests (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  guest_user_id uuid not null references public.profiles(id) on delete cascade,
  full_name_searched text,
  registered_at timestamptz not null default now(),
  unique (entry_id, guest_user_id)
);

-- ── Helper dei cancelli ─────────────────────────────────────────────────────
create or replace function public._photo_circle_member(p_entry uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_evento_member(p_entry) or public.is_event_collaborator(p_entry);
$$;
create or replace function public._photo_lavoro_consented(p_entry uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gallery_consents c
    where c.entry_id = p_entry and c.scope = 'LAVORO_INTERO'
      and c.granted_at is not null and c.revoked_at is null);
$$;
create or replace function public._photo_is_guest(p_entry uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.gallery_guests g
    where g.entry_id = p_entry and g.guest_user_id = auth.uid());
$$;
create or replace function public._photo_my_subrole() returns text
  language sql stable security definer set search_path = public as $$
  select subrole from public.profiles where id = auth.uid();
$$;
create or replace function public._photo_gallery_owner(p_gallery uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_galleries g where g.id = p_gallery and g.owner_id = auth.uid());
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.drive_connections enable row level security;
alter table public.event_galleries   enable row level security;
alter table public.gallery_folders   enable row level security;
alter table public.gallery_media      enable row level security;
alter table public.gallery_consents   enable row level security;
alter table public.gallery_guests     enable row level security;

revoke all on public.drive_connections, public.event_galleries, public.gallery_folders,
              public.gallery_media, public.gallery_consents, public.gallery_guests from anon;
grant select, insert, update, delete on public.event_galleries, public.gallery_folders,
              public.gallery_media, public.gallery_consents, public.gallery_guests to authenticated;
grant select, insert, update, delete on public.drive_connections to authenticated;

-- drive_connections: SOLO il professionista proprietario (token sensibili)
create policy dc_owner on public.drive_connections for all
  using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- galleria: gestita dall'owner; visibile a chi ha accesso all'evento
create policy eg_owner_write on public.event_galleries for all
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());
create policy eg_read on public.event_galleries for select
  using (owner_id = auth.uid() or public.is_admin()
         or public.is_wedding_couple(entry_id)
         or public._photo_circle_member(entry_id)
         or public._photo_is_guest(entry_id));

-- cartelle: scrive l'owner; leggono owner/admin/sposi/cerchio (la struttura;
-- il contenuto resta gated a livello media)
create policy gf_owner_write on public.gallery_folders for all
  using (public._photo_gallery_owner(gallery_id) or public.is_admin())
  with check (public._photo_gallery_owner(gallery_id) or public.is_admin());
create policy gf_read on public.gallery_folders for select
  using (public._photo_gallery_owner(gallery_id) or public.is_admin()
         or public.is_wedding_couple(entry_id)
         or public._photo_circle_member(entry_id)
         or (level = 'INVITATI' and public._photo_is_guest(entry_id)));

-- MEDIA: il cuore. Tre porte + due regimi di consenso.
create policy gm_owner_write on public.gallery_media for all
  using (public._photo_gallery_owner(gallery_id) or public.is_admin())
  with check (public._photo_gallery_owner(gallery_id) or public.is_admin());
create policy gm_read on public.gallery_media for select
  using (
    public.is_admin()
    or public._photo_gallery_owner(gallery_id)                 -- il professionista (padrone del file)
    or public.is_wedding_couple(entry_id)                      -- SPOSI: tutto il proprio evento
    or exists (
      select 1 from public.gallery_folders f where f.id = gallery_media.folder_id and (
        -- LAVORAZIONE: 1 interruttore (assegnazione al fornitore o al suo ruolo nel cerchio)
        (f.level = 'LAVORAZIONE' and (
            f.assigned_to = auth.uid()
            or (f.assigned_subrole is not null
                and f.assigned_subrole = public._photo_my_subrole()
                and public._photo_circle_member(f.entry_id))))
        -- LAVORO_INTERO: 3 interruttori IN SERIE (cerchio + condiviso + consenso sposi)
        or (f.level = 'LAVORO_INTERO'
            and f.shared
            and public._photo_circle_member(f.entry_id)
            and public._photo_lavoro_consented(f.entry_id))
        -- INVITATI: solo gli invitati registrati di quell'evento (filtro per nome lato app)
        or (f.level = 'INVITATI' and public._photo_is_guest(f.entry_id))
      )
    )
  );

-- consensi: gli sposi concedono/revocano; owner/admin leggono
create policy gc_couple_write on public.gallery_consents for all
  using (public.is_wedding_couple(entry_id) or public.is_admin())
  with check (public.is_wedding_couple(entry_id) or public.is_admin());
create policy gc_read on public.gallery_consents for select
  using (public.is_wedding_couple(entry_id) or public.is_admin()
         or exists (select 1 from public.event_galleries g where g.entry_id = gallery_consents.entry_id and g.owner_id = auth.uid()));

-- invitati: ognuno registra/legge la PROPRIA riga; owner/admin leggono tutte
create policy gg_self on public.gallery_guests for all
  using (guest_user_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.event_galleries g where g.entry_id = gallery_guests.entry_id and g.owner_id = auth.uid()))
  with check (guest_user_id = auth.uid() or public.is_admin());

-- ── Vendita per-file: DIETRO FLAG (OFF in beta, solo "gratis") ──────────────
insert into public.feature_flags(key, enabled, description)
values ('photo_sales_enabled', false,
        'Vendita foto/video per-file. OFF fino a Stripe: in beta solo condivisione gratis, niente denaro.')
on conflict (key) do update set description = excluded.description;
