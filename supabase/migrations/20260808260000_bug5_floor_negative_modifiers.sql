-- ============================================================================
-- BUG5: i modificatori di voce (modifiers_applied, jsonb senza CHECK) potevano
-- rendere v_base NEGATIVO (PERCENT <= -100 o FIXED molto negativo) → line_cost /
-- line_client negativi nei totali (e la condizione subtotal=0 del BUG4). Solo
-- item_discount_percent è vincolato 0..100; i modificatori no.
-- Fix: floor di v_base a 0 dopo l'applicazione dei modificatori. Resto invariato.
-- ============================================================================

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

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_cost := new.line_client;
  else
    -- voce di terzi: il prezzo al cliente non può scendere sotto il costo fornitore
    if v_include and new.line_client < new.line_cost then
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
