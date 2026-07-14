-- DIAGNOSTICO (read-only) del caso "Cristoforo Colombo": perché il contratto non arriva alla firma.
do $$
declare r record; n int := 0;
begin
  for r in
    select q.id, q.title, q.status::text as qstatus, q.client_name, q.client_email, q.direct_client_id,
           (select count(*) from public.contracts c where c.quote_id = q.id) as n_contracts
    from public.quotes q
    where q.client_name ilike '%colombo%' or q.title ilike '%colombo%'
    order by q.created_at desc limit 8
  loop
    n := n + 1;
    raise notice 'QUOTE % | stato=% | cliente=% | email=% | direct_client=% | contratti collegati=%',
      r.id, r.qstatus, coalesce(r.client_name,'(vuoto)'), coalesce(r.client_email,'(NESSUNA)'),
      coalesce(r.direct_client_id::text,'no'), r.n_contracts;
  end loop;
  if n = 0 then raise notice 'Nessun preventivo con "colombo" nel nome/titolo.'; end if;

  for r in
    select c.id, c.status::text as cstatus, coalesce(c.party_kind::text,'CLIENT_WP') as pkind,
           c.client_name, c.client_email, c.quote_id, c.access_token is not null as has_token,
           (select status::text from public.quotes q where q.id = c.quote_id) as linked_quote_status
    from public.contracts c
    where c.client_name ilike '%colombo%' or c.title ilike '%colombo%'
    order by c.created_at desc limit 8
  loop
    raise notice 'CONTRATTO % | stato=% | tipo=% | email=% | token=% | quote=% (stato preventivo=%)',
      r.id, r.cstatus, r.pkind, coalesce(r.client_email,'(NESSUNA)'), r.has_token,
      coalesce(r.quote_id::text,'nessuno'), coalesce(r.linked_quote_status,'-');
  end loop;
end $$;
