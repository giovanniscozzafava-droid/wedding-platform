-- P0-2 HOTFIX (audit calendario 13/07/2026): check_owner_date_busy referenziava ce.event_date e ce.kind
-- — colonne MAI esistite: calendar_entries ha date_from/date_to (26/05: event_kind). PL/pgSQL non valida
-- i corpi a create-time → la funzione esplodeva a OGNI chiamata runtime, e QuotesPage.tsx ingoiava l'errore
-- (catch vuoto) → l'avviso anti-doppia-prenotazione "data occupata" non è MAI apparso a nessun utente.
-- Fix: (1) ce.kind → ce.event_kind; (2) match per INTERVALLO (un allestimento su più giorni blocca tutti i giorni).
-- In coda uno SMOKE-TEST che esegue le stesse SELECT: se una colonna referenziata non esiste, la migration
-- FALLISCE qui e non arriva mai in produzione rotta (contromisura al drift schema↔codice).

create or replace function check_owner_date_busy(p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_owner uuid := auth.uid();
  v_quotes jsonb; v_entries jsonb; v_busy boolean := false;
begin
  if v_owner is null or p_date is null then
    return jsonb_build_object('busy', false, 'quotes', '[]'::jsonb, 'entries', '[]'::jsonb);
  end if;

  -- Preventivi sulla stessa data (ACCETTATO/INVIATO bloccano; BOZZA informativo)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'title', q.title, 'client_name', q.client_name,
    'status', q.status, 'total_client', q.total_client, 'revision', q.revision
  ) order by case q.status when 'ACCETTATO' then 0 when 'INVIATO' then 1 else 2 end), '[]'::jsonb)
  into v_quotes
  from quotes q
  where q.owner_id = v_owner
    and q.event_date = p_date
    and q.status in ('BOZZA', 'INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO');

  -- Calendar entries: la data cade nell'INTERVALLO dell'evento (allestimento multi-giorno → blocca ogni giorno)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', ce.id, 'title', ce.title, 'status', ce.status, 'kind', ce.event_kind
  )), '[]'::jsonb)
  into v_entries
  from calendar_entries ce
  where ce.owner_id = v_owner
    and p_date between ce.date_from and ce.date_to
    and ce.status in ('IN_TRATTATIVA', 'OPZIONATA', 'CONFERMATA');

  v_busy := (v_quotes <> '[]'::jsonb) or (v_entries <> '[]'::jsonb);
  return jsonb_build_object('busy', v_busy, 'quotes', v_quotes, 'entries', v_entries);
end$$;

grant execute on function check_owner_date_busy(date) to authenticated;

comment on function check_owner_date_busy(date) is
  'Verifica se la data ha gia preventivi (stato attivo) o calendar entries (in trattativa/opzionata/confermata) nell''INTERVALLO date_from..date_to, per auth.uid(). Usato dal dialog Nuovo preventivo.';

-- SMOKE-TEST colonne: le stesse SELECT su 0 righe → se una colonna non esiste, questa migration fallisce.
do $$
begin
  perform q.id, q.title, q.client_name, q.status, q.total_client, q.revision
    from public.quotes q
    where q.owner_id is null and q.event_date = current_date
      and q.status in ('BOZZA', 'INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO');
  perform ce.id, ce.title, ce.status, ce.event_kind
    from public.calendar_entries ce
    where ce.owner_id is null and current_date between ce.date_from and ce.date_to
      and ce.status in ('IN_TRATTATIVA', 'OPZIONATA', 'CONFERMATA');
end $$;
