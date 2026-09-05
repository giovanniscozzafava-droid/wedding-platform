-- ============================================================================
-- CICLO-08: is_collab_supplier_of_entry, ramo (b), concede l'accesso PII a un
-- fornitore semplicemente perché ha una voce su un preventivo "vivo"
-- (status <> RIFIUTATO). Quando un preventivo rifiutato torna a BOZZA
-- (transizione permessa), il fornitore riottiene automaticamente l'accesso,
-- anche se nel frattempo ha lasciato esplicitamente la rete del capostipite
-- (collaborations.status='REVOKED') — nessuna riverifica della relazione.
-- Fix mirato: se esiste una collaborazione REVOKED esplicita fra questo
-- fornitore e il capostipite proprietario del preventivo, il ramo (b) non
-- concede più l'accesso (non tocca il caso "nessuna collaborazione" — es.
-- fornitore diretto senza capostipite — che resta invariato).
-- ============================================================================

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
    -- (b) voce di preventivo collegato al wedding — SOLO se il preventivo è
    -- ancora vivo E, se esiste una relazione di rete esplicita col capostipite
    -- proprietario, questa non è stata revocata (CICLO-08).
    select 1
      from calendar_entries ce
      join quotes q on q.id = ce.quote_id
      join quote_items qi on qi.quote_id = ce.quote_id
     where ce.id = p_entry
       and qi.supplier_id = auth.uid()
       and q.status <> 'RIFIUTATO'
       and q.archived_at is null
       and not exists (
         select 1 from collaborations col
          where col.capostipite_id = q.owner_id
            and col.fornitore_id = auth.uid()
            and col.status = 'REVOKED'
       )
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
  'Vero se il fornitore loggato è coinvolto nel wedding p_entry: (a) participant esplicito, (b) fornitore di una voce di un preventivo ANCORA VIVO (non rifiutato/archiviato) del wedding E senza una collaborazione REVOKED esplicita col capostipite proprietario, o (c) assegnato a un momento del programma.';
