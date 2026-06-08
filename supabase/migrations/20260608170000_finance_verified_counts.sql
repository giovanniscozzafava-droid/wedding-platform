-- ============================================================================
-- I traguardi del Business Plan devono contare i SOLI verificati (clienti/fornitori
-- reali), non gli account di test. Aggiungiamo i conteggi verificati all'overview.
-- ============================================================================
create or replace function public.admin_finance_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_in_once numeric; v_out_once numeric;
  v_in_rec numeric;  v_out_rec numeric;
  v_comm_tot numeric; v_comm_settled numeric;
  v_users jsonb; v_subs jsonb; v_forn int;
  v_forn_verif int; v_clienti_verif int;
begin
  if not public.is_support_staff() then return jsonb_build_object('error','forbidden'); end if;

  select coalesce(sum(amount) filter (where direction='IN'  and recurrence='UNA_TANTUM' and entry_date<=current_date),0),
         coalesce(sum(amount) filter (where direction='OUT' and recurrence='UNA_TANTUM' and entry_date<=current_date),0),
         coalesce(sum(case recurrence when 'MENSILE' then amount when 'ANNUALE' then amount/12 else 0 end) filter (where direction='IN'),0),
         coalesce(sum(case recurrence when 'MENSILE' then amount when 'ANNUALE' then amount/12 else 0 end) filter (where direction='OUT'),0)
    into v_in_once, v_out_once, v_in_rec, v_out_rec
    from public.platform_finance_entries;

  select coalesce(sum(platform_commission),0),
         coalesce(sum(platform_commission) filter (where status='SETTLED'),0)
    into v_comm_tot, v_comm_settled
    from public.supplier_credits;

  select coalesce(jsonb_object_agg(role, n),'{}'::jsonb) into v_users
    from (select role, count(*) n from public.profiles group by role) t;
  select coalesce(jsonb_object_agg(coalesce(subscription_status,'?'), n),'{}'::jsonb) into v_subs
    from (select subscription_status, count(*) n from public.profiles group by subscription_status) t;
  select count(*) into v_forn from public.profiles where role='FORNITORE';
  select count(*) into v_forn_verif from public.profiles where role='FORNITORE' and is_verified_customer;
  select count(*) into v_clienti_verif from public.profiles where role in ('CLIENT','COUPLE') and is_verified_customer;

  return jsonb_build_object(
    'cassetto',            v_in_once + v_comm_settled - v_out_once,
    'entrate_una_tantum',  v_in_once,
    'costi_una_tantum',    v_out_once,
    'entrate_ricorrenti_mese', v_in_rec,
    'costi_ricorrenti_mese',   v_out_rec,
    'netto_ricorrente_mese',   v_in_rec - v_out_rec,
    'commissioni_totali',  v_comm_tot,
    'commissioni_incassate', v_comm_settled,
    'commissioni_da_incassare', v_comm_tot - v_comm_settled,
    'users_by_role',       v_users,
    'subs_by_status',      v_subs,
    'fornitori_totali',    v_forn,
    'fornitori_verificati', v_forn_verif,
    'clienti_verificati',  v_clienti_verif
  );
end$$;
grant execute on function public.admin_finance_overview() to authenticated;
