-- Advisor Supabase (CRITICAL): la vista public.user_rating_summary era SECURITY DEFINER →
-- bypassava la RLS di chi interroga. Espone solo l'aggregato reputazione (media stelle + n. voti);
-- la tabella collaboration_ratings ha già `rate_select_all` (SELECT using true) → i voti sono
-- pubblici, quindi passare a security_invoker NON cambia il comportamento del badge e chiude l'alert.
alter view public.user_rating_summary set (security_invoker = on);
