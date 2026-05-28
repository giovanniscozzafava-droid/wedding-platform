-- WP/LOCATION aggiunge un fornitore esistente direttamente al proprio team.
-- Crea collaboration ACTIVE (oppure riattiva REVOKED). Idempotente.

create or replace function capostipite_add_supplier(p_supplier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capo uuid := auth.uid();
  v_role user_role;
  v_sup_role user_role;
  v_existing collaborations%rowtype;
  v_new collaborations%rowtype;
begin
  if v_capo is null then
    return jsonb_build_object('error','auth_required');
  end if;

  select role into v_role from profiles where id = v_capo;
  if v_role not in ('WEDDING_PLANNER','LOCATION') then
    return jsonb_build_object('error','only_capostipite');
  end if;

  select role into v_sup_role from profiles where id = p_supplier_id;
  if v_sup_role is distinct from 'FORNITORE' then
    return jsonb_build_object('error','target_not_supplier');
  end if;

  select * into v_existing from collaborations
   where capostipite_id = v_capo and fornitore_id = p_supplier_id;

  if v_existing.id is not null then
    if v_existing.status = 'ACTIVE' then
      return jsonb_build_object('ok', true, 'already_active', true, 'collaboration_id', v_existing.id);
    end if;
    update collaborations
       set status = 'ACTIVE', accepted_at = now()
     where id = v_existing.id
     returning * into v_new;
    return jsonb_build_object('ok', true, 'reactivated', true, 'collaboration_id', v_new.id);
  end if;

  insert into collaborations (capostipite_id, fornitore_id, status, invited_at, accepted_at)
  values (v_capo, p_supplier_id, 'ACTIVE', now(), now())
  returning * into v_new;

  return jsonb_build_object('ok', true, 'collaboration_id', v_new.id);
end$$;

grant execute on function capostipite_add_supplier(uuid) to authenticated;
