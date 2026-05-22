-- ============================================================================
-- v2 Onboarding completo fornitori + sposi
-- ============================================================================

-- 1. profiles: campi onboarding pro --------------------------------------
alter table profiles
  add column if not exists vat_number       varchar(40),
  add column if not exists fiscal_code      varchar(32),
  add column if not exists address          varchar(260),
  add column if not exists city             varchar(120),
  add column if not exists zip              varchar(16),
  add column if not exists country          varchar(80),
  add column if not exists website          varchar(200),
  add column if not exists instagram        varchar(60),
  add column if not exists facebook         varchar(60),
  add column if not exists tiktok           varchar(60),
  add column if not exists bio              text,
  add column if not exists cover_image_url  text,
  add column if not exists service_radius_km int,
  add column if not exists years_active     int,
  add column if not exists onboarding_complete boolean not null default false;

-- 2. couple_preferences: stile, budget, vision -------------------------------
create type wedding_style as enum (
  'CLASSICO','MODERNO','BOHO','RUSTICO','GLAMOUR','MINIMAL',
  'VINTAGE','INDUSTRIALE','BEACH','MOUNTAIN','GARDEN','DESTINATION'
);

create table if not exists couple_preferences (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  bride_name      varchar(120),
  groom_name      varchar(120),
  couple_name     varchar(160), -- "Andrea & Giulia"
  styles          wedding_style[] default '{}'::wedding_style[],
  budget_min      numeric(12,2),
  budget_max      numeric(12,2),
  vision_note     text,
  preferred_season text,
  preferred_palette text[], -- ["beige","sage","gold"]
  location_kind   text,     -- "villa", "spiaggia", "montagna", "borgo"
  must_haves      text[],
  no_thanks       text[],
  guests_estimate int,
  budget_priority text,     -- "cibo", "location", "foto", "musica"
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists uq_couple_pref_entry on couple_preferences(entry_id);
create trigger trg_couple_pref_updated_at before update on couple_preferences
  for each row execute function set_updated_at();

alter table couple_preferences enable row level security;
create policy "cpref_select_owner_or_couple" on couple_preferences for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))
  or is_admin()
);
create policy "cpref_modify_owner_or_couple" on couple_preferences for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id)))
);

-- 3. mood_images esteso: link sorgente esterna -------------------------------
alter table mood_images
  add column if not exists source_url text,
  add column if not exists source_title varchar(200);
