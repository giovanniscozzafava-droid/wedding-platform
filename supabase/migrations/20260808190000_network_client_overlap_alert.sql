-- ============================================================================
-- ALERT sovrapposizione di canale sulla RETE.
-- Caso: un FORNITORE singolo invia un preventivo diretto a un cliente che sta
-- già ricevendo un preventivo tramite un CAPOSTIPITE (wedding planner / location)
-- per lo STESSO evento — e viceversa. È un potenziale conflitto di canale
-- (disintermediazione): avvisiamo entrambi i professionisti (in-app) così sanno
-- di non sovrapporsi. Il cliente è condiviso (email + data evento); NON esponiamo
-- l'identità dell'altro professionista, solo il ruolo e il cliente.
--
-- Match: stessa email cliente (case-insensitive) + stessa data evento, quote vivi
-- (INVIATO/ACCETTATO/CONVERTITO), di CATEGORIE OPPOSTE (fornitore ↔ capostipite).
-- Scatta quando un preventivo passa a INVIATO. Dedup per coppia (ref = altro quote).
-- ============================================================================

create or replace function public._notify_quote_client_overlap(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_role text; v_email text; v_date date; v_cat text;
  v_client_label text;
  r record;
begin
  select q.owner_id, p.role::text, lower(trim(q.client_email)), q.event_date,
         coalesce(nullif(trim(q.client_name), ''), 'un cliente')
    into v_owner, v_role, v_email, v_date, v_client_label
    from public.quotes q
    join public.profiles p on p.id = q.owner_id
   where q.id = p_quote_id;

  if v_owner is null or v_email is null or v_email = '' or v_date is null then
    return;  -- senza email o data non possiamo appaiare in modo affidabile
  end if;

  v_cat := case
    when v_role = 'FORNITORE' then 'SUP'
    when v_role in ('WEDDING_PLANNER', 'LOCATION') then 'CAP'
    else null end;
  if v_cat is null then return; end if;

  -- Cerca preventivi vivi dello STESSO cliente/evento, di categoria OPPOSTA.
  for r in
    select q2.id as quote_id, q2.owner_id, p2.role::text as role,
           coalesce(nullif(trim(q2.client_name), ''), 'un cliente') as client_label
      from public.quotes q2
      join public.profiles p2 on p2.id = q2.owner_id
     where q2.id <> p_quote_id
       and q2.owner_id <> v_owner
       and q2.archived_at is null
       and q2.status in ('INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
       and lower(trim(q2.client_email)) = v_email
       and q2.event_date = v_date
       and case
             when v_cat = 'SUP' then p2.role::text in ('WEDDING_PLANNER', 'LOCATION')
             when v_cat = 'CAP' then p2.role::text = 'FORNITORE'
             else false end
  loop
    -- Avvisa il proprietario del NUOVO preventivo (una volta per coppia).
    if not exists (
      select 1 from public.user_notifications
       where user_id = v_owner and type = 'NETWORK_CLIENT_OVERLAP' and ref_id = r.quote_id
    ) then
      perform public.push_user_notification(v_owner, 'NETWORK_CLIENT_OVERLAP',
        'Attenzione: cliente già in trattativa sulla rete',
        'Il cliente «' || v_client_label || '» sta ricevendo un preventivo per lo stesso evento anche da '
          || case when v_cat = 'SUP' then 'un capostipite (wedding planner o location)' else 'un fornitore diretto' end
          || '. Verificate di non sovrapporvi.',
        '/quotes/' || p_quote_id::text, r.quote_id);
    end if;

    -- Avvisa il proprietario dell'ALTRO preventivo (simmetrico).
    if not exists (
      select 1 from public.user_notifications
       where user_id = r.owner_id and type = 'NETWORK_CLIENT_OVERLAP' and ref_id = p_quote_id
    ) then
      perform public.push_user_notification(r.owner_id, 'NETWORK_CLIENT_OVERLAP',
        'Attenzione: cliente già in trattativa sulla rete',
        'Il cliente «' || r.client_label || '» sta ricevendo un preventivo per lo stesso evento anche da '
          || case when v_cat = 'SUP' then 'un fornitore diretto' else 'un capostipite (wedding planner o location)' end
          || '. Verificate di non sovrapporvi.',
        '/quotes/' || r.quote_id::text, p_quote_id);
    end if;
  end loop;
exception when others then
  null;  -- non bloccare mai l'invio del preventivo per un errore dell'alert
end$$;
revoke all on function public._notify_quote_client_overlap(uuid) from public, anon, authenticated;

create or replace function public._tg_quote_client_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'INVIATO' and coalesce(old.status::text, '') <> 'INVIATO' then
    perform public._notify_quote_client_overlap(new.id);
  end if;
  return new;
end$$;

drop trigger if exists trg_quote_client_overlap on public.quotes;
create trigger trg_quote_client_overlap
  after update of status on public.quotes
  for each row execute function public._tg_quote_client_overlap();
