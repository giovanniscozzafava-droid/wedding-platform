-- Due regole di Giovanni (01/09/2026):
--
-- 1. "Quando escludi qualcosa dall'album, viene anche escluso da presentazione e
--    da selezione." L'esclusione del fotografo è `gallery_folders.album_selectable
--    = false` ("Escludi da album"). Finora la selezione la ignorava: le foto di una
--    cartella esclusa finivano lo stesso nel mazzo da far scegliere agli sposi.
--    NB: `gallery_media.album_choice='DISCARDED'` NON è un'esclusione del fotografo —
--    è l'ESITO della selezione degli sposi (lo scrive gallery_selection_submit su
--    tutto ciò che non hanno tenuto). Filtrarlo qui farebbe sparire le foto dopo
--    ogni conferma: non si tocca.
--
-- 2. "Iniziano a mettere i loro like… e poi devono corrispondere alla selezione."
--    Finora i like (gallery_media_likes) erano solo cuoricini social: `pick_couple`
--    veniva unicamente dallo swipe. Ora il like di UNO SPOSO vale come scelta per
--    l'album. Il like di chiunque altro (invitati col QR, fornitori della cerchia)
--    resta social e NON tocca la selezione.

-- ————— 1. il pool della selezione rispetta l'esclusione dall'album —————
create or replace function public._gallery_base_media(p_gallery uuid)
returns table(media_id uuid)
language sql stable security definer set search_path = public as $$
  select gm.id
  from public.gallery_media gm
  join public.gallery_folders gf on gf.id = gm.folder_id
  where gm.gallery_id = p_gallery
    and gf.level = 'LAVORO_INTERO'
    and gm.media_type = 'PHOTO'
    and coalesce(gf.album_selectable, true)
$$;

-- ————— 2. il like degli sposi è una scelta di selezione —————
create or replace function public.tg_like_feeds_selection()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_media uuid; v_user uuid; v_keep boolean;
  v_entry uuid; v_gallery uuid; v_round int; v_status text;
begin
  if tg_op = 'INSERT' then v_media := new.media_id; v_user := new.user_id; v_keep := true;
  else                     v_media := old.media_id; v_user := old.user_id; v_keep := false;
  end if;

  select gm.entry_id, gm.gallery_id into v_entry, v_gallery
    from gallery_media gm where gm.id = v_media;
  if v_gallery is null then return null; end if;

  -- SOLO gli sposi. Un invitato che mette like dal QR non deve entrare nella
  -- selezione dell'album: il suo resta un cuore e basta.
  if not exists (select 1 from wedding_couple_members m
                  where m.entry_id = v_entry and m.user_id = v_user) then
    return null;
  end if;

  -- La foto deve essere davvero in gioco per l'album (cartella non esclusa).
  if not exists (select 1 from public._gallery_base_media(v_gallery) b where b.media_id = v_media) then
    return null;
  end if;

  select s.round, s.status into v_round, v_status
    from gallery_selection s where s.gallery_id = v_gallery;
  if v_round is null then
    -- Nessun giro ancora aperto: lo creo, così i like non vanno persi.
    perform public._gallery_ensure_selection(v_gallery, v_entry);
    select s.round, s.status into v_round, v_status from gallery_selection s where s.gallery_id = v_gallery;
  end if;
  -- Selezione già consegnata: non si riscrive (la riapre il fotografo).
  if v_round is null or v_status = 'SUBMITTED' then return null; end if;

  if v_keep then
    insert into gallery_selection_decisions (gallery_id, media_id, round, keep, decided_at)
    values (v_gallery, v_media, v_round, true, now())
    on conflict (gallery_id, media_id, round) do update set keep = true, decided_at = now();
  else
    delete from gallery_selection_decisions
     where gallery_id = v_gallery and media_id = v_media and round = v_round;
  end if;

  update gallery_media set pick_couple = v_keep where id = v_media;
  return null;
exception when others then
  -- Un effetto collaterale non deve MAI far fallire un like.
  raise warning 'tg_like_feeds_selection: %', sqlerrm;
  return null;
end$$;

drop trigger if exists trg_like_feeds_selection on public.gallery_media_likes;
create trigger trg_like_feeds_selection
  after insert or delete on public.gallery_media_likes
  for each row execute function public.tg_like_feeds_selection();

comment on function public.tg_like_feeds_selection() is
  'Il like di uno sposo vale come scelta per l''album; quello degli invitati no.';
