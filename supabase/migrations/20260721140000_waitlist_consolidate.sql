-- ============================================================================
-- CONSOLIDAMENTO LISTE D'ATTESA → una sola: access_requests.
-- Le vecchie iscrizioni (waitlist_signups, RPC waitlist_submit) confluiscono in
-- access_requests, l'unica lista monitorata dal pannello admin. NIENTE email ai
-- contatti storici: l'email di conferma la manda solo l'edge, non il DB; il trigger
-- fa solo la notifica campanello, che disattivo durante il travaso per non spammare.
-- Le nuove scritture sul vecchio backend vengono chiuse (revoke). La tabella
-- waitlist_signups resta come backup (dati preservati), semplicemente non più scritta.
-- ============================================================================

alter table public.access_requests disable trigger trg_access_request_notify;

insert into public.access_requests
  (nome, attivita, ruolo, ruolo_altro, email, provincia, messaggio, source, stato, created_at)
select
  left(coalesce(nullif(trim(w.name), ''), 'Senza nome'), 120),
  'Non indicata',                                   -- il vecchio form non chiedeva l'azienda
  case
    when w.activity_type ilike '%planner%' or w.activity_type ilike 'WP%' then 'WEDDING_PLANNER'
    when w.activity_type ilike '%location%' then 'LOCATION'
    when w.activity_type ilike '%fornitore%' then 'FORNITORE'
    else 'ALTRO'
  end,
  case
    when w.activity_type is not null
     and w.activity_type not ilike '%planner%' and w.activity_type not ilike 'WP%'
     and w.activity_type not ilike '%location%' and w.activity_type not ilike '%fornitore%'
    then left(w.activity_type, 80)
    else null
  end,
  lower(w.email),
  null,
  nullif('Città: ' || coalesce(w.city, ''), 'Città: '),   -- non perdiamo la città
  'waitlist_legacy',
  'NUOVA',
  w.created_at
from public.waitlist_signups w
where not exists (
  select 1 from public.access_requests a where lower(a.email) = lower(w.email)
);

alter table public.access_requests enable trigger trg_access_request_notify;

-- Da ora la lista d'attesa è una sola: chiudi le nuove scritture sul vecchio backend.
revoke execute on function public.waitlist_submit(text, text, text, text, text) from anon, authenticated;
