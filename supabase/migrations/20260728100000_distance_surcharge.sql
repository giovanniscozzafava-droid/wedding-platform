-- ============================================================================
-- MAGGIORAZIONE TRASFERTA (per distanza km dal punto di partenza del professionista).
-- Nuovo kind 'DISTANCE' in price_surcharges: soglia gratuita (free_km) + tariffa €/km (per_km),
-- con un punto di partenza (base_place). I km sono inseriti a mano nel preventivo (quotes.distance_km):
-- niente geocoding. L'importo = max(0, km - free_km) * per_km ed è puro markup lato cliente,
-- integrato in quotes_recalc_totals (coerente in editor, preview, PDF, acconto Stripe).
-- ============================================================================

alter table public.price_surcharges
  add column if not exists per_km     numeric(8,2),
  add column if not exists free_km    numeric(6,1) not null default 0,
  add column if not exists base_place text;

-- percent non è più obbligatorio: le regole DISTANCE non lo usano.
-- (il vecchio check `percent > 0 and percent <= 100` con percent NULL resta UNKNOWN → passa.)
alter table public.price_surcharges alter column percent drop not null;

-- ammetti il nuovo kind DISTANCE
alter table public.price_surcharges drop constraint if exists price_surcharges_kind_check;
alter table public.price_surcharges add constraint price_surcharges_kind_check
  check (kind in ('WEEKEND','SEASON','DATES','DISTANCE'));

-- snapshot sul preventivo
alter table public.quotes
  add column if not exists distance_km        numeric(7,1),
  add column if not exists distance_surcharge numeric(12,2) not null default 0,
  add column if not exists distance_detail    jsonb not null default '[]'::jsonb;

-- Importo trasferta per un professionista dati i km del preventivo (somma delle regole DISTANCE attive).
create or replace function public.quote_compute_distance_surcharge(p_owner uuid, p_km numeric)
returns jsonb language sql stable security definer set search_path = public as $$
  with applic as (
    select label,
           round(greatest(0, coalesce(p_km,0) - coalesce(free_km,0)) * coalesce(per_km,0), 2) as amount
      from public.price_surcharges s
     where s.fornitore_id = p_owner and s.active and s.kind = 'DISTANCE'
       and coalesce(p_km,0) > 0 and coalesce(per_km,0) > 0
  )
  select jsonb_build_object(
    'amount', coalesce((select sum(amount) from applic), 0),
    'detail', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'amount', amount)) from applic where amount > 0), '[]'::jsonb)
  );
$$;
grant execute on function public.quote_compute_distance_surcharge(uuid, numeric) to authenticated;

-- Ricalcolo totali del preventivo, ORA con maggiorazione data (%) + trasferta (€/km).
create or replace function public.quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost_raw numeric; v_subtotal numeric; v_own_client numeric; v_cost_third numeric;
  v_client numeric; v_cost numeric; v_factor numeric; v_pct numeric; v_amt numeric;
  v_discounted numeric; v_owner uuid; v_date date; v_sur jsonb; v_sur_pct numeric;
  v_km numeric; v_dist jsonb; v_dist_amt numeric;
begin
  select coalesce(sum(line_cost),0),
         coalesce(sum(line_client),0),
         coalesce(sum(line_client) filter (where coalesce(erogatore_e_capostipite,false)),0)
    into v_cost_raw, v_subtotal, v_own_client
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

  update public.quotes
     set subtotal_client   = v_subtotal,
         surcharge_percent  = v_sur_pct,
         surcharge_detail   = coalesce(v_sur->'detail', '[]'::jsonb),
         distance_surcharge = v_dist_amt,
         distance_detail    = coalesce(v_dist->'detail', '[]'::jsonb),
         total_cost         = v_cost,
         total_client       = v_client,
         margin_amount      = v_client - v_cost,
         margin_percent     = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at         = now()
   where id = p_quote_id;
end$$;

-- Ricalcola quando cambiano i km (il ricalcolo non tocca distance_km → nessuna ricorsione).
create or replace function public.tg_quote_recalc_on_distance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.quotes_recalc_totals(new.id);
  return new;
end$$;
drop trigger if exists trg_quote_recalc_on_distance on public.quotes;
create trigger trg_quote_recalc_on_distance
  after update of distance_km on public.quotes
  for each row execute function public.tg_quote_recalc_on_distance();

-- Ricalcola tutti i preventivi con la nuova logica.
do $$ declare r record; begin
  for r in select id from public.quotes loop perform public.quotes_recalc_totals(r.id); end loop;
end $$;
