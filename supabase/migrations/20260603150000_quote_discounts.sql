-- ============================================================================
-- SCONTI nel preventivo: per SINGOLA voce e sul TOTALE.
-- Percentuale positiva = sconto; negativa = maggiorazione (moltiplica il prezzo).
-- + sconto fisso in € sul totale. Lo sconto agisce sul prezzo CLIENTE (e quindi
-- sul margine), non sul costo.
-- ----------------------------------------------------------------------------

alter table public.quote_items
  add column if not exists item_discount_percent numeric not null default 0;
comment on column public.quote_items.item_discount_percent is
  'Sconto % sul prezzo cliente di questa voce. Negativo = maggiorazione.';

alter table public.quotes
  add column if not exists total_discount_percent numeric not null default 0,
  add column if not exists total_discount_amount  numeric not null default 0,
  add column if not exists subtotal_client numeric;
comment on column public.quotes.total_discount_percent is 'Sconto % sul totale cliente. Negativo = maggiorazione.';
comment on column public.quotes.total_discount_amount  is 'Sconto fisso in € sul totale cliente.';

-- 1) Ricalcolo riga: applica lo sconto di voce dopo il markup.
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

  -- SCONTO di voce sul prezzo cliente (negativo = maggiorazione).
  if coalesce(new.item_discount_percent, 0) <> 0 then
    new.line_client := round(new.line_client * (1 - new.item_discount_percent / 100.0), 2);
    if new.line_client < 0 then new.line_client := 0; end if;
  end if;

  return new;
end$$;

-- 2) Ricalcolo totali: subtotale (somma righe) → applica sconto totale.
create or replace function quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost     numeric;
  v_subtotal numeric;
  v_client   numeric;
  v_pct      numeric;
  v_amt      numeric;
begin
  select coalesce(sum(line_cost),0), coalesce(sum(line_client),0)
    into v_cost, v_subtotal
    from quote_items where quote_id = p_quote_id;

  select coalesce(total_discount_percent,0), coalesce(total_discount_amount,0)
    into v_pct, v_amt
    from quotes where id = p_quote_id;

  v_client := round(v_subtotal * (1 - v_pct / 100.0) - v_amt, 2);
  if v_client < 0 then v_client := 0; end if;

  update quotes
     set subtotal_client = v_subtotal,
         total_cost      = v_cost,
         total_client    = v_client,
         margin_amount   = v_client - v_cost,
         margin_percent  = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at      = now()
   where id = p_quote_id;
end$$;

-- 3) Quando cambia lo sconto totale sul quote, ricalcola (no ricorsione: il
--    recalc aggiorna colonne diverse da quelle osservate).
create or replace function quote_discount_after_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform quotes_recalc_totals(new.id);
  return new;
end$$;

drop trigger if exists trg_quote_discount_recalc on public.quotes;
create trigger trg_quote_discount_recalc
  after update of total_discount_percent, total_discount_amount on public.quotes
  for each row execute function quote_discount_after_change();

-- 4) Ricalcola subito tutti i preventivi esistenti (popola subtotal_client).
update public.quote_items set updated_at = now();  -- ritrigger righe
do $$ declare r record; begin
  for r in select id from public.quotes loop
    perform quotes_recalc_totals(r.id);
  end loop;
end $$;
