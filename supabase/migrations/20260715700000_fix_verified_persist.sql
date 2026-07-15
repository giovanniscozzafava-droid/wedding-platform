-- ════════════════════════════════════════════════════════════════════════════
-- FIX: il "verificato" (is_verified_customer) dato dallo staff si CANCELLAVA da solo.
--
-- Causa (SEC-01): admin_set_verified è autorizzata da admin_guard() = is_support_staff(),
-- ma il trigger BEFORE UPDATE lock_profile_privileged_fields bypassa SOLO service_role o
-- is_admin() (role='ADMIN'). Lo staff di supporto NON è ADMIN → il trigger RICONGELA
-- is_verified_customer al valore precedente: l'UPDATE della RPC veniva silenziosamente annullato.
-- In UI il badge appariva (stato ottimistico), al reload spariva → "dopo un po' si cancella".
--
-- Fix: il lock onora un flag TRANSAZIONALE (`sec.privileged_write`) che solo le RPC
-- amministrative FIDATE — già passate da admin_guard() — impostano per i loro write. Il canale
-- pubblico (update self via PostgREST) non può impostarlo, quindi la protezione SEC-01 resta piena.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.lock_profile_privileged_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- edge function fidate (Stripe, staff) → bypassa
  if (auth.jwt() ->> 'role') = 'service_role' then return new; end if;
  -- write privilegiato da una RPC amministrativa fidata (ha già verificato l'autorizzazione)
  if coalesce(current_setting('sec.privileged_write', true), '') = 'on' then return new; end if;
  -- chiunque altro: i campi privilegiati tornano al valore OLD (self-escalation ignorata)
  if not public.is_admin() then
    new.role                 := old.role;
    new.subscription_tier    := old.subscription_tier;
    new.subscription_status  := old.subscription_status;
    new.is_support_staff     := old.is_support_staff;
    new.is_verified_customer := old.is_verified_customer;
    new.is_album_lab         := old.is_album_lab;
    new.discover_tier        := old.discover_tier;
  end if;
  return new;
end$$;

-- La RPC (autorizzata da admin_guard) segnala il write privilegiato al lock.
create or replace function public.admin_set_verified(p_user_id uuid, p_value boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();                                 -- solo support staff / admin
  perform set_config('sec.privileged_write', 'on', true); -- transazionale: consente il write al lock SEC-01
  update public.profiles set is_verified_customer = coalesce(p_value, false) where id = p_user_id;
  perform set_config('sec.privileged_write', 'off', true);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;

-- diagnostica: conferma perché lo staff non passava il lock (role ≠ ADMIN)
do $$
declare r record;
begin
  for r in select p.id, p.role, p.is_support_staff, (p.role='ADMIN') as is_real_admin
             from public.profiles p join auth.users u on u.id = p.id
             where u.email ilike 'giovanni.scozzafava@gmail.com' loop
    raise notice 'FIX VERIFIED: account % → role=% support_staff=% real_admin=% (prima: passava admin_guard ma il lock lo bloccava)',
      r.id, r.role, r.is_support_staff, r.is_real_admin;
  end loop;
end $$;
