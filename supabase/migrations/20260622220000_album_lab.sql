-- STAMPERIA ALBUM: ruolo "album lab" (vede gli ordini di TUTTI i fotografi), ordini d'album con
-- stato/coda/rifiuto, e configurazione copertina/box (per il mockup 3D). RLS: il fotografo vede i
-- propri ordini; la stamperia (is_album_lab) vede e lavora tutti; admin tutto.

alter table public.profiles add column if not exists is_album_lab boolean not null default false;

create table if not exists public.album_orders (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references public.calendar_entries(id) on delete cascade,
  album_project_id uuid references public.album_projects(id) on delete set null,
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  couple_label    text,
  format_key      text not null default 'SQ_30',
  pages           int  not null default 0,
  copies          int  not null default 1,
  cover           jsonb not null default '{}'::jsonb,   -- {model, fabric, color, photo_url, title}
  status          text not null default 'NEW' check (status in ('NEW','ACCEPTED','IN_PRODUCTION','SHIPPED','REJECTED','ON_HOLD')),
  queue_order     int  not null default 0,
  reject_reason   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_album_orders_status on public.album_orders(status, queue_order, created_at);
create index if not exists idx_album_orders_photog on public.album_orders(photographer_id);

drop trigger if exists trg_album_orders_upd on public.album_orders;
create trigger trg_album_orders_upd before update on public.album_orders for each row execute function public.set_updated_at();

alter table public.album_orders enable row level security;
drop policy if exists album_orders_photog on public.album_orders;
create policy album_orders_photog on public.album_orders for all
  using (photographer_id = auth.uid()) with check (photographer_id = auth.uid());
drop policy if exists album_orders_lab on public.album_orders;
create policy album_orders_lab on public.album_orders for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_album_lab or p.role = 'ADMIN')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_album_lab or p.role = 'ADMIN')));

-- il fotografo invia un album in stampa (crea/aggiorna l'ordine; uno per album_project)
create or replace function public.album_send_to_print(p_entry uuid, p_cover jsonb, p_copies int default 1)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_proj record; v_label text; v_pages int; v_id uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error','forbidden'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  v_owner := coalesce(v_owner, auth.uid());
  select id, format_key, coalesce(jsonb_array_length(layout->'pages'),0) as pages into v_proj
    from public.album_projects where entry_id = p_entry order by updated_at desc limit 1;
  select coalesce(title, 'Album') into v_label from public.calendar_entries where id = p_entry;
  v_pages := coalesce(v_proj.pages, 0);

  select id into v_id from public.album_orders where album_project_id = v_proj.id and status in ('NEW','ON_HOLD','REJECTED') limit 1;
  if v_id is not null then
    update public.album_orders set cover = coalesce(p_cover,'{}'::jsonb), copies = greatest(1,coalesce(p_copies,1)),
      pages = v_pages, status = 'NEW', reject_reason = null where id = v_id;
  else
    insert into public.album_orders(entry_id, album_project_id, photographer_id, couple_label, format_key, pages, copies, cover)
      values (p_entry, v_proj.id, v_owner, v_label, coalesce(v_proj.format_key,'SQ_30'), v_pages, greatest(1,coalesce(p_copies,1)), coalesce(p_cover,'{}'::jsonb))
      returning id into v_id;
  end if;
  return jsonb_build_object('ok', true, 'order_id', v_id);
end$$;
grant execute on function public.album_send_to_print(uuid, jsonb, int) to authenticated;

-- la stamperia elenca tutti gli ordini (con nome fotografo)
create or replace function public.album_lab_list()
returns table (id uuid, couple_label text, photographer text, format_key text, pages int, copies int, cover jsonb, status text, queue_order int, reject_reason text, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select o.id, o.couple_label, coalesce(p.business_name, p.full_name, 'Fotografo'), o.format_key, o.pages, o.copies, o.cover, o.status, o.queue_order, o.reject_reason, o.created_at
  from public.album_orders o left join public.profiles p on p.id = o.photographer_id
  order by case o.status when 'NEW' then 0 when 'ACCEPTED' then 1 when 'IN_PRODUCTION' then 2 when 'ON_HOLD' then 3 when 'SHIPPED' then 4 else 5 end, o.queue_order, o.created_at;
$$;
grant execute on function public.album_lab_list() to authenticated;

-- la stamperia cambia stato / rifiuta / riordina (gate is_album_lab via RLS sull'update)
create or replace function public.album_lab_update(p_order uuid, p_status text, p_reason text default null, p_queue int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_is_lab boolean;
begin
  select (is_album_lab or role = 'ADMIN') into v_is_lab from public.profiles where id = auth.uid();
  if not coalesce(v_is_lab, false) then return jsonb_build_object('error','forbidden'); end if;
  if p_status is not null and p_status not in ('NEW','ACCEPTED','IN_PRODUCTION','SHIPPED','REJECTED','ON_HOLD') then return jsonb_build_object('error','bad_status'); end if;
  update public.album_orders set
    status = coalesce(p_status, status),
    reject_reason = case when p_status = 'REJECTED' then p_reason else reject_reason end,
    queue_order = coalesce(p_queue, queue_order)
  where id = p_order;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.album_lab_update(uuid, text, text, int) to authenticated;
