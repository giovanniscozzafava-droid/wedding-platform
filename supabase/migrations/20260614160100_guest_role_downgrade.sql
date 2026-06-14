-- Declassa a GUEST gli ospiti già creati per errore come professionisti (WEDDING_PLANNER)
-- o come CLIENT (fix intermedio). Condizioni MOLTO conservative: profili CHIARAMENTE ospiti —
--   • presenti in gallery_guests
--   • mai onboardati e senza business_name
--   • senza eventi/gallerie di proprietà (non sono professionisti)
--   • la cui email NON compare come client_email in alcun preventivo/contratto (non sono clienti diretti)
-- Così un vero professionista o un vero cliente diretto NON viene mai toccato.
update public.profiles p
   set role = 'GUEST'
  from auth.users u
 where u.id = p.id
   and p.role in ('WEDDING_PLANNER', 'CLIENT')
   and coalesce(p.onboarding_complete, false) = false
   and nullif(btrim(coalesce(p.business_name, '')), '') is null
   and exists     (select 1 from public.gallery_guests   gg where gg.guest_user_id = p.id)
   and not exists (select 1 from public.calendar_entries ce where ce.owner_id = p.id)
   and not exists (select 1 from public.event_galleries  eg where eg.owner_id = p.id)
   and not exists (select 1 from public.quotes    q where lower(q.client_email) = lower(u.email))
   and not exists (select 1 from public.contracts c where lower(c.client_email) = lower(u.email));
