-- SEC-03 — `stripe_apply_subscription` era SECURITY DEFINER, eseguibile da anon/authenticated,
-- SENZA guard: un utente poteva chiamarla per applicarsi un abbonamento (scrive stripe_subscriptions
-- e profiles.subscription_status). Va chiamata SOLO dal webhook Stripe (service_role, dopo verifica
-- firma). Chiudiamo con: guard interno service_role + revoca dei grant pubblici.
create or replace function public.stripe_apply_subscription(p_profile uuid, p_sub_id text, p_status text, p_price text, p_period_end timestamptz, p_cancel_at_end boolean)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_tier text; v_active boolean;
begin
  -- Solo il webhook Stripe (service_role) può applicare abbonamenti.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    return jsonb_build_object('error', 'forbidden');
  end if;

  insert into public.stripe_subscriptions(subscription_id, profile_id, status, price_id, current_period_end, cancel_at_period_end, updated_at)
    values (p_sub_id, p_profile, p_status, p_price, p_period_end, coalesce(p_cancel_at_end, false), now())
  on conflict (subscription_id) do update set
    status = excluded.status, price_id = excluded.price_id,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now();

  v_active := p_status in ('active', 'trialing', 'past_due');
  if v_active then
    v_tier := coalesce((select tier from public.stripe_price_map where price_id = p_price), 'PLUS');
  else
    v_tier := 'EXPIRED';
  end if;

  update public.profiles
     set subscription_status   = case when subscription_status = 'LIFETIME' then 'LIFETIME' else v_tier end,
         subscription_renews_at = p_period_end
   where id = p_profile;

  return jsonb_build_object('ok', true, 'tier', v_tier);
end$function$;

revoke execute on function public.stripe_apply_subscription(uuid, text, text, text, timestamptz, boolean) from anon, authenticated, public;
grant execute on function public.stripe_apply_subscription(uuid, text, text, text, timestamptz, boolean) to service_role;
