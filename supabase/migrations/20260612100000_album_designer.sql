-- ============================================================================
-- IMPAGINATORE ALBUM — progetto album per evento + tag "momento" per
-- l'auto-impaginazione. Gli sposi selezionano (60–110 foto per momento), il
-- motore impagina, il fotografo rifinisce. Tutto editabile.
-- ============================================================================

-- Tag "momento" su ogni media: guida il motore di auto-impaginazione.
-- (es. preparativi, famiglia, partecipazione, chiesa, uscita, coppia, ricevimento, festa, dettagli)
alter table public.gallery_media add column if not exists album_moment text;
create index if not exists idx_gallery_media_moment on public.gallery_media(album_moment) where album_moment is not null;

-- Un progetto album per evento (v1). layout = JSON con pagine/template/slot.
create table if not exists public.album_projects (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  gallery_id  uuid references public.event_galleries(id) on delete set null,
  owner_id    uuid not null,                              -- fotografo (proprietario galleria)
  format_key  text not null default 'SQ_30',
  status      text not null default 'DRAFT',              -- DRAFT | COUPLE_REVIEW | PHOTOGRAPHER_EDIT | FINAL
  layout      jsonb not null default '{"pages":[]}'::jsonb,
  target_min  int  not null default 60,
  target_max  int  not null default 110,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (entry_id)
);
alter table public.album_projects enable row level security;

-- Chi può lavorare all'album: fotografo proprietario galleria, sposi, admin.
create or replace function public.album_can_edit(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid())
      or public.is_wedding_couple(p_entry)
      or public.is_admin();
$$;
grant execute on function public.album_can_edit(uuid) to authenticated;

drop policy if exists ap_rw on public.album_projects;
create policy ap_rw on public.album_projects for all
  using (public.album_can_edit(entry_id))
  with check (public.album_can_edit(entry_id));

-- Salva (upsert) il progetto album.
create or replace function public.album_project_save(p_entry uuid, p_gallery uuid, p_format text, p_status text, p_layout jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_owner uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  insert into public.album_projects(entry_id, gallery_id, owner_id, format_key, status, layout, updated_by, updated_at)
    values (p_entry, p_gallery, coalesce(v_owner, auth.uid()),
            coalesce(nullif(p_format,''), 'SQ_30'), coalesce(nullif(p_status,''), 'DRAFT'),
            coalesce(p_layout, '{"pages":[]}'::jsonb), auth.uid(), now())
  on conflict (entry_id) do update set
    gallery_id = coalesce(excluded.gallery_id, public.album_projects.gallery_id),
    format_key = excluded.format_key,
    status     = excluded.status,
    layout     = excluded.layout,
    updated_by = auth.uid(),
    updated_at = now()
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.album_project_save(uuid, uuid, text, text, jsonb) to authenticated;

-- Assegna in blocco il tag "momento" a più media: [{id, moment}].
create or replace function public.album_set_moments(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_it jsonb; v_entry uuid; v_id uuid; n int := 0;
begin
  for v_it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_id := (v_it->>'id')::uuid;
    select entry_id into v_entry from public.gallery_media where id = v_id;
    if v_entry is null then continue; end if;
    if not public.album_can_edit(v_entry) then return jsonb_build_object('error', 'forbidden'); end if;
    update public.gallery_media set album_moment = nullif(v_it->>'moment', '') where id = v_id;
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'updated', n);
end$$;
grant execute on function public.album_set_moments(jsonb) to authenticated;
