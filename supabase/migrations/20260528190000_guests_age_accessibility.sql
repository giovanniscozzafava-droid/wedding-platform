-- ============================================================================
-- Invitati: distinzione adulto/bambino/infant + bisogni di accessibilita
-- ----------------------------------------------------------------------------
-- - age_group: ADULT (default), CHILD (2-12), INFANT (<2). Usato per:
--    * conteggio posti (un infant in braccio non occupa una sedia)
--    * conta menu bambini per il catering
--    * predisposizione tavoli con seggiolone
-- - accessibility_needs: array text per requisiti specifici
--   (mobilita ridotta, intolleranze gravi, dieta medica, sordita, ecc.)
-- - accessibility_notes: testo libero per dettagli
-- - high_chair_needed: booleano per seggiolone
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'guest_age_group') then
    create type guest_age_group as enum ('ADULT', 'CHILD', 'INFANT');
  end if;
end$$;

alter table event_guests
  add column if not exists age_group           guest_age_group not null default 'ADULT',
  add column if not exists accessibility_needs text[] not null default '{}',
  add column if not exists accessibility_notes text,
  add column if not exists high_chair_needed   boolean not null default false;

comment on column event_guests.age_group is 'ADULT (default) / CHILD (2-12) / INFANT (<2). INFANT non occupa posto a tavola.';
comment on column event_guests.accessibility_needs is 'Array di requisiti: MOBILITY, DEAF, BLIND, MEDICAL_DIET, INTERPRETER, ACCESSIBLE_BATHROOM, RAMP, FRONT_ROW, OTHER';
comment on column event_guests.accessibility_notes is 'Dettagli liberi (allergie gravi, accompagnatore, dispositivi, ecc.)';

create index if not exists idx_guests_age_group on event_guests(entry_id, age_group);
