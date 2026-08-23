-- Espone supplier_clients.is_test nella vista usata dalla pagina clienti, così il
-- professionista può vedere/attivare l'etichetta "test". (create or replace view:
-- la nuova colonna va aggiunta IN CODA, senza toccare nome/ordine delle esistenti.)
create or replace view public.supplier_clients_dashboard as
 SELECT id,
    supplier_id,
    full_name,
    partner_name,
    email,
    phone,
    event_date,
    event_kind,
    status,
    tags,
    created_at,
    COALESCE(( SELECT count(*) AS count
           FROM quotes q
          WHERE q.direct_client_id = sc.id), 0::bigint) AS quote_count,
    COALESCE(( SELECT sum(q.total_client) AS sum
           FROM quotes q
          WHERE q.direct_client_id = sc.id AND (q.status = ANY (ARRAY['INVIATO'::quote_status, 'ACCETTATO'::quote_status, 'CONVERTITO_IN_CONTRATTO'::quote_status]))), 0::numeric) AS quoted_amount,
    COALESCE(( SELECT count(*) AS count
           FROM contracts c
          WHERE c.direct_client_id = sc.id AND c.status = 'FIRMATO'::contract_status), 0::bigint) AS signed_contracts,
    sc.is_test
   FROM supplier_clients sc
  WHERE supplier_id = auth.uid() OR is_admin();
