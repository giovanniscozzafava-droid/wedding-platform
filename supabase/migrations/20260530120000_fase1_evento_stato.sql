-- FASE 1.3 — Stato evento (macchina a stati)
-- Aggiungiamo un workflow esplicito al ciclo di vita dell''evento, separato dallo
-- "status" tecnico (entry_status) che rimane per compatibilita`.
--
-- Sequenza forward (solo avanti, mai indietro):
--   LEAD
--     -> INCARICO_FIRMATO         (cliente firma l''incarico)
--     -> PREVENTIVI               (raccolta preventivi fornitori)
--     -> PREVENTIVO_FIRMATO       (cliente accetta il preventivo)
--     -> CONTRATTO                (firma del contratto)
--     -> PIANIFICAZIONE           (allocazione risorse, scaletta, fornitori)
--     -> CHECKLIST                (settimana evento, checklist operative)
--     -> SVOLTO                   (post-evento)
--
-- ANNULLATO e` raggiungibile da QUALUNQUE stato che non sia SVOLTO.
-- Una volta SVOLTO o ANNULLATO, lo stato e` finale (immutabile).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'evento_stato') then
    create type public.evento_stato as enum (
      'LEAD',
      'INCARICO_FIRMATO',
      'PREVENTIVI',
      'PREVENTIVO_FIRMATO',
      'CONTRATTO',
      'PIANIFICAZIONE',
      'CHECKLIST',
      'SVOLTO',
      'ANNULLATO'
    );
  end if;
end$$;

comment on type public.evento_stato is
  'Workflow evento: LEAD -> INCARICO_FIRMATO -> PREVENTIVI -> PREVENTIVO_FIRMATO -> CONTRATTO -> PIANIFICAZIONE -> CHECKLIST -> SVOLTO. ANNULLATO da qualunque stato != SVOLTO. SVOLTO e ANNULLATO sono finali.';

alter table public.calendar_entries
  add column if not exists evento_stato public.evento_stato not null default 'LEAD';

comment on column public.calendar_entries.evento_stato is
  'Stato del workflow evento. Le transizioni sono validate dal trigger trg_calendar_entries_evento_stato.';

create index if not exists idx_calentry_evento_stato
  on public.calendar_entries(evento_stato);

-- Trigger validazione transizioni.
create or replace function public.fn_validate_evento_stato_transition()
returns trigger
language plpgsql
as $$
declare
  v_old_rank int;
  v_new_rank int;
begin
  -- Nessuna variazione → ok.
  if new.evento_stato = old.evento_stato then
    return new;
  end if;

  -- SVOLTO e ANNULLATO sono stati finali: non si esce.
  if old.evento_stato in ('SVOLTO', 'ANNULLATO') then
    raise exception
      'Transizione evento non consentita: % e` uno stato finale (da % a %).',
      old.evento_stato, old.evento_stato, new.evento_stato
      using errcode = '22023';
  end if;

  -- ANNULLATO e` raggiungibile da qualunque stato != SVOLTO (gia` filtrato sopra).
  if new.evento_stato = 'ANNULLATO' then
    return new;
  end if;

  -- Per le altre transizioni: solo "avanti" nella sequenza canonica.
  v_old_rank := case old.evento_stato
    when 'LEAD'               then 1
    when 'INCARICO_FIRMATO'   then 2
    when 'PREVENTIVI'         then 3
    when 'PREVENTIVO_FIRMATO' then 4
    when 'CONTRATTO'          then 5
    when 'PIANIFICAZIONE'     then 6
    when 'CHECKLIST'          then 7
    when 'SVOLTO'             then 8
    when 'ANNULLATO'          then 99
  end;
  v_new_rank := case new.evento_stato
    when 'LEAD'               then 1
    when 'INCARICO_FIRMATO'   then 2
    when 'PREVENTIVI'         then 3
    when 'PREVENTIVO_FIRMATO' then 4
    when 'CONTRATTO'          then 5
    when 'PIANIFICAZIONE'     then 6
    when 'CHECKLIST'          then 7
    when 'SVOLTO'             then 8
    when 'ANNULLATO'          then 99
  end;

  if v_new_rank <= v_old_rank then
    raise exception
      'Transizione evento non consentita: si puo` solo avanzare nel workflow (da % a %).',
      old.evento_stato, new.evento_stato
      using errcode = '22023';
  end if;

  return new;
end;
$$;

comment on function public.fn_validate_evento_stato_transition() is
  'Valida le transizioni di calendar_entries.evento_stato. Forward-only; ANNULLATO da qualunque stato != SVOLTO; SVOLTO/ANNULLATO sono finali.';

drop trigger if exists trg_calendar_entries_evento_stato on public.calendar_entries;
create trigger trg_calendar_entries_evento_stato
  before update of evento_stato on public.calendar_entries
  for each row
  execute function public.fn_validate_evento_stato_transition();
