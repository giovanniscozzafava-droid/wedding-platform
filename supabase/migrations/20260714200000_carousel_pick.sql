-- Selezione CAROSELLO: è una selezione del PROFESSIONISTA, separata e indipendente da quella dell'album
-- fatta dagli sposi (gallery_media.album_choice). Sono due selezioni diverse. Il fotografo la fa dentro
-- il Carosello (cuoricini) e alimenta il pool di foto delle slide.
alter table public.gallery_media add column if not exists carousel_pick boolean not null default false;
comment on column public.gallery_media.carousel_pick is 'Foto scelta dal FOTOGRAFO per il carosello Instagram. Indipendente da album_choice (selezione album degli sposi).';

-- Toggle della selezione carosello: solo il proprietario della galleria (il fotografo).
create or replace function public.carousel_toggle_pick(p_media uuid, p_pick boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select g.owner_id into v_owner
    from public.gallery_media m join public.event_galleries g on g.id = m.gallery_id
   where m.id = p_media;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() then raise exception 'forbidden'; end if;
  update public.gallery_media set carousel_pick = coalesce(p_pick, false) where id = p_media;
  return true;
end$$;
revoke all on function public.carousel_toggle_pick(uuid, boolean) from public;
grant execute on function public.carousel_toggle_pick(uuid, boolean) to authenticated;
comment on function public.carousel_toggle_pick(uuid, boolean) is 'Il fotografo (owner galleria) marca/smarca una foto per il carosello. Non tocca album_choice.';

-- TEST e2e non-fatale: owner marca/smarca; estraneo respinto. Self-cleaning (ripristina lo stato).
do $$
declare v_mid uuid; v_owner uuid; v_prev boolean; v_ok boolean; v_now boolean; v_denied boolean := false;
begin
  select m.id, g.owner_id, m.carousel_pick into v_mid, v_owner, v_prev
    from public.gallery_media m join public.event_galleries g on g.id = m.gallery_id
   where m.media_type = 'PHOTO' limit 1;
  if v_mid is null then raise notice 'TEST CAROUSEL-PICK: nessuna foto, salto (funzione creata)'; return; end if;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text)::text, true);
    begin perform public.carousel_toggle_pick(v_mid, true); exception when others then v_denied := true; end;
    perform set_config('request.jwt.claims', json_build_object('sub', v_owner::text)::text, true);
    v_ok := public.carousel_toggle_pick(v_mid, true);
    select carousel_pick into v_now from public.gallery_media where id = v_mid;
    update public.gallery_media set carousel_pick = v_prev where id = v_mid;   -- ripristina
    if v_denied and v_ok and v_now then
      raise notice 'TEST CAROUSEL-PICK: OK — estraneo respinto, owner marca → carousel_pick=true';
    else
      raise notice 'TEST CAROUSEL-PICK: ESITO INATTESO denied=% ok=% now=%', v_denied, v_ok, v_now;
    end if;
  exception when others then
    update public.gallery_media set carousel_pick = v_prev where id = v_mid;
    raise notice 'TEST CAROUSEL-PICK: salto (%).', SQLERRM;
  end;
end $$;
