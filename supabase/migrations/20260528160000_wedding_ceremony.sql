-- ============================================================================
-- Cerimonia matrimonio: tipo (religioso/civile/simbolico/elopement/misto/altro)
-- + dati luogo della cerimonia (chiesa / municipio / location) + stato prenotaz.
-- ----------------------------------------------------------------------------
-- Per le foto di valutazione (sopralluogo chiesa, foto del luogo da decidere)
-- riusiamo mood_images con tag='cerimonia' invece di creare una nuova tabella.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ceremony_type') then
    create type ceremony_type as enum (
      'RELIGIOUS',   -- religioso (chiesa, sinagoga, moschea…)
      'CIVIL',       -- civile (municipio, sala consiliare…)
      'SYMBOLIC',    -- simbolico (celebrante laico, rito personale)
      'ELOPEMENT',   -- fuga d'amore — pochi presenti, luogo intimo
      'MIXED',       -- religioso + civile insieme
      'OTHER'        -- altro
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ceremony_status') then
    create type ceremony_status as enum (
      'TO_DEFINE',   -- da definire
      'EVALUATING',  -- in valutazione (foto/sopralluoghi in corso)
      'REQUESTED',   -- richiesta inviata, in attesa
      'BOOKED',      -- prenotato/confermato dal luogo
      'CANCELLED'    -- annullato
    );
  end if;
end$$;

alter table calendar_entries
  add column if not exists ceremony_type        ceremony_type,
  add column if not exists ceremony_status      ceremony_status not null default 'TO_DEFINE',
  add column if not exists ceremony_venue_name  varchar(200),
  add column if not exists ceremony_venue_address text,
  add column if not exists ceremony_city        varchar(120),
  add column if not exists ceremony_date        timestamptz,    -- giorno+ora della cerimonia (può differire da date_from se ricevimento è altro giorno)
  add column if not exists ceremony_contact_name  varchar(160),
  add column if not exists ceremony_contact_phone varchar(40),
  add column if not exists ceremony_contact_email varchar(200),
  add column if not exists ceremony_notes       text;

comment on column calendar_entries.ceremony_type is 'Tipo di cerimonia (religioso, civile, simbolico, elopement, misto, altro)';
comment on column calendar_entries.ceremony_status is 'Stato della prenotazione del luogo della cerimonia';

-- Niente nuova tabella foto: usiamo mood_images con tag='cerimonia'
-- (vedi RLS guests_select_owner_or_part su event_guests come pattern).
