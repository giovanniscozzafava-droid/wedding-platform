-- SEC-09 — le valutazioni fra professionisti erano leggibili da chiunque.
--
-- `collaboration_ratings` aveva `rate_select_all` con qual `true`: con la sola
-- chiave pubblica si leggevano rater_id, rated_id, entry_id, stelle e testo
-- della recensione. Cioè chi ha valutato chi, su QUALE evento, e cosa ha
-- scritto. Sul profilo pubblico serve solo la media, non le righe.
--
-- Le righe restano visibili a chi le ha scritte, a chi è stato valutato e agli
-- admin. La media pubblica continua a funzionare perché `user_rating_summary`
-- passa a SECURITY DEFINER: espone solo user_id, media e conteggio.
drop policy if exists rate_select_all on public.collaboration_ratings;

create policy rate_select_parti
  on public.collaboration_ratings for select
  using (rater_id = auth.uid() or rated_id = auth.uid() or is_admin());

-- La vista aggregata resta pubblica: media e numero, nessun nome, nessun evento.
alter view public.user_rating_summary set (security_invoker = false);
