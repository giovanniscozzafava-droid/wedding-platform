-- ════════════════════════════════════════════════════════════════════════════
-- SEC-01 (CRITICO) — Privilege escalation via self-UPDATE su `profiles`.
-- La policy `profiles_update_self` consente a un utente di aggiornare QUALSIASI colonna
-- della propria riga (nessun vincolo di colonna). Su profiles vivono campi che concedono
-- POTERE: role (incl. ADMIN), subscription_tier/status (bypass Stripe), is_support_staff,
-- is_verified_customer, is_album_lab, discover_tier. Un `update({role:'ADMIN'})` dalla console
-- rende is_admin()=true → controllo totale del DB. Chiudiamo con un trigger BEFORE UPDATE che
-- RICONGELA i campi privilegiati al valore precedente per chi non è service_role né ADMIN reale.
--
-- Approccio "freeze silenzioso": non solleva eccezioni, così gli update legittimi dell'UI
-- (full_name, phone, brand_*, subrole in onboarding, accettazione termini…) continuano a funzionare;
-- viene ignorata SOLO la modifica ai campi privilegiati.
--
-- NON blocchiamo `subrole` (categoria scelta dall'utente in onboarding) né
-- `platform_terms_accepted_at` (l'utente accetta i termini): non sono escalation.
-- Verificato: nessun trigger/funzione modifica subscription_tier/status su UPDATE di profiles,
-- quindi lockarli non regredisce il flusso abbonamenti (le edge Stripe girano come service_role).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.lock_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role (edge function fidate: tier post-Stripe, promozione staff, verifica) → bypassa.
  if (auth.jwt() ->> 'role') = 'service_role' then
    return new;
  end if;

  -- Un ADMIN reale (adminità già acquisita legittimamente via service_role/seed) può modificare.
  -- Chiunque altro: i campi privilegiati tornano al valore OLD (modifica non autorizzata ignorata).
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

-- Nome alfabeticamente PRIMA di trg_profiles_* → questo BEFORE UPDATE scatta per primo.
drop trigger if exists trg_lock_profile_privileged on public.profiles;
create trigger trg_lock_profile_privileged
  before update on public.profiles
  for each row execute function public.lock_profile_privileged_fields();

comment on function public.lock_profile_privileged_fields() is
  'SEC-01: impedisce la self-escalation su profiles (role/tier/status/staff/verified/album_lab/discover_tier). Solo service_role o ADMIN reale possono cambiarli.';
