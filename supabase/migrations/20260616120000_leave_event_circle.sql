-- BUG "forbidden" sull'eliminazione evento: un FORNITORE/collaboratore che vede un evento
-- nel proprio hub perché è nel CERCHIO (non ne è owner) cliccava il cestino → la RPC
-- delete_event_with_consent giustamente nega ('forbidden': un fornitore non può cancellare
-- l'intero evento della coppia con foto/dati altrui). Mancava però l'azione legittima:
-- USCIRE dal cerchio. Questa RPC rimuove SOLO la propria membership; evento e dati altrui restano.
create or replace function public.leave_event_circle(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid;
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_owner = v_uid then return jsonb_build_object('error', 'owner_cannot_leave'); end if;

  delete from public.calendar_entry_participants where entry_id = p_entry and user_id = v_uid;
  -- annulla un eventuale credito-segnalazione di cui sono debitore su questo evento (esco, non lavoro più)
  update public.supplier_credits set status = 'CANCELLED'
    where entry_id = p_entry and debtor_id = v_uid and status = 'PENDING';
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.leave_event_circle(uuid) to authenticated;
