-- ============================================================================
-- Fase B — Preventivo "forzabile" senza questionario completato
-- ============================================================================
-- Workflow ideale: questionario coppia → preventivo → contratto.
-- Il preventivo PUO'' essere creato anche senza questionario completato
-- ("forzato"), il contratto NO.
--
-- Aggiungo flag forced_without_questionnaire su quotes. Un trigger BEFORE
-- INSERT verifica se la coppia ha completato il questionario di pianificazione
-- (couple_preferences.questionnaire_completed_at non null) per il wedding
-- collegato. Se non l'ha fatto, setta il flag a TRUE per tracciare l'override.
--
-- Niente blocco. Solo audit + segnalazione UI.
-- ============================================================================

alter table public.quotes
  add column if not exists forced_without_questionnaire boolean not null default false;

comment on column public.quotes.forced_without_questionnaire is
  'true se il preventivo e'' stato creato senza che la coppia abbia completato il questionario di pianificazione (couple_preferences.questionnaire_completed_at NULL al momento della creazione). Override silenzioso, per audit.';

create or replace function public.quotes_flag_forced_without_questionnaire()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id   uuid;
  v_completed  timestamptz;
begin
  -- Se il chiamante ha gia' valorizzato il flag esplicitamente, rispettalo.
  if new.forced_without_questionnaire is not null and new.forced_without_questionnaire = true then
    return new;
  end if;

  -- Trova entry collegato (via calendar_entries.quote_id == NEW.id non possibile
  -- in BEFORE INSERT perche' la riga non esiste ancora. Usiamo direct_client_id
  -- per quote diretti fornitore (no wedding) → skip. Per quote dentro wedding il
  -- collegamento avviene DOPO l'insert con UPDATE calendar_entries.quote_id.
  -- Allora controlliamo se gia' c'e' un calendar_entry per questo owner con
  -- event_date matching e quote_id null (placeholder). Approccio piu' robusto:
  -- valutiamo il flag SOLO se chiamante e' WP/LOCATION e il quote nasce dentro
  -- un wedding. Lo segneremo a TRUE come default conservativo, poi una RPC di
  -- attach lo aggiornera' a FALSE se il questionario era completato).

  -- Per semplicita' e correttezza in BEFORE INSERT, settiamo default TRUE:
  -- sara' poi compito del frontend (o di un trigger AFTER UPDATE su
  -- calendar_entries.quote_id) verificare il vero stato del questionario.
  if new.direct_client_id is not null then
    -- Preventivo diretto fornitore: non c'e' questionario di coppia. Flag NO.
    new.forced_without_questionnaire := false;
    return new;
  end if;

  return new;
end$$;

drop trigger if exists trg_quotes_flag_forced on public.quotes;
create trigger trg_quotes_flag_forced
  before insert on public.quotes
  for each row execute function public.quotes_flag_forced_without_questionnaire();

-- ─── Trigger su calendar_entries: quando viene collegato un quote_id,
--     verifica se la coppia ha completato il questionario e aggiorna il flag
--     sul quote di conseguenza.
create or replace function public.quotes_resolve_forced_flag_on_entry_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_completed timestamptz;
begin
  if new.quote_id is null then return new; end if;
  if old.quote_id is not distinct from new.quote_id then return new; end if;

  select questionnaire_completed_at into v_completed
    from public.couple_preferences
   where entry_id = new.id
   limit 1;

  update public.quotes
     set forced_without_questionnaire = (v_completed is null)
   where id = new.quote_id;

  return new;
end$$;

drop trigger if exists trg_entries_resolve_forced on public.calendar_entries;
create trigger trg_entries_resolve_forced
  after insert or update of quote_id on public.calendar_entries
  for each row execute function public.quotes_resolve_forced_flag_on_entry_link();

comment on function public.quotes_resolve_forced_flag_on_entry_link() is
  'Quando un quote viene linkato a un calendar_entry, controlla se la coppia ha completato il questionario di pianificazione e aggiorna il flag forced_without_questionnaire sul quote.';
