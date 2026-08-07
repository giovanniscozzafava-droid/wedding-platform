-- ════════════════════════════════════════════════════════════════════════════
-- SEC / AU-1 (CRITICO): il signup poteva auto-assegnarsi role=ADMIN.
-- `handle_new_auth_user` prende il ruolo da raw_user_meta_data (controllato dal
-- client via signUp options.data) senza whitelist: falliva solo se NULL, non se
-- 'ADMIN'. Con role=ADMIN l'account passa is_admin() → admin-impersonate impersona
-- chiunque. La fix SEC-01 (lock_profile_privileged_fields) copre solo l'UPDATE,
-- non l'INSERT via trigger. Qui blocchiamo il valore ADMIN al SIGNUP: l'unica via
-- legittima per ADMIN resta admin_set_role (che già rifiuta di crearli).
-- Ricreiamo la funzione IDENTICA all'ultima versione (20260802100000) aggiungendo
-- solo la guardia sul ruolo. Nessun signup legittimo (CLIENT/WP/LOCATION/FORNITORE/
-- MAESTRANZA/GUEST) viene toccato.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path to 'public', 'auth' as $function$
declare v_role user_role; v_subrole text; v_full text; v_invite supplier_invites%rowtype; v_token_text text; v_accept boolean; v_terms boolean;
begin
  v_role    := (new.raw_user_meta_data->>'role')::user_role;   -- NIENTE default silenzioso a WEDDING_PLANNER
  v_subrole := new.raw_user_meta_data->>'subrole';
  v_full    := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1));
  v_token_text := new.raw_user_meta_data->>'invite_token';
  v_accept  := (new.raw_user_meta_data->>'accept_referrals')::boolean;
  v_terms   := coalesce((new.raw_user_meta_data->>'platform_terms')::boolean, false);
  if v_token_text is not null then
    select * into v_invite from supplier_invites where token = v_token_text::uuid and status = 'PENDING' and expires_at > now() limit 1;
    if found then v_role := 'FORNITORE'; if v_subrole is null then v_subrole := v_invite.subrole_hint; end if; end if;
  end if;
  -- Nessun ruolo esplicito e nessun invito → NON creare un profilo a caso. Fallisce, così il path
  -- che ha dimenticato il ruolo si scopre subito (mai più WP di default).
  if v_role is null then
    raise exception 'Registrazione senza ruolo: registrati dal modulo scegliendo il ruolo. (Il magic-link non crea account nuovi.)'
      using errcode = 'check_violation';
  end if;
  -- SEC / AU-1: ADMIN non è mai un ruolo di auto-registrazione. Va assegnato solo
  -- via admin_set_role (con privileged_write). Blocchiamo qualsiasi tentativo dal signup.
  if v_role = 'ADMIN' then
    raise exception 'Registrazione con ruolo ADMIN non consentita.'
      using errcode = 'check_violation';
  end if;
  insert into public.profiles (id, role, subrole, full_name, onboarding_complete, accept_referrals,
                               platform_terms_accepted_at, platform_terms_version)
  values (new.id, v_role, v_subrole, v_full, (v_role = 'CLIENT'), coalesce(v_accept,false),
          case when v_terms then now() else null end, case when v_terms then 1 else null end)
  on conflict (id) do update
    set role = excluded.role,
        subrole = coalesce(excluded.subrole, profiles.subrole),
        full_name = coalesce(profiles.full_name, excluded.full_name),
        accept_referrals = coalesce(v_accept, profiles.accept_referrals),
        platform_terms_accepted_at = coalesce(excluded.platform_terms_accepted_at, profiles.platform_terms_accepted_at),
        platform_terms_version = coalesce(excluded.platform_terms_version, profiles.platform_terms_version);
  return new;
end$function$;
