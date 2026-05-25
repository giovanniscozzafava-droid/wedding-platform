-- ============================================================================
-- CONFLICT ALERTS — anti-disintermediazione
--
-- Caso: WP fa preventivo a coppia X per data D, includendo fornitore F.
-- Coppia X contatta direttamente F per stessa data → F propone preventivo
-- scontato (senza commissione WP). Risultato: WP "saltata".
--
-- Soluzione: rilevazione automatica di overlapping signal tra:
--   1. Preventivi WP (con quote_items.supplier_id = F)
--   2. Preventivi diretti di F (direct_client_id non null)
-- per stessa data E (email coppia coincidente OR nome esatto).
--
-- Visibility: entrambi i lati (WP e Fornitore) vedono l'alert via RPC
-- my_quote_conflict_alerts() che mostra solo i quote_id di propria
-- appartenenza + metadati dell'altro lato (kind+name+data+totale+status).
-- I dati sensibili dell'altro preventivo NON sono esposti (no client_email
-- altrui, no voci dettagliate, no PDF).
-- ============================================================================

create or replace function my_quote_conflict_alerts()
returns table (
  my_quote_id            uuid,
  my_quote_title         text,
  my_quote_status        text,
  my_quote_total         numeric,
  my_role                text,
  match_signals          text[],
  other_quote_id         uuid,
  other_owner_role       text,
  other_owner_name       text,
  other_quote_event_date date,
  other_quote_total      numeric,
  other_quote_status     text,
  conflict_severity      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return; end if;

  return query
  with my_q as (
    select
      q.id, q.owner_id, q.title, q.client_name, q.client_email,
      q.event_date, q.direct_client_id, q.total_client, q.status,
      array(
        select distinct supplier_id
          from quote_items
         where quote_id = q.id and supplier_id is not null
      ) as supplier_ids
      from quotes q
     where q.owner_id = v_uid
       and q.event_date is not null
       and q.status not in ('RIFIUTATO')
  ),
  other_q as (
    select
      q.id, q.owner_id, q.title, q.client_name, q.client_email,
      q.event_date, q.direct_client_id, q.total_client, q.status,
      array(
        select distinct supplier_id
          from quote_items
         where quote_id = q.id and supplier_id is not null
      ) as supplier_ids
      from quotes q
     where q.owner_id <> v_uid
       and q.event_date is not null
       and q.status not in ('RIFIUTATO')
  )
  select
    m.id                                  as my_quote_id,
    m.title                               as my_quote_title,
    m.status::text                        as my_quote_status,
    m.total_client                        as my_quote_total,
    case
      when m.direct_client_id is not null then 'FORNITORE_DIRETTO'
      else 'CAPOSTIPITE'
    end                                   as my_role,
    array_remove(array[
      case
        when m.client_email is not null and o.client_email is not null
             and lower(trim(m.client_email)) = lower(trim(o.client_email))
        then 'EMAIL_MATCH' end,
      case
        when m.client_name is not null and o.client_name is not null
             and lower(trim(m.client_name)) = lower(trim(o.client_name))
        then 'NAME_EXACT' end,
      case
        when m.event_date = o.event_date then 'DATE_MATCH' end
    ], null)                              as match_signals,
    o.id                                  as other_quote_id,
    p.role::text                          as other_owner_role,
    coalesce(p.full_name, p.email)        as other_owner_name,
    o.event_date                          as other_quote_event_date,
    o.total_client                        as other_quote_total,
    o.status::text                        as other_quote_status,
    case
      when (m.client_email is not null and o.client_email is not null
            and lower(trim(m.client_email)) = lower(trim(o.client_email)))
        then 'HIGH'
      when (m.client_name is not null and o.client_name is not null
            and lower(trim(m.client_name)) = lower(trim(o.client_name)))
        then 'MEDIUM'
      else 'LOW'
    end                                   as conflict_severity
  from my_q m
  join other_q o on o.event_date = m.event_date
  join profiles p on p.id = o.owner_id
  where
    -- coppia coincidente: email O nome esatto
    (
      (m.client_email is not null and o.client_email is not null
       and lower(trim(m.client_email)) = lower(trim(o.client_email)))
      or
      (m.client_name is not null and o.client_name is not null
       and lower(trim(m.client_name)) = lower(trim(o.client_name)))
    )
    and (
      -- io fornitore con quote diretto, e dall'altra parte WP con me dentro
      (m.direct_client_id is not null
       and o.direct_client_id is null
       and m.owner_id = any(o.supplier_ids))
      or
      -- io WP con un fornitore in voci, e dall'altra parte quel fornitore in quote diretto
      (m.direct_client_id is null
       and o.direct_client_id is not null
       and o.owner_id = any(m.supplier_ids))
      or
      -- due quote diretti tra stessi soggetti (raro: doppio invio fornitore)
      (m.direct_client_id is not null
       and o.direct_client_id is not null
       and m.owner_id = o.owner_id)
      or
      -- due WP che hanno stessa coppia (chi è arrivato primo?) — solo se condividono almeno 1 fornitore
      (m.direct_client_id is null
       and o.direct_client_id is null
       and m.supplier_ids && o.supplier_ids)
    );
end$$;

grant execute on function my_quote_conflict_alerts() to authenticated;

comment on function my_quote_conflict_alerts() is
  'Ritorna alert di potenziale disintermediazione: pairs di preventivi con stessa data e coppia coincidente (per email o nome) che coinvolgono lo stesso fornitore sia come quote diretto sia come voce di quote WP. Espone solo metadati aggregati dell''altro lato (nome owner, totale, status), non dati sensibili.';
