-- ============================================================================
-- ADVERSARIAL — Famiglia D (confini e input spazzatura)  [EXPECTED-FAIL]
-- ----------------------------------------------------------------------------
-- DIAGNOSI, non riparazione. Ogni blocco DOCUMENTA una rottura: fa
-- `raise exception 'BRK-D-NN: ...'` SOLO quando la rottura e' presente.
-- Tutti i blocchi sono autonomi (`begin; ... rollback;`) e NON lasciano
-- residui. NON vanno nel runner della build verde. Eseguire a mano:
--
--   DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
--   docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=0 \
--     -f tests/adversarial/D_boundaries.sql 2>&1
--
-- Atteso: 13 ERROR 'BRK-D-NN' (tutti rossi). Se un blocco non e' rosso, la
-- rottura corrispondente NON si riproduce piu' (regressione = fix avvenuto).
--
-- Funzioni di calcolo reali esercitate (live, via trigger):
--   - quote_items_recalc_lines_v2  (BEFORE INSERT/UPDATE su quote_items)
--   - quotes_recalc_totals         (chiamata da quote_items_after_change e
--                                    quote_discount_after_change)
-- Seed: quote cccccccc-0000-0000-0000-000000000001
--       owner/proprio  00000000-aaaa-0000-0000-000000000002 (Giulia Rossi)
--       terzo (libero) 00000000-aaaa-0000-0000-000000000005 (Mario Foto)
-- "proprio"  = erogatore_e_capostipite=true   (line_client := line_cost)
-- "terzi"    = supplier_id<>owner, erogatore_e_capostipite=false (markup vivo)
-- ============================================================================


-- ── BRK-D-01 🟠 item_discount_percent=-1000 su voce -> "sconto" che e'
--    maggiorazione 1000%: line_client = 11x il costo (1000 -> 11000).
begin;
do $$
declare v_cost numeric; v_client numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent,item_discount_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-01',1000,1,
      '00000000-aaaa-0000-0000-000000000005',false,0,-1000)
  returning line_cost, line_client into v_cost, v_client;

  if v_client > v_cost then
    raise exception
      'BRK-D-01: item_discount_percent=-1000 ammesso (CHECK >= -1000) -> line_client=% e'' %x il line_cost=% (lo "sconto" gonfia il prezzo cliente)',
      v_client, round(v_client / nullif(v_cost,0), 0), v_cost;
  end if;
  raise notice 'BRK-D-01 non riprodotta (cost=% client=%)', v_cost, v_client;
end$$;
rollback;


-- ── BRK-D-02 🟠 item_markup_percent=-100 su voce TERZI (costo 1000) ->
--    line_client=0, margine -1000 (WP regala il servizio del terzo).
begin;
do $$
declare v_client numeric; v_total_cost numeric; v_margin numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent,item_discount_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-02',1000,1,
      '00000000-aaaa-0000-0000-000000000005',false,-100,0)
  returning line_client into v_client;

  select total_cost, margin_amount into v_total_cost, v_margin
    from public.quotes where id='cccccccc-0000-0000-0000-000000000001';

  if v_client = 0 and v_margin < 0 then
    raise exception
      'BRK-D-02: item_markup_percent=-100 su terzi (costo %) -> line_client=0, margine=% (costo del terzo non recuperato, nessun avviso)',
      v_total_cost, v_margin;
  end if;
  raise notice 'BRK-D-02 non riprodotta (client=% margin=%)', v_client, v_margin;
end$$;
rollback;


-- ── BRK-D-03 🟠 item_discount_percent=90 su TERZI markup 0 (costo 1000) ->
--    line_client=100 < costo, margine negativo, nessun warning.
begin;
do $$
declare v_client numeric; v_cost numeric; v_margin numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent,item_discount_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-03',1000,1,
      '00000000-aaaa-0000-0000-000000000005',false,0,90)
  returning line_cost, line_client into v_cost, v_client;

  select margin_amount into v_margin
    from public.quotes where id='cccccccc-0000-0000-0000-000000000001';

  if v_client < v_cost then
    raise exception
      'BRK-D-03: discount 90%% su terzi markup 0 -> line_client=% < line_cost=%, margine=% (prezzo sotto costo, nessun warning)',
      v_client, v_cost, v_margin;
  end if;
  raise notice 'BRK-D-03 non riprodotta (client=% cost=%)', v_client, v_cost;
end$$;
rollback;


-- ── BRK-D-04 🟠 total_discount_percent=-1000 -> total_client = 11x subtotale
--    (lo "sconto totale" e' in realta' una maggiorazione del 1000%).
begin;
do $$
declare v_sub numeric; v_client numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-04',1000,1,
      '00000000-aaaa-0000-0000-000000000005',false,0);

  update public.quotes set total_discount_percent=-1000
   where id='cccccccc-0000-0000-0000-000000000001';

  select subtotal_client, total_client into v_sub, v_client
    from public.quotes where id='cccccccc-0000-0000-0000-000000000001';

  if v_client > v_sub then
    raise exception
      'BRK-D-04: total_discount_percent=-1000 ammesso (CHECK >= -1000) -> total_client=% e'' %x il subtotal=% (maggiorazione 1000%% spacciata per sconto)',
      v_client, round(v_client / nullif(v_sub,0), 0), v_sub;
  end if;
  raise notice 'BRK-D-04 non riprodotta (sub=% client=%)', v_sub, v_client;
end$$;
rollback;


-- ── BRK-D-06 🔴 item_markup_percent=1000 ammesso dal CHECK qitems_markup_range
--    (<= 1000) ma la colonna e' numeric(5,2) (max 999.99) -> overflow su INSERT.
--    CHECK e tipo incoerenti. Catturo numeric_value_out_of_range e ri-rilancio.
begin;
do $$
begin
  begin
    insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
        supplier_id,erogatore_e_capostipite,item_markup_percent)
    values ('cccccccc-0000-0000-0000-000000000001','BRK-D-06',1000,1,
        '00000000-aaaa-0000-0000-000000000005',false,1000);
  exception when numeric_value_out_of_range then
    raise exception
      'BRK-D-06: item_markup_percent=1000 passa il CHECK qitems_markup_range(<=1000) ma la colonna numeric(5,2) va in numeric_value_out_of_range su INSERT (CHECK e tipo incoerenti)';
  end;
  raise notice 'BRK-D-06 non riprodotta: INSERT con markup=1000 e'' andato a buon fine';
end$$;
rollback;


-- ── BRK-D-06b 🔴 stesso difetto su quote_supplier_markups.markup_percent:
--    CHECK qsupmarkup_range(<=1000) vs colonna numeric(5,2) -> overflow.
begin;
do $$
begin
  begin
    insert into public.quote_supplier_markups(quote_id, supplier_id, markup_percent)
    values ('cccccccc-0000-0000-0000-000000000001',
            '00000000-aaaa-0000-0000-000000000005', 1000);
  exception when numeric_value_out_of_range then
    raise exception
      'BRK-D-06: quote_supplier_markups.markup_percent=1000 passa il CHECK qsupmarkup_range(<=1000) ma la colonna numeric(5,2) va in overflow su INSERT (stessa incoerenza CHECK vs tipo)';
  end;
  raise notice 'BRK-D-06b non riprodotta: INSERT supplier_markup=1000 ok';
end$$;
rollback;


-- ── BRK-D-07 🟠 opziona_data(date_to < date_from) -> opzione salvata incoerente
--    (date_to < date_from), 0 date marcate, ma ritorna ok:true.
begin;
do $$
declare v_res jsonb; v_id uuid; v_marked int; v_df date; v_dt date;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  v_res := public.opziona_data('2026-12-20'::date,'2026-12-10'::date,7,'BRK-D-07',null,null);
  v_id  := (v_res->>'id')::uuid;

  select date_from, date_to into v_df, v_dt
    from public.supplier_date_options where id = v_id;
  select count(*) into v_marked
    from public.supplier_availability
   where fornitore_id='00000000-aaaa-0000-0000-000000000002' and notes='BRK-D-07';

  if (v_res->>'ok')::boolean and v_dt < v_df and v_marked = 0 then
    raise exception
      'BRK-D-07: opziona_data(date_to=% < date_from=%) ritorna ok:true, salva opzione incoerente e marca % date (range vuoto accettato in silenzio)',
      v_dt, v_df, v_marked;
  end if;
  raise notice 'BRK-D-07 non riprodotta (df=% dt=% marked=%)', v_df, v_dt, v_marked;
end$$;
rollback;


-- ── BRK-D-08 🟡 opziona_data su data PASSATA (2020-01-01) accettata.
begin;
do $$
declare v_res jsonb; v_marked int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  v_res := public.opziona_data('2020-01-01'::date,'2020-01-01'::date,7,'BRK-D-08',null,null);

  select count(*) into v_marked
    from public.supplier_availability
   where fornitore_id='00000000-aaaa-0000-0000-000000000002' and date='2020-01-01';

  if (v_res->>'ok')::boolean and v_marked >= 1 then
    raise exception
      'BRK-D-08: opziona_data su data passata 2020-01-01 accettata (ok:true), % riga di availability marcata (nessun controllo data >= oggi)',
      v_marked;
  end if;
  raise notice 'BRK-D-08 non riprodotta (marked=%)', v_marked;
end$$;
rollback;


-- ── BRK-D-09 🟠 opziona_data range 2026-01-01 -> 2036-01-01 senza limite ->
--    marca migliaia di righe supplier_availability in 1 sola chiamata.
begin;
do $$
declare v_res jsonb; v_marked int;
begin
  perform set_config('request.jwt.claims',
    '{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  v_res := public.opziona_data('2026-01-01'::date,'2036-01-01'::date,7,'BRK-D-09',null,null);

  select count(*) into v_marked
    from public.supplier_availability
   where fornitore_id='00000000-aaaa-0000-0000-000000000002' and notes='BRK-D-09';

  if v_marked > 366 then
    raise exception
      'BRK-D-09: opziona_data range 2026->2036 senza limite -> % righe supplier_availability marcate in 1 chiamata (nessun cap sull''ampiezza del range)',
      v_marked;
  end if;
  raise notice 'BRK-D-09 non riprodotta (marked=%)', v_marked;
end$$;
rollback;


-- ── BRK-D-11 🟡 supplier_clients accetta email malformata + fiscal_code di
--    lunghezza errata (3 char) senza alcuna validazione (0 CHECK constraint).
begin;
do $$
declare v_email text; v_fc text;
begin
  insert into public.supplier_clients(supplier_id, full_name, email, fiscal_code,
      tags, status, profile_answers)
  values ('00000000-aaaa-0000-0000-000000000002','BRK-D-11','not-an-email','ABC',
      '{}', 'LEAD', '{}'::jsonb)
  returning email, fiscal_code into v_email, v_fc;

  if v_email = 'not-an-email' and length(v_fc) = 3 then
    raise exception
      'BRK-D-11: supplier_clients accetta email="%" (no @) e fiscal_code="%" (len=%, atteso 11/16) senza validazione',
      v_email, v_fc, length(v_fc);
  end if;
  raise notice 'BRK-D-11 non riprodotta (email=% fc=%)', v_email, v_fc;
end$$;
rollback;


-- ── BRK-D-14 🟠 sconto 100% ("gratis") su voce TERZI (costo 1000) ->
--    total_client=0 ma margine=-1000 (WP assorbe il costo del terzo, nessun avviso).
begin;
do $$
declare v_total_cost numeric; v_total_client numeric; v_margin numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent,item_discount_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-14',1000,1,
      '00000000-aaaa-0000-0000-000000000005',false,0,100);

  select total_cost, total_client, margin_amount
    into v_total_cost, v_total_client, v_margin
    from public.quotes where id='cccccccc-0000-0000-0000-000000000001';

  if v_total_client = 0 and v_margin < 0 then
    raise exception
      'BRK-D-14: discount 100%% su terzi (costo %) -> total_client=0 ma margine=% (WP assorbe il costo del terzo, nessun avviso)',
      v_total_cost, v_margin;
  end if;
  raise notice 'BRK-D-14 non riprodotta (client=% margin=%)', v_total_client, v_margin;
end$$;
rollback;


-- ── BRK-D-17 🟠 total_discount_amount=999999 >> subtotale -> total_client
--    clampato a 0 ma margine=-1000 (sconto oltre il totale assorbito in silenzio).
begin;
do $$
declare v_sub numeric; v_client numeric; v_margin numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-17',1000,1,
      '00000000-aaaa-0000-0000-000000000005',false,0);

  update public.quotes set total_discount_amount=999999
   where id='cccccccc-0000-0000-0000-000000000001';

  select subtotal_client, total_client, margin_amount
    into v_sub, v_client, v_margin
    from public.quotes where id='cccccccc-0000-0000-0000-000000000001';

  if v_client = 0 and v_margin < 0 then
    raise exception
      'BRK-D-17: total_discount_amount=999999 >> subtotal=% -> total_client clampato a 0 ma margine=% (sconto oltre il totale assorbito, nessun limite)',
      v_sub, v_margin;
  end if;
  raise notice 'BRK-D-17 non riprodotta (sub=% client=% margin=%)', v_sub, v_client, v_margin;
end$$;
rollback;


-- ── BRK-D-18 🟠 sconto totale 100% su servizio PROPRIO (costo reale 1000) ->
--    la live quotes_recalc_totals applica v_factor anche al costo proprio ->
--    total_cost=0 (il costo reale sparisce dai conti).
begin;
do $$
declare v_sub numeric; v_cost numeric; v_client numeric; v_margin numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      erogatore_e_capostipite,item_markup_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-18',1000,1,true,null);

  update public.quotes set total_discount_percent=100
   where id='cccccccc-0000-0000-0000-000000000001';

  select subtotal_client, total_cost, total_client, margin_amount
    into v_sub, v_cost, v_client, v_margin
    from public.quotes where id='cccccccc-0000-0000-0000-000000000001';

  if v_cost = 0 then
    raise exception
      'BRK-D-18: discount totale 100%% su servizio proprio (costo reale 1000) -> total_cost=% (v_factor azzera anche il costo proprio: costo reale sparito dai conti; margine apparente=%)',
      v_cost, v_margin;
  end if;
  raise notice 'BRK-D-18 non riprodotta (cost=% client=% margin=%)', v_cost, v_client, v_margin;
end$$;
rollback;


-- ── BRK-D-16 ⚪ arrotondamento per-riga: 3 voci a markup 33.33% su 0.10 ->
--    somma per-riga 0.39 vs calcolo single-line 0.40 (1 cent perso).
begin;
do $$
declare v_perline numeric; v_single numeric;
begin
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-16a',0.10,1,
      '00000000-aaaa-0000-0000-000000000005',false,33.33);
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-16b',0.10,1,
      '00000000-aaaa-0000-0000-000000000005',false,33.33);
  insert into public.quote_items(quote_id,name_snapshot,snapshot_price,quantity,
      supplier_id,erogatore_e_capostipite,item_markup_percent)
  values ('cccccccc-0000-0000-0000-000000000001','BRK-D-16c',0.10,1,
      '00000000-aaaa-0000-0000-000000000005',false,33.33);

  select sum(line_client), round(sum(line_cost) * (1 + 33.33/100.0), 2)
    into v_perline, v_single
    from public.quote_items where quote_id='cccccccc-0000-0000-0000-000000000001';

  if v_perline <> v_single then
    raise exception
      'BRK-D-16: arrotondamento per-riga 3x(markup 33.33%% su 0.10) -> somma line_client=% vs calcolo single-line=% (% di scarto, cent perso/guadagnato per la doppia round)',
      v_perline, v_single, v_single - v_perline;
  end if;
  raise notice 'BRK-D-16 non riprodotta (perline=% single=%)', v_perline, v_single;
end$$;
rollback;
