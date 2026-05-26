-- ============================================================================
-- FIX CRITICO GDPR — la view supplier_clients_dashboard bypassava RLS della
-- tabella supplier_clients. Un fornitore appena iscritto vedeva i clienti di
-- altri fornitori/WP nella propria "rubrica".
--
-- Cause: in Postgres le viste SQL non ereditano automaticamente le RLS della
-- tabella sottostante quando vengono interrogate da utenti non-superuser; senza
-- un WHERE esplicito (o `security_invoker`) il filtro `supplier_id = auth.uid()`
-- non viene mai applicato.
--
-- Fix: aggiungiamo WHERE supplier_id = auth.uid() e settiamo security_invoker
-- (Postgres 15+) cosi le RLS della tabella si applicano anche sulla view.
-- ============================================================================

drop view if exists supplier_clients_dashboard;

create view supplier_clients_dashboard
  with (security_invoker = true)
  as
  select
    sc.id,
    sc.supplier_id,
    sc.full_name,
    sc.partner_name,
    sc.email,
    sc.phone,
    sc.event_date,
    sc.event_kind,
    sc.status,
    sc.tags,
    sc.created_at,
    coalesce((
      select count(*) from quotes q where q.direct_client_id = sc.id
    ), 0) as quote_count,
    coalesce((
      select sum(q.total_client) from quotes q
       where q.direct_client_id = sc.id and q.status in ('INVIATO','ACCETTATO')
    ), 0) as quoted_amount,
    coalesce((
      select count(*) from contracts c where c.direct_client_id = sc.id and c.status = 'FIRMATO'
    ), 0) as signed_contracts
  from supplier_clients sc
  where sc.supplier_id = auth.uid()
     or is_admin();

comment on view supplier_clients_dashboard is
  'Dashboard clienti diretti del fornitore. Filtra esplicitamente per supplier_id = auth.uid() + security_invoker per garantire isolamento dati anche se chiamata da contesti non-anon.';
