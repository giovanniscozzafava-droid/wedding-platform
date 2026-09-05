-- ============================================================================
-- GER-06 (trovato dall'audit) + NEW-10 (trovato dal collaudo dal vivo 05/09):
--
-- GER-06: nessuna notifica al capostipite quando (a) un fornitore chiede di
-- collaborare (supplier_invite_capostipite) o (b) un fornitore esce dalla
-- rete (supplier_leave_collaboration). Il capostipite scopriva entrambe le
-- cose solo aprendo manualmente la pagina fornitori.
--
-- NEW-10: su `collaborations`, riattivare/riaprire una relazione non azzerava
-- mai accepted_at/revoked_at del ciclo precedente — righe "sporche" che
-- farebbero leggere falsi positivi a qualunque logica futura su "è mai stata
-- revocata questa collaborazione". Corretto in tutti e tre i punti che
-- riattivano/riaprono una collaborations: capostipite_add_supplier,
-- wp_add_location_to_team, supplier_invite_capostipite.
-- ============================================================================

-- --- supplier_invite_capostipite: notifica il capostipite + azzera stato sporco ---
create or replace function supplier_invite_capostipite(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid := auth.uid();
  v_capo_user uuid;
  v_capo_profile record;
  v_supplier_profile record;
  v_existing record;
  v_collab_id uuid;
begin
  if v_supplier is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  if not exists (select 1 from profiles where id = v_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'only_fornitore_can_invite');
  end if;

  select id into v_capo_user from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_capo_user is null then
    return jsonb_build_object('error', 'capostipite_non_trovato',
      'detail', 'Nessun account Planfully con questa email. Chiedi al/la wedding planner di registrarsi prima.');
  end if;

  select * into v_capo_profile from profiles where id = v_capo_user;
  if v_capo_profile.role not in ('WEDDING_PLANNER', 'LOCATION', 'ADMIN') then
    return jsonb_build_object('error', 'non_e_capostipite',
      'detail', 'L''account trovato non e un wedding planner o location.');
  end if;

  if v_capo_user = v_supplier then
    return jsonb_build_object('error', 'self_invite');
  end if;

  select * into v_supplier_profile from profiles where id = v_supplier;

  select * into v_existing from collaborations
   where fornitore_id = v_supplier and capostipite_id = v_capo_user
   limit 1;
  if v_existing.id is not null then
    if v_existing.status = 'ACTIVE' then
      return jsonb_build_object('error', 'gia_collaborano', 'collaboration_id', v_existing.id);
    end if;
    -- Riaperto: torna a PENDING, stato pulito (niente accepted_at/revoked_at di un ciclo precedente).
    update collaborations
       set status = 'PENDING', initiated_by = 'FORNITORE', updated_at = now(),
           accepted_at = null, revoked_at = null
     where id = v_existing.id;
    insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
    values (v_capo_user, 'RICHIESTA_COLLABORAZIONE_FORNITORE', 'Richiesta di collaborazione',
      coalesce(v_supplier_profile.business_name, v_supplier_profile.full_name, 'Un fornitore') || ' vuole entrare nella tua rete.',
      '/suppliers', v_supplier, 'PENDING', 6);
    return jsonb_build_object('ok', true, 'collaboration_id', v_existing.id, 'mode', 'reopened');
  end if;

  insert into collaborations (capostipite_id, fornitore_id, status, initiated_by)
    values (v_capo_user, v_supplier, 'PENDING', 'FORNITORE')
    returning id into v_collab_id;

  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (v_capo_user, 'RICHIESTA_COLLABORAZIONE_FORNITORE', 'Richiesta di collaborazione',
    coalesce(v_supplier_profile.business_name, v_supplier_profile.full_name, 'Un fornitore') || ' vuole entrare nella tua rete.',
    '/suppliers', v_supplier, 'PENDING', 6);

  return jsonb_build_object('ok', true, 'collaboration_id', v_collab_id,
    'capostipite_name', coalesce(v_capo_profile.business_name, v_capo_profile.full_name));
end$$;

grant execute on function supplier_invite_capostipite(text) to authenticated;

-- --- supplier_leave_collaboration: notifica il capostipite ---
-- (stessa logica originale — revoca da qualunque stato non già REVOKED —
-- con l'aggiunta della notifica al capostipite, prima assente)
create or replace function public.supplier_leave_collaboration(p_capostipite_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_supplier_profile record;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;

  update public.collaborations
     set status = 'REVOKED', revoked_at = now(), updated_at = now()
   where capostipite_id = p_capostipite_id
     and fornitore_id = v_uid
     and status <> 'REVOKED';

  if not found then
    return jsonb_build_object('error','not_found');
  end if;

  select * into v_supplier_profile from profiles where id = v_uid;
  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (p_capostipite_id, 'FORNITORE_USCITO', 'Un fornitore ha lasciato la rete',
    coalesce(v_supplier_profile.business_name, v_supplier_profile.full_name, 'Un fornitore') || ' si è tolto dalla tua rete fornitori.',
    '/suppliers', v_uid, 'PENDING', 5);

  return jsonb_build_object('ok', true);
end$$;

grant execute on function public.supplier_leave_collaboration(uuid) to authenticated;

-- --- capostipite_add_supplier: azzera revoked_at alla riattivazione ---
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

  if v_role = 'WEDDING_PLANNER' then
    if v_sup_role not in ('FORNITORE','LOCATION') then
      return jsonb_build_object('error','target_not_supplier');
    end if;
  else  -- LOCATION
    if v_sup_role is distinct from 'FORNITORE' then
      return jsonb_build_object('error','target_not_supplier');
    end if;
  end if;

  select * into v_existing from collaborations
   where capostipite_id = v_capo and fornitore_id = p_supplier_id;

  if v_existing.id is not null then
    if v_existing.status = 'ACTIVE' then
      return jsonb_build_object('ok', true, 'already_active', true, 'collaboration_id', v_existing.id);
    end if;
    update collaborations
       set status = 'ACTIVE', accepted_at = now(), revoked_at = null
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

-- --- wp_add_location_to_team: azzera revoked_at alla riattivazione ---
create or replace function public.wp_add_location_to_team(p_location_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_target_role user_role;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_location_id = v_uid then return jsonb_build_object('error','self'); end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'WEDDING_PLANNER' then return jsonb_build_object('error','forbidden'); end if;
  select role into v_target_role from public.profiles where id = p_location_id;
  if v_target_role is null then return jsonb_build_object('error','not_found'); end if;
  if v_target_role <> 'LOCATION' then return jsonb_build_object('error','not_a_location'); end if;

  insert into public.collaborations (capostipite_id, fornitore_id, status, invited_at, accepted_at)
  values (v_uid, p_location_id, 'ACTIVE', now(), now())
  on conflict (capostipite_id, fornitore_id)
    do update set status = 'ACTIVE',
                  accepted_at = coalesce(public.collaborations.accepted_at, now()),
                  revoked_at = null;

  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.wp_add_location_to_team(uuid) to authenticated;
