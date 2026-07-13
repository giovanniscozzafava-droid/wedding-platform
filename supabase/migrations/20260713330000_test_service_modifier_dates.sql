-- TEST: supplemento per-servizio con data → matcha solo alla data giusta e alza il prezzo (self-cleaning).
do $$
declare
  v_owner uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';
  v_cat uuid; v_svc uuid; v_quote uuid; v_item uuid;
  v_date date := '2031-09-05'; v_other date := '2031-09-06';
  v_mods_match jsonb; v_mods_no jsonb; v_lc numeric;
begin
  if not exists (select 1 from public.profiles where id = v_owner) then raise notice 'TEST SALTATO'; return; end if;
  select id into v_cat from public.service_categories where is_standard limit 1;
  if v_cat is null then raise notice 'TEST SALTATO: nessuna categoria'; return; end if;

  -- servizio + supplemento datato (+20% solo il v_date)
  insert into public.services(fornitore_id, category_id, name, base_price, unit, is_active)
    values (v_owner, v_cat, 'TEST SVC SUPPL', 100, 'EVENTO', true) returning id into v_svc;
  insert into public.service_modifiers(service_id, name, modifier_type, value, date_from, date_to)
    values (v_svc, 'Supplemento data clou', 'PERCENT', 20, v_date, v_date);

  -- 1) la funzione matcha SOLO alla data giusta
  v_mods_match := public.service_modifiers_for_date(v_svc, v_date);
  v_mods_no    := public.service_modifiers_for_date(v_svc, v_other);
  if jsonb_array_length(v_mods_match) <> 1 then raise exception 'FALLITO: atteso 1 modifier alla data, trovato %', v_mods_match; end if;
  if jsonb_array_length(v_mods_no) <> 0 then raise exception 'FALLITO: fuori data non doveva matchare, trovato %', v_mods_no; end if;

  -- 2) in preventivo il prezzo riflette il supplemento (trigger su quote_items)
  insert into public.quotes(owner_id, title, event_date) values (v_owner, 'TEST SVC SUPPL', v_date) returning id into v_quote;
  insert into public.quote_items(quote_id, name_snapshot, snapshot_price, quantity, unit_snapshot, modifiers_applied)
    values (v_quote, 'TEST SVC SUPPL', 100, 1, 'EVENTO', v_mods_match) returning id into v_item;
  select line_cost into v_lc from public.quote_items where id = v_item;
  if v_lc <> 120 then raise exception 'FALLITO: line_cost atteso 120 (100 +20%%), trovato %', v_lc; end if;

  -- pulizia
  delete from public.quote_items where id = v_item;
  delete from public.quotes where id = v_quote;
  delete from public.service_modifiers where service_id = v_svc;
  delete from public.services where id = v_svc;

  raise notice 'TEST SUPPLEMENTO DATATO: OK (matcha solo alla data giusta, in preventivo 100 → 120 col +20%%)';
end $$;
