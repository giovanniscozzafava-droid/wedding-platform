-- CATALOGO PDF ALBUM: ogni fotografo carica il PDF del proprio catalogo aziendale e
-- marca "hotspot" (riquadri cliccabili) sui modelli. La coppia sfoglia il PDF, tocca il
-- modello, compila le specifiche, FIRMA → ne esce una COMMESSA firmata che entra nella
-- coda azienda ESISTENTE (album_orders + ruolo is_album_lab). Non duplica la commessa.

-- ---------------------------------------------------------------------------
-- Storage: PDF catalogo (pubblico, marketing) e commesse firmate (privato).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album-catalogs','album-catalogs', true, 52428800, array['application/pdf'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('album-commissions','album-commissions', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- PDF catalogo: path = <owner_id>/<uuid>.pdf. Lettura pubblica; scrittura solo del proprietario.
drop policy if exists "albumcat read" on storage.objects;
create policy "albumcat read" on storage.objects for select using (bucket_id = 'album-catalogs');
drop policy if exists "albumcat write owner" on storage.objects;
create policy "albumcat write owner" on storage.objects for insert with check (
  bucket_id = 'album-catalogs' and split_part(name,'/',1) = auth.uid()::text
);
drop policy if exists "albumcat update owner" on storage.objects;
create policy "albumcat update owner" on storage.objects for update using (
  bucket_id = 'album-catalogs' and split_part(name,'/',1) = auth.uid()::text
);
drop policy if exists "albumcat delete owner" on storage.objects;
create policy "albumcat delete owner" on storage.objects for delete using (
  bucket_id = 'album-catalogs' and split_part(name,'/',1) = auth.uid()::text
);

-- Commesse firmate: path = <entry_id>/<uuid>.pdf. Scrive chi può editare l'evento (coppia/fotografo);
-- legge coppia/fotografo + azienda (is_album_lab) + admin.
drop policy if exists "albumcomm insert party" on storage.objects;
create policy "albumcomm insert party" on storage.objects for insert with check (
  bucket_id = 'album-commissions' and public.album_can_edit((split_part(name,'/',1))::uuid)
);
drop policy if exists "albumcomm read party" on storage.objects;
create policy "albumcomm read party" on storage.objects for select using (
  bucket_id = 'album-commissions' and (
    public.album_can_edit((split_part(name,'/',1))::uuid)
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_album_lab or p.role = 'ADMIN'))
  )
);

-- ---------------------------------------------------------------------------
-- Tabelle: catalogo per fotografo + hotspot.
-- ---------------------------------------------------------------------------
create table if not exists public.album_catalogs (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Catalogo album',
  pdf_path    text not null,
  page_count  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_album_catalogs_owner on public.album_catalogs(owner_id, active);
drop trigger if exists trg_album_catalogs_upd on public.album_catalogs;
create trigger trg_album_catalogs_upd before update on public.album_catalogs
  for each row execute function public.set_updated_at();

create table if not exists public.album_catalog_hotspots (
  id             uuid primary key default gen_random_uuid(),
  catalog_id     uuid not null references public.album_catalogs(id) on delete cascade,
  page           int  not null default 1,
  x              real not null,  -- coordinate normalizzate 0..1 (frazione della pagina)
  y              real not null,
  w              real not null,
  h              real not null,
  label          text not null default 'Modello',
  default_format text,
  default_pages  int,
  created_at     timestamptz not null default now()
);
create index if not exists idx_album_hotspots_cat on public.album_catalog_hotspots(catalog_id, page);

alter table public.album_catalogs enable row level security;
alter table public.album_catalog_hotspots enable row level security;

drop policy if exists album_catalogs_owner on public.album_catalogs;
create policy album_catalogs_owner on public.album_catalogs for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists album_hotspots_owner on public.album_catalog_hotspots;
create policy album_hotspots_owner on public.album_catalog_hotspots for all
  using (exists (select 1 from public.album_catalogs c where c.id = catalog_id and c.owner_id = auth.uid()))
  with check (exists (select 1 from public.album_catalogs c where c.id = catalog_id and c.owner_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- RPC: la coppia legge il catalogo attivo del fotografo del proprio evento.
-- security definer → niente RLS complessa lato lettura coppia.
-- ---------------------------------------------------------------------------
create or replace function public.album_catalog_for_entry(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cat record; v_hot jsonb; v_studio text;
begin
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then
    select owner_id into v_owner from public.calendar_entries where id = p_entry limit 1;
  end if;
  if v_owner is null then return jsonb_build_object('error','no_event'); end if;

  select coalesce(business_name, full_name, 'Studio') into v_studio from public.profiles where id = v_owner;

  select id, name, pdf_path, page_count into v_cat
    from public.album_catalogs where owner_id = v_owner and active
    order by updated_at desc limit 1;
  if v_cat.id is null then return jsonb_build_object('error','no_catalog'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',h.id,'page',h.page,'x',h.x,'y',h.y,'w',h.w,'h',h.h,
           'label',h.label,'default_format',h.default_format,'default_pages',h.default_pages
         ) order by h.page, h.created_at), '[]'::jsonb)
    into v_hot from public.album_catalog_hotspots h where h.catalog_id = v_cat.id;

  return jsonb_build_object('ok', true,
    'catalog', jsonb_build_object('id',v_cat.id,'name',v_cat.name,'pdf_path',v_cat.pdf_path,
                                  'page_count',v_cat.page_count,'owner_id',v_owner,'studio',v_studio),
    'hotspots', v_hot);
end$$;
grant execute on function public.album_catalog_for_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: crea la commessa firmata → riga in album_orders (coda azienda esistente).
-- p_payload = { catalog_id, page, model_label, specs:{format,pages,box,finishes},
--               signed_by, signed_at, commission_pdf_path }
-- ---------------------------------------------------------------------------
create or replace function public.album_commission_create(p_entry uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_label text; v_pages int; v_format text; v_id uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error','forbidden'); end if;

  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then select owner_id into v_owner from public.calendar_entries where id = p_entry limit 1; end if;
  v_owner := coalesce(v_owner, auth.uid());

  select coalesce(title,'Album') into v_label from public.calendar_entries where id = p_entry;
  v_pages  := coalesce((p_payload->'specs'->>'pages')::int, 0);
  v_format := coalesce(p_payload->'specs'->>'format', 'SQ_30');

  insert into public.album_orders(entry_id, photographer_id, couple_label, format_key, pages, copies, cover, status)
    values (p_entry, v_owner, v_label, v_format, v_pages, 1,
            jsonb_build_object('source','pdf_catalog') || coalesce(p_payload, '{}'::jsonb), 'NEW')
    returning id into v_id;

  return jsonb_build_object('ok', true, 'order_id', v_id);
end$$;
grant execute on function public.album_commission_create(uuid, jsonb) to authenticated;
