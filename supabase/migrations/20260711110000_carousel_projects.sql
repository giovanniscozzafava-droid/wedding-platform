-- CAROSELLO: editor social (slide Instagram collegate in flusso unico, effetto seamless).
-- Modello dati specchio di album_projects: una riga per evento, layout in JSONB.
-- Il "documento" è una STRIP continua (una AlbumPage libera larga N*slide) che l'export
-- affetta in N slide 1080x1350 → swipe continuo su Instagram. Parte dalla stessa selezione
-- foto dell'album (gallery_media KEPT). Stesso gate di autorizzazione dell'album.

create table if not exists public.carousel_projects (
  entry_id    uuid primary key references public.calendar_entries(id) on delete cascade,
  owner_id    uuid,
  format_key  text not null default 'IG_PORTRAIT',   -- IG_PORTRAIT 1080x1350 | IG_SQUARE 1080x1080 | IG_STORY 1080x1920
  slides      int  not null default 3 check (slides between 1 and 20),
  status      text not null default 'DRAFT',          -- DRAFT | READY
  layout      jsonb not null default '{"strip":{"mode":"free","elements":[]}}'::jsonb,
  updated_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.carousel_projects enable row level security;

-- Stessa autorizzazione dell'album: fotografo proprietario galleria, coppia, admin.
drop policy if exists cp_rw on public.carousel_projects;
create policy cp_rw on public.carousel_projects for all
  using (public.album_can_edit(entry_id))
  with check (public.album_can_edit(entry_id));

-- Salva (upsert) il progetto carosello.
create or replace function public.carousel_project_save(
  p_entry uuid, p_format text, p_slides int, p_status text, p_layout jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  insert into public.carousel_projects(entry_id, owner_id, format_key, slides, status, layout, updated_by, updated_at)
    values (p_entry, coalesce(v_owner, auth.uid()),
            coalesce(nullif(p_format,''), 'IG_PORTRAIT'),
            greatest(1, least(20, coalesce(p_slides, 3))),
            coalesce(nullif(p_status,''), 'DRAFT'),
            coalesce(p_layout, '{"strip":{"mode":"free","elements":[]}}'::jsonb), auth.uid(), now())
  on conflict (entry_id) do update set
    format_key = excluded.format_key,
    slides     = excluded.slides,
    status     = excluded.status,
    layout     = excluded.layout,
    updated_by = auth.uid(),
    updated_at = now();
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.carousel_project_save(uuid, text, int, text, jsonb) to authenticated;

-- Carica il progetto carosello (o NULL se non esiste). Comodità: una sola RPC gated.
create or replace function public.carousel_project_get(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.carousel_projects;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  select * into v_row from public.carousel_projects where entry_id = p_entry;
  if not found then return jsonb_build_object('ok', true, 'exists', false); end if;
  return jsonb_build_object('ok', true, 'exists', true,
    'format_key', v_row.format_key, 'slides', v_row.slides, 'status', v_row.status, 'layout', v_row.layout);
end$$;
grant execute on function public.carousel_project_get(uuid) to authenticated;
