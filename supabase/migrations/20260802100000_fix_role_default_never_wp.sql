-- ════════════════════════════════════════════════════════════════════════════
-- BUG GRAVE (ricorrente): utenti finiti con role=WEDDING_PLANNER per sbaglio.
-- Causa sistemica: handle_new_auth_user faceva `coalesce(meta->>'role', 'WEDDING_PLANNER')`
-- → QUALSIASI creazione utente senza ruolo nei metadati diventava un Wedding Planner.
-- Il leak principale: il magic-link (signInWithOtp) creava account NUOVI senza ruolo (fix separato
-- lato LoginPage: shouldCreateUser=false). Qui togliamo il default silenzioso: se manca il ruolo
-- (e non è un invito), la registrazione FALLISCE con errore chiaro invece di inventare un WP.
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

-- Correzione una-tantum: Antonio Tallarico è un make-up artist, non un Wedding Planner.
-- role è colonna privilegiata (lock SEC-01) → serve il flag transazionale.
do $$
begin
  perform set_config('sec.privileged_write', 'on', true);
  update public.profiles
     set role = 'FORNITORE'::user_role, subrole = 'make_up'
   where id = '4f104553-b39c-45a4-b294-e536ed3d68a3' and role = 'WEDDING_PLANNER';
  perform set_config('sec.privileged_write', 'off', true);
end $$;
