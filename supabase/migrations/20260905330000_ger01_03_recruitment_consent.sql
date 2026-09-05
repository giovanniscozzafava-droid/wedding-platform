-- ============================================================================
-- GER-01/GER-03 (decisione presa da Giovanni: "1 B" — il reclutamento deve
-- chiedere conferma al fornitore, non entrare subito attivo).
--
-- Prima: capostipite_add_supplier e wp_add_location_to_team mettevano la
-- collaboration subito ACTIVE, senza che il fornitore/location facesse nulla.
-- Ora: la creano/riaprono PENDING (initiated_by='CAPOSTIPITE') e notificano il
-- fornitore, che deve accettare esplicitamente (nuove RPC
-- fornitore_accept_collaboration / fornitore_reject_collaboration) prima che
-- diventi ACTIVE — colmando anche GER-03 (nessuna UI di accettazione esisteva).
--
-- NON toccati (restano consensuali già oggi, per design):
-- - referral_to_collaboration: il fornitore stesso digita il codice referral
--   al signup — è già una scelta attiva sua.
-- - approve_candidacy: approva una CANDIDATURA che il fornitore ha avviato
--   lui stesso (segue il capostipite sperando di entrare) — già consensuale
--   dal lato fornitore, l'approvazione del capostipite la completa.
-- - supplier_invite_capostipite: già PENDING, fornitore-iniziata.
-- ============================================================================

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
  v_capo_profile record;
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
    if v_existing.status = 'PENDING' and v_existing.initiated_by = 'CAPOSTIPITE' then
      return jsonb_build_object('ok', true, 'already_pending', true, 'collaboration_id', v_existing.id);
    end if;
    update collaborations
       set status = 'PENDING', initiated_by = 'CAPOSTIPITE', invited_at = now(),
           accepted_at = null, revoked_at = null
     where id = v_existing.id
     returning * into v_new;
  else
    insert into collaborations (capostipite_id, fornitore_id, status, initiated_by, invited_at)
    values (v_capo, p_supplier_id, 'PENDING', 'CAPOSTIPITE', now())
    returning * into v_new;
  end if;

  select * into v_capo_profile from profiles where id = v_capo;
  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (p_supplier_id, 'INVITO_RETE_CAPOSTIPITE', 'Sei stato invitato in una rete',
    coalesce(v_capo_profile.business_name, v_capo_profile.full_name, 'Un referente evento') ||
      ' vuole aggiungerti alla sua rete fornitori. Accetta per iniziare a ricevere preventivi.',
    '/capostipiti', v_capo, 'PENDING', 6)
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione, stato = 'PENDING', letto_il = null;

  return jsonb_build_object('ok', true, 'collaboration_id', v_new.id, 'pending', true);
end$$;

grant execute on function capostipite_add_supplier(uuid) to authenticated;

-- --- wp_add_location_to_team: stesso trattamento ---
create or replace function public.wp_add_location_to_team(p_location_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_target_role user_role;
  v_capo_profile record;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_location_id = v_uid then return jsonb_build_object('error','self'); end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'WEDDING_PLANNER' then return jsonb_build_object('error','forbidden'); end if;
  select role into v_target_role from public.profiles where id = p_location_id;
  if v_target_role is null then return jsonb_build_object('error','not_found'); end if;
  if v_target_role <> 'LOCATION' then return jsonb_build_object('error','not_a_location'); end if;

  insert into public.collaborations (capostipite_id, fornitore_id, status, initiated_by, invited_at)
  values (v_uid, p_location_id, 'PENDING', 'CAPOSTIPITE', now())
  on conflict (capostipite_id, fornitore_id)
    do update set status = 'PENDING',
                  initiated_by = 'CAPOSTIPITE',
                  invited_at = now(),
                  accepted_at = null,
                  revoked_at = null
    where public.collaborations.status <> 'ACTIVE';

  select * into v_capo_profile from public.profiles where id = v_uid;
  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (p_location_id, 'INVITO_RETE_CAPOSTIPITE', 'Sei stato invitato in una rete',
    coalesce(v_capo_profile.business_name, v_capo_profile.full_name, 'Un wedding planner') ||
      ' vuole aggiungerti alla sua rete. Accetta per iniziare a ricevere preventivi.',
    '/capostipiti', v_uid, 'PENDING', 6)
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione, stato = 'PENDING', letto_il = null;

  return jsonb_build_object('ok', true, 'pending', true);
end$$;
grant execute on function public.wp_add_location_to_team(uuid) to authenticated;

-- --- Il fornitore accetta un invito PENDING iniziato dal capostipite ---
create or replace function public.fornitore_accept_collaboration(p_capostipite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row collaborations%rowtype;
  v_fornitore_profile record;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;

  update public.collaborations
     set status = 'ACTIVE', accepted_at = now(), revoked_at = null, updated_at = now()
   where capostipite_id = p_capostipite_id
     and fornitore_id = v_uid
     and status = 'PENDING'
     and initiated_by = 'CAPOSTIPITE'
   returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('error','not_found');
  end if;

  select * into v_fornitore_profile from public.profiles where id = v_uid;
  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (p_capostipite_id, 'FORNITORE_HA_ACCETTATO', 'Fornitore entrato in rete',
    coalesce(v_fornitore_profile.business_name, v_fornitore_profile.full_name, 'Un fornitore') ||
      ' ha accettato di entrare nella tua rete.',
    '/suppliers', v_uid, 'PENDING', 5)
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione, stato = 'PENDING', letto_il = null;

  return jsonb_build_object('ok', true, 'collaboration_id', v_row.id);
end$$;
grant execute on function public.fornitore_accept_collaboration(uuid) to authenticated;

-- --- Il fornitore rifiuta un invito PENDING iniziato dal capostipite ---
create or replace function public.fornitore_reject_collaboration(p_capostipite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row collaborations%rowtype;
  v_fornitore_profile record;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;

  update public.collaborations
     set status = 'REVOKED', revoked_at = now(), updated_at = now()
   where capostipite_id = p_capostipite_id
     and fornitore_id = v_uid
     and status = 'PENDING'
     and initiated_by = 'CAPOSTIPITE'
   returning * into v_row;

  if v_row.id is null then
    return jsonb_build_object('error','not_found');
  end if;

  select * into v_fornitore_profile from public.profiles where id = v_uid;
  insert into public.notifiche(destinatario_id, tipo, titolo, descrizione, link_action, owner_della_mossa, stato, priorita)
  values (p_capostipite_id, 'FORNITORE_HA_RIFIUTATO', 'Invito alla rete rifiutato',
    coalesce(v_fornitore_profile.business_name, v_fornitore_profile.full_name, 'Un fornitore') ||
      ' ha rifiutato l''invito a entrare nella tua rete.',
    '/suppliers', v_uid, 'PENDING', 3)
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione, stato = 'PENDING', letto_il = null;

  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fornitore_reject_collaboration(uuid) to authenticated;
