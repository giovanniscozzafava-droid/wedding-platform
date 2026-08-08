-- ============================================================================
-- FIX all'alert di sovrapposizione: escludere il flusso LEGITTIMO di referral.
-- Un preventivo con quote_origin='SUPPLIER_SUGGESTION' è il fornitore SUGGERITO
-- dal capostipite stesso: capostipite + suggerito che quotano lo stesso cliente
-- è il funzionamento NORMALE della rete, non un conflitto. Il contro-test sui dati
-- reali mostrava 56 overlap "opposti" ma solo 2 conflitti veri: gli altri 54 sono
-- referral. Escludiamo quote_origin='SUPPLIER_SUGGESTION' (su entrambi i lati).
-- ============================================================================

create or replace function public._notify_quote_client_overlap(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid; v_role text; v_email text; v_date date; v_cat text; v_origin text;
  v_client_label text;
  r record;
begin
  select q.owner_id, p.role::text, lower(trim(q.client_email)), q.event_date,
         coalesce(q.quote_origin, ''), coalesce(nullif(trim(q.client_name), ''), 'un cliente')
    into v_owner, v_role, v_email, v_date, v_origin, v_client_label
    from public.quotes q
    join public.profiles p on p.id = q.owner_id
   where q.id = p_quote_id;

  if v_owner is null or v_email is null or v_email = '' or v_date is null then
    return;
  end if;
  -- Referral coordinato dal capostipite: non è un conflitto di canale.
  if v_origin = 'SUPPLIER_SUGGESTION' then return; end if;

  v_cat := case
    when v_role = 'FORNITORE' then 'SUP'
    when v_role in ('WEDDING_PLANNER', 'LOCATION') then 'CAP'
    else null end;
  if v_cat is null then return; end if;

  for r in
    select q2.id as quote_id, q2.owner_id, p2.role::text as role,
           coalesce(nullif(trim(q2.client_name), ''), 'un cliente') as client_label
      from public.quotes q2
      join public.profiles p2 on p2.id = q2.owner_id
     where q2.id <> p_quote_id
       and q2.owner_id <> v_owner
       and q2.archived_at is null
       and q2.status in ('INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
       and coalesce(q2.quote_origin, '') <> 'SUPPLIER_SUGGESTION'   -- escludi referral
       and lower(trim(q2.client_email)) = v_email
       and q2.event_date = v_date
       and case
             when v_cat = 'SUP' then p2.role::text in ('WEDDING_PLANNER', 'LOCATION')
             when v_cat = 'CAP' then p2.role::text = 'FORNITORE'
             else false end
  loop
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
  null;
end$$;
revoke all on function public._notify_quote_client_overlap(uuid) from public, anon, authenticated;
