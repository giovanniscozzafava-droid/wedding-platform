-- Allinea anche il SALVATAGGIO della valutazione alla membership del cerchio:
-- prima rate_user autorizzava solo relazioni via quote_items → salvare una stella a un
-- membro del cerchio non-a-preventivo dava 'not_authorized'. Ora: rater e rated devono
-- entrambi essere membri del cerchio (partecipanti + fornitori a preventivo + WP owner),
-- a evento concluso.
create or replace function public.rate_user(p_rated uuid, p_entry uuid, p_stars integer, p_review text default null)
returns collaboration_ratings language plpgsql security definer set search_path = public as $$
declare v_event_end date; v_relates boolean; v_row collaboration_ratings;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_rated = auth.uid() then raise exception 'cannot_rate_self'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'invalid_stars'; end if;
  select coalesce(date_to, date_from) into v_event_end from public.calendar_entries where id = p_entry;
  if v_event_end is null then raise exception 'entry_not_found'; end if;
  if v_event_end > current_date then raise exception 'event_not_completed_yet'; end if;

  with members as (
    select user_id as uid from public.calendar_entry_participants where entry_id = p_entry and user_id is not null
    union
    select qi.supplier_id from public.calendar_entries ce join public.quote_items qi on qi.quote_id = ce.quote_id
      where ce.id = p_entry and qi.supplier_id is not null
    union
    select owner_id from public.calendar_entries where id = p_entry and owner_id is not null
  )
  select exists (select 1 from members where uid = auth.uid())
     and exists (select 1 from members where uid = p_rated)
    into v_relates;
  if not v_relates then raise exception 'not_authorized_to_rate_this_user_on_this_event'; end if;

  insert into public.collaboration_ratings (rater_id, rated_id, entry_id, stars, review)
  values (auth.uid(), p_rated, p_entry, p_stars, nullif(p_review, ''))
  on conflict (rater_id, rated_id, entry_id) do update
    set stars = excluded.stars, review = excluded.review, updated_at = now()
  returning * into v_row;
  return v_row;
end$$;
grant execute on function public.rate_user(uuid, uuid, integer, text) to authenticated;
