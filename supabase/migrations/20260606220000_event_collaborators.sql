-- ============================================================================
-- Colleghi esterni sull'evento: un fornitore (es. fotografo) invita un altro
-- fornitore Planfully (es. videografo) a CONDIVIDERE la timeline/run-sheet di
-- uno specifico turno/evento. L'invitato vede il programma (sola lettura) e può
-- esportarlo, così lavorano sugli stessi orari. Reciproco.
-- ============================================================================
create table if not exists public.supplier_event_collaborators (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.supplier_team_events(id) on delete cascade,
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  collaborator_id uuid not null references public.profiles(id) on delete cascade,
  status         text not null default 'INVITATO',   -- 'INVITATO' | 'ATTIVO' | 'RIFIUTATO'
  can_edit       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (event_id, collaborator_id),
  check (owner_id <> collaborator_id)
);
create index if not exists idx_event_collab_event on public.supplier_event_collaborators(event_id);
create index if not exists idx_event_collab_collaborator on public.supplier_event_collaborators(collaborator_id, status);

drop trigger if exists trg_event_collab_upd on public.supplier_event_collaborators;
create trigger trg_event_collab_upd before update on public.supplier_event_collaborators
  for each row execute function set_updated_at();

alter table public.supplier_event_collaborators enable row level security;

-- Il proprietario gestisce gli inviti del proprio evento.
drop policy if exists "event_collab_owner" on public.supplier_event_collaborators;
create policy "event_collab_owner" on public.supplier_event_collaborators
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Il collaboratore vede e aggiorna (accetta/rifiuta) la propria riga.
drop policy if exists "event_collab_self_read" on public.supplier_event_collaborators;
create policy "event_collab_self_read" on public.supplier_event_collaborators
  for select using (collaborator_id = auth.uid());
drop policy if exists "event_collab_self_update" on public.supplier_event_collaborators;
create policy "event_collab_self_update" on public.supplier_event_collaborators
  for update using (collaborator_id = auth.uid()) with check (collaborator_id = auth.uid());

-- Helper: l'utente è collaboratore ATTIVO di quell'evento?
create or replace function public.is_event_collaborator(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.supplier_event_collaborators
    where event_id = p_event and collaborator_id = auth.uid() and status = 'ATTIVO'
  );
$$;

-- --- Estensione RLS: il collaboratore ATTIVO può LEGGERE evento e run-sheet ---
drop policy if exists "team_events_shared_read" on public.supplier_team_events;
create policy "team_events_shared_read" on public.supplier_team_events
  for select using (public.is_event_collaborator(id));

drop policy if exists "event_items_shared_read" on public.supplier_team_event_items;
create policy "event_items_shared_read" on public.supplier_team_event_items
  for select using (public.is_event_collaborator(event_id));

-- RPC: invita un collega via email (deve essere un fornitore Planfully registrato).
create or replace function public.invite_event_collaborator(p_event_id uuid, p_email text, p_can_edit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := auth.uid();
  v_title text; v_target uuid; v_owner_name text; v_collab_id uuid;
begin
  if v_owner is null then return jsonb_build_object('error','auth_required'); end if;
  select title into v_title from public.supplier_team_events where id = p_event_id and supplier_id = v_owner;
  if v_title is null then return jsonb_build_object('error','not_owner'); end if;

  select p.id into v_target
    from public.profiles p join auth.users u on u.id = p.id
   where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_target is null then return jsonb_build_object('error','user_not_found'); end if;
  if v_target = v_owner then return jsonb_build_object('error','cannot_invite_self'); end if;

  insert into public.supplier_event_collaborators (event_id, owner_id, collaborator_id, status, can_edit)
  values (p_event_id, v_owner, v_target, 'INVITATO', coalesce(p_can_edit, false))
  on conflict (event_id, collaborator_id)
    do update set status = 'INVITATO', can_edit = excluded.can_edit, updated_at = now()
  returning id into v_collab_id;

  select coalesce(business_name, full_name, 'Un collega') into v_owner_name from public.profiles where id = v_owner;
  perform public.push_user_notification(
    v_target, 'EVENT_COLLAB_INVITE',
    'Invito a un evento',
    v_owner_name || ' ti ha invitato a condividere il programma di "' || v_title || '"',
    '/team', p_event_id);

  return jsonb_build_object('ok', true, 'collaborator_id', v_collab_id);
end$$;
grant execute on function public.invite_event_collaborator(uuid, text, boolean) to authenticated;

-- RPC: il collaboratore accetta o rifiuta l'invito.
create or replace function public.respond_event_invite(p_collab_id uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_owner uuid; v_event uuid; v_name text; v_title text;
begin
  if v_me is null then return jsonb_build_object('error','auth_required'); end if;
  update public.supplier_event_collaborators
     set status = case when p_accept then 'ATTIVO' else 'RIFIUTATO' end, updated_at = now()
   where id = p_collab_id and collaborator_id = v_me
   returning owner_id, event_id into v_owner, v_event;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;

  select coalesce(business_name, full_name, 'Il collega') into v_name from public.profiles where id = v_me;
  select title into v_title from public.supplier_team_events where id = v_event;
  perform public.push_user_notification(
    v_owner, 'EVENT_COLLAB_REPLY',
    case when p_accept then 'Invito accettato' else 'Invito rifiutato' end,
    v_name || (case when p_accept then ' ha accettato' else ' ha rifiutato' end) || ' la condivisione di "' || coalesce(v_title,'evento') || '"',
    '/team', v_event);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.respond_event_invite(uuid, boolean) to authenticated;

-- RPC: eventi condivisi CON ME (come collaboratore), con nome del proprietario.
create or replace function public.list_shared_events()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'collab_id', c.id,
    'status', c.status,
    'can_edit', c.can_edit,
    'event', jsonb_build_object(
      'id', e.id, 'title', e.title, 'event_date', e.event_date,
      'call_time', e.call_time, 'location', e.location, 'quote_id', e.quote_id
    ),
    'owner_name', coalesce(op.business_name, op.full_name, 'Collega')
  ) order by e.event_date desc nulls last), '[]'::jsonb)
  from public.supplier_event_collaborators c
  join public.supplier_team_events e on e.id = c.event_id
  join public.profiles op on op.id = c.owner_id
  where c.collaborator_id = auth.uid() and c.status in ('INVITATO','ATTIVO');
$$;
grant execute on function public.list_shared_events() to authenticated;
