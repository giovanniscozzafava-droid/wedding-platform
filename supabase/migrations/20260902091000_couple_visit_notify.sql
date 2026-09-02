-- «Da dove vedo l'accesso dei clienti ogni qualvolta entrano nel loro evento?»
-- (Giovanni, 02/09/2026). La scheda dentro l'evento c'era, ma nessuno te lo diceva:
-- dovevi andare a guardare. Ora l'ingresso del cliente arriva come notifica, nella
-- campanella, con il link all'evento.
--
-- Una notifica per SESSIONE, non per battito: il cliente che gira tra foto e
-- preventivo per venti minuti è un ingresso solo. Regola: nessuna notifica se per lo
-- stesso evento c'è già una visita iniziata nelle ultime 3 ore.

create or replace function public.couple_visit_ping(p_entry uuid, p_section text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_id uuid; v_sec text;
  v_recent boolean; v_title text; v_owner uuid; v_gallery_owner uuid; v_chi text;
begin
  if v_uid is null then return jsonb_build_object('error','auth'); end if;
  if not exists (select 1 from wedding_couple_members m
                  where m.entry_id = p_entry and m.user_id = v_uid) then
    return jsonb_build_object('error','forbidden');
  end if;
  v_sec := coalesce(nullif(trim(p_section), ''), 'evento');
  if length(v_sec) > 40 then v_sec := left(v_sec, 40); end if;

  select id into v_id from couple_visits
   where entry_id = p_entry and user_id = v_uid and section = v_sec
     and last_seen_at > now() - interval '3 minutes'
   order by last_seen_at desc limit 1;

  if v_id is not null then
    update couple_visits set last_seen_at = now() where id = v_id;
    return jsonb_build_object('ok', true, 'id', v_id);
  end if;

  -- Visita nuova. Prima di inserirla guardo se è un INGRESSO nuovo (nessuna visita
  -- di nessuno negli ultimi 180 minuti su questo evento) → notifica.
  select exists (select 1 from couple_visits
                  where entry_id = p_entry and started_at > now() - interval '3 hours')
    into v_recent;

  insert into couple_visits (entry_id, user_id, section) values (p_entry, v_uid, v_sec)
  returning id into v_id;

  if not v_recent then
    select ce.title, ce.owner_id into v_title, v_owner from calendar_entries ce where ce.id = p_entry;
    select g.owner_id into v_gallery_owner from event_galleries g where g.entry_id = p_entry limit 1;
    select coalesce(nullif(trim(m.full_name),''), nullif(trim(p.full_name),''))
      into v_chi from wedding_couple_members m left join profiles p on p.id = m.user_id
     where m.entry_id = p_entry and m.user_id = v_uid limit 1;

    perform public.push_user_notification(
      v_owner, 'couple_visit', 'Il cliente è entrato',
      coalesce(v_chi, 'Il cliente') || case when v_chi is null then ' è entrato in ' else ' è dentro ' end
        || coalesce('«' || v_title || '»', 'l''evento') || ' e sta guardando '
        || case v_sec when 'foto' then 'le foto' when 'preventivo' then 'il preventivo'
                      when 'contratto' then 'il contratto' when 'video' then 'i video'
                      when 'overview' then 'la panoramica' else v_sec end || '.',
      '/weddings/' || p_entry::text, p_entry);
    -- Il fotografo che ha la galleria ma non è il proprietario dell'evento: anche lui.
    if v_gallery_owner is not null and v_gallery_owner <> v_owner then
      perform public.push_user_notification(
        v_gallery_owner, 'couple_visit', 'Il cliente è entrato',
        coalesce(v_chi, 'Il cliente') || ' è dentro ' || coalesce('«' || v_title || '»', 'l''evento')
          || ' e sta guardando ' || case v_sec when 'foto' then 'le foto' else v_sec end || '.',
        '/weddings/' || p_entry::text, p_entry);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'ingresso', not v_recent);
end$$;

revoke all on function public.couple_visit_ping(uuid, text) from public;
grant execute on function public.couple_visit_ping(uuid, text) to authenticated;
