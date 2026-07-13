-- Default AMBITO CAPOSTIPITE sul PROFILO.
-- Il capostipite sceglie, una volta, se sui NUOVI eventi gestisce tutto (COMPLETO) oppure lascia che
-- i singoli professionisti firmino i propri preventivi/contratti (SOLO_COORDINAMENTO / SOLO_PROPRI_SERVIZI).
-- Applicato ai nuovi calendar_entries via trigger BEFORE INSERT; l'override per-evento resta possibile
-- (AmbitoIncaricoModal continua a impostare ambito_capostipite sul singolo evento).
alter table public.profiles
  add column if not exists default_ambito_capostipite public.ambito_capostipite;

comment on column public.profiles.default_ambito_capostipite is
  'Ambito predefinito del capostipite applicato ai NUOVI eventi (override per-evento su calendar_entries.ambito_capostipite). NULL = nessun default (l''evento resta NULL → trattato come COMPLETO).';

create or replace function public.tg_calentry_default_ambito()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Solo se il nuovo evento non ha già un ambito esplicito: eredita quello di default del proprietario.
  if new.ambito_capostipite is null and new.owner_id is not null then
    select default_ambito_capostipite into new.ambito_capostipite
      from public.profiles where id = new.owner_id;
  end if;
  return new;
end$$;

drop trigger if exists trg_calentry_default_ambito on public.calendar_entries;
create trigger trg_calentry_default_ambito
  before insert on public.calendar_entries
  for each row execute function public.tg_calentry_default_ambito();
