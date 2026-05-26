-- ============================================================================
-- FIX GDPR — la view calendar_entries_for_participants esponeva l'intero
-- calendario di tutti gli WP a qualsiasi utente loggato che la interrogasse,
-- perche' era una view "naked" senza WHERE e in Postgres le view non ereditano
-- automaticamente le RLS della tabella sottostante.
--
-- Fix: ricreiamo la view con security_invoker=true + WHERE esplicito che limita
-- ai soli entries dove auth.uid() e' owner o participant (o admin).
-- ============================================================================

drop view if exists calendar_entries_for_participants;

create view calendar_entries_for_participants
  with (security_invoker = true)
  as
  select
    ce.id,
    ce.owner_id,
    ce.title,
    ce.date_from,
    ce.date_to,
    ce.status,
    ce.quote_id,
    ce.created_at,
    ce.updated_at
  from calendar_entries ce
  where ce.owner_id = auth.uid()
     or exists (
       select 1 from calendar_entry_participants cep
        where cep.entry_id = ce.id and cep.user_id = auth.uid()
     )
     or is_admin();

comment on view calendar_entries_for_participants is
  'Vista ridotta (senza PII cliente) del calendario: ogni utente vede SOLO le entries dove e owner o participant. security_invoker garantisce che le RLS della tabella sottostante restino attive.';
