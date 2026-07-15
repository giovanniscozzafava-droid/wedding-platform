-- Igiene sicurezza (audit gate 15/07): le funzioni diagnostiche non devono essere
-- eseguibili da `anon` in produzione. `_diag_whoami` (ritorna l'identità del chiamante)
-- e `_diag_album_counts` (conteggi) erano granted a anon. Le revoco.
-- (NB: `get_supplier_assets` resta anon: è LEGITTIMA — la usa la pagina pubblica
--  EmbedLeadPage per mostrare gli asset del fornitore ai potenziali clienti.)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('_diag_whoami','_diag_album_counts')
  loop
    execute format('revoke execute on function %s from anon;', r.sig);
    raise notice 'revoke anon su %', r.sig;
  end loop;
end $$;
