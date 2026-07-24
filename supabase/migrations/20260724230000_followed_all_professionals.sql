-- "Suggerisci i miei fornitori" deve poter suggerire TUTTI i professionisti che segui,
-- capostipiti compresi (WEDDING_PLANNER, LOCATION), non solo i FORNITORE. followed_suppliers
-- filtrava p.role='FORNITORE': i capostipiti seguiti sparivano dalla lista candidati.
-- Allarghiamo ai 5 ruoli professionali. L'edge suggest-my-suppliers NON filtra per ruolo
-- (valida solo follows APPROVED / collaboration ACTIVE), quindi basta questa modifica.
create or replace function public.followed_suppliers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'name', coalesce(p.business_name, p.full_name), 'subrole', p.subrole, 'city', p.city,
    'credit', p.referral_credit, 'accept_referrals', coalesce(p.accept_referrals, false)
  ) order by coalesce(p.business_name, p.full_name)), '[]'::jsonb) into v_res
  from public.follows f join public.profiles p on p.id = f.followed_id
  where f.follower_id = v_uid and f.status = 'APPROVED'
    and p.role in ('FORNITORE','WEDDING_PLANNER','LOCATION','FOTOLAB','MAESTRANZA');
  return jsonb_build_object('ok', true, 'suppliers', v_res);
end$$;
grant execute on function public.followed_suppliers() to authenticated;
