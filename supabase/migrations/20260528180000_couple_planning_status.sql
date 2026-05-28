-- ============================================================================
-- Stato avanzamento coppia + fornitori/elementi gia prenotati
-- ----------------------------------------------------------------------------
-- Aggiunge a couple_preferences i campi che il WP ritrova quando la coppia
-- ha gia compilato il questionario:
--  - planning_stage: a che punto della pianificazione si trova
--  - urgency: quanto preme la data
--  - already_booked: jsonb array di {category, supplier_name, status, notes}
--  - additional_notes: testo libero
-- Tutto incasellato (non solo blob), accessibile via la stessa policy esistente.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'couple_planning_stage') then
    create type couple_planning_stage as enum (
      'JUST_ENGAGED',     -- appena fidanzati, idee non chiare
      'EXPLORING',        -- stiamo esplorando, raccogliamo idee
      'COMPARING',        -- abbiamo iniziato a confrontare preventivi
      'MOSTLY_BOOKED',    -- la maggior parte e gia prenotata
      'FINAL_DETAILS'     -- solo dettagli finali da chiudere
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'couple_urgency') then
    create type couple_urgency as enum (
      'RELAXED',    -- abbiamo tempo
      'NORMAL',     -- da qui a qualche mese
      'TIGHT',      -- la data e vicina
      'URGENT'      -- urgentissimo
    );
  end if;
end$$;

alter table couple_preferences
  add column if not exists planning_stage    couple_planning_stage,
  add column if not exists urgency           couple_urgency,
  add column if not exists already_booked    jsonb not null default '[]'::jsonb,
  add column if not exists additional_notes  text,
  add column if not exists questionnaire_completed_at timestamptz;

comment on column couple_preferences.planning_stage    is 'A che punto della pianificazione la coppia si trova';
comment on column couple_preferences.urgency           is 'Quanto preme la data, per priorita WP';
comment on column couple_preferences.already_booked    is 'Array JSON [{category, supplier_name, status, notes}] di cosa gia prenotato';
comment on column couple_preferences.additional_notes  is 'Note libere coppia per il WP';
comment on column couple_preferences.questionnaire_completed_at is 'Timestamp prima compilazione completa del questionario';

-- Helper RPC: upsert idempotente delle risposte coppia (chiamato dal questionario)
create or replace function couple_save_planning(
  p_entry_id uuid,
  p_planning_stage text,
  p_urgency text,
  p_already_booked jsonb,
  p_additional_notes text
)
returns couple_preferences
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row couple_preferences%rowtype;
  v_authorized boolean;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  select exists (
    select 1 from calendar_entries ce
     where ce.id = p_entry_id
       and (ce.owner_id = auth.uid() or is_wedding_couple(ce.id))
  ) into v_authorized;
  if not v_authorized then raise exception 'forbidden'; end if;

  insert into couple_preferences (entry_id, planning_stage, urgency, already_booked, additional_notes, questionnaire_completed_at)
  values (
    p_entry_id,
    nullif(p_planning_stage, '')::couple_planning_stage,
    nullif(p_urgency, '')::couple_urgency,
    coalesce(p_already_booked, '[]'::jsonb),
    nullif(p_additional_notes, ''),
    now()
  )
  on conflict (entry_id) do update set
    planning_stage = excluded.planning_stage,
    urgency = excluded.urgency,
    already_booked = excluded.already_booked,
    additional_notes = excluded.additional_notes,
    questionnaire_completed_at = coalesce(couple_preferences.questionnaire_completed_at, now()),
    updated_at = now()
  returning * into v_row;
  return v_row;
end$$;

grant execute on function couple_save_planning(uuid, text, text, jsonb, text) to authenticated;
