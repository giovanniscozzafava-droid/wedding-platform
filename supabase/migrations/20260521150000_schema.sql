-- ============================================================================
-- Wedding Platform — Schema iniziale (Dossier v2 + PRP-1/2/3 v2)
-- ============================================================================

-- 1. Extensions ---------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- 2. Enum types ---------------------------------------------------------------
create type user_role           as enum ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN');
create type subscription_tier   as enum ('FREE','PREMIUM');
create type profile_visibility  as enum ('PRIVATE','PUBLIC');
create type collaboration_status as enum ('PENDING','ACTIVE','REVOKED');
create type service_unit        as enum ('PEZZO','PERSONA','ORA','EVENTO');
create type modifier_type       as enum ('PERCENT','FIXED');
create type entry_status        as enum ('IN_TRATTATIVA','OPZIONATA','CONFERMATA','RIFIUTATA','CANCELLATA');
create type quote_status        as enum ('BOZZA','INVIATO','ACCETTATO','RIFIUTATO','CONVERTITO_IN_CONTRATTO');
create type pdf_variant         as enum ('NEUTRA','PREMIUM');

-- 3. profiles (estende auth.users) -------------------------------------------
create table profiles (
  id                        uuid primary key references auth.users(id) on delete cascade,
  role                      user_role not null,
  subrole                   text,
  full_name                 varchar(160),
  business_name             varchar(160),
  phone                     varchar(40),
  profile_visibility        profile_visibility not null default 'PRIVATE',
  subscription_tier         subscription_tier  not null default 'FREE',
  brand_logo_url            text,
  brand_primary_color       varchar(7),
  brand_secondary_color     varchar(7),
  default_markup_percent    numeric(5,2) not null default 0
                            check (default_markup_percent between -100 and 1000),
  notification_preferences  jsonb not null default '{"immediate":true,"digest":false}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index idx_profiles_role        on profiles(role);
create index idx_profiles_subrole     on profiles(subrole) where subrole is not null;
create index idx_profiles_tier        on profiles(subscription_tier);

-- 4. collaborations -----------------------------------------------------------
create table collaborations (
  id              uuid primary key default gen_random_uuid(),
  capostipite_id  uuid not null references profiles(id) on delete cascade,
  fornitore_id    uuid not null references profiles(id) on delete cascade,
  status          collaboration_status not null default 'PENDING',
  invite_token    uuid not null default gen_random_uuid(),
  invited_at      timestamptz not null default now(),
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (capostipite_id, fornitore_id),
  check (capostipite_id <> fornitore_id)
);

create index idx_collab_capo_active  on collaborations(capostipite_id) where status = 'ACTIVE';
create index idx_collab_forn_active  on collaborations(fornitore_id)   where status = 'ACTIVE';
create index idx_collab_token        on collaborations(invite_token);

-- 5. service_categories -------------------------------------------------------
create table service_categories (
  id            uuid primary key default gen_random_uuid(),
  name          varchar(120) not null,
  slug          varchar(120) not null unique,
  subrole       text,
  is_standard   boolean not null default false,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_cat_subrole on service_categories(subrole) where subrole is not null;
create index idx_cat_standard on service_categories(is_standard);

-- 6. services -----------------------------------------------------------------
create table services (
  id            uuid primary key default gen_random_uuid(),
  fornitore_id  uuid not null references profiles(id) on delete cascade,
  category_id   uuid not null references service_categories(id) on delete restrict,
  name          varchar(160) not null,
  description   text,
  base_price    numeric(10,2) not null check (base_price >= 0),
  unit          service_unit not null default 'PEZZO',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_services_fornitore on services(fornitore_id) where is_active;
create index idx_services_category  on services(category_id);

-- 7. price_versions -----------------------------------------------------------
create table price_versions (
  id           uuid primary key default gen_random_uuid(),
  service_id   uuid not null references services(id) on delete cascade,
  price        numeric(10,2) not null check (price >= 0),
  valid_from   timestamptz not null default now(),
  valid_until  timestamptz,
  created_at   timestamptz not null default now()
);

create index idx_price_versions_service_current
  on price_versions(service_id) where valid_until is null;
create index idx_price_versions_service_history
  on price_versions(service_id, valid_from desc);

-- 8. service_photos -----------------------------------------------------------
create table service_photos (
  id              uuid primary key default gen_random_uuid(),
  service_id      uuid not null references services(id) on delete cascade,
  original_url    text not null,
  thumbnail_url   text not null,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_photos_service on service_photos(service_id, sort_order);

-- 9. service_modifiers --------------------------------------------------------
create table service_modifiers (
  id             uuid primary key default gen_random_uuid(),
  service_id     uuid not null references services(id) on delete cascade,
  name           varchar(120) not null,
  description    text,
  modifier_type  modifier_type not null,
  value          numeric(10,2) not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_modifiers_service on service_modifiers(service_id);

-- 10. calendar_entries --------------------------------------------------------
create table calendar_entries (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  title         varchar(200) not null,
  client_name   varchar(160),
  client_email  varchar(200),
  date_from     date not null,
  date_to       date not null,
  status        entry_status not null default 'IN_TRATTATIVA',
  value_amount  numeric(12,2),
  notes         text,
  quote_id      uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (date_to >= date_from)
);

create index idx_calentry_owner_date on calendar_entries(owner_id, date_from);
create index idx_calentry_status     on calendar_entries(status);
create index idx_calentry_date       on calendar_entries(date_from, date_to);

-- 11. calendar_entry_participants --------------------------------------------
create table calendar_entry_participants (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references calendar_entries(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  role_in_entry text,
  confirmed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (entry_id, user_id)
);

create index idx_partic_entry on calendar_entry_participants(entry_id);
create index idx_partic_user  on calendar_entry_participants(user_id);

-- 12. quotes ------------------------------------------------------------------
create table quotes (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references profiles(id) on delete cascade,
  title                    varchar(200) not null,
  client_name              varchar(160),
  client_email             varchar(200),
  event_date               date,
  guest_count              int,
  status                   quote_status not null default 'BOZZA',
  revision                 int not null default 1,
  access_token             uuid unique,
  default_markup_percent   numeric(5,2) not null default 0,
  total_cost               numeric(12,2) not null default 0,
  total_client             numeric(12,2) not null default 0,
  margin_amount            numeric(12,2) not null default 0,
  margin_percent           numeric(7,2)  not null default 0,
  pdf_url                  text,
  pdf_variant              pdf_variant not null default 'NEUTRA',
  sent_at                  timestamptz,
  accepted_at              timestamptz,
  rejected_at              timestamptz,
  rejection_reason         text,
  sent_email_log           jsonb not null default '[]'::jsonb,
  client_response_log      jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_quotes_owner_status on quotes(owner_id, status);
create index idx_quotes_event_date   on quotes(event_date);
create index idx_quotes_token        on quotes(access_token) where access_token is not null;

-- FK calendar_entries.quote_id -> quotes (aggiunta dopo creazione quotes per evitare circolarita`)
alter table calendar_entries
  add constraint calendar_entries_quote_fk
  foreign key (quote_id) references quotes(id) on delete set null;

-- 13. quote_items -------------------------------------------------------------
create table quote_items (
  id                    uuid primary key default gen_random_uuid(),
  quote_id              uuid not null references quotes(id) on delete cascade,
  service_id            uuid references services(id) on delete set null,
  supplier_id           uuid references profiles(id) on delete set null,
  name_snapshot         varchar(200) not null,
  description_snapshot  text,
  unit_snapshot         service_unit not null default 'PEZZO',
  snapshot_price        numeric(10,2) not null check (snapshot_price >= 0),
  quantity              numeric(10,2) not null default 1 check (quantity > 0),
  modifiers_applied     jsonb not null default '[]'::jsonb,
  item_markup_percent   numeric(5,2),
  line_cost             numeric(12,2) not null default 0,
  line_client           numeric(12,2) not null default 0,
  sort_order            int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_qitems_quote     on quote_items(quote_id, sort_order);
create index idx_qitems_supplier  on quote_items(supplier_id);
create index idx_qitems_service   on quote_items(service_id);

-- 14. quote_supplier_markups --------------------------------------------------
create table quote_supplier_markups (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid not null references quotes(id) on delete cascade,
  supplier_id     uuid not null references profiles(id) on delete cascade,
  markup_percent  numeric(5,2) not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (quote_id, supplier_id)
);

create index idx_qsm_quote on quote_supplier_markups(quote_id);

-- 15. notification_queue ------------------------------------------------------
create table notification_queue (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles(id) on delete cascade,
  event_type     text not null,
  payload        jsonb not null,
  scheduled_for  timestamptz not null default now(),
  sent_at        timestamptz,
  attempts       int not null default 0,
  last_error     text,
  created_at     timestamptz not null default now()
);

create index idx_notif_pending on notification_queue(scheduled_for) where sent_at is null;
create index idx_notif_user    on notification_queue(user_id, created_at desc);

-- 16. calendar_export_tokens --------------------------------------------------
create table calendar_export_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  expires_at  timestamptz not null default (now() + interval '90 days'),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

create index idx_export_tokens_user on calendar_export_tokens(user_id);
