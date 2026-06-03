-- ============================================================================
-- Collego ogni cliente della rubrica fornitore al suo EVENTO (calendar_entry),
-- così dalla scheda cliente si apre la dashboard evento (tavoli, mood, invitati).
-- Catena: supplier_clients.id -> quotes.direct_client_id -> calendar_entries.quote_id
-- Preferisco l'evento più "caldo": CONFERMATA > OPZIONATA > IN_TRATTATIVA > altro,
-- poi per data più vicina.
-- create or replace view: la nuova colonna va aggiunta in coda.
-- ----------------------------------------------------------------------------

create or replace view public.supplier_clients_dashboard as
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
    coalesce((select count(*) from quotes q where q.direct_client_id = sc.id), 0::bigint) as quote_count,
    coalesce((select sum(q.total_client) from quotes q
               where q.direct_client_id = sc.id
                 and q.status = any (array['INVIATO'::quote_status, 'ACCETTATO'::quote_status])), 0::numeric) as quoted_amount,
    coalesce((select count(*) from contracts c
               where c.direct_client_id = sc.id and c.status = 'FIRMATO'::contract_status), 0::bigint) as signed_contracts,
    (select e.id
       from calendar_entries e
       join quotes q on q.id = e.quote_id
      where q.direct_client_id = sc.id
      order by case e.status
                 when 'CONFERMATA'    then 0
                 when 'OPZIONATA'     then 1
                 when 'IN_TRATTATIVA' then 2
                 else 3
               end,
               e.date_from asc nulls last
      limit 1) as event_entry_id
  from supplier_clients sc
  where sc.supplier_id = auth.uid() or is_admin();
