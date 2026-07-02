-- CLONE DI TEST dell'evento REALE "Natalino e Ludovica" (con le sue foto VERE caricate), così il
-- fotografo lavora sulle loro foto e prova l'impaginazione AI SENZA toccare l'evento vero.
--
-- Copia: evento + membri coppia + gallerie + cartelle + gallery_media (stesso drive_file_id →
-- stesse foto reali). NON copia `album_projects` → la copia parte SENZA impaginazione (pronta per
-- "Impagina con AI"). Rimuove anche il vecchio seed finto (picsum). Idempotente. Non fatale.
do $$
declare
  v_src uuid; v_owner uuid;
  v_new uuid := gen_random_uuid();
  g record; f record;
  v_gal uuid; v_folder uuid;
  v_photos int; v_kept int;
begin
  -- 1) EVENTO REALE Natalino e Ludovica (escludo le mie copie/seed di test). Prima per titolo, poi
  --    per nome dei membri coppia.
  select ce.id, ce.owner_id into v_src, v_owner
    from public.calendar_entries ce
   where ce.title ilike '%natalino%' and ce.title not ilike 'TEST %'
   order by ce.created_at desc nulls last
   limit 1;
  if v_src is null then
    select ce.id, ce.owner_id into v_src, v_owner
      from public.calendar_entries ce
      join public.wedding_couple_members m on m.entry_id = ce.id
     where (m.full_name ilike '%natalino%' or m.full_name ilike '%ludovica%')
       and ce.title not ilike 'TEST %'
     group by ce.id, ce.owner_id
     order by max(ce.created_at) desc nulls last
     limit 1;
  end if;
  if v_src is null then
    raise notice 'Clone saltato: evento reale Natalino e Ludovica non trovato.';
    return;
  end if;

  -- 2) pulizia: vecchio seed finto + eventuale copia precedente
  delete from public.calendar_entries where owner_id = v_owner and title in ('TEST Natalino e Ludovica', 'TEST Natalino e Ludovica (copia)');

  -- 3) clona l'evento (stesse date/stato; NIENTE album_projects → non impaginato)
  insert into public.calendar_entries(id, owner_id, title, date_from, date_to, status, event_kind, evento_stato, guest_count)
  select v_new, owner_id, 'TEST Natalino e Ludovica (copia)', date_from, date_to, status, event_kind, evento_stato, guest_count
    from public.calendar_entries where id = v_src;

  insert into public.wedding_couple_members(entry_id, email, full_name, role)
  select v_new, email, full_name, role from public.wedding_couple_members where entry_id = v_src;

  -- 4) clona gallerie → cartelle → media (foto VERE: stesso drive_file_id/thumbnail_link)
  for g in select * from public.event_galleries where entry_id = v_src loop
    v_gal := gen_random_uuid();
    insert into public.event_galleries(id, entry_id, owner_id, title, kind, drive_folder_id)
    values (v_gal, v_new, g.owner_id, g.title, g.kind, g.drive_folder_id);
    for f in select * from public.gallery_folders where gallery_id = g.id loop
      v_folder := gen_random_uuid();
      insert into public.gallery_folders(id, gallery_id, entry_id, name, level, assigned_subrole, assigned_to, shared, drive_folder_id, sort_order)
      values (v_folder, v_gal, v_new, f.name, f.level, f.assigned_subrole, f.assigned_to, f.shared, f.drive_folder_id, f.sort_order);
      insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, guest_tag_name, album_choice, album_moment, uploaded_by, promo_consent, uploader_name, no_minors, guest_tags, source_name, is_for_sale)
      select v_folder, v_gal, v_new, drive_file_id, thumbnail_link, media_type, guest_tag_name, album_choice, album_moment, uploaded_by, promo_consent, uploader_name, no_minors, guest_tags, source_name, is_for_sale
        from public.gallery_media where folder_id = f.id;
    end loop;
  end loop;

  -- 5) se la copia non ha foto SELEZIONATE, marca KEPT le foto (così l'impaginazione AI è testabile)
  select count(*) into v_photos from public.gallery_media where entry_id = v_new;
  select count(*) into v_kept  from public.gallery_media where entry_id = v_new and album_choice = 'KEPT';
  if v_kept = 0 and v_photos > 0 then
    update public.gallery_media set album_choice = 'KEPT' where entry_id = v_new and media_type = 'PHOTO';
    select count(*) into v_kept from public.gallery_media where entry_id = v_new and album_choice = 'KEPT';
  end if;

  raise notice 'Clone Natalino e Ludovica: nuovo evento % da %, % media (% KEPT), owner %', v_new, v_src, v_photos, v_kept, v_owner;
end $$;
