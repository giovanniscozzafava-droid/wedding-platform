-- ============================================================================
-- GALLERIA SPOSI PUBBLICA + SELEZIONE SWIPE A GIRI (60–120)
-- Superficie pubblica (link con token, senza login, come il preventivo): gli sposi
-- ricevono, sfogliano e selezionano le foto. La selezione è a scremature successive
-- (giri): giro 1 libero; se le tenute > 120 si rifà un giro solo sulle tenute, finché
-- il totale è ≤ 120; minimo 60. All'invio le tenute diventano album_choice=KEPT e
-- compaiono nella libreria dell'Album Designer ("Preferite degli sposi") + notifica.
--
-- Accesso anonimo: mirror del pattern album_commission_by_token / quote_get_by_token
-- (funzioni SECURITY DEFINER che risolvono un token e sono grant a anon).
-- ============================================================================

-- 1) TOKEN DI CONDIVISIONE + etichetta sposi + scadenza sulla galleria dell'evento
alter table public.event_galleries
  add column if not exists share_token uuid,
  add column if not exists couple_label text,
  add column if not exists share_expires_at timestamptz;
update public.event_galleries set share_token = gen_random_uuid() where share_token is null;
alter table public.event_galleries alter column share_token set default gen_random_uuid();
create unique index if not exists event_galleries_share_token_uq on public.event_galleries(share_token);

-- 2) STATO DELLA SELEZIONE (una riga per galleria) + decisioni per giro
create table if not exists public.gallery_selection (
  gallery_id  uuid primary key references public.event_galleries(id) on delete cascade,
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  round       int  not null default 1,
  status      text not null default 'ACTIVE' check (status in ('ACTIVE','SUBMITTED')),
  target_min  int  not null default 60,
  target_max  int  not null default 120,
  submitted_at timestamptz,
  updated_at  timestamptz not null default now()
);

create table if not exists public.gallery_selection_decisions (
  gallery_id uuid not null references public.event_galleries(id) on delete cascade,
  media_id   uuid not null references public.gallery_media(id) on delete cascade,
  round      int  not null,
  keep       boolean not null,
  decided_at timestamptz not null default now(),
  primary key (gallery_id, media_id, round)
);
create index if not exists gsd_round_idx on public.gallery_selection_decisions(gallery_id, round, keep);

-- RLS: le tabelle si toccano SOLO via le RPC SECURITY DEFINER (anon col token). Owner/admin
-- possono leggere per mostrare l'avanzamento in-app.
alter table public.gallery_selection enable row level security;
alter table public.gallery_selection_decisions enable row level security;
drop policy if exists gsel_read_owner on public.gallery_selection;
create policy gsel_read_owner on public.gallery_selection for select using (
  is_admin() or exists (select 1 from public.event_galleries g where g.id = gallery_id and (g.owner_id = auth.uid() or public.is_wedding_couple(g.entry_id)))
);
drop policy if exists gsd_read_owner on public.gallery_selection_decisions;
create policy gsd_read_owner on public.gallery_selection_decisions for select using (
  is_admin() or exists (select 1 from public.event_galleries g where g.id = gallery_id and (g.owner_id = auth.uid() or public.is_wedding_couple(g.entry_id)))
);

-- 3) HELPER: media base della galleria = foto del LAVORO_INTERO (le foto consegnate agli sposi)
create or replace function public._gallery_base_media(p_gallery uuid)
returns table(media_id uuid) language sql stable security definer set search_path = public as $$
  select gm.id
  from public.gallery_media gm
  join public.gallery_folders gf on gf.id = gm.folder_id
  where gm.gallery_id = p_gallery and gf.level = 'LAVORO_INTERO' and gm.media_type = 'PHOTO'
$$;

-- Assicura la riga di stato (creata pigramente)
create or replace function public._gallery_ensure_selection(p_gallery uuid, p_entry uuid)
returns public.gallery_selection language plpgsql security definer set search_path = public as $$
declare v public.gallery_selection;
begin
  select * into v from public.gallery_selection where gallery_id = p_gallery;
  if v.gallery_id is null then
    insert into public.gallery_selection(gallery_id, entry_id) values (p_gallery, p_entry)
      on conflict (gallery_id) do nothing;
    select * into v from public.gallery_selection where gallery_id = p_gallery;
  end if;
  return v;
end$$;

-- Pool del giro corrente: giro 1 = tutte le foto; giro N = le tenute del giro N-1.
create or replace function public._gallery_pool(p_gallery uuid, p_round int)
returns table(media_id uuid) language sql stable security definer set search_path = public as $$
  select b.media_id from public._gallery_base_media(p_gallery) b
  where p_round <= 1
     or exists (select 1 from public.gallery_selection_decisions d
                where d.gallery_id = p_gallery and d.media_id = b.media_id and d.round = p_round - 1 and d.keep)
$$;

-- 4) LETTURA PUBBLICA: galleria + stato selezione + elenco foto (con decisione del giro corrente)
create or replace function public.gallery_get_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_p record; v_email text; v_date date; v_sel public.gallery_selection;
        v_media jsonb; v_pool_n int; v_decided_n int; v_kept_n int; v_total int;
begin
  if p_token is null then return jsonb_build_object('error', 'no_token'); end if;
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_g.share_expires_at is not null and v_g.share_expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select business_name, full_name, brand_logo_url, brand_primary_color into v_p from public.profiles where id = v_g.owner_id;
  select email into v_email from auth.users where id = v_g.owner_id;
  select coalesce(ceremony_date, date_from) into v_date from public.calendar_entries where id = v_g.entry_id;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);

  select count(*) into v_total from public._gallery_base_media(v_g.id);
  select count(*) into v_pool_n from public._gallery_pool(v_g.id, v_sel.round);
  select count(*) into v_decided_n from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round;
  select count(*) into v_kept_n from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;

  -- elenco foto: solo le foto in pool del giro corrente, con la decisione già presa (per riprendere)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', gm.id, 'drive_file_id', gm.drive_file_id, 'thumbnail_link', gm.thumbnail_link,
           'media_type', gm.media_type, 'album_moment', gm.album_moment, 'source_name', gm.source_name,
           'decision', d.keep) order by gm.album_moment nulls last, gm.created_at), '[]'::jsonb)
    into v_media
  from public.gallery_media gm
  join public._gallery_pool(v_g.id, v_sel.round) p on p.media_id = gm.id
  left join public.gallery_selection_decisions d on d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round;

  return jsonb_build_object(
    'ok', true,
    'gallery', jsonb_build_object(
      'title', v_g.title, 'couple_label', v_g.couple_label, 'kind', v_g.kind,
      'event_date', v_date, 'expires_at', v_g.share_expires_at),
    'photographer', jsonb_build_object(
      'business_name', v_p.business_name, 'full_name', v_p.full_name, 'email', v_email,
      'logo', v_p.brand_logo_url, 'color', v_p.brand_primary_color),
    'selection', jsonb_build_object(
      'round', v_sel.round, 'status', v_sel.status, 'target_min', v_sel.target_min, 'target_max', v_sel.target_max,
      'total', v_total, 'pool', v_pool_n, 'decided', v_decided_n, 'kept', v_kept_n,
      'submitted_at', v_sel.submitted_at),
    'media', v_media);
end$$;

-- 5) SCRITTURE PUBBLICHE (col token): decidi / annulla / avanza giro / invia
--    Wrapper comune: risolve il token, valida (non scaduta, non inviata), ritorna lo stato aggiornato.
create or replace function public._gallery_state_json(p_gallery uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sel public.gallery_selection; v_pool int; v_decided int; v_kept int; v_total int;
begin
  select * into v_sel from public.gallery_selection where gallery_id = p_gallery;
  select count(*) into v_total from public._gallery_base_media(p_gallery);
  select count(*) into v_pool from public._gallery_pool(p_gallery, v_sel.round);
  select count(*) into v_decided from public.gallery_selection_decisions where gallery_id = p_gallery and round = v_sel.round;
  select count(*) into v_kept from public.gallery_selection_decisions where gallery_id = p_gallery and round = v_sel.round and keep;
  return jsonb_build_object('ok', true, 'round', v_sel.round, 'status', v_sel.status,
    'target_min', v_sel.target_min, 'target_max', v_sel.target_max,
    'total', v_total, 'pool', v_pool, 'decided', v_decided, 'kept', v_kept, 'submitted_at', v_sel.submitted_at);
end$$;

create or replace function public.gallery_selection_decide(p_token uuid, p_media uuid, p_keep boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_g.share_expires_at is not null and v_g.share_expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'submitted'); end if;
  -- il media deve essere nel pool del giro corrente
  if not exists (select 1 from public._gallery_pool(v_g.id, v_sel.round) p where p.media_id = p_media) then
    return jsonb_build_object('error', 'not_in_pool');
  end if;
  insert into public.gallery_selection_decisions(gallery_id, media_id, round, keep)
    values (v_g.id, p_media, v_sel.round, coalesce(p_keep, false))
    on conflict (gallery_id, media_id, round) do update set keep = excluded.keep, decided_at = now();
  update public.gallery_selection set updated_at = now() where gallery_id = v_g.id;
  return public._gallery_state_json(v_g.id);
end$$;

create or replace function public.gallery_selection_undo(p_token uuid, p_media uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'submitted'); end if;
  delete from public.gallery_selection_decisions where gallery_id = v_g.id and media_id = p_media and round = v_sel.round;
  update public.gallery_selection set updated_at = now() where gallery_id = v_g.id;
  return public._gallery_state_json(v_g.id);
end$$;

-- Avanza al giro successivo: consentito solo se tutte decise e le tenute > tetto massimo.
create or replace function public.gallery_selection_advance(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection; v_pool int; v_decided int; v_kept int;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'submitted'); end if;
  select count(*) into v_pool from public._gallery_pool(v_g.id, v_sel.round);
  select count(*) into v_decided from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round;
  select count(*) into v_kept from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;
  if v_decided < v_pool then return jsonb_build_object('error', 'not_finished'); end if;
  if v_kept <= v_sel.target_max then return jsonb_build_object('error', 'not_needed'); end if;
  update public.gallery_selection set round = round + 1, updated_at = now() where gallery_id = v_g.id;
  return public._gallery_state_json(v_g.id);
end$$;

-- Invia la selezione: consentito con tenute nel range [min,max] e tutte decise. Le tenute
-- del giro corrente diventano KEPT (le altre foto base DISCARDED) → libreria Album Designer.
create or replace function public.gallery_selection_submit(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection; v_pool int; v_decided int; v_kept int; v_studio text;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'already_submitted'); end if;
  select count(*) into v_pool from public._gallery_pool(v_g.id, v_sel.round);
  select count(*) into v_decided from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round;
  select count(*) into v_kept from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;
  if v_decided < v_pool then return jsonb_build_object('error', 'not_finished'); end if;
  if v_kept < v_sel.target_min then return jsonb_build_object('error', 'below_min', 'kept', v_kept, 'min', v_sel.target_min); end if;
  if v_kept > v_sel.target_max then return jsonb_build_object('error', 'above_max', 'kept', v_kept, 'max', v_sel.target_max); end if;

  -- tenute del giro corrente = KEPT; le altre foto base = DISCARDED
  update public.gallery_media gm set album_choice = 'KEPT'
   from public._gallery_base_media(v_g.id) b
   where gm.id = b.media_id
     and exists (select 1 from public.gallery_selection_decisions d
                 where d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round and d.keep);
  update public.gallery_media gm set album_choice = 'DISCARDED'
   from public._gallery_base_media(v_g.id) b
   where gm.id = b.media_id
     and not exists (select 1 from public.gallery_selection_decisions d
                     where d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round and d.keep);

  update public.gallery_selection set status = 'SUBMITTED', submitted_at = now(), updated_at = now() where gallery_id = v_g.id;

  -- notifica al fotografo (owner)
  select coalesce(nullif(business_name,''), full_name) into v_studio from public.profiles where id = v_g.owner_id;
  perform public.push_user_notification(
    v_g.owner_id, 'gallery_selection',
    'Gli sposi hanno inviato la selezione',
    coalesce(v_g.couple_label, v_g.title) || ' · ' || v_kept || ' foto scelte per l''album',
    '/album/' || v_g.entry_id::text, v_g.id);

  return jsonb_build_object('ok', true, 'kept', v_kept, 'status', 'SUBMITTED');
end$$;

-- grant: lettura+scrittura per token a anon (e authenticated). Le funzioni validano il token.
grant execute on function public.gallery_get_by_token(uuid) to anon, authenticated;
grant execute on function public.gallery_selection_decide(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.gallery_selection_undo(uuid, uuid) to anon, authenticated;
grant execute on function public.gallery_selection_advance(uuid) to anon, authenticated;
grant execute on function public.gallery_selection_submit(uuid) to anon, authenticated;
-- gli helper NON sono esposti direttamente
revoke all on function public._gallery_base_media(uuid) from public, anon;
revoke all on function public._gallery_pool(uuid, int) from public, anon;
revoke all on function public._gallery_ensure_selection(uuid, uuid) from public, anon;
revoke all on function public._gallery_state_json(uuid) from public, anon;
