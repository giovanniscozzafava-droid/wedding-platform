-- ============================================================================
-- MAGGIORAZIONE PREZZO AUTOMATICA (weekend / stagione ricorrente / date specifiche).
-- Regole per professionista; il compilatore le applica in base a quotes.event_date, le SOMMA,
-- e le mostra come voci nel preventivo. Integrata in quotes_recalc_totals → coerente ovunque
-- (editor, preview cliente, PDF, acconto Stripe che usa total_client).
-- ============================================================================

create table if not exists public.price_surcharges (
  id           uuid primary key default gen_random_uuid(),
  fornitore_id uuid not null references public.profiles(id) on delete cascade,
  label        text not null,
  kind         text not null check (kind in ('WEEKEND','SEASON','DATES')),
  percent      numeric(5,2) not null check (percent > 0 and percent <= 100),
  date_from    date,   -- SEASON: si usa solo giorno-mese (anno ignorato); DATES: data piena
  date_to      date,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists idx_price_surcharges_owner on public.price_surcharges(fornitore_id) where active;
alter table public.price_surcharges enable row level security;
drop policy if exists price_surcharges_owner on public.price_surcharges;
create policy price_surcharges_owner on public.price_surcharges
  for all using (fornitore_id = auth.uid()) with check (fornitore_id = auth.uid());

-- snapshot sul preventivo: percentuale totale + dettaglio voci applicate
alter table public.quotes add column if not exists surcharge_percent numeric(6,2) not null default 0;
alter table public.quotes add column if not exists surcharge_detail  jsonb not null default '[]'::jsonb;

-- Maggiorazione totale + dettaglio per un professionista a una certa data (somma delle regole attive).
create or replace function public.quote_compute_surcharge(p_owner uuid, p_date date)
returns jsonb language sql stable security definer set search_path = public as $$
  with applic as (
    select label, percent from public.price_surcharges s
    where s.fornitore_id = p_owner and s.active and p_date is not null and (
      (s.kind = 'WEEKEND' and extract(isodow from p_date) in (6,7))
      or (s.kind = 'DATES' and s.date_from is not null and s.date_to is not null
          and p_date between s.date_from and s.date_to)
      or (s.kind = 'SEASON' and s.date_from is not null and s.date_to is not null and (
            case
              when to_char(s.date_from,'MM-DD') <= to_char(s.date_to,'MM-DD')
                then to_char(p_date,'MM-DD') between to_char(s.date_from,'MM-DD') and to_char(s.date_to,'MM-DD')
              else -- stagione che scavalca il capodanno (es. dic → feb)
                to_char(p_date,'MM-DD') >= to_char(s.date_from,'MM-DD')
                or to_char(p_date,'MM-DD') <= to_char(s.date_to,'MM-DD')
            end))
    )
  )
  select jsonb_build_object(
    'percent', coalesce((select sum(percent) from applic), 0),
    'detail',  coalesce((select jsonb_agg(jsonb_build_object('label', label, 'percent', percent)) from applic), '[]'::jsonb)
  );
$$;
grant execute on function public.quote_compute_surcharge(uuid, date) to authenticated;

-- Ricalcolo totali del preventivo, ORA con la maggiorazione automatica.
-- (rispetto alla versione precedente: separo il fattore di sconto — che scala il costo dei propri —
--  dalla maggiorazione, che è puro markup lato cliente e NON deve gonfiare il costo).
create or replace function public.quotes_recalc_totals(p_quote_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cost_raw numeric; v_subtotal numeric; v_own_client numeric; v_cost_third numeric;
  v_client numeric; v_cost numeric; v_factor numeric; v_pct numeric; v_amt numeric;
  v_discounted numeric; v_owner uuid; v_date date; v_sur jsonb; v_sur_pct numeric;
begin
  select coalesce(sum(line_cost),0),
         coalesce(sum(line_client),0),
         coalesce(sum(line_client) filter (where coalesce(erogatore_e_capostipite,false)),0)
    into v_cost_raw, v_subtotal, v_own_client
    from public.quote_items where quote_id = p_quote_id;
  v_cost_third := v_cost_raw - v_own_client;

  select coalesce(total_discount_percent,0), coalesce(total_discount_amount,0), owner_id, event_date
    into v_pct, v_amt, v_owner, v_date
    from public.quotes where id = p_quote_id;

  -- prezzo cliente dopo lo SCONTO (base per il fattore costo)
  v_discounted := round(v_subtotal * (1 - v_pct / 100.0) - v_amt, 2);
  if v_discounted < 0 then v_discounted := 0; end if;
  v_factor := case when v_subtotal > 0 then v_discounted / v_subtotal else 1 end;
  v_cost := round(v_cost_third + v_own_client * v_factor, 2);

  -- MAGGIORAZIONE automatica (weekend/stagione/date) sul prezzo scontato
  v_sur := public.quote_compute_surcharge(v_owner, v_date);
  v_sur_pct := coalesce((v_sur->>'percent')::numeric, 0);
  v_client := round(v_discounted * (1 + v_sur_pct / 100.0), 2);

  update public.quotes
     set subtotal_client  = v_subtotal,
         surcharge_percent = v_sur_pct,
         surcharge_detail  = coalesce(v_sur->'detail', '[]'::jsonb),
         total_cost        = v_cost,
         total_client      = v_client,
         margin_amount     = v_client - v_cost,
         margin_percent    = case when v_cost > 0 then round(((v_client - v_cost) / v_cost) * 100, 2) else 0 end,
         updated_at        = now()
   where id = p_quote_id;
end$$;

-- Ricalcola la maggiorazione quando cambia la data evento (il ricalcolo NON tocca event_date →
-- il trigger "of event_date" non si ri-innesca: nessuna ricorsione).
create or replace function public.tg_quote_recalc_on_date()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.quotes_recalc_totals(new.id);
  return new;
end$$;
drop trigger if exists trg_quote_recalc_on_date on public.quotes;
create trigger trg_quote_recalc_on_date
  after update of event_date on public.quotes
  for each row execute function public.tg_quote_recalc_on_date();

-- Popola i nuovi campi su tutti i preventivi esistenti.
do $$ declare r record; begin
  for r in select id from public.quotes loop perform public.quotes_recalc_totals(r.id); end loop;
end $$;
