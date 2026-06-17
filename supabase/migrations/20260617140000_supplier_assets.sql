-- LIBRERIA ASSET DEL FORNITORE: foto dei propri lavori/stili, taggate (tag modificabili/
-- cancellabili). Fonte unica riusabile: gioco swipe nel form lead, e in futuro pagine/siti/blog.
create table if not exists public.supplier_assets (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,                 -- nel bucket 'supplier-assets'
  caption      text,
  tags         text[] not null default '{}',
  kind         text not null default 'style', -- style | work | inspiration ...
  event_kind   text,                          -- opzionale: filtro per tipo evento
  is_public    boolean not null default true, -- visibile al pubblico (swipe/pagine)
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_supplier_assets_supplier on public.supplier_assets(supplier_id);
create index if not exists idx_supplier_assets_tags on public.supplier_assets using gin(tags);

alter table public.supplier_assets enable row level security;
drop policy if exists sa_owner_all on public.supplier_assets;
create policy sa_owner_all on public.supplier_assets for all
  using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());
drop policy if exists sa_admin_all on public.supplier_assets;
create policy sa_admin_all on public.supplier_assets for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists sa_public_read on public.supplier_assets;
create policy sa_public_read on public.supplier_assets for select using (is_public);

drop trigger if exists trg_sa_updated on public.supplier_assets;
create trigger trg_sa_updated before update on public.supplier_assets
  for each row execute function set_updated_at();

-- Bucket pubblico per le immagini (URL pubblici opachi). Path: {supplier_id}/{filename}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('supplier-assets', 'supplier-assets', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/heic','image/avif'])
on conflict (id) do update set public = true;

drop policy if exists "supplier_assets_read_all" on storage.objects;
create policy "supplier_assets_read_all" on storage.objects for select using (bucket_id = 'supplier-assets');
drop policy if exists "supplier_assets_insert_owner" on storage.objects;
create policy "supplier_assets_insert_owner" on storage.objects for insert with check (
  bucket_id = 'supplier-assets' and auth.uid() is not null and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists "supplier_assets_delete_owner" on storage.objects;
create policy "supplier_assets_delete_owner" on storage.objects for delete using (
  bucket_id = 'supplier-assets' and split_part(name, '/', 1) = auth.uid()::text);

-- RPC PUBBLICA: le card di un fornitore by slug (per il gioco swipe nel form lead, anon).
create or replace function public.get_supplier_assets(p_slug text, p_event_kind text default null, p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sup uuid;
begin
  select id into v_sup from public.profiles where slug = p_slug limit 1;
  if v_sup is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'path', a.storage_path, 'caption', a.caption, 'tags', a.tags)
                     order by a.sort_order, a.created_at desc)
    from public.supplier_assets a
    where a.supplier_id = v_sup and a.is_public
      and (p_event_kind is null or a.event_kind is null or a.event_kind = p_event_kind)
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  ), '[]'::jsonb);
end$$;
grant execute on function public.get_supplier_assets(text, text, int) to anon, authenticated;
