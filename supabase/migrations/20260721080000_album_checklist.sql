-- CHECKLIST DI CONSEGNA spuntata dalla COPPIA: il fotografo definisce le voci (nel layout dell'album),
-- la coppia le conferma nella vista di consegna. Lo stato (spuntato/no) è per evento e scritto dalla
-- coppia; il fotografo (owner dell'evento) può leggerlo (sa se la coppia ha confermato tutto).

create table if not exists public.album_checklist_state (
  entry_id   uuid not null references public.calendar_entries(id) on delete cascade,
  item_id    text not null,
  done       boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (entry_id, item_id)
);
alter table public.album_checklist_state enable row level security;
-- lettura: coppia dell'evento + proprietario (fotografo) + admin. Scrittura solo via RPC definer.
drop policy if exists acs_read on public.album_checklist_state;
create policy acs_read on public.album_checklist_state for select using (
  public.is_admin() or public.is_wedding_couple(entry_id)
  or exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

create or replace function public._album_checklist_allowed(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_wedding_couple(p_entry)
    or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
$$;

-- stato corrente: { item_id: done, ... }
create or replace function public.album_checklist_get(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._album_checklist_allowed(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  return coalesce((select jsonb_object_agg(item_id, done) from public.album_checklist_state where entry_id = p_entry), '{}'::jsonb);
end$$;

-- la coppia (o l'owner) spunta/deseleziona una voce
create or replace function public.album_checklist_toggle(p_entry uuid, p_item text, p_done boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public._album_checklist_allowed(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  insert into public.album_checklist_state(entry_id, item_id, done, updated_at)
    values (p_entry, p_item, coalesce(p_done, false), now())
    on conflict (entry_id, item_id) do update set done = excluded.done, updated_at = now();
  return jsonb_build_object('ok', true);
end$$;

grant execute on function public.album_checklist_get(uuid) to authenticated;
grant execute on function public.album_checklist_toggle(uuid, text, boolean) to authenticated;
