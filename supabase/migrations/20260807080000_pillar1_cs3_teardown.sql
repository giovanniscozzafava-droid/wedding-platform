-- ════════════════════════════════════════════════════════════════════════════
-- PILASTRO 1 — CONSENSO FORNITORE, increment 3: teardown accesso (CS-3).
-- Bug: is_collab_supplier_of_entry concede accesso (guest list PII, piantina, chat)
-- via il ramo (b) "ha una voce nel preventivo del wedding" A PRESCINDERE dallo stato
-- del preventivo. Così, dopo un preventivo RIFIUTATO o un evento ANNULLATO (annulla_evento
-- porta il preventivo a RIFIUTATO), il fornitore continua a leggere i dati del wedding —
-- l'accesso non viene mai "smontato".
--
-- Fix mirato: il ramo (b) conta SOLO se il preventivo è ancora VIVO (status <> 'RIFIUTATO'
-- e non archiviato). I rami (a) participant esplicito e (c) assegnazione timeline restano
-- invariati (sono grant espliciti, non legati allo stato del preventivo). Chi è su un
-- preventivo attivo (BOZZA/INVIATO/ACCETTATO/CONVERTITO, non archiviato) mantiene l'accesso
-- come prima; chi era solo su un preventivo rifiutato/archiviato lo perde.
-- Ricreazione VERBATIM + sola condizione di stato sul ramo (b).
-- ════════════════════════════════════════════════════════════════════════════

create or replace function is_collab_supplier_of_entry(p_entry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    -- (a) participant esplicito
    select 1
      from calendar_entry_participants p
     where p.entry_id = p_entry
       and p.user_id = auth.uid()
  )
  or exists (
    -- (b) voce di preventivo collegato al wedding — SOLO se il preventivo è ancora vivo.
    select 1
      from calendar_entries ce
      join quotes q on q.id = ce.quote_id
      join quote_items qi on qi.quote_id = ce.quote_id
     where ce.id = p_entry
       and qi.supplier_id = auth.uid()
       and q.status <> 'RIFIUTATO'
       and q.archived_at is null
  )
  or exists (
    -- (c) assegnazione esplicita a un momento del programma
    select 1
      from event_timeline et
     where et.entry_id = p_entry
       and et.supplier_id = auth.uid()
  );
$$;

grant execute on function is_collab_supplier_of_entry(uuid) to authenticated;

comment on function is_collab_supplier_of_entry(uuid) is
  'Vero se il fornitore loggato è coinvolto nel wedding p_entry: (a) participant esplicito, (b) fornitore di una voce di un preventivo ANCORA VIVO (non rifiutato/archiviato) del wedding, o (c) assegnato a un momento del programma. Il ramo (b) è gattato sullo stato (teardown CS-3): un preventivo rifiutato/annullato smonta l accesso.';
