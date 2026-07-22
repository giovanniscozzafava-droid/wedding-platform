-- ============================================================================
-- DUE CUORI INDIPENDENTI per foto: cuore del FOTOGRAFO e cuore del CLIENTE (sposi).
-- Restano SEMPRE distinti: nessun import li sovrascrive. Il fotografo poi IMPORTA
-- (sostituendola) la selezione di lavoro — album (album_choice) o carosello
-- (carousel_pick) — da uno dei due cuori.
--
--   pick_photographer  = cuore del fotografo (lo mette solo l'owner della galleria)
--   pick_couple        = cuore del cliente   (si accende dallo swipe degli sposi)
--   album_choice       = SELEZIONE DI LAVORO album  (invariata: la usa l'AlbumDesigner)
--   carousel_pick      = SELEZIONE DI LAVORO carosello (invariata)
-- ============================================================================
alter table public.gallery_media add column if not exists pick_photographer boolean not null default false;
alter table public.gallery_media add column if not exists pick_couple boolean not null default false;
comment on column public.gallery_media.pick_photographer is 'Cuore del FOTOGRAFO (owner). Indipendente da album_choice/carousel_pick e dal cuore cliente.';
comment on column public.gallery_media.pick_couple is 'Cuore del CLIENTE (sposi), acceso dallo swipe. Indipendente dalla selezione di lavoro.';

-- Backfill una-tantum del cuore cliente dalle selezioni album già confermate (best-effort).
update public.gallery_media set pick_couple = true where album_choice = 'KEPT' and pick_couple = false;

-- Il cuore del fotografo: marca/smarca (solo owner della galleria). Non tocca nient'altro.
create or replace function public.photographer_toggle_pick(p_media uuid, p_pick boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select g.owner_id into v_owner
    from public.gallery_media m join public.event_galleries g on g.id = m.gallery_id
   where m.id = p_media;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  update public.gallery_media set pick_photographer = coalesce(p_pick, false) where id = p_media;
  return true;
end$$;
revoke all on function public.photographer_toggle_pick(uuid, boolean) from public, anon;
grant execute on function public.photographer_toggle_pick(uuid, boolean) to authenticated;

-- IMPORT (SOSTITUISCE): riempie la selezione di lavoro da uno dei due cuori.
--   p_source: 'COUPLE' | 'PHOTOGRAPHER'   p_target: 'ALBUM' | 'CAROUSEL'
-- I due cuori NON vengono toccati: si scrive solo album_choice o carousel_pick.
create or replace function public.import_selection(p_entry uuid, p_source text, p_target text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gallery uuid; v_owner uuid; v_n int;
begin
  if p_source not in ('COUPLE','PHOTOGRAPHER') then return jsonb_build_object('error','bad_source'); end if;
  if p_target not in ('ALBUM','CAROUSEL') then return jsonb_build_object('error','bad_target'); end if;
  select id, owner_id into v_gallery, v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_gallery is null then return jsonb_build_object('error','no_gallery'); end if;
  if v_owner <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;

  if p_target = 'CAROUSEL' then
    if p_source = 'COUPLE'
      then update public.gallery_media set carousel_pick = coalesce(pick_couple, false)       where gallery_id = v_gallery;
      else update public.gallery_media set carousel_pick = coalesce(pick_photographer, false) where gallery_id = v_gallery;
    end if;
    select count(*) into v_n from public.gallery_media where gallery_id = v_gallery and carousel_pick;
  else -- ALBUM: la selezione di lavoro diventa ESATTAMENTE il cuore scelto (sostituisce)
    if p_source = 'COUPLE'
      then update public.gallery_media set album_choice = case when coalesce(pick_couple, false)       then 'KEPT' else 'DISCARDED' end where gallery_id = v_gallery;
      else update public.gallery_media set album_choice = case when coalesce(pick_photographer, false) then 'KEPT' else 'DISCARDED' end where gallery_id = v_gallery;
    end if;
    select count(*) into v_n from public.gallery_media where gallery_id = v_gallery and album_choice = 'KEPT';
  end if;
  return jsonb_build_object('ok', true, 'count', v_n);
end$$;
revoke all on function public.import_selection(uuid, text, text) from public, anon;
grant execute on function public.import_selection(uuid, text, text) to authenticated;

-- Accende il CUORE CLIENTE dallo swipe: quando la selezione degli sposi passa a SUBMITTED,
-- pick_couple = (tenuta nel giro). Così non tocco la grande RPC di submit: un trigger la
-- rispecchia. Vale anche per il submit anticipato (entrambi mettono status='SUBMITTED').
create or replace function public._sync_couple_pick() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.gallery_media gm set pick_couple = exists (
      select 1 from public.gallery_selection_decisions d
       where d.gallery_id = new.gallery_id and d.media_id = gm.id and d.round = new.round and d.keep)
    from public._gallery_base_media(new.gallery_id) b
   where gm.id = b.media_id;
  return new;
end$$;
drop trigger if exists trg_sync_couple_pick on public.gallery_selection;
create trigger trg_sync_couple_pick
  after update on public.gallery_selection
  for each row when (new.status = 'SUBMITTED' and old.status is distinct from 'SUBMITTED')
  execute function public._sync_couple_pick();
