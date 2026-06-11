-- Notifiche GLOBALI sulle azioni che riguardano direttamente gli utenti.
-- (Il campanello + bollino + deep-link esistono già: qui aggiungiamo i PRODUTTORI.)

-- 1) FEEDBACK ricevuto: chi viene valutato riceve la notifica.
create or replace function public.rate_user(p_rated uuid, p_entry uuid, p_stars integer, p_review text default null)
returns collaboration_ratings language plpgsql security definer set search_path = public as $$
declare v_event_end date; v_relates boolean; v_row collaboration_ratings; v_rater text;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_rated = auth.uid() then raise exception 'cannot_rate_self'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'invalid_stars'; end if;
  select coalesce(date_to, date_from) into v_event_end from public.calendar_entries where id = p_entry;
  if v_event_end is null then raise exception 'entry_not_found'; end if;
  if v_event_end > current_date then raise exception 'event_not_completed_yet'; end if;

  with members as (
    select user_id as uid from public.calendar_entry_participants where entry_id = p_entry and user_id is not null
    union select qi.supplier_id from public.calendar_entries ce join public.quote_items qi on qi.quote_id = ce.quote_id where ce.id = p_entry and qi.supplier_id is not null
    union select owner_id from public.calendar_entries where id = p_entry and owner_id is not null
  )
  select exists (select 1 from members where uid = auth.uid()) and exists (select 1 from members where uid = p_rated) into v_relates;
  if not v_relates then raise exception 'not_authorized_to_rate_this_user_on_this_event'; end if;

  insert into public.collaboration_ratings (rater_id, rated_id, entry_id, stars, review)
  values (auth.uid(), p_rated, p_entry, p_stars, nullif(p_review, ''))
  on conflict (rater_id, rated_id, entry_id) do update set stars = excluded.stars, review = excluded.review, updated_at = now()
  returning * into v_row;

  select coalesce(nullif(business_name, ''), full_name, 'Un professionista') into v_rater from public.profiles where id = auth.uid();
  perform public.push_user_notification(p_rated, 'rating_received', 'Hai una nuova valutazione ⭐',
    v_rater || ' ti ha valutato (' || p_stars || '★)' || case when nullif(p_review,'') is not null then ': ' || left(p_review, 80) else '.' end,
    '/profile', p_entry);
  return v_row;
end$$;
grant execute on function public.rate_user(uuid, uuid, integer, text) to authenticated;

-- 2) COMMENTO su una foto: notifica l'owner della galleria e gli sposi.
create or replace function public._notify_photo_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_owner uuid; m record;
begin
  select gm.entry_id, g.owner_id into v_entry, v_owner
    from public.gallery_media gm join public.event_galleries g on g.id = gm.gallery_id where gm.id = new.media_id;
  if v_owner is not null and v_owner <> new.user_id then
    perform public.push_user_notification(v_owner, 'photo_comment', 'Nuovo commento su una foto',
      coalesce(new.author_name, 'Un invitato') || ': ' || left(new.body, 80), '/weddings/' || v_entry::text, v_entry);
  end if;
  for m in select user_id from public.wedding_couple_members where entry_id = v_entry and user_id is not null and user_id <> new.user_id loop
    perform public.push_user_notification(m.user_id, 'photo_comment', 'Nuovo commento su una foto',
      coalesce(new.author_name, 'Un invitato') || ': ' || left(new.body, 80), '/couple', v_entry);
  end loop;
  return new;
end$$;
drop trigger if exists trg_notify_photo_comment on public.gallery_media_comments;
create trigger trg_notify_photo_comment after insert on public.gallery_media_comments for each row execute function public._notify_photo_comment();

-- 3) AUGURIO VOCALE: notifica gli sposi.
create or replace function public._notify_audio_wish() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from public.wedding_couple_members where entry_id = new.entry_id and user_id is not null and user_id <> new.user_id loop
    perform public.push_user_notification(m.user_id, 'audio_wish', 'Nuovo augurio vocale 🎤',
      coalesce(new.author_name, 'Un invitato') || ' ha lasciato un augurio per voi.', '/couple', new.entry_id);
  end loop;
  return new;
end$$;
drop trigger if exists trg_notify_audio_wish on public.event_audio_wishes;
create trigger trg_notify_audio_wish after insert on public.event_audio_wishes for each row execute function public._notify_audio_wish();

-- 4) COPPIA che accetta l'invito: notifica chi ha creato l'evento (owner).
create or replace function public._notify_couple_joined() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  if old.user_id is null and new.user_id is not null then
    select owner_id, coalesce(nullif(title, ''), 'un evento') into v_owner, v_title from public.calendar_entries where id = new.entry_id;
    if v_owner is not null and v_owner <> new.user_id then
      perform public.push_user_notification(v_owner, 'couple_joined', 'La coppia si è registrata',
        coalesce(nullif(new.full_name, ''), 'La coppia') || ' ha accettato l''invito a ' || v_title || '.', '/weddings/' || new.entry_id::text, new.entry_id);
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_couple_joined on public.wedding_couple_members;
create trigger trg_notify_couple_joined after update of user_id on public.wedding_couple_members for each row execute function public._notify_couple_joined();
