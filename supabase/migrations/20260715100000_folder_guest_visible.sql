-- Rendere una cartella foto VISIBILE agli ospiti registrati (quelli che si sono iscritti per pubblicare le
-- proprie foto). Il fotografo (owner) decide per singola cartella con un flag. Le cartelle INVITATI restano
-- sempre visibili agli ospiti; con guest_visible il fotografo può aprire anche il LAVORO_INTERO / lavorazioni.
alter table public.gallery_folders add column if not exists guest_visible boolean not null default false;
comment on column public.gallery_folders.guest_visible is 'Se true, gli ospiti registrati (gallery_guests) possono VEDERE (sola lettura) le foto di questa cartella, oltre alle INVITATI.';

-- gf_read: gli ospiti vedono anche le cartelle guest_visible
drop policy if exists gf_read on public.gallery_folders;
create policy gf_read on public.gallery_folders for select
  using (public._photo_gallery_owner(gallery_id) or public.is_admin()
         or public.is_wedding_couple(entry_id)
         or public._photo_circle_member(entry_id)
         or (level = 'INVITATI' and public._photo_is_guest(entry_id))
         or (guest_visible and public._photo_is_guest(entry_id)));

-- gm_read: gli ospiti vedono anche i media delle cartelle guest_visible (oltre a INVITATI / cerchio / coppia)
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
        or (f.level = 'LAVORO_INTERO' and public._photo_circle_member(f.entry_id))
        or (f.level = 'INVITATI' and public._photo_is_guest(f.entry_id))
        or (f.guest_visible and public._photo_is_guest(f.entry_id))   -- cartella aperta agli ospiti
      )
    )
  );
