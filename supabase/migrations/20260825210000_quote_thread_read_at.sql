-- Chat preventivo: esporre read_at nel payload del thread così la UI può mostrare
-- la conferma di lettura ("Letto") sui propri messaggi. read_at è GIA' valorizzato
-- da quote_thread quando l'altra parte apre il thread (marca letti i messaggi ricevuti).
create or replace function public.quote_thread(p_quote uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_party text; v_msgs jsonb;
begin
  v_party := public._quote_party(p_quote);
  if v_party is null then return jsonb_build_object('error','forbidden'); end if;
  update public.quote_messages set read_at = now()
    where quote_id = p_quote and read_at is null and sender_role <> v_party;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'sender_role', sender_role, 'kind', kind, 'body', body,
      'created_at', created_at, 'read_at', read_at, 'mine', (sender_role = v_party)
    ) order by created_at), '[]'::jsonb) into v_msgs
  from public.quote_messages where quote_id = p_quote;
  return jsonb_build_object('ok', true, 'party', v_party, 'messages', v_msgs);
end$$;
