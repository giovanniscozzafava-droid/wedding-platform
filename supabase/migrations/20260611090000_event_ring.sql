-- ============================================================================
-- Anello dell'evento (§10): ogni evento è un cerchio a segmenti, un segmento per
-- ruolo necessario. Acceso = coperto da un membro del cerchio; spento = scoperto.
-- Denominatore IBRIDO: checklist standard, il timone (owner) toglie/aggiunge ruoli.
-- Coverage calcolata dai membri del cerchio (subrole), niente percentuali.
-- ============================================================================
create table public.event_ring_roles (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  role_key text not null,
  label text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (entry_id, role_key)
);
create index on public.event_ring_roles(entry_id);

alter table public.event_ring_roles enable row level security;
revoke all on public.event_ring_roles from anon;
grant select, insert, update, delete on public.event_ring_roles to authenticated;
-- legge chi è nel cerchio; scrive il timone (owner dell'evento) o admin
create policy err_read on public.event_ring_roles for select
  using (public._photo_circle_member(entry_id) or public.is_wedding_couple(entry_id) or public.is_admin());
create policy err_write on public.event_ring_roles for all
  using (exists (select 1 from public.calendar_entries e where e.id = entry_id and e.owner_id = auth.uid()) or public.is_admin())
  with check (exists (select 1 from public.calendar_entries e where e.id = entry_id and e.owner_id = auth.uid()) or public.is_admin());

-- Set standard (denominatore di partenza). role_key = subrole (o 'location').
create or replace function public._event_ring_seed(p_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.event_ring_roles where entry_id = p_entry) then return; end if;
  insert into public.event_ring_roles(entry_id, role_key, label, sort_order) values
    (p_entry,'location','Location',1),
    (p_entry,'catering','Catering',2),
    (p_entry,'fotografo','Fotografo',3),
    (p_entry,'videomaker','Videomaker',4),
    (p_entry,'fioraio','Fiori',5),
    (p_entry,'musica','Musica / DJ',6),
    (p_entry,'make_up','Trucco',7),
    (p_entry,'parrucchiere','Acconciatura',8),
    (p_entry,'allestimenti','Allestimenti',9),
    (p_entry,'pasticcere','Torta',10)
  on conflict (entry_id, role_key) do nothing;
end$$;

-- Stato dell'anello per un evento (con seed lazy). Accessibile a chi è nel cerchio.
create or replace function public.get_event_ring(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_roles jsonb; v_total int; v_covered int;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','event_not_found'); end if;
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;

  perform public._event_ring_seed(p_entry);

  -- chiavi coperte = subrole dei membri del cerchio (partecipanti + owner + collaboratori)
  -- + 'location' se un membro ha role LOCATION
  with members as (
    select user_id as uid from public.calendar_entry_participants where entry_id = p_entry
    union select v_owner
    union select collaborator_id from public.supplier_event_collaborators where event_id = p_entry and status = 'ATTIVO'
  ),
  covered_keys as (
    select distinct pr.subrole as k from members m join public.profiles pr on pr.id = m.uid where pr.subrole is not null
    union
    select 'location' from members m join public.profiles pr on pr.id = m.uid where pr.role = 'LOCATION'
  ),
  named as (
    -- primo nome che copre ogni subrole (per "coperto da")
    select pr.subrole as k, coalesce(pr.business_name, pr.full_name) as nm
    from members m join public.profiles pr on pr.id = m.uid where pr.subrole is not null
  )
  select
    jsonb_agg(jsonb_build_object(
      'role_key', r.role_key, 'label', r.label, 'sort_order', r.sort_order,
      'covered', (r.role_key in (select k from covered_keys)),
      'covered_by', (select nm from named n where n.k = r.role_key limit 1)
    ) order by r.sort_order),
    count(*),
    count(*) filter (where r.role_key in (select k from covered_keys))
  into v_roles, v_total, v_covered
  from public.event_ring_roles r
  where r.entry_id = p_entry and r.active;

  return jsonb_build_object(
    'roles', coalesce(v_roles,'[]'::jsonb),
    'total', coalesce(v_total,0),
    'covered', coalesce(v_covered,0),
    'closed', coalesce(v_total,0) > 0 and coalesce(v_covered,0) = coalesce(v_total,0)
  );
end$$;

-- Il timone aggiunge/toglie/riattiva un ruolo del proprio anello.
create or replace function public.set_event_ring_role(p_entry uuid, p_role_key text, p_active boolean, p_label text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.calendar_entries e where e.id = p_entry and e.owner_id = auth.uid()) and not public.is_admin() then
    return jsonb_build_object('error','forbidden');
  end if;
  insert into public.event_ring_roles(entry_id, role_key, label, active, sort_order)
    values (p_entry, p_role_key, coalesce(p_label, initcap(replace(p_role_key,'_',' '))), p_active,
            coalesce((select max(sort_order)+1 from public.event_ring_roles where entry_id = p_entry), 99))
    on conflict (entry_id, role_key) do update set active = excluded.active,
            label = coalesce(excluded.label, public.event_ring_roles.label);
  return jsonb_build_object('ok', true);
end$$;

grant execute on function public.get_event_ring(uuid) to authenticated;
grant execute on function public.set_event_ring_role(uuid, text, boolean, text) to authenticated;
