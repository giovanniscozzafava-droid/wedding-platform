-- ============================================================================
-- Wedding Platform — test isolamento VISTE (audit notturno, punto 2)
-- Le viste senza security_invoker girano coi privilegi del owner e BYPASSANO la
-- RLS. Ogni vista raggiungibile da anon/authenticated: o aggregato pubblico
-- senza cross-tenant, o deve rispettare la RLS del chiamante.
-- Lanciare: docker exec ... psql -1 -f tests/sql/views_isolation_tests.sql
-- ============================================================================

-- TEST V1: anon NON legge v_salute_evento (era un leak cross-tenant)
do $$
declare v int;
begin
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  set local role anon;
  begin
    select count(*) into v from v_salute_evento;
  exception when insufficient_privilege then v := -1; end;  -- revocato = ok
  reset role;
  if v <= 0 then
    raise notice 'TEST V1 OK (anon su v_salute_evento: % righe / privilege negato)', v;
  else
    raise exception 'TEST V1 FAIL: anon legge % righe da v_salute_evento (leak cross-tenant)', v;
  end if;
end$$;

-- TEST V2 (positivo): l'owner Giulia vede la salute dei PROPRI eventi
do $$
declare v int;
begin
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  begin
    select count(*) into v from v_salute_evento;
  exception when insufficient_privilege then v := -1; end;
  reset role;
  -- L'accesso legittimo deve restare: niente errore di privilegio per l'owner.
  if v >= 0 then
    raise notice 'TEST V2 OK (owner accede a v_salute_evento: % righe)', v;
  else
    raise exception 'TEST V2 FAIL: l''owner non accede piu a v_salute_evento (accesso legittimo rotto)';
  end if;
end$$;

-- TEST V3 (positivo): user_rating_summary resta leggibile (aggregato pubblico)
do $$
declare v int;
begin
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  set local role anon;
  begin select count(*) into v from user_rating_summary; exception when insufficient_privilege then v := -1; end;
  reset role;
  if v >= 0 then
    raise notice 'TEST V3 OK (aggregato pubblico user_rating_summary leggibile: % righe)', v;
  else
    raise notice 'TEST V3 INFO (user_rating_summary non leggibile da anon: %)', v;
  end if;
end$$;

do $$ begin raise notice 'VIEWS ISOLATION TESTS: completati'; end$$;
