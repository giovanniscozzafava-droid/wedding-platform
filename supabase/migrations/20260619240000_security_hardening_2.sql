-- Hardening sicurezza (round 2).

-- D) Token di accesso pubblici (preventivi/contratti): finestra 365 → 90 giorni per i NUOVI record.
--    Gli esistenti restano invariati (non invalidiamo link già condivisi con i clienti).
alter table public.quotes    alter column access_token_expires_at set default (now() + interval '90 days');
alter table public.contracts alter column access_token_expires_at set default (now() + interval '90 days');

-- E) profiles: l'UPDATE admin usava `with check (true)` (anti-pattern). Vincoliamo il check al
--    fatto che il chiamante sia admin (lo `using` già lo fa). Funzionalmente equivalente, ma senza
--    il check permissivo.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
