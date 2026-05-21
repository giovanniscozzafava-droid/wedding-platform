-- ============================================================================
-- Wedding Platform — Logistica matrimoni 2026 (locale + destination)
-- ============================================================================

-- 1. Calendar entry: destination + wedding website ---------------------------
alter table calendar_entries
  add column if not exists is_destination boolean not null default false,
  add column if not exists destination_location varchar(160),
  add column if not exists destination_country varchar(80),
  add column if not exists destination_language varchar(20),
  add column if not exists wedding_website_slug varchar(60) unique,
  add column if not exists wedding_website_published boolean not null default false,
  add column if not exists wedding_website_data jsonb not null default '{}'::jsonb,
    -- { hero_image, story, programme[], location_info, accommodation_info,
    --   travel_info, gift_registry_url, dress_code, hashtag, contacts }
  add column if not exists honeymoon_destination varchar(160),
  add column if not exists honeymoon_start date,
  add column if not exists honeymoon_end date,
  add column if not exists honeymoon_notes text;

create index if not exists idx_calentry_slug on calendar_entries(wedding_website_slug) where wedding_website_slug is not null;

-- 2. Alloggi ----------------------------------------------------------------
create type accommodation_kind as enum ('HOTEL','BNB','AIRBNB','VILLA_PRIVATA','APPARTAMENTO','RESORT');

create table if not exists event_accommodations (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  kind            accommodation_kind not null default 'HOTEL',
  name            varchar(160) not null,
  address         varchar(260),
  city            varchar(120),
  country         varchar(80),
  contact_email   varchar(200),
  contact_phone   varchar(40),
  url             text,
  checkin_date    date,
  checkout_date   date,
  rate_per_night  numeric(10,2),
  currency        varchar(8) default 'EUR',
  rooms_blocked   int default 0,
  rooms_used      int default 0,
  promo_code      varchar(60),
  distance_km     numeric(6,2),
  notes           text,
  cover_image_url text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_acc_entry on event_accommodations(entry_id);
create trigger trg_acc_updated_at before update on event_accommodations
  for each row execute function set_updated_at();

alter table event_accommodations enable row level security;
create policy "acc_select_owner_or_part" on event_accommodations for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "acc_modify_owner" on event_accommodations for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Assegnazione invitati → alloggio
alter table event_guests
  add column if not exists accommodation_id uuid references event_accommodations(id) on delete set null,
  add column if not exists nights_count int,
  add column if not exists room_share_with text,
  add column if not exists travel_origin varchar(160),
  add column if not exists arrival_at timestamptz,
  add column if not exists departure_at timestamptz,
  add column if not exists needs_transport boolean not null default false;

-- 3. Trasporti --------------------------------------------------------------
create type transport_kind as enum (
  'AUTO_SPOSI','PULMINO_NAVETTA','AUTOBUS_GRUPPO','TRENO_GRUPPO',
  'VOLO_GRUPPO','AUTO_NOLEGGIO','TAXI_NCC','BARCA','ALTRO'
);

create table if not exists event_transport (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references calendar_entries(id) on delete cascade,
  kind          transport_kind not null default 'PULMINO_NAVETTA',
  label         varchar(160) not null,
  provider      varchar(160),
  contact_phone varchar(40),
  contact_email varchar(200),
  capacity      int,
  passengers_count int default 0,
  depart_at     timestamptz,
  depart_from   varchar(260),
  arrive_at     timestamptz,
  arrive_to     varchar(260),
  route_notes   text,
  cost          numeric(10,2),
  currency      varchar(8) default 'EUR',
  driver_name   varchar(120),
  flight_number varchar(40),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_transport_entry on event_transport(entry_id, depart_at);
create trigger trg_transport_updated_at before update on event_transport
  for each row execute function set_updated_at();

alter table event_transport enable row level security;
create policy "transport_select_owner_or_part" on event_transport for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "transport_modify_owner" on event_transport for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Aggancio invitati → trasporto
create table if not exists event_transport_assignments (
  id            uuid primary key default gen_random_uuid(),
  transport_id  uuid not null references event_transport(id) on delete cascade,
  guest_id      uuid not null references event_guests(id) on delete cascade,
  seat          varchar(20),
  notes         text,
  unique (transport_id, guest_id)
);
create index if not exists idx_ta_trans on event_transport_assignments(transport_id);
create index if not exists idx_ta_guest on event_transport_assignments(guest_id);

alter table event_transport_assignments enable row level security;
create policy "ta_select_owner" on event_transport_assignments for select using (
  exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id
    where t.id = transport_id and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "ta_modify_owner" on event_transport_assignments for all using (
  exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id
    where t.id = transport_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from event_transport t join calendar_entries ce on ce.id = t.entry_id
    where t.id = transport_id and ce.owner_id = auth.uid())
);

-- 4. Gadget / bomboniere / inviti / tableau / wedding favors -----------------
create type gadget_kind as enum (
  'BOMBONIERA','CONFETTI','WELCOME_BAG','SAVE_THE_DATE','INVITO',
  'MENU_STAMPATO','TABLEAU','SEGNAPOSTO','LIBRO_FIRME','RINGRAZIAMENTO',
  'GADGET','ALTRO'
);

create table if not exists event_gadgets (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  kind            gadget_kind not null default 'GADGET',
  name            varchar(160) not null,
  description     text,
  supplier_id     uuid references profiles(id) on delete set null,
  supplier_external varchar(160),
  quantity        int not null default 1,
  quantity_basis  quantity_basis not null default 'FLAT',
  unit_cost       numeric(10,2),
  total_cost      numeric(12,2),
  currency        varchar(8) default 'EUR',
  status          text not null default 'IDEA' check (status in ('IDEA','APPROVATO','ORDINATO','RICEVUTO','CONSEGNATO')),
  due_at          date,
  cover_image_url text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_gadgets_entry on event_gadgets(entry_id, kind);
create trigger trg_gadgets_updated_at before update on event_gadgets
  for each row execute function set_updated_at();

alter table event_gadgets enable row level security;
create policy "gadgets_select_owner_or_part" on event_gadgets for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "gadgets_modify_owner" on event_gadgets for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Trigger: ricalcola total_cost = unit_cost * quantity
create or replace function gadgets_compute_total()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.unit_cost is not null and new.quantity is not null then
    new.total_cost := round(new.unit_cost * new.quantity, 2);
  end if;
  return new;
end$$;
create trigger trg_gadgets_total before insert or update on event_gadgets
  for each row execute function gadgets_compute_total();

-- 5. Sub-eventi (addio nubilato, rehearsal, brunch, engagement, ecc.) ------
create type subevent_kind as enum (
  'ADDIO_NUBILATO','ADDIO_CELIBATO','PRE_WEDDING_SHOOT','ENGAGEMENT_PARTY',
  'CENA_PROVE','REHEARSAL','WELCOME_DINNER','BRUNCH_POST','HONEYMOON_DEPART',
  'BABY_SHOWER','ALTRO'
);

create table if not exists event_subevents (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references calendar_entries(id) on delete cascade,
  kind          subevent_kind not null default 'ALTRO',
  title         varchar(200) not null,
  description   text,
  date_at       timestamptz,
  duration_min  int,
  location      varchar(260),
  capacity      int,
  attending_count int default 0,
  budget        numeric(12,2),
  organizer     varchar(160),
  contact_phone varchar(40),
  status        text not null default 'PIANIFICATO' check (status in ('PIANIFICATO','CONFERMATO','COMPLETATO','CANCELLATO')),
  notes         text,
  cover_image_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_sub_entry on event_subevents(entry_id, date_at);
create trigger trg_sub_updated_at before update on event_subevents
  for each row execute function set_updated_at();

alter table event_subevents enable row level security;
create policy "sub_select_owner_or_part" on event_subevents for select using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id
    and (ce.owner_id = auth.uid() or is_entry_participant(ce.id)))
  or is_admin()
);
create policy "sub_modify_owner" on event_subevents for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- 6. Wedding website pubblico - RPC ----------------------------------------
-- accesso pubblico al wedding site via slug per ospiti
create or replace function wedding_site_get(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ce calendar_entries%rowtype;
  v_owner record;
  v_sub jsonb;
  v_acc jsonb;
  v_tr  jsonb;
begin
  select * into v_ce from calendar_entries where wedding_website_slug = p_slug and wedding_website_published = true;
  if v_ce.id is null then return null; end if;

  select full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color
    into v_owner from profiles where id = v_ce.owner_id;

  select jsonb_agg(jsonb_build_object(
    'id', se.id, 'kind', se.kind, 'title', se.title, 'description', se.description,
    'date_at', se.date_at, 'duration_min', se.duration_min, 'location', se.location,
    'cover_image_url', se.cover_image_url
  ) order by se.date_at)
  into v_sub from event_subevents se
  where se.entry_id = v_ce.id and se.status in ('PIANIFICATO','CONFERMATO');

  select jsonb_agg(jsonb_build_object(
    'id', a.id, 'kind', a.kind, 'name', a.name, 'address', a.address,
    'city', a.city, 'country', a.country, 'url', a.url, 'rate_per_night', a.rate_per_night,
    'currency', a.currency, 'promo_code', a.promo_code, 'distance_km', a.distance_km,
    'cover_image_url', a.cover_image_url
  ))
  into v_acc from event_accommodations a where a.entry_id = v_ce.id;

  select jsonb_agg(jsonb_build_object(
    'id', t.id, 'kind', t.kind, 'label', t.label, 'depart_at', t.depart_at,
    'depart_from', t.depart_from, 'arrive_at', t.arrive_at, 'arrive_to', t.arrive_to,
    'capacity', t.capacity, 'route_notes', t.route_notes
  ) order by t.depart_at)
  into v_tr from event_transport t where t.entry_id = v_ce.id;

  return jsonb_build_object(
    'wedding', jsonb_build_object(
      'id', v_ce.id,
      'title', v_ce.title,
      'client_name', v_ce.client_name,
      'date_from', v_ce.date_from,
      'date_to', v_ce.date_to,
      'is_destination', v_ce.is_destination,
      'destination_location', v_ce.destination_location,
      'destination_country', v_ce.destination_country,
      'destination_language', v_ce.destination_language,
      'data', v_ce.wedding_website_data
    ),
    'owner', to_jsonb(v_owner),
    'subevents', coalesce(v_sub, '[]'::jsonb),
    'accommodations', coalesce(v_acc, '[]'::jsonb),
    'transport', coalesce(v_tr, '[]'::jsonb)
  );
end$$;
revoke all on function wedding_site_get(text) from public;
grant execute on function wedding_site_get(text) to anon, authenticated;

-- RSVP pubblico ospite via slug + nome (semplificato; in v2: token per-guest)
create or replace function wedding_site_rsvp(p_slug text, p_full_name text, p_email text, p_rsvp text, p_party int, p_diet text, p_notes text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_entry uuid;
begin
  select id into v_entry from calendar_entries where wedding_website_slug = p_slug and wedding_website_published = true;
  if v_entry is null then return false; end if;

  insert into event_guests (entry_id, full_name, email, party_size, rsvp, diet, notes)
  values (v_entry, p_full_name, p_email, coalesce(p_party,1), p_rsvp::rsvp_status,
          p_diet, coalesce('RSVP web ricevuto. ' || p_notes, 'RSVP web ricevuto'));
  return true;
end$$;
revoke all on function wedding_site_rsvp(text, text, text, text, int, text, text) from public;
grant execute on function wedding_site_rsvp(text, text, text, text, int, text, text) to anon, authenticated;
