-- ============================================================================
-- CHECK OWNER DATE BUSY — usato dal dialog "Nuovo preventivo" per avvisare
-- in tempo reale se la data evento è già impegnata (quote o calendar_entry).
-- ============================================================================

create or replace function check_owner_date_busy(p_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid := auth.uid();
  v_quotes jsonb;
  v_entries jsonb;
  v_busy boolean := false;
begin
  if v_owner is null or p_date is null then
    return jsonb_build_object('busy', false, 'quotes', '[]'::jsonb, 'entries', '[]'::jsonb);
  end if;

  -- Preventivi sulla stessa data (ACCETTATO o INVIATO bloccano realmente,
  -- BOZZA solo informativo)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',           q.id,
    'title',        q.title,
    'client_name',  q.client_name,
    'status',       q.status,
    'total_client', q.total_client,
    'revision',     q.revision
  ) order by case q.status when 'ACCETTATO' then 0 when 'INVIATO' then 1 else 2 end), '[]'::jsonb)
  into v_quotes
  from quotes q
  where q.owner_id = v_owner
    and q.event_date = p_date
    and q.status in ('BOZZA', 'INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO');

  -- Calendar entries (OPZIONATA / CONFERMATA blocca, IN_TRATTATIVA tentativo)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',     ce.id,
    'title',  ce.title,
    'status', ce.status,
    'kind',   ce.kind
  )), '[]'::jsonb)
  into v_entries
  from calendar_entries ce
  where ce.owner_id = v_owner
    and ce.event_date = p_date
    and ce.status in ('IN_TRATTATIVA', 'OPZIONATA', 'CONFERMATA');

  v_busy := (v_quotes <> '[]'::jsonb) or (v_entries <> '[]'::jsonb);

  return jsonb_build_object(
    'busy',    v_busy,
    'quotes',  v_quotes,
    'entries', v_entries
  );
end$$;

grant execute on function check_owner_date_busy(date) to authenticated;

comment on function check_owner_date_busy(date) is
  'Verifica se la data ha gia preventivi (qualsiasi stato attivo) o calendar entries (in trattativa/opzionata/confermata) per auth.uid(). Usato dal dialog Nuovo preventivo per avvisare in tempo reale.';
