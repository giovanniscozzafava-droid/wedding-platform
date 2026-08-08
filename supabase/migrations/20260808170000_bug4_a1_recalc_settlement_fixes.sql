-- ============================================================================
-- Fix regressioni di sessione trovate dal secondo giro di audit:
--  BUG4: in quotes_recalc_totals (fix M1) la pro-quota dello sconto fisso usava
--        v_amt * v_sub_sel / nullif(v_subtotal,0): se v_subtotal=0 ma il subset
--        accettato > 0, dava NULL -> total_client_selected NULL -> acconto/atto
--        ripiegavano al pieno silenziosamente. Ora coalesce(...,0).
--  A1:   _populate_network_settlements (fix N2) filtrava SOLO client_decision=
--        ACCETTATO: sulla FIRMA INTERA (tutte le voci IN_ATTESA) il registro
--        restava VUOTO. Allineato a R1/M2: se c e selezione per-voce usa
--        ACCETTATO, altrimenti tutte le voci non RIFIUTATO.
-- ============================================================================

create or replace function public.quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost_raw numeric; v_subtotal numeric; v_own_client numeric; v_cost_third numeric;
  v_client numeric; v_cost numeric; v_factor numeric; v_pct numeric; v_amt numeric;
  v_discounted numeric; v_owner uuid; v_date date; v_sur jsonb; v_sur_pct numeric;
  v_km numeric; v_dist jsonb; v_dist_amt numeric;
  v_sub_sel numeric; v_disc_sel numeric; v_client_sel numeric;
begin
  select coalesce(sum(line_cost),0),
         coalesce(sum(line_client),0),
         coalesce(sum(line_client) filter (where coalesce(erogatore_e_capostipite,false)),0),
         coalesce(sum(line_client) filter (where client_decision = 'ACCETTATO'),0)
    into v_cost_raw, v_subtotal, v_own_client, v_sub_sel
    from public.quote_items where quote_id = p_quote_id;
  v_cost_third := v_cost_raw - v_own_client;

  select coalesce(total_discount_percent,0), coalesce(total_discount_amount,0), owner_id, event_date, distance_km
    into v_pct, v_amt, v_owner, v_date, v_km
    from public.quotes where id = p_quote_id;

  -- prezzo cliente dopo lo SCONTO (base per il fattore costo)
  v_discounted := round(v_subtotal * (1 - v_pct / 100.0) - v_amt, 2);
  if v_discounted < 0 then v_discounted := 0; end if;
  v_factor := case when v_subtotal > 0 then v_discounted / v_subtotal else 1 end;
  v_cost := round(v_cost_third + v_own_client * v_factor, 2);

  -- MAGGIORAZIONE % (weekend/stagione/date) sul prezzo scontato
  v_sur := public.quote_compute_surcharge(v_owner, v_date);
  v_sur_pct := coalesce((v_sur->>'percent')::numeric, 0);
  v_client := round(v_discounted * (1 + v_sur_pct / 100.0), 2);

  -- TRASFERTA (€/km oltre soglia): importo assoluto, puro markup lato cliente
  v_dist := public.quote_compute_distance_surcharge(v_owner, v_km);
  v_dist_amt := coalesce((v_dist->>'amount')::numeric, 0);
  v_client := round(v_client + v_dist_amt, 2);

  -- TOTALE SCELTO: stessa trasformazione ma sul subtotale delle voci accettate. 0 se nessuna scelta.
  if v_sub_sel <= 0 then
    v_client_sel := 0;
  else
    -- M1: sconto fisso € riproporzionato sul subset accettato (non sottratto intero).
    -- BUG4: coalesce a 0 se v_subtotal=0 (evita total_client_selected NULL).
    v_disc_sel := round(v_sub_sel * (1 - v_pct / 100.0) - coalesce(v_amt * v_sub_sel / nullif(v_subtotal, 0), 0), 2);
    if v_disc_sel < 0 then v_disc_sel := 0; end if;
    v_client_sel := round(round(v_disc_sel * (1 + v_sur_pct / 100.0), 2) + v_dist_amt, 2);
  end if;

  update public.quotes
     set subtotal_client   = v_subtotal,
         surcharge_percent  = v_sur_pct,
         surcharge_detail   = coalesce(v_sur->'detail', '[]'::jsonb),
         distance_surcharge = v_dist_amt,
         distance_detail    = coalesce(v_dist->'detail', '[]'::jsonb),
         total_cost         = v_cost,
         total_client       = v_client,
         total_client_selected = v_client_sel,
         margin_amount      = v_client - v_cost,
         margin_percent     = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at         = now()
   where id = p_quote_id;
end$$;


create or replace function public._populate_network_settlements(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mode text; v_entry uuid; v_has_sel boolean;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return; end if;
  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from public.profiles where id = v_owner;
  select id into v_entry from public.calendar_entries where quote_id = p_quote_id limit 1;
  -- A1: c'è una selezione per-voce? (come R1/M2). Se sì conta solo le ACCETTATO;
  -- se no (firma intera, voci IN_ATTESA) conta tutte le voci non rifiutate.
  select coalesce(total_client_selected, 0) > 0 into v_has_sel from public.quotes where id = p_quote_id;

  insert into public.network_settlements (quote_id, entry_id, capostipite_id, supplier_id, direction, amount_due)
  select p_quote_id, v_entry, v_owner, t.supplier_id, t.direction, t.amount
  from (
    select qi.supplier_id,
           case when v_mode = 'ITEMIZED' then 'SUPPLIER_OWES_CAPOSTIPITE' else 'CAPOSTIPITE_OWES_SUPPLIER' end as direction,
           -- BUNDLE: il capostipite deve il COSTO; ITEMIZED: il fornitore deve il MARGINE.
           case when v_mode = 'ITEMIZED' then round(sum(qi.line_client - qi.line_cost), 2)
                else round(sum(qi.line_cost), 2) end as amount
      from public.quote_items qi
     where qi.quote_id = p_quote_id
       and qi.supplier_id is not null
       and qi.supplier_id <> v_owner                            -- non con te stesso
       and coalesce(qi.erogatore_e_capostipite, false) = false  -- non i servizi propri
       and (case when v_has_sel then qi.client_decision = 'ACCETTATO'
                 else qi.client_decision <> 'RIFIUTATO' end)     -- A1: fallback firma intera
     group by qi.supplier_id
  ) t
  where t.amount > 0
  on conflict (quote_id, supplier_id) do update
    set amount_due = excluded.amount_due,
        direction  = excluded.direction,
        status     = case when public.network_settlements.amount_paid >= excluded.amount_due then 'SALDATO'
                          when public.network_settlements.amount_paid > 0 then 'PARZIALE'
                          else 'MATURATO' end,
        updated_at = now();

  -- N3: rimuovi i conti orfani — fornitore non più tra le voci accettate — MA
  -- conserva quelli con un pagamento già registrato (traccia di denaro reale mosso).
  delete from public.network_settlements ns
   where ns.quote_id = p_quote_id
     and ns.amount_paid = 0
     and ns.supplier_id not in (
       select qi.supplier_id from public.quote_items qi
        where qi.quote_id = p_quote_id and qi.supplier_id is not null
          and qi.supplier_id <> v_owner
          and coalesce(qi.erogatore_e_capostipite, false) = false
          and (case when v_has_sel then qi.client_decision = 'ACCETTATO'
                    else qi.client_decision <> 'RIFIUTATO' end)
     );
end$$;
revoke all on function public._populate_network_settlements(uuid) from public, anon, authenticated;  -- N7
