-- Chiude i buchi notifica IN-APP (campanello = user_notifications via list_notifications).
--  1) FIX: l'admin-notify su registrazione scriveva in `notifiche` (tabella sbagliata, non nel
--     campanello). Ora usa push_user_notification (user_notifications).
--  2) NUOVO: preventivo APERTO/visto dal cliente la prima volta → notifica al professionista.
-- (Preventivo accettato e contratto firmato gia' notificano via push_user_notification.)

-- 1) admin: notifica corretta su ogni nuova registrazione
create or replace function public.trg_admin_notify_new_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; v_who text; v_role text;
begin
  v_role := coalesce(new.role::text, 'utente');
  v_who  := coalesce(nullif(btrim(new.business_name), ''), nullif(btrim(new.full_name), ''), 'Nuovo utente');
  for a in select id from public.profiles where role = 'ADMIN' loop
    perform public.push_user_notification(a.id, 'ADMIN_SIGNUP', 'Nuova registrazione', v_role || ' · ' || v_who, '/admin', new.id);
  end loop;
  return new;
end$$;

-- 2) preventivo aperto dal cliente (prima volta) → al professionista
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
