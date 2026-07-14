-- DIAG (read-only): perché la coppia Christian & Anastasia vede solo le foto ospiti.
do $$
declare r record; v_found boolean := false;
begin
  for r in
    select ce.id as entry_id, ce.title,
           (select count(*) from public.gallery_folders f where f.entry_id = ce.id) as folders,
           (select count(*) from public.gallery_folders f where f.entry_id = ce.id and f.level='LAVORO_INTERO') as folders_lavoro,
           (select count(*) from public.wedding_couple_members m where m.entry_id = ce.id) as couple_members,
           (select string_agg(distinct coalesce(p.full_name,'?')||' <'||coalesce(u.email,'?')||'>', ', ')
              from public.wedding_couple_members m
              left join public.profiles p on p.id = m.user_id
              left join auth.users u on u.id = m.user_id
             where m.entry_id = ce.id) as couple_list,
           (select count(*) from public.gallery_guests g where g.entry_id = ce.id) as guests
      from public.calendar_entries ce
     where ce.title ilike '%christian%' or ce.title ilike '%anastasia%'
        or exists (select 1 from public.quotes q where q.id = ce.quote_id and (q.client_name ilike '%christian%' or q.client_name ilike '%anastasia%'))
        or exists (select 1 from public.gallery_guests g join auth.users u on u.id=g.guest_user_id where g.entry_id=ce.id and (u.email ilike '%christian%' or u.email ilike '%anastasia%'))
     limit 10
  loop
    v_found := true;
    raise notice 'ENTRY % (%) | cartelle=% (lavoro_intero=%) | couple_members=% [%] | ospiti=%',
      r.entry_id, r.title, r.folders, r.folders_lavoro, r.couple_members, coalesce(r.couple_list,'—'), r.guests;
  end loop;
  if not v_found then raise notice 'DIAG: nessun evento trovato per Christian/Anastasia'; end if;
end $$;
