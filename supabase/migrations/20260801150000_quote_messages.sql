-- Chat CLIENTE <-> PROFESSIONISTA legata al PREVENTIVO (anche suggerito/cieco): il cliente fa
-- domande, il professionista risponde e puo' RICHIEDERE UNA CALL (messaggio speciale). Accesso solo
-- via RPC SECURITY DEFINER: il professionista non vede mai i contatti del cliente (nessun PII in chat).
create table if not exists public.quote_messages (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sender_id uuid not null,
  sender_role text not null check (sender_role in ('CLIENT','PRO')),
  kind text not null default 'MESSAGE' check (kind in ('MESSAGE','CALL_REQUEST')),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists idx_quote_messages_quote on public.quote_messages(quote_id, created_at);
alter table public.quote_messages enable row level security;
-- Nessuna policy: si accede solo tramite le RPC sotto (che verificano di essere parte del preventivo).
revoke all on public.quote_messages from anon, authenticated;

-- Ruolo del chiamante rispetto al preventivo: 'PRO' (proprietario) o 'CLIENT' (membro dell'evento
-- via chiave-evento) oppure null (estraneo). Riusa quote_event_key per i preventivi suggeriti.
create or replace function public._quote_party(p_quote uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_key text;
begin
  if v_uid is null then return null; end if;
  select owner_id into v_owner from public.quotes where id = p_quote;
  if v_owner is null then return null; end if;
  if v_owner = v_uid then return 'PRO'; end if;
  v_key := public.quote_event_key(p_quote);
  if exists (
    select 1 from public.wedding_couple_members m
    join public.calendar_entries ce on ce.id = m.entry_id
    where m.user_id = v_uid and (ce.quote_id = p_quote or (v_key is not null and public.quote_event_key(ce.quote_id) = v_key))
  ) then return 'CLIENT'; end if;
  if public.is_admin() then return 'PRO'; end if;
  return null;
end$$;

-- Legge il thread e segna come letti i messaggi ricevuti dall'altra parte.
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
      'created_at', created_at, 'mine', (sender_role = v_party)
    ) order by created_at), '[]'::jsonb) into v_msgs
  from public.quote_messages where quote_id = p_quote;
  return jsonb_build_object('ok', true, 'party', v_party, 'messages', v_msgs);
end$$;

-- Invia un messaggio (o una CALL_REQUEST, solo dal professionista) e notifica l'altra parte.
create or replace function public.quote_send_message(p_quote uuid, p_body text, p_kind text default 'MESSAGE')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_party text; v_uid uuid := auth.uid(); v_owner uuid; v_title text; v_kind_ev text;
        v_body text := btrim(coalesce(p_body,'')); v_kind text := coalesce(p_kind,'MESSAGE'); v_id uuid; m record;
begin
  v_party := public._quote_party(p_quote);
  if v_party is null then return jsonb_build_object('error','forbidden'); end if;
  if v_kind not in ('MESSAGE','CALL_REQUEST') then v_kind := 'MESSAGE'; end if;
  if v_kind = 'CALL_REQUEST' and v_party <> 'PRO' then return jsonb_build_object('error','only_pro_call'); end if;
  if v_kind = 'CALL_REQUEST' and v_body = '' then v_body := 'Vorrei fissare una call con te per parlarne meglio. Quando ti è comodo?'; end if;
  if v_body = '' then return jsonb_build_object('error','empty'); end if;
  if length(v_body) > 4000 then v_body := left(v_body, 4000); end if;

  insert into public.quote_messages(quote_id, sender_id, sender_role, kind, body)
    values (p_quote, v_uid, v_party, v_kind, v_body) returning id into v_id;

  select owner_id, title, event_kind into v_owner, v_title, v_kind_ev from public.quotes where id = p_quote;

  if v_party = 'CLIENT' then
    -- avvisa il professionista
    perform public.push_user_notification(v_owner, 'QUOTE_MESSAGE',
      'Nuovo messaggio dal cliente',
      'Un cliente ti ha scritto sul preventivo' || coalesce(' «' || v_title || '»','') || ': ' || left(v_body, 120),
      '/quotes/' || p_quote::text, v_id);
  else
    -- avvisa i membri dell'evento (la coppia)
    for m in
      select distinct wm.user_id from public.wedding_couple_members wm
      join public.calendar_entries ce on ce.id = wm.entry_id
      where ce.quote_id = p_quote or public.quote_event_key(ce.quote_id) = public.quote_event_key(p_quote)
    loop
      perform public.push_user_notification(m.user_id,
        case when v_kind = 'CALL_REQUEST' then 'QUOTE_CALL' else 'QUOTE_MESSAGE' end,
        case when v_kind = 'CALL_REQUEST' then 'Un professionista vuole fissare una call' else 'Nuovo messaggio da un professionista' end,
        left(v_body, 140), '/couple?tab=preventivo', v_id);
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'kind', v_kind);
end$$;

revoke all on function public._quote_party(uuid) from anon, public;
revoke all on function public.quote_thread(uuid) from anon, public;
revoke all on function public.quote_send_message(uuid, text, text) from anon, public;
grant execute on function public.quote_thread(uuid) to authenticated;
grant execute on function public.quote_send_message(uuid, text, text) to authenticated;
