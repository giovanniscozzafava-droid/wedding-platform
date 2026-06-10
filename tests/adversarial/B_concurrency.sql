-- ============================================================================
-- ADVERSARIAL — Famiglia B (concorrenza e doppi click)  [EXPECTED-FAIL]
-- ----------------------------------------------------------------------------
-- Questi blocchi DOCUMENTANO rotture: fanno `raise exception` QUANDO la rottura
-- e' presente. NON vanno nel runner della build verde. Eseguire a mano:
--   docker exec -i supabase_db_wedding-platform psql -U postgres -d postgres \
--     -f tests/adversarial/B_concurrency.sql
-- Ogni blocco e' in begin/rollback (B1) o si autopulisce (B2/B3 = vere sessioni).
-- ============================================================================

-- ── BRK-B-01 🟠 double-booking: stesso fornitore opziona la STESSA data per 2
--    clienti diversi (supplier_date_options non ha unique su (supplier_id,date)).
do $$
declare v_n int;
begin
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000005","role":"authenticated"}', true);
  -- nota: opziona_data e' SECURITY DEFINER, legge auth.uid() dai claims
  perform public.opziona_data('2026-12-12','2026-12-12',1,'Cliente A', null, null);
  perform public.opziona_data('2026-12-12','2026-12-12',1,'Cliente B', null, null);
  select count(*) into v_n from public.supplier_date_options
   where supplier_id='00000000-aaaa-0000-0000-000000000005' and date_from='2026-12-12';
  if v_n >= 2 then
    raise exception 'BRK-B-01: il fornitore ha % opzioni attive sulla STESSA data per clienti diversi (nessuna unique su supplier_date_options) -> doppia promessa', v_n;
  end if;
  raise notice 'BRK-B-01 non riprodotta (v_n=%)', v_n;
end$$;
-- (eseguito senza begin/rollback esterno -> se vuoi pulire: delete from
--  supplier_date_options where reason in ('Cliente A','Cliente B');)

-- ── BRK-B-02 ✅ RESISTE: il claim atomico di quote-accept-sign in race reale
--    (UPDATE ... WHERE status IN (INVIATO,BOZZA)) lascia vincere UNA sola sessione.
--    Provato con 2 sessioni psql concorrenti: A -> UPDATE 1, B -> UPDATE 0.
--    Non e' una rottura; documentato come guard che TIENE.

-- ── BRK-B-03 🟠 lost update: quotes non ha optimistic lock (solo `revision`,
--    che e' la revisione del preventivo, non un lock di concorrenza). Due "tab"
--    che salvano in sequenza: il secondo sovrascrive il primo SENZA errore.
--    Provato con sessioni reali: title ORIGINALE -> EDIT_B -> EDIT_A, finale
--    EDIT_A, EDIT_B perso silenziosamente. Repro a sessioni (vedi audit), qui la
--    prova strutturale: nessuna colonna di versione-lock.
do $$
declare v_has_lock int;
begin
  select count(*) into v_has_lock from information_schema.columns
   where table_name='quotes' and column_name in ('version','lock_version','row_version');
  if v_has_lock = 0 then
    raise exception 'BRK-B-03: quotes non ha colonna di optimistic-lock -> due update concorrenti = lost update silenzioso (nessun conflitto rilevato)';
  end if;
end$$;
