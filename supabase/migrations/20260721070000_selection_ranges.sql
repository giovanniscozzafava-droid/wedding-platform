-- RANGE DI SELEZIONE ALBUM per TIPO EVENTO (event_kind): il fotografo decide min/max foto che la
-- coppia deve selezionare. Impostato su una galleria diventa il DEFAULT per quel tipo di evento e
-- viene applicato alla creazione della selezione. La coppia lo vede già (traguardo min–max) e la
-- conferma è bloccata fuori range.

create table if not exists public.album_selection_prefs (
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  event_kind  text not null,
  target_min  int  not null,
  target_max  int  not null,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, event_kind)
);
alter table public.album_selection_prefs enable row level security;
drop policy if exists asp_owner_all on public.album_selection_prefs;
create policy asp_owner_all on public.album_selection_prefs
  for all using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- Alla CREAZIONE della selezione uso il default del fotografo per quel tipo evento (fallback 60/120).
create or replace function public._gallery_ensure_selection(p_gallery uuid, p_entry uuid)
returns public.gallery_selection language plpgsql security definer set search_path = public as $$
declare v public.gallery_selection; v_owner uuid; v_kind text; v_min int; v_max int;
begin
  select * into v from public.gallery_selection where gallery_id = p_gallery;
  if v.gallery_id is null then
    select g.owner_id, coalesce(ce.event_kind, 'matrimonio')
      into v_owner, v_kind
      from public.event_galleries g
      left join public.calendar_entries ce on ce.id = g.entry_id
      where g.id = p_gallery;
    select p.target_min, p.target_max into v_min, v_max
      from public.album_selection_prefs p
      where p.owner_id = v_owner and p.event_kind = v_kind;
    insert into public.gallery_selection(gallery_id, entry_id, target_min, target_max)
      values (p_gallery, p_entry, coalesce(v_min, 60), coalesce(v_max, 120))
      on conflict (gallery_id) do nothing;
    select * into v from public.gallery_selection where gallery_id = p_gallery;
  end if;
  return v;
end$$;

-- Il fotografo legge il range corrente della galleria (crea la riga se manca) + il tipo evento.
create or replace function public.gallery_get_range(p_gallery uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g public.event_galleries; v_sel public.gallery_selection; v_kind text;
begin
  select * into v_g from public.event_galleries where id = p_gallery;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (v_g.owner_id = auth.uid() or public.is_admin()) then return jsonb_build_object('error', 'forbidden'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  select coalesce(event_kind, 'matrimonio') into v_kind from public.calendar_entries where id = v_g.entry_id;
  return jsonb_build_object('min', v_sel.target_min, 'max', v_sel.target_max, 'event_kind', v_kind, 'submitted', v_sel.submitted_at is not null);
end$$;

-- Il fotografo imposta il range di QUESTA galleria E lo salva come default per il tipo evento.
create or replace function public.gallery_set_range(p_gallery uuid, p_min int, p_max int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g public.event_galleries; v_kind text; v_min int; v_max int;
begin
  select * into v_g from public.event_galleries where id = p_gallery;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (v_g.owner_id = auth.uid() or public.is_admin()) then return jsonb_build_object('error', 'forbidden'); end if;
  v_min := greatest(1, coalesce(p_min, 60));
  v_max := greatest(v_min, coalesce(p_max, 120));
  perform public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  update public.gallery_selection set target_min = v_min, target_max = v_max, updated_at = now() where gallery_id = v_g.id;
  select coalesce(event_kind, 'matrimonio') into v_kind from public.calendar_entries where id = v_g.entry_id;
  insert into public.album_selection_prefs(owner_id, event_kind, target_min, target_max, updated_at)
    values (v_g.owner_id, v_kind, v_min, v_max, now())
    on conflict (owner_id, event_kind) do update set target_min = excluded.target_min, target_max = excluded.target_max, updated_at = now();
  return jsonb_build_object('ok', true, 'min', v_min, 'max', v_max, 'event_kind', v_kind);
end$$;

grant execute on function public.gallery_get_range(uuid) to authenticated;
grant execute on function public.gallery_set_range(uuid, int, int) to authenticated;
