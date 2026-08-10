-- ============================================================================
-- OMAGGIO: il professionista può regalare una singola voce al cliente (azzera il
-- prezzo cliente). La voce esce come "omaggio" nel preventivo/PDF. Il costo del
-- fornitore resta a carico del capostipite (per i servizi propri si azzera).
-- Il check "sotto-costo" è saltato per gli omaggi (è intenzionale).
-- ============================================================================

alter table public.quote_items add column if not exists is_gift boolean not null default false;
comment on column public.quote_items.is_gift is 'Voce regalata al cliente (omaggio): line_client = 0, mostrata come "omaggio".';

create or replace function quote_items_recalc_lines_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_base numeric; v_mod jsonb; v_type text; v_value numeric; v_markup_pct numeric; v_include boolean;
begin
  v_base := coalesce(new.snapshot_price, 0) * coalesce(new.quantity, 0);
  if jsonb_typeof(new.modifiers_applied) = 'array' then
    for v_mod in select * from jsonb_array_elements(new.modifiers_applied) loop
      v_type := v_mod->>'type'; v_value := coalesce((v_mod->>'value')::numeric, 0);
      if v_type = 'PERCENT' then v_base := v_base * (1 + v_value / 100.0);
      elsif v_type = 'FIXED' then v_base := v_base + v_value; end if;
    end loop;
  end if;
  -- BUG5: i modificatori non possono portare la voce sotto zero.
  if v_base < 0 then v_base := 0; end if;
  v_include := not coalesce(new.is_optional, false) or coalesce(new.selected_by_client, false);
  if not v_include then v_base := 0; end if;
  new.line_cost := round(v_base, 2);

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_client := new.line_cost;
  else
    v_markup_pct := calcola_markup_effettivo(new.quote_id, new.supplier_id, new.item_markup_percent);
    new.line_client := round(new.line_cost * (1 + coalesce(v_markup_pct, 0) / 100.0), 2);
  end if;

  if coalesce(new.item_discount_percent, 0) <> 0 then
    new.line_client := round(new.line_client * (1 - new.item_discount_percent / 100.0), 2);
    if new.line_client < 0 then new.line_client := 0; end if;
  end if;

  -- OMAGGIO: prezzo cliente azzerato (il costo fornitore resta a carico del
  -- capostipite; per i servizi propri si azzera anche il costo poco sotto).
  if coalesce(new.is_gift, false) then new.line_client := 0; end if;

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_cost := new.line_client;
  else
    -- voce di terzi: il prezzo al cliente non può scendere sotto il costo fornitore,
    -- SALVO l'OMAGGIO (dove è intenzionale: il capostipite assorbe il costo).
    if v_include and not coalesce(new.is_gift, false) and new.line_client < new.line_cost then
      raise exception 'item_below_cost'
        using hint = 'Voce di terzi sotto-costo: prezzo cliente ' || new.line_client || ' < costo ' || new.line_cost || '. Riduci lo sconto o alza il markup.';
    end if;
  end if;

  if coalesce(new.paid_amount, 0) > new.line_client then new.paid_amount := new.line_client; end if;
  if coalesce(new.paid_amount, 0) <= 0 then
    new.paid_amount := 0; new.payment_status := 'NON_PAGATO'; new.paid_at := null;
  end if;
  return new;
end$$;

-- Ricalcola tutte le voci (nessun omaggio ancora → nessun cambiamento, ma allinea).
update public.quote_items set updated_at = now();
