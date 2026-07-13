-- D-CAL-4 (audit calendario 13/07/2026, decisione Giovanni = "Tipo + data"):
-- il fornitore con collaborazione ATTIVA su un evento leggeva la riga intera di
-- calendar_entries via policy `ce_select_collab_supplier` -> incluso il `title`
-- LIBERO, che l'owner puo' scrivere con dentro il cognome cliente ("Matrimonio Rossi").
-- La PII vera (nome/email/note/importo) e' gia' fuori (calendar_entries_private).
-- Resta il titolo: va mascherato verso i fornitori senza toccare owner/coppia.
--
-- RLS Postgres e' per-riga, non per-colonna, e tutti gli utenti app sono ruolo
-- `authenticated` -> non si puo' mascherare SOLO il titolo con una policy.
-- Soluzione: (1) togliere al fornitore la lettura DIRETTA della riga base;
--            (2) dargli una VIEW security-definer con titolo mascherato a
--                "Tipo · data" (event_kind + date_from). Owner/coppia intatti.

-- 1. View mascherata per il fornitore-collaboratore --------------------------
-- security_invoker=false => gira coi privilegi del definer (bypassa RLS base):
-- percio' la WHERE limita esplicitamente alle sole entry dove il CHIAMANTE
-- (auth.uid(), invariato sotto definer) e' collab supplier ATTIVO.
create or replace view public.calendar_entries_collab
  with (security_invoker = false)
  as
  select
    ce.id,
    ce.owner_id,
    -- titolo mascherato: "Matrimonio · 15/09/2026"
    initcap(coalesce(nullif(ce.event_kind, ''), 'evento'))
      || ' · ' || coalesce(to_char(ce.date_from, 'DD/MM/YYYY'), '') as title,
    ce.date_from,
    ce.date_to,
    ce.status,
    ce.quote_id,
    ce.event_kind,
    ce.created_at,
    ce.updated_at
  from public.calendar_entries ce
  where public.is_collab_supplier_of_entry(ce.id);

comment on view public.calendar_entries_collab is
  'Vista che il fornitore-collaboratore usa al posto di calendar_entries: titolo mascherato a "Tipo · data" (mai il titolo libero dell''owner). Solo entry con collaborazione ATTIVA del chiamante. Vedi D-CAL-4.';

grant select on public.calendar_entries_collab to authenticated;

-- 2. Chiude il leak: il fornitore non legge piu' la riga base (quindi nemmeno
--    il title libero). I permessi sulle tabelle figlie (timeline/tavoli/ospiti)
--    restano: usano is_collab_supplier_of_entry, indipendenti da questa policy.
drop policy if exists "ce_select_collab_supplier" on public.calendar_entries;

-- 3. Smoke-test: la view deve selezionare pulita (0 righe qui: auth.uid() null).
do $$
begin
  perform id, owner_id, title, date_from, date_to, status, quote_id, event_kind
    from public.calendar_entries_collab
   where false;
end $$;
