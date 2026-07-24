-- ════════════════════════════════════════════════════════════════════════════
-- STRUMENTO ADMIN: correggere un profilo iscritto con ruolo/subrole sbagliato.
--
-- Caso reale: Antonio Rosariano (A&A Florist) si è iscritto come WEDDING_PLANNER
-- ma è un fioraio. In RegisterPage il ruolo è PRESELEZIONATO su "Event & Wedding
-- Planner" (default + primo in lista) e la tendina "Tipo fornitore" appare solo se
-- scegli FORNITORE: chi non cambia il default resta WP senza subrole.
--
-- `role` è una colonna privilegiata protetta dal lock SEC-01
-- (lock_profile_privileged_fields): senza il flag transazionale sec.privileged_write
-- l'UPDATE verrebbe silenziosamente ricongelato. La RPC — già autorizzata da
-- admin_guard() — imposta il flag, come admin_set_verified.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.admin_set_role(p_user uuid, p_role text, p_subrole text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_subrole text;
begin
  perform admin_guard();                                    -- solo support staff / admin
  if p_role not in ('WEDDING_PLANNER', 'LOCATION', 'FORNITORE') then
    return jsonb_build_object('error', 'ruolo non valido: ' || coalesce(p_role, 'null'));
  end if;
  -- il subrole ha senso solo per i FORNITORE; per gli altri ruoli va azzerato
  v_subrole := case when p_role = 'FORNITORE' then nullif(trim(p_subrole), '') else null end;

  perform set_config('sec.privileged_write', 'on', true);   -- consente il write al lock SEC-01
  update public.profiles
     set role = p_role::user_role,
         subrole = v_subrole
   where id = p_user;
  perform set_config('sec.privileged_write', 'off', true);

  return jsonb_build_object('ok', true, 'role', p_role, 'subrole', v_subrole);
end$$;

revoke all on function public.admin_set_role(uuid, text, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text, text) to authenticated;

-- ── Correzione una-tantum: Antonio Rosariano (A&A Florist) → FORNITORE / fioraio ──
do $$
begin
  perform set_config('sec.privileged_write', 'on', true);
  update public.profiles
     set role = 'FORNITORE'::user_role, subrole = 'fioraio'
   where id = '34981492-9c80-42f7-8881-2982113e49b7'
     and role = 'WEDDING_PLANNER';                          -- idempotente: solo se ancora sbagliato
  perform set_config('sec.privileged_write', 'off', true);
end $$;
