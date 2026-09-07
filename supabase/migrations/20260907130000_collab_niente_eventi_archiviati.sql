-- Gli eventi archiviati tornavano nella lista, anonimi.
--
-- `calendar_entries_collab` è la vista mascherata («Tipo · data») che serve al
-- fornitore-collaboratore, che sulla riga base non ha policy. Gira con
-- security_invoker=false, quindi NON passa da RLS: mostrava anche righe che la
-- tabella nascondeva. Due conseguenze, entrambe viste in produzione:
--
--  1. un evento ARCHIVIATO spariva dalla query base (che filtra archived_at) e
--     rientrava dalla vista, che quel filtro non ce l'ha e non espone nemmeno la
--     colonna — quindi il controllo lato frontend (`!r.archived_at`) leggeva
--     `undefined` e lo lasciava passare. Risultato: righe fantasma «Matrimonio ·
--     17/02/2027», cliente «—», valore € 0, che l'utente aveva già archiviato
--     mesi prima. 12 eventi su 2 account al momento del fix.
--
--  2. la vista restituiva anche gli eventi DI PROPRIETÀ di chi guarda (un
--     fotografo è fornitore sul proprio preventivo, quindi
--     is_collab_supplier_of_entry() è vero anche per lui): ogni volta che la
--     riga base non passava, il suo stesso evento gli tornava indietro
--     anonimizzato. Il proprietario legge sempre la riga vera: qui non deve
--     comparire mai.
create or replace view public.calendar_entries_collab
with (security_invoker = false)
as
  select id,
         owner_id,
         (initcap(coalesce(nullif(event_kind, ''), 'evento')) || ' · ')
           || coalesce(to_char(date_from::timestamp with time zone, 'DD/MM/YYYY'), '') as title,
         date_from,
         date_to,
         status,
         quote_id,
         event_kind,
         created_at,
         updated_at,
         -- in coda: `create or replace view` sa solo aggiungere colonne alla fine.
         -- Esposta perché il frontend possa filtrare anche da solo.
         archived_at
    from calendar_entries ce
   where is_collab_supplier_of_entry(id)
     and ce.archived_at is null
     and ce.owner_id <> auth.uid();

grant select on public.calendar_entries_collab to authenticated;
