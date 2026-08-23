-- ============================================================================
-- Clienti "di prova": il professionista può etichettare un cliente come TEST.
-- I clienti test (e i loro preventivi/contratti) NON entrano nelle statistiche.
--  • supplier_clients.is_test → il flag sul cliente.
--  • L'esclusione dai numeri passa da:
--     - lead: supplier_clients non-test;
--     - preventivi: quotes.is_test = false E il cliente collegato (direct_client_id) non è test;
--     - contratti: contracts.is_test = false E il preventivo d'origine non è di un cliente test.
-- ============================================================================
alter table public.supplier_clients
  add column if not exists is_test boolean not null default false;
comment on column public.supplier_clients.is_test is 'Cliente di prova: escluso da tutte le statistiche (funnel, provenienza).';

-- Funnel del professionista, ora al netto dei test.
create or replace function public.professional_funnel_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_leads int := 0;
  v_quotes_total int := 0;
  v_quotes_sent int := 0;
  v_quotes_accepted int := 0;
  v_quotes_rejected int := 0;
  v_contracts_signed int := 0;
  v_accepted_value numeric := 0;
  v_won_30d int := 0;
  v_sent_30d int := 0;
  v_accept_rate numeric;
  v_send_rate numeric;
  v_contract_rate numeric;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;

  -- Lead ricevuti (esclusi i clienti test).
  select
    coalesce((select count(*) from lead_requests where wp_id = v_uid), 0)
    + coalesce((select count(*) from supplier_clients where supplier_id = v_uid and not coalesce(is_test, false)), 0)
  into v_leads;

  select
    count(*),
    count(*) filter (where status in ('INVIATO','ACCETTATO','RIFIUTATO','CONVERTITO_IN_CONTRATTO')),
    count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')),
    count(*) filter (where status = 'RIFIUTATO'),
    coalesce(sum(case when coalesce(total_client_selected,0) > 0 then total_client_selected else total_client end)
             filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')), 0),
    count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') and accepted_at >= now() - interval '30 days'),
    count(*) filter (where sent_at is not null and sent_at >= now() - interval '30 days')
  into v_quotes_total, v_quotes_sent, v_quotes_accepted, v_quotes_rejected, v_accepted_value, v_won_30d, v_sent_30d
  from quotes q
  where q.owner_id = v_uid
    and not coalesce(q.is_test, false)
    and not exists (select 1 from supplier_clients sc where sc.id = q.direct_client_id and sc.is_test);

  select count(*) into v_contracts_signed
  from contracts c
  where c.owner_id = v_uid and c.status = 'FIRMATO'
    and not coalesce(c.is_test, false)
    and not exists (
      select 1 from quotes q join supplier_clients sc on sc.id = q.direct_client_id
      where q.id = c.quote_id and sc.is_test);

  v_accept_rate   := case when v_quotes_sent > 0 then round(100.0 * v_quotes_accepted / v_quotes_sent) else null end;
  v_send_rate     := case when v_leads > 0 then round(100.0 * v_quotes_sent / v_leads) else null end;
  v_contract_rate := case when v_quotes_accepted > 0 then round(100.0 * v_contracts_signed / v_quotes_accepted) else null end;

  return jsonb_build_object(
    'ok', true,
    'leads', v_leads,
    'quotes_total', v_quotes_total,
    'quotes_sent', v_quotes_sent,
    'quotes_accepted', v_quotes_accepted,
    'quotes_rejected', v_quotes_rejected,
    'contracts_signed', v_contracts_signed,
    'accepted_value', v_accepted_value,
    'avg_accepted_value', case when v_quotes_accepted > 0 then round(v_accepted_value / v_quotes_accepted) else 0 end,
    'acceptance_rate', v_accept_rate,
    'send_rate', v_send_rate,
    'contract_rate', v_contract_rate,
    'won_last_30d', v_won_30d,
    'sent_last_30d', v_sent_30d
  );
end
$$;
grant execute on function public.professional_funnel_metrics() to public, anon, authenticated, service_role;

-- Statistiche provenienza, al netto dei test.
create or replace function public.lead_source_stats()
returns table(lead_source text, n bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(q.lead_source, 'NON_INDICATO') as lead_source, count(*) as n
  from public.quotes q
  where q.owner_id = auth.uid()
    and coalesce(q.archived_at::text, '') = ''
    and not coalesce(q.is_test, false)
    and not exists (select 1 from public.supplier_clients sc where sc.id = q.direct_client_id and sc.is_test)
  group by 1
  order by n desc;
$$;
grant execute on function public.lead_source_stats() to authenticated, service_role;
