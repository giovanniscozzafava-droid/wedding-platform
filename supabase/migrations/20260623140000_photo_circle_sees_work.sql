-- I professionisti del CERCHIO dell'evento (fotografo, fornitori, celebrante, coppia) vedono le foto
-- del LAVORO_INTERO per il solo fatto di essere nel cerchio: tolti i gate "shared" + consenso sposi,
-- che bloccavano i collaboratori (es. il parrucchiere non vedeva le foto dell'evento dove ha lavorato).
drop policy if exists gm_read on public.gallery_media;
create policy gm_read on public.gallery_media for select
  using (
    public.is_admin()
    or public._photo_gallery_owner(gallery_id)
    or public.is_wedding_couple(entry_id)
    or exists (
      select 1 from public.gallery_folders f where f.id = gallery_media.folder_id and (
        (f.level = 'LAVORAZIONE' and (
            f.assigned_to = auth.uid()
            or (f.assigned_subrole is not null
                and f.assigned_subrole = public._photo_my_subrole()
                and public._photo_circle_member(f.entry_id))))
        -- LAVORO_INTERO: ora basta essere nel cerchio dell'evento
        or (f.level = 'LAVORO_INTERO' and public._photo_circle_member(f.entry_id))
        or (f.level = 'INVITATI' and public._photo_is_guest(f.entry_id))
      )
    )
  );
