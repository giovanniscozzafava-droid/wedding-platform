-- DIAGNOSTICA (no-op, SOLO SELECT): top errori client reali (ultimi 30 gg) per capire
-- cosa causa "Riproviamo". I chunk error sono filtrati a monte, quindi qui restano
-- solo errori runtime veri (che il reload NON risolve).
do $$
declare r record; tot int; occ bigint;
begin
  select count(*), coalesce(sum(count),0) into tot, occ from public.client_errors where last_seen > now() - interval '30 days';
  raise notice '==== gruppi errore (30gg): % | occorrenze totali: % ====', tot, occ;
  raise notice '---- TOP per occorrenze ----';
  for r in
    select count c, source, severity, left(message,140) msg, url, to_char(last_seen,'MM-DD HH24:MI') ls, status
    from public.client_errors where last_seen > now() - interval '30 days'
    order by count desc limit 25
  loop
    raise notice '[%x] % % | url=% | ult=% | %', r.c, r.source, r.severity, r.url, r.ls, r.msg;
  end loop;
  raise notice '---- TOP per user-agent (mobile?) sui 10 più frequenti ----';
  for r in
    select count c, left(coalesce(last_user_agent,'?'),80) ua, left(message,60) msg
    from public.client_errors where last_seen > now() - interval '30 days'
    order by count desc limit 10
  loop raise notice 'UA[%x] % | %', r.c, r.ua, r.msg; end loop;
end $$;
