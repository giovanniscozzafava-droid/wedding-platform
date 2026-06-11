-- Generare il link ospiti crea AUTOMATICAMENTE la cartella "Foto & video degli ospiti"
-- (livello INVITATI), così con il solo link gli invitati possono già caricare foto e video.
create or replace function public.gallery_enable_guest_link(p_gallery_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tok text; v_found boolean; v_entry uuid;
begin
  select guest_token, true, entry_id into v_tok, v_found, v_entry from public.event_galleries
   where id = p_gallery_id and (owner_id = auth.uid() or public.is_admin());
  if not coalesce(v_found, false) then return jsonb_build_object('error', 'forbidden'); end if;
  if v_tok is null then
    v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.event_galleries set guest_token = v_tok where id = p_gallery_id;
  end if;
  -- assicura la cartella ospiti (foto + video) così l'upload funziona col solo link
  if not exists (select 1 from public.gallery_folders where gallery_id = p_gallery_id and level = 'INVITATI' and name = 'Foto & video degli ospiti') then
    insert into public.gallery_folders(gallery_id, entry_id, name, level, sort_order)
      values (p_gallery_id, v_entry, 'Foto & video degli ospiti', 'INVITATI',
              coalesce((select max(sort_order) + 1 from public.gallery_folders where gallery_id = p_gallery_id), 0));
  end if;
  return jsonb_build_object('ok', true, 'token', v_tok);
end$$;
grant execute on function public.gallery_enable_guest_link(uuid) to authenticated;
