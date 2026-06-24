-- DEDUP gallery_media: il recupero "orfani" (quando la lettura era limitata a 1000 righe)
-- ha inserito righe duplicate dello stesso file nella stessa cartella. Qui le ripuliamo
-- SENZA toccare nulla di importante: per ogni (folder_id, drive_file_id) si tiene UNA riga
-- (preferendo quella con selezione/like/commento, altrimenti la più vecchia) e si eliminano
-- SOLO i duplicati INERTI — cioè senza album_choice, senza like e senza commento.
-- Quindi: nessuna foto scelta, "messa mi piace" o commentata viene mai persa.
do $$
declare v_before bigint; v_after bigint; v_deleted bigint;
begin
  select count(*) into v_before from public.gallery_media;

  with ranked as (
    select gm.id,
      (gm.album_choice is not null
        or exists (select 1 from public.gallery_media_likes l where l.media_id = gm.id)
        or exists (select 1 from public.gallery_media_comments c where c.media_id = gm.id)) as engaged,
      row_number() over (
        partition by gm.folder_id, gm.drive_file_id
        order by
          (gm.album_choice is not null
            or exists (select 1 from public.gallery_media_likes l where l.media_id = gm.id)
            or exists (select 1 from public.gallery_media_comments c where c.media_id = gm.id)) desc,
          gm.created_at asc, gm.id asc
      ) as rn
    from public.gallery_media gm
  )
  delete from public.gallery_media gm
  using ranked r
  where gm.id = r.id
    and r.rn > 1            -- non è la riga "tenuta" del gruppo
    and r.engaged = false;  -- ed è inerte (nessuna scelta/like/commento)

  get diagnostics v_deleted = row_count;
  select count(*) into v_after from public.gallery_media;
  raise notice 'DEDUP gallery_media → prima=%, dopo=%, eliminati=%', v_before, v_after, v_deleted;
end $$;
