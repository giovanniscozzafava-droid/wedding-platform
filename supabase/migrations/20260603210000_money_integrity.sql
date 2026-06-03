-- ============================================================================
-- Integrità economica:
--  * paid_amount (acconto/saldo) non può superare il prezzo cliente della voce
--    né essere negativo. Dopo uno sconto che abbassa line_client, l'acconto va
--    riallineato (altrimenti resta un "pagato" maggiore del dovuto).
--  * percentuali di sconto limitate a [-1000, 100] (negativo = maggiorazione,
--    100 = gratis). Oltre 100 azzererebbe il prezzo sotto costo silenziosamente.
--  * party_size invitati >= 1 (0 falsava i conteggi posti).
-- ----------------------------------------------------------------------------

-- 1) Recalc riga: come prima, ma alla fine riallinea paid_amount a line_client.
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

  if coalesce(new.item_discount_percent, 0) <> 0 then
    new.line_client := round(new.line_client * (1 - new.item_discount_percent / 100.0), 2);
    if new.line_client < 0 then new.line_client := 0; end if;
  end if;

  if coalesce(new.erogatore_e_capostipite, false) then
    new.line_cost := new.line_client;
  end if;

  -- Riallineamento acconto: non può superare il prezzo cliente finale.
  if coalesce(new.paid_amount, 0) > new.line_client then
    new.paid_amount := new.line_client;
  end if;
  if coalesce(new.paid_amount, 0) <= 0 then
    new.paid_amount := 0;
    new.payment_status := 'NON_PAGATO';
    new.paid_at := null;
  end if;

  return new;
end$$;

-- 2) Vincoli DB (verificato: nessun dato fuori range in produzione).
alter table public.quote_items
  add constraint quote_items_paid_nonneg_chk check (paid_amount is null or paid_amount >= 0) not valid;
alter table public.quote_items validate constraint quote_items_paid_nonneg_chk;

alter table public.quote_items
  add constraint quote_items_item_discount_pct_chk
  check (item_discount_percent between -1000 and 100) not valid;
alter table public.quote_items validate constraint quote_items_item_discount_pct_chk;

alter table public.quotes
  add constraint quotes_total_discount_pct_chk
  check (total_discount_percent between -1000 and 100) not valid;
alter table public.quotes validate constraint quotes_total_discount_pct_chk;

alter table public.quotes
  add constraint quotes_total_discount_amt_chk
  check (total_discount_amount >= 0) not valid;
alter table public.quotes validate constraint quotes_total_discount_amt_chk;

alter table public.event_guests
  add constraint event_guests_party_size_chk check (party_size is null or party_size >= 1) not valid;
alter table public.event_guests validate constraint event_guests_party_size_chk;

-- 3) Ricalcola le righe per applicare il riallineamento acconti.
update public.quote_items set updated_at = now();
do $$ declare r record; begin
  for r in select id from public.quotes loop
    perform quotes_recalc_totals(r.id);
  end loop;
end $$;
