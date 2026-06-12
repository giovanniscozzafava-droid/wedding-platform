-- ============================================================================
-- VIDEOMAKER: consegna del video (bozza + finale) con revisione del cliente.
-- Il cliente guarda, mette in pausa e lascia un "post-it" su un momento preciso
-- (timestamp) commentando montaggio/musica/ecc. Il videomaker risolve i post-it.
-- ============================================================================
create table if not exists public.video_projects (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  owner_id    uuid not null,                  -- il videomaker che consegna
  draft_url   text,                            -- video bozza (link diretto / Drive condiviso)
  final_url   text,                            -- video finale
  status      text not null default 'DRAFT',   -- DRAFT | REVIEW | FINAL
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (entry_id)
);
alter table public.video_projects enable row level security;

create table if not exists public.video_comments (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  author_name text,
  t_seconds   numeric not null default 0,      -- momento del video a cui si riferisce
  target      text not null default 'bozza',   -- bozza | finale
  kind        text not null default 'generale',-- generale | montaggio | musica | colore
  body        text not null,
  status      text not null default 'OPEN',    -- OPEN | DONE
  created_at  timestamptz not null default now()
);
create index if not exists idx_video_comments_entry on public.video_comments(entry_id, t_seconds);
alter table public.video_comments enable row level security;

-- Chi può MODIFICARE (videomaker/cerchio/owner/admin) vs solo COMMENTARE (anche coppia).
create or replace function public.video_can_edit(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public._photo_circle_member(p_entry) or public.is_admin()
      or exists (select 1 from public.event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid())
      or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
      or exists (select 1 from public.video_projects vp where vp.entry_id = p_entry and vp.owner_id = auth.uid());
$$;
create or replace function public.video_can_view(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.video_can_edit(p_entry) or public.is_wedding_couple(p_entry);
$$;
grant execute on function public.video_can_edit(uuid) to authenticated;
grant execute on function public.video_can_view(uuid) to authenticated;

drop policy if exists vp_view on public.video_projects;
create policy vp_view on public.video_projects for select using (public.video_can_view(entry_id));
drop policy if exists vp_edit on public.video_projects;
create policy vp_edit on public.video_projects for all using (public.video_can_edit(entry_id)) with check (public.video_can_edit(entry_id));

drop policy if exists vc_view on public.video_comments;
create policy vc_view on public.video_comments for select using (public.video_can_view(entry_id));
drop policy if exists vc_insert on public.video_comments;
create policy vc_insert on public.video_comments for insert with check (user_id = auth.uid() and public.video_can_view(entry_id));
drop policy if exists vc_update on public.video_comments;
create policy vc_update on public.video_comments for update using (public.video_can_edit(entry_id) or user_id = auth.uid());
drop policy if exists vc_delete on public.video_comments;
create policy vc_delete on public.video_comments for delete using (user_id = auth.uid() or public.video_can_edit(entry_id));

-- Salva (upsert) il progetto video.
create or replace function public.video_project_save(p_entry uuid, p_draft text, p_final text, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.video_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  insert into public.video_projects(entry_id, owner_id, draft_url, final_url, status, updated_at)
    values (p_entry, auth.uid(), nullif(p_draft,''), nullif(p_final,''), coalesce(nullif(p_status,''),'DRAFT'), now())
  on conflict (entry_id) do update set
    draft_url = excluded.draft_url, final_url = excluded.final_url, status = excluded.status, updated_at = now()
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.video_project_save(uuid, text, text, text) to authenticated;

-- autore del post-it
create or replace function public._set_video_comment_author() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select split_part(full_name_searched, ' ', 1) from public.gallery_guests where entry_id = new.entry_id and guest_user_id = auth.uid() limit 1),
    (select coalesce(nullif(business_name,''), full_name) from public.profiles where id = auth.uid()),
    'Cliente');
  return new;
end$$;
drop trigger if exists trg_set_video_comment_author on public.video_comments;
create trigger trg_set_video_comment_author before insert on public.video_comments
  for each row execute function public._set_video_comment_author();

-- notifica: post-it del cliente → videomaker; risposte → coppia
create or replace function public._notify_video_comment() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; m record;
begin
  select owner_id into v_owner from public.video_projects where entry_id = new.entry_id limit 1;
  if v_owner is not null and v_owner <> new.user_id then
    perform public.push_user_notification(v_owner, 'video_comment', 'Nuovo post-it sul video',
      coalesce(new.author_name,'Il cliente') || ' ha commentato a ' || to_char((new.t_seconds || ' seconds')::interval, 'MI:SS'),
      '/video/' || new.entry_id, new.entry_id);
  end if;
  for m in select user_id from public.wedding_couple_members where entry_id = new.entry_id and user_id is not null and user_id <> new.user_id loop
    perform public.push_user_notification(m.user_id, 'video_comment', 'Aggiornamento sul video', 'Nuovo commento sul vostro video', '/couple', new.entry_id);
  end loop;
  return new;
end$$;
drop trigger if exists trg_notify_video_comment on public.video_comments;
create trigger trg_notify_video_comment after insert on public.video_comments
  for each row execute function public._notify_video_comment();
