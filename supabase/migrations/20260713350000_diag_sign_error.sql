-- DIAGNOSTICA: riproduce l'UPDATE ad ACCETTATO (come l'edge) su un preventivo di test e cattura
-- l'errore reale dei trigger di conferma. NON committa (savepoint rollback).
do $$
declare v_q uuid; v_st text;
begin
  select id, status into v_q, v_st from public.quotes
    where client_name ilike '%Giorgio Gatto%' or client_name ilike '%Napoleone%' or title ilike '%destination weekend%'
    order by created_at desc limit 1;
  if v_q is null then raise notice 'DIAG: preventivo di test non trovato'; return; end if;
  raise notice 'DIAG: preventivo % stato attuale %', v_q, v_st;
  begin
    if v_st = 'BOZZA' then perform public.quote_promote_to_inviato(v_q); end if;
    update public.quotes set status='ACCETTATO' where id = v_q and status in ('INVIATO','BOZZA');
    raise exception using errcode = '40000', message = '__OK__';   -- successo → rollback del savepoint
  exception
    when sqlstate '40000' then raise notice 'DIAG CONFERMA: i trigger PASSANO (UPDATE ad ACCETTATO ok) → il bug e'' altrove nell''edge (upload firma / insert fiscale / email)';
    when others then raise notice 'DIAG ERRORE TRIGGER CONFERMA: [%] %', SQLSTATE, SQLERRM;
  end;
end $$;
