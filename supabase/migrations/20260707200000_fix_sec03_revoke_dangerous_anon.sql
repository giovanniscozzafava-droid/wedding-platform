-- SEC-03 — Funzioni SECURITY DEFINER esposte ad anon/authenticated senza guard, chiamabili
-- direttamente e pericolose. Le revochiamo dai ruoli pubblici; restano usabili dai chiamanti
-- INTERNI (trigger/RPC SECURITY DEFINER di proprietà del db owner) e dal service_role (edge).
--
--  • seed_user            → creava UTENTI AUTH con password: anon poteva creare account arbitrari.
--  • push_user_notification → anon poteva inviare notifiche a QUALSIASI user_id (spam/phishing).
--  • fb_ai_charge / fb_ai_precheck → wallet AI a consumo: anon poteva drenarlo/manipolarlo.
--    (fb_ai_topup ha già il guard is_admin; le charge/precheck girano solo dalle edge service_role.)

revoke execute on function public.seed_user(uuid, text, text, jsonb) from anon, authenticated, public;
revoke execute on function public.push_user_notification(uuid, text, text, text, text, uuid) from anon, authenticated, public;
revoke execute on function public.fb_ai_charge(uuid, numeric, integer, integer, text) from anon, authenticated, public;
revoke execute on function public.fb_ai_precheck(uuid) from anon, authenticated, public;

grant execute on function public.push_user_notification(uuid, text, text, text, text, uuid) to service_role;
grant execute on function public.fb_ai_charge(uuid, numeric, integer, integer, text) to service_role;
grant execute on function public.fb_ai_precheck(uuid) to service_role;
