-- ============================================================================
-- FIX margine negativo con gli sconti sui SERVIZI PROPRI (no ricarico).
-- Per le voci erogate dal titolare del preventivo (erogatore_e_capostipite =
-- "MIO SERVIZIO · no ricarico") non esiste un costo separato: il "costo" coincide
-- col prezzo. Quindi uno sconto NON deve generare margine negativo: il costo
-- deve seguire il prezzo scontato → margine 0. Il margine resta reale solo per
-- la rivendita di servizi di TERZI (dove lo sconto erode il ricarico).
-- ----------------------------------------------------------------------------

-- 1) Riga: per le voci no-ricarico, dopo lo sconto, allinea il costo al cliente.
create or replace function quote_items_recalc_lines_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base       numeric;
  v_mod        jsonb;
  v_type       text;
  v_value      numeric;
  v_markup_pct numeric;
  v_include    boolean;
begin
  v_base := coalesce(new.snapshot_price, 0) * coalesce(new.quantity, 0);

  if jsonb_typeof(new.modifiers_applied) = 'array' then
    for v_mod in select * from jsonb_array_elements(new.modifiers_applied) loop
      v_type  := v_mod->>'type';
      v_value := coalesce((v_mod->>'value')::numeric, 0);
      if v_type = 'PERCENT' then
        v_base := v_base * (1 + v_value / 100.0);
      elsif v_type = 'FIXED' then
        v_base := v_base + v_value;
      end if;
    end loop;
  end if;

  v_include := not coalesce(new.is_optional, false) or coalesce(new.selected_by_client, false);
  if not v_include then v_base := 0; end if;

  new.line_cost := round(v_base, 2);

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_client := new.line_cost;
  else
    v_markup_pct := calcola_markup_effettivo(new.quote_id, new.supplier_id, new.item_markup_percent);
    new.line_client := round(new.line_cost * (1 + coalesce(v_markup_pct, 0) / 100.0), 2);
  end if;

  -- Sconto di voce sul prezzo cliente (negativo = maggiorazione).
  if coalesce(new.item_discount_percent, 0) <> 0 then
    new.line_client := round(new.line_client * (1 - new.item_discount_percent / 100.0), 2);
    if new.line_client < 0 then new.line_client := 0; end if;
  end if;

  -- SERVIZIO PROPRIO (no ricarico): il costo segue il prezzo scontato → margine 0.
  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_cost := new.line_client;
  end if;

  return new;
end$$;

-- 2) Totali: lo sconto sul totale non deve creare margine negativo sulla quota
--    "servizi propri". Il costo dei servizi propri segue il cliente; il costo
--    dei servizi di terzi resta quello reale.
create or replace function quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost_raw   numeric;   -- somma line_cost (per i propri = già scontato)
  v_subtotal   numeric;   -- somma line_client
  v_own_client numeric;   -- somma line_client dei servizi propri
  v_cost_third numeric;
  v_client     numeric;
  v_cost       numeric;
  v_factor     numeric;
  v_pct        numeric;
  v_amt        numeric;
begin
  select coalesce(sum(line_cost),0),
         coalesce(sum(line_client),0),
         coalesce(sum(line_client) filter (where coalesce(erogatore_e_capostipite,false)),0)
    into v_cost_raw, v_subtotal, v_own_client
    from quote_items where quote_id = p_quote_id;

  v_cost_third := v_cost_raw - v_own_client;   -- per i propri line_cost = line_client

  select coalesce(total_discount_percent,0), coalesce(total_discount_amount,0)
    into v_pct, v_amt
    from quotes where id = p_quote_id;

  v_client := round(v_subtotal * (1 - v_pct / 100.0) - v_amt, 2);
  if v_client < 0 then v_client := 0; end if;

  -- Fattore di sconto totale, applicato anche al costo dei servizi propri.
  v_factor := case when v_subtotal > 0 then v_client / v_subtotal else 1 end;
  v_cost := round(v_cost_third + v_own_client * v_factor, 2);

  update quotes
     set subtotal_client = v_subtotal,
         total_cost      = v_cost,
         total_client    = v_client,
         margin_amount   = v_client - v_cost,
         margin_percent  = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at      = now()
   where id = p_quote_id;
end$$;

-- 3) Ricalcola tutto.
update public.quote_items set updated_at = now();
do $$ declare r record; begin
  for r in select id from public.quotes loop
    perform quotes_recalc_totals(r.id);
  end loop;
end $$;
