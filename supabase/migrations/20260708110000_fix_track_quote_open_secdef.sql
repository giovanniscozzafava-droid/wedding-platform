-- FIX tracking aperture: garantisce che track_quote_open scriva anche per il CLIENTE anonimo.
-- Sintomo: il chiamante anon otteneva 0 righe aggiornate (open_count/quote_views fermi), mentre
-- service_role funzionava → la funzione non stava girando come SECURITY DEFINER per l'anon, quindi
-- l'UPDATE su quotes veniva filtrato dalla RLS (policy owner_id = auth.uid(); anon → null → 0 righe).
-- Ri-assero la definizione CANONICA (identica a 20260621270000): SECURITY DEFINER + grant anon.
-- È un endpoint pubblico legittimo: aggiorna SOLO la riga il cui access_token combacia (nessuna
-- escalation). NON è tra le RPC chiuse da SEC-03 (seed_user/push_user_notification/fb_ai_*/stripe).
create or replace function public.track_quote_open(p_token uuid, p_ua text default null)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_owner uuid; v_first boolean; v_client text;
begin
  update public.quotes
     set open_count = open_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = now()
   where access_token = p_token
     and token_revoked_at is null
   returning id, owner_id, (open_count = 1), client_name into v_id, v_owner, v_first, v_client;
  if v_id is not null then
    insert into public.quote_views (quote_id, event_type, payload, user_agent)
    values (v_id, 'OPEN', '{}'::jsonb, left(p_ua, 300));
    perform public.log_access('quotes', v_id::text, 'READ', jsonb_build_object('op','quote_open'));
    if v_first and v_owner is not null then
      perform public.push_user_notification(v_owner, 'QUOTE_OPENED', 'Preventivo aperto dal cliente',
        coalesce(nullif(v_client,''), 'Il cliente') || ' ha aperto il tuo preventivo per la prima volta.',
        '/quotes/' || v_id, v_id);
    end if;
  end if;
end$$;
grant execute on function public.track_quote_open(uuid, text) to anon, authenticated;
