-- ============================================================================
-- HOTFIX 2: my_quote_conflict_alerts() ritornava 42804 dopo il fix precedente.
-- RETURNS TABLE(...) dichiara my_quote_title TEXT, my_role TEXT, ecc., ma
-- in SELECT le colonne sorgente sono varchar(200)/varchar(40) → mismatch
-- type structure dopo il planning. Aggiungiamo cast espliciti ::text.
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
      q.event_date, q.event_location, q.direct_client_id,
      q.total_client, q.status,
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
      q.event_date, q.event_location, q.direct_client_id,
      q.total_client, q.status,
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
    m.title::text                         as my_quote_title,
    m.status::text                        as my_quote_status,
    m.total_client                        as my_quote_total,
    (case
      when m.direct_client_id is not null then 'FORNITORE_DIRETTO'
      else 'CAPOSTIPITE'
    end)::text                            as my_role,
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
        when m.event_location is not null and o.event_location is not null
             and lower(trim(m.event_location)) = lower(trim(o.event_location))
             and length(trim(m.event_location)) >= 3
        then 'LOCATION_MATCH' end,
      case
        when m.event_date = o.event_date then 'DATE_MATCH' end
    ], null)::text[]                      as match_signals,
    o.id                                  as other_quote_id,
    p.role::text                          as other_owner_role,
    coalesce(nullif(trim(p.business_name), ''), nullif(trim(p.full_name), ''), 'Utente Planfully')::text as other_owner_name,
    o.event_date                          as other_quote_event_date,
    o.total_client                        as other_quote_total,
    o.status::text                        as other_quote_status,
    (case
      when (m.client_email is not null and o.client_email is not null
            and lower(trim(m.client_email)) = lower(trim(o.client_email)))
        then 'HIGH'
      when (m.client_name is not null and o.client_name is not null
            and lower(trim(m.client_name)) = lower(trim(o.client_name)))
        then 'MEDIUM'
      when (m.event_location is not null and o.event_location is not null
            and lower(trim(m.event_location)) = lower(trim(o.event_location))
            and length(trim(m.event_location)) >= 3)
        then 'MEDIUM'
      else 'LOW'
    end)::text                            as conflict_severity
  from my_q m
  join other_q o on o.event_date = m.event_date
  join profiles p on p.id = o.owner_id
  where
    (
      (m.client_email is not null and o.client_email is not null
       and lower(trim(m.client_email)) = lower(trim(o.client_email)))
      or
      (m.client_name is not null and o.client_name is not null
       and lower(trim(m.client_name)) = lower(trim(o.client_name)))
      or
      (m.event_location is not null and o.event_location is not null
       and lower(trim(m.event_location)) = lower(trim(o.event_location))
       and length(trim(m.event_location)) >= 3)
    )
    and (
      (m.direct_client_id is not null
       and o.direct_client_id is null
       and m.owner_id = any(o.supplier_ids))
      or
      (m.direct_client_id is null
       and o.direct_client_id is not null
       and o.owner_id = any(m.supplier_ids))
      or
      (m.direct_client_id is not null
       and o.direct_client_id is not null
       and m.owner_id = o.owner_id)
      or
      (m.direct_client_id is null
       and o.direct_client_id is null
       and m.supplier_ids && o.supplier_ids)
    );
end$$;

grant execute on function my_quote_conflict_alerts() to authenticated;
