-- ============================================================================
-- REGRESSIONE VERDE — Cluster 3 "Limiti economici e concorrenza"
-- (ex BRK-D-01/02/03/04/06/07/14/18, BRK-B-01/B-03). Verde = nessun ERROR.
-- Owner Giulia ...0002, fornitore Mario ...0005.
-- ============================================================================

-- ── C3-T1 · sconti 0..100 (D-01/D-04): negativi rifiutati, 50% ok ──────────
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_bad1 boolean:=false; v_bad2 boolean:=false;
  begin
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','BOZZA',gen_random_uuid(),1,30);
    begin insert into quote_items(quote_id,name_snapshot,snapshot_price,item_discount_percent) values (v_q,'V',100,-1000);
    exception when check_violation then v_bad1:=true; end;
    begin update quotes set total_discount_percent=-1000 where id=v_q;
    exception when check_violation then v_bad2:=true; end;
    if not (v_bad1 and v_bad2) then raise exception 'FAIL C3-T1: sconto negativo accettato (item=% total=%)',v_bad1,v_bad2; end if;
    -- positivo: sconto 10% valido (resta sopra costo: 100*1.3*0.9=117 > 100)
    insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_discount_percent) values (v_q,'V2',100,'00000000-aaaa-0000-0000-000000000005',10);
    raise notice 'C3-T1 OK (sconti negativi rifiutati; 10%% ok)';
  end$$;
rollback;

-- ── C3-T2 · markup ≥ 0 (D-02): -100 rifiutato, 30 ok ──────────────────────
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_bad boolean:=false;
  begin
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','BOZZA',gen_random_uuid(),1,30);
    -- markup negativo bloccato (CHECK >=0, oppure il blocco sotto-costo che scatta prima)
    begin insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent) values (v_q,'V',100,'00000000-aaaa-0000-0000-000000000005',-100);
    exception when others then if sqlerrm like '%qitems_markup_range%' or sqlerrm like '%item_below_cost%' then v_bad:=true; else raise; end if; end;
    if not v_bad then raise exception 'FAIL C3-T2: markup -100 accettato'; end if;
    insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent) values (v_q,'V2',100,'00000000-aaaa-0000-0000-000000000005',30);
    raise notice 'C3-T2 OK (markup -100 rifiutato; 30 ok)';
  end$$;
rollback;

-- ── C3-T3 · markup 1000 storabile (D-06), 1001 rifiutato ──────────────────
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_bad boolean:=false; v_mk numeric;
  begin
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','BOZZA',gen_random_uuid(),1,30);
    insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent) values (v_q,'V',100,'00000000-aaaa-0000-0000-000000000005',1000);
    select item_markup_percent into v_mk from quote_items where quote_id=v_q;
    if v_mk <> 1000 then raise exception 'FAIL C3-T3: markup 1000 non memorizzato (=%)',v_mk; end if;
    begin insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent) values (v_q,'V2',100,'00000000-aaaa-0000-0000-000000000005',1001);
    exception when check_violation then v_bad:=true; end;
    if not v_bad then raise exception 'FAIL C3-T3: markup 1001 accettato'; end if;
    raise notice 'C3-T3 OK (markup 1000 storabile; 1001 rifiutato)';
  end$$;
rollback;

-- ── C3-T4 · voce di terzi sotto-costo bloccata (D-03/D-14); sopra-costo ok ──
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_b1 boolean:=false; v_b2 boolean:=false; v_lc numeric;
  begin
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','BOZZA',gen_random_uuid(),1,0);
    -- markup 0 + sconto 90% → sotto-costo → blocco
    begin insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent,item_discount_percent) values (v_q,'V',1000,'00000000-aaaa-0000-0000-000000000005',0,90);
    exception when others then if sqlerrm like '%item_below_cost%' then v_b1:=true; else raise; end if; end;
    -- sconto 100% (gratis) su terzi → blocco
    begin insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent,item_discount_percent) values (v_q,'V',1000,'00000000-aaaa-0000-0000-000000000005',30,100);
    exception when others then if sqlerrm like '%item_below_cost%' then v_b2:=true; else raise; end if; end;
    if not (v_b1 and v_b2) then raise exception 'FAIL C3-T4: sotto-costo non bloccato (90%%=% 100%%=%)',v_b1,v_b2; end if;
    -- positivo: markup 30, sconto 10 → sopra costo
    insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,item_markup_percent,item_discount_percent) values (v_q,'V2',1000,'00000000-aaaa-0000-0000-000000000005',30,10);
    select line_client into v_lc from quote_items where quote_id=v_q and name_snapshot='V2';
    if v_lc < 1000 then raise exception 'FAIL C3-T4: voce legittima sotto costo (line=%)',v_lc; end if;
    raise notice 'C3-T4 OK (terzi sotto-costo bloccato; sopra-costo ok line=%)',v_lc;
  end$$;
rollback;

-- ── C3-T5 · D-18: lo sconto non azzera il costo proprio reale ──────────────
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_cost numeric; v_margin numeric;
  begin
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','BOZZA',gen_random_uuid(),1,0);
    insert into quote_items(quote_id,name_snapshot,snapshot_price,erogatore_e_capostipite) values (v_q,'Servizio proprio',1000,true);
    update quotes set total_discount_percent=100 where id=v_q;
    select total_cost, margin_amount into v_cost, v_margin from quotes where id=v_q;
    if v_cost <> 1000 then raise exception 'FAIL C3-T5: total_cost azzerato dallo sconto (=%, atteso 1000)',v_cost; end if;
    if v_margin <> -1000 then raise exception 'FAIL C3-T5: margine non riflette la perdita (=%, atteso -1000)',v_margin; end if;
    raise notice 'C3-T5 OK (sconto 100%%: total_cost resta 1000, margine -1000 VISIBILE)';
  end$$;
rollback;

-- ── C3-T6 · B-01: niente doppia opzione stessa data; range invertito rifiutato;
--    data libera ok ──────────────────────────────────────────────────────────
begin;
  do $$
  declare v_r1 jsonb; v_r2 jsonb; v_r3 jsonb; v_r4 jsonb;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000005','role','authenticated')::text, true);
    v_r1 := public.opziona_data('2026-12-12','2026-12-12',7,'Cliente A',null,null);
    v_r2 := public.opziona_data('2026-12-12','2026-12-12',7,'Cliente B',null,null);
    if v_r1->>'ok' is distinct from 'true' then raise exception 'FAIL C3-T6: prima opzione fallita (%)',v_r1; end if;
    if v_r2->>'error' is distinct from 'date_already_optioned' then raise exception 'FAIL C3-T6: seconda opzione non rifiutata (%)',v_r2; end if;
    v_r3 := public.opziona_data('2026-12-20','2026-12-10',7,'range bad',null,null);
    if v_r3->>'error' is distinct from 'invalid_range' then raise exception 'FAIL C3-T6: range invertito non rifiutato (%)',v_r3; end if;
    v_r4 := public.opziona_data('2026-12-25','2026-12-25',7,'libera',null,null);
    if v_r4->>'ok' is distinct from 'true' then raise exception 'FAIL C3-T6: data libera non opzionata (%)',v_r4; end if;
    raise notice 'C3-T6 OK (doppia opzione rifiutata; range invertito rifiutato; data libera ok)';
  end$$;
rollback;

-- ── C3-T7 · B-03: optimistic lock su quotes (lost update rilevato) ──────────
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_r jsonb;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000002','role','authenticated')::text, true);
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Originale','2027-05-01','BOZZA',gen_random_uuid(),1);
    -- "tab B" salva con versione corretta (0) → ok, versione passa a 1
    v_r := quote_save_guarded(v_q, 0, jsonb_build_object('title','EDIT_B'));
    if v_r->>'ok' is distinct from 'true' then raise exception 'FAIL C3-T7: save valido fallito (%)',v_r; end if;
    -- "tab A" salva con versione stantia (0) → stale, niente sovrascrittura
    v_r := quote_save_guarded(v_q, 0, jsonb_build_object('title','EDIT_A'));
    if v_r->>'error' is distinct from 'stale_version' then raise exception 'FAIL C3-T7: lost update non rilevato (%)',v_r; end if;
    if (select title from quotes where id=v_q) <> 'EDIT_B' then raise exception 'FAIL C3-T7: EDIT_B sovrascritto da save stantio'; end if;
    raise notice 'C3-T7 OK (save valido ok; save stantio = stale_version, EDIT_B preservato)';
  end$$;
rollback;

do $$ begin raise notice 'CLUSTER 3 — regressione verde: completata'; end$$;
