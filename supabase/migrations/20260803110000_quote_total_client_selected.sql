-- Totale "scelto dal cliente": nelle viste riepilogative (card lista preventivi, home, dashboard
-- coppia) il totale deve riflettere SOLO le voci che il cliente ha accettato (client_decision =
-- 'ACCETTATO'), e valere 0 finché non ne sceglie nessuna. Le viste del DOCUMENTO preventivo (editor,
-- PDF, pagina pubblica di accettazione) continuano a usare total_client (l'offerta piena).
--
-- Manteniamo il valore lato DB (colonna total_client_selected) così tutte le liste che caricano solo
-- il riepilogo del preventivo (senza le voci) possono mostrarlo senza query extra. Ricalcolato dallo
-- stesso quotes_recalc_totals, che scatta anche quando cambia client_decision (trigger AFTER UPDATE
-- su quote_items). Rispecchia la stessa trasformazione del totale pieno (sconto% + maggiorazione% +
-- trasferta) ma sul subtotale delle sole voci accettate ⇒ coincide con total_client quando tutte le
-- voci sono accettate, vale 0 se nessuna.

alter table public.quotes add column if not exists total_client_selected numeric not null default 0;

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
    v_disc_sel := round(v_sub_sel * (1 - v_pct / 100.0) - v_amt, 2);
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

-- Backfill: ricalcola tutti i preventivi così total_client_selected viene popolato.
do $$ declare r record; begin
  for r in select id from public.quotes loop perform public.quotes_recalc_totals(r.id); end loop;
end $$;
