-- ============================================================================
-- Il collaboratore esterno ATTIVO su un evento entra nel team per quell'evento:
-- compare nei turni/presenze come un membro e riceve una comunicazione quando il
-- programma cambia. Estendiamo supplier_team_assignments per accettare, in
-- alternativa a member_id, un collaborator_id (profilo del collega).
-- ============================================================================
alter table public.supplier_team_assignments
  alter column member_id drop not null,
  add column if not exists collaborator_id uuid references public.profiles(id) on delete cascade;

create unique index if not exists uq_assign_event_collaborator
  on public.supplier_team_assignments(event_id, collaborator_id)
  where collaborator_id is not null;

-- Notifica ai collaboratori ATTIVI quando il programma (run-sheet) di un evento
-- viene aggiornato: "comunicazione" di squadra.
create or replace function public.notify_collaborators_runsheet()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event uuid; v_title text; v_owner_name text; r record;
begin
  v_event := coalesce(new.event_id, old.event_id);
  select e.title into v_title from public.supplier_team_events e where e.id = v_event;
  select coalesce(business_name, full_name, 'Il referente') into v_owner_name
    from public.profiles where id = coalesce(new.supplier_id, old.supplier_id);
  for r in
    select collaborator_id from public.supplier_event_collaborators
     where event_id = v_event and status = 'ATTIVO'
  loop
    perform public.push_user_notification(
      r.collaborator_id, 'EVENT_RUNSHEET_UPDATE', 'Programma aggiornato',
      v_owner_name || ' ha aggiornato il programma di "' || coalesce(v_title,'evento') || '"',
      '/team', v_event);
  end loop;
  return null;
end$$;

drop trigger if exists trg_notify_collab_runsheet on public.supplier_team_event_items;
create trigger trg_notify_collab_runsheet
  after insert or update or delete on public.supplier_team_event_items
  for each row execute function public.notify_collaborators_runsheet();
