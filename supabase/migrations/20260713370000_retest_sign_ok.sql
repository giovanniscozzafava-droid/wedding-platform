-- RETEST firma esatto come l'edge (status=ACCETTATO + accepted_at) → deve passare (rollback finale).
do $$
declare v_q uuid; v_st text;
begin
  select id, status into v_q, v_st from public.quotes
    where client_name ilike '%Giorgio Gatto%' or client_name ilike '%Napoleone%' or title ilike '%destination weekend%'
    order by created_at desc limit 1;
  if v_q is null then raise notice 'RETEST2: nessun preventivo di test'; return; end if;
  begin
    if v_st = 'BOZZA' then perform public.quote_promote_to_inviato(v_q); end if;
    update public.quotes set status='ACCETTATO', accepted_at = now() where id = v_q and status in ('INVIATO','BOZZA');
    raise exception using errcode = '40000', message = '__OK__';
  exception
    when sqlstate '40000' then raise notice 'RETEST2 FIRMA: OK — accettazione + conferma evento passano (firma sbloccata)';
    when others then raise notice 'RETEST2 FIRMA ANCORA ROTTO: [%] %', SQLSTATE, SQLERRM;
  end;
end $$;
