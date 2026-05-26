-- ============================================================================
-- OWNER FINANCE STATS — aggrega quotes ACCETTATO per dashboard /bilancio.
-- Solo le quote con firma cliente (status='ACCETTATO') vengono conteggiate:
-- nel flusso /p/accept la firma FES setta accepted_at + status='ACCETTATO'.
-- ============================================================================

create or replace function owner_finance_stats(p_owner_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_owner uuid := coalesce(p_owner_id, auth.uid());
  v_lifetime numeric(14,2);
  v_year     numeric(14,2);
  v_month    numeric(14,2);
  v_count_accepted int;
  v_count_pending  int;
  v_by_month jsonb;
  v_recent   jsonb;
  v_upcoming jsonb;
  v_pending  jsonb;
begin
  if v_owner is null then
    return jsonb_build_object('error', 'no_owner');
  end if;

  -- Totali aggregati su quotes ACCETTATO
  select
    coalesce(sum(total_client), 0),
    coalesce(sum(total_client) filter (where date_trunc('year',  accepted_at) = date_trunc('year',  now())), 0),
    coalesce(sum(total_client) filter (where date_trunc('month', accepted_at) = date_trunc('month', now())), 0),
    count(*)
  into v_lifetime, v_year, v_month, v_count_accepted
  from quotes
  where owner_id = v_owner and status = 'ACCETTATO';

  -- Quote inviate non ancora firmate
  select count(*) into v_count_pending
  from quotes
  where owner_id = v_owner and status = 'INVIATO';

  -- Andamento ultimi 12 mesi (gennaio → dicembre)
  with months as (
    select date_trunc('month', now()) - (interval '1 month' * gs) as m
      from generate_series(0, 11) as gs
  ), agg as (
    select date_trunc('month', accepted_at) as m, sum(total_client) as tot
      from quotes
     where owner_id = v_owner and status = 'ACCETTATO' and accepted_at is not null
       and accepted_at >= now() - interval '12 months'
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'month', to_char(months.m, 'YYYY-MM'),
           'total', coalesce(agg.tot, 0)
         ) order by months.m asc), '[]'::jsonb)
    into v_by_month
    from months left join agg on agg.m = months.m;

  -- Ultime 20 accettate (recap fatturato)
  select coalesce(jsonb_agg(row order by row->>'accepted_at' desc), '[]'::jsonb)
    into v_recent
    from (
      select jsonb_build_object(
        'id',           q.id,
        'title',        q.title,
        'client_name',  q.client_name,
        'event_date',   q.event_date,
        'event_kind',   q.event_kind,
        'total_client', q.total_client,
        'accepted_at',  q.accepted_at,
        'revision',     q.revision
      ) as row
      from quotes q
      where q.owner_id = v_owner and q.status = 'ACCETTATO'
      order by q.accepted_at desc nulls last
      limit 20
    ) s;

  -- Eventi futuri accettati (per pianificazione cashflow)
  select coalesce(jsonb_agg(row order by row->>'event_date' asc), '[]'::jsonb)
    into v_upcoming
    from (
      select jsonb_build_object(
        'id',           q.id,
        'title',        q.title,
        'client_name',  q.client_name,
        'event_date',   q.event_date,
        'event_kind',   q.event_kind,
        'total_client', q.total_client
      ) as row
      from quotes q
      where q.owner_id = v_owner
        and q.status = 'ACCETTATO'
        and q.event_date is not null
        and q.event_date >= current_date
      order by q.event_date asc
      limit 20
    ) s;

  -- Quote INVIATO in attesa di firma
  select coalesce(jsonb_agg(row order by row->>'created_at' desc), '[]'::jsonb)
    into v_pending
    from (
      select jsonb_build_object(
        'id',           q.id,
        'title',        q.title,
        'client_name',  q.client_name,
        'client_email', q.client_email,
        'total_client', q.total_client,
        'created_at',   q.created_at,
        'event_date',   q.event_date
      ) as row
      from quotes q
      where q.owner_id = v_owner and q.status = 'INVIATO'
      order by q.created_at desc
      limit 20
    ) s;

  return jsonb_build_object(
    'lifetime_total',  v_lifetime,
    'year_total',      v_year,
    'month_total',     v_month,
    'count_accepted',  v_count_accepted,
    'count_pending',   v_count_pending,
    'by_month',        v_by_month,
    'recent',          v_recent,
    'upcoming',        v_upcoming,
    'pending',         v_pending
  );
end$$;

grant execute on function owner_finance_stats(uuid) to authenticated;

comment on function owner_finance_stats(uuid) is
  'Dashboard /bilancio: aggrega quotes ACCETTATO per owner. Solo le quote firmate dal cliente (status=ACCETTATO) contribuiscono al fatturato.';
