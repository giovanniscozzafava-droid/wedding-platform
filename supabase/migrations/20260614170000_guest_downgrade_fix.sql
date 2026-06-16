-- FIX del declassamento ospiti: i CLIENT vengono creati con onboarding_complete=true,
-- quindi la condizione precedente (onboarding_complete=false) li escludeva → restavano CLIENT
-- e cliccando il logo finivano in /area-cliente. Rimuoviamo quel vincolo: i segnali forti
-- (in gallery_guests, niente business, niente eventi/gallerie propri, NESSUN preventivo/contratto
-- a loro nome) bastano a distinguere un ospite puro da un cliente/professionista vero.
update public.profiles p
   set role = 'GUEST'
  from auth.users u
 where u.id = p.id
   and p.role in ('WEDDING_PLANNER', 'CLIENT')
   and nullif(btrim(coalesce(p.business_name, '')), '') is null
   and exists     (select 1 from public.gallery_guests   gg where gg.guest_user_id = p.id)
   and not exists (select 1 from public.calendar_entries ce where ce.owner_id = p.id)
   and not exists (select 1 from public.event_galleries  eg where eg.owner_id = p.id)
   and not exists (select 1 from public.quotes    q where lower(q.client_email) = lower(u.email))
   and not exists (select 1 from public.contracts c where lower(c.client_email) = lower(u.email));
