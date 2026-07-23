-- BETA: "Suggerisci i miei fornitori" mostra TUTTI i colleghi che segui (follows APPROVED, role
-- FORNITORE), non solo quelli con l'opt-in referral attivo. In beta il credito referral è dormiente
-- e l'opt-in (default false) escludeva ~46/51 fornitori: chi segue un collega ma quello non aveva
-- spuntato "accetto segnalazioni" spariva dalla lista (es. Stefano Severini, seguito ma non
-- suggeribile). Aggiungiamo `accept_referrals` nel payload così la UI può marcare chi non l'ha ancora
-- attivato. Quando, dopo la beta, il credito diventerà reale, si potrà reintrodurre il gate.
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
  where f.follower_id = v_uid and f.status = 'APPROVED' and p.role = 'FORNITORE';
  return jsonb_build_object('ok', true, 'suppliers', v_res);
end$$;
grant execute on function public.followed_suppliers() to authenticated;
