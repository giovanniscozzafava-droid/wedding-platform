-- BUG: nella card cliente il "Quotato" mostrava € 0 anche con preventivo firmato.
-- Causa: quoted_amount sommava solo i preventivi INVIATO/ACCETTATO, ma quando un
-- preventivo viene accettato e diventa contratto il suo status passa a
-- CONVERTITO_IN_CONTRATTO → veniva escluso (mentre "Preventivi" lo contava).
-- Fix: includiamo anche CONVERTITO_IN_CONTRATTO (tutti i preventivi "vivi", non BOZZA/RIFIUTATO).
drop view if exists supplier_clients_dashboard;
create view supplier_clients_dashboard
  with (security_invoker = true)
  as
  select
    sc.id, sc.supplier_id, sc.full_name, sc.partner_name, sc.email, sc.phone,
    sc.event_date, sc.event_kind, sc.status, sc.tags, sc.created_at,
    coalesce((select count(*) from quotes q where q.direct_client_id = sc.id), 0) as quote_count,
    coalesce((
      select sum(q.total_client) from quotes q
       where q.direct_client_id = sc.id
         and q.status in ('INVIATO','ACCETTATO','CONVERTITO_IN_CONTRATTO')
    ), 0) as quoted_amount,
    coalesce((select count(*) from contracts c where c.direct_client_id = sc.id and c.status = 'FIRMATO'), 0) as signed_contracts
  from supplier_clients sc
  where sc.supplier_id = auth.uid() or is_admin();
