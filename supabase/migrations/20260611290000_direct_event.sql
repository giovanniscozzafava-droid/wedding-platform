-- "Evento diretto": un professionista (anche FORNITORE) crea al volo un evento GIÀ
-- CONFERMATO (bypassa preventivo+contratto, gestiti fuori piattaforma), si mette nel
-- cerchio e genera un invito-coppia. La coppia si registra dal vivo su /couple/accept/:token
-- (flusso esistente) e usa subito la dashboard cliente + foto. SECURITY DEFINER perché un
-- FORNITORE non può inserire direttamente in calendar_entries (RLS solo WP/LOCATION/ADMIN).
create or replace function public.create_direct_event(p_couple_name text, p_couple_email text, p_date date, p_title text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_role text; v_sub text; v_entry uuid; v_token uuid := gen_random_uuid();
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;
  select role::text, subrole into v_role, v_sub from public.profiles where id = v_uid;
  if v_role not in ('FORNITORE', 'WEDDING_PLANNER', 'LOCATION', 'ADMIN') then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_date is null or coalesce(btrim(p_couple_name), '') = '' or position('@' in coalesce(p_couple_email, '')) = 0 then
    return jsonb_build_object('error', 'invalid_input');
  end if;

  insert into public.calendar_entries(owner_id, title, date_from, date_to, status)
    values (v_uid, coalesce(nullif(btrim(p_title), ''), btrim(p_couple_name)), p_date, p_date, 'CONFERMATA')
    returning id into v_entry;

  -- il creatore entra nel cerchio (così può consegnare le foto); block_busy non deve bloccare
  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, v_uid, coalesce(v_sub, 'fornitore'), true);
  exception when others then null; end;

  -- invito-coppia (riusa /couple/accept/:token)
  insert into public.wedding_couple_members(entry_id, email, full_name, role, invite_token, invited_at)
    values (v_entry, lower(btrim(p_couple_email)), btrim(p_couple_name), 'SPOSA', v_token, now());

  return jsonb_build_object('ok', true, 'entry_id', v_entry, 'token', v_token);
end$$;
grant execute on function public.create_direct_event(text, text, date, text) to authenticated;
