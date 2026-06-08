-- ============================================================================
-- Il collaboratore esterno ATTIVO porta in dote il PROPRIO team: i suoi membri
-- (es. il secondo operatore) compaiono anch'essi nel team dell'evento.
-- RPC che, per chi possiede l'evento (o ne è collaboratore), restituisce i
-- membri attivi di tutti i collaboratori ATTIVI. SECURITY DEFINER per leggere i
-- team altrui in sicurezza, solo nel contesto di quell'evento.
-- ============================================================================
create or replace function public.event_imported_team(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_is_owner boolean; v_res jsonb;
begin
  if v_uid is null then return '[]'::jsonb; end if;
  select exists(select 1 from public.supplier_team_events where id = p_event_id and supplier_id = v_uid)
    into v_is_owner;
  if not v_is_owner and not public.is_event_collaborator(p_event_id) then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                m.id,
           'full_name',         m.full_name,
           'role_label',        m.role_label,
           'collaborator_id',   c.collaborator_id,
           'collaborator_name', coalesce(cp.business_name, cp.full_name, 'Collega')
         ) order by coalesce(cp.business_name, cp.full_name), m.full_name), '[]'::jsonb)
    into v_res
  from public.supplier_event_collaborators c
  join public.profiles cp on cp.id = c.collaborator_id
  join public.supplier_team_members m on m.supplier_id = c.collaborator_id and m.active = true
  where c.event_id = p_event_id and c.status = 'ATTIVO';

  return v_res;
end$$;
grant execute on function public.event_imported_team(uuid) to authenticated;
