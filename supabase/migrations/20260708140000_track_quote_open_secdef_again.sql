-- Ri-assere (di nuovo) track_quote_open come SECURITY DEFINER: un processo concorrente la sta
-- flippando a INVOKER, che rompe il tracking per il cliente ANONIMO (RLS su quotes blocca l'update
-- di chi non è owner). Deve restare DEFINER: è token-scoped, nessuna escalation. + drop diag.
drop function if exists public._diag_force(uuid);

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
