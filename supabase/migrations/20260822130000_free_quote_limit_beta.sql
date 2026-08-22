-- BUG (bloccante, reale): un professionista non riesce a creare un preventivo → "Errore" nudo.
-- Causa: enforce_free_quote_limit blocca a 10 preventivi attivi per i tier FREE. Ma siamo in BETA
-- (beta_status.is_beta = true) e NON si può nemmeno passare a PREMIUM (Stripe dormiente) → il limite
-- è un muro invalicabile per chi ha >=10 preventivi. Fix: il limite NON si applica finché il RUOLO
-- del professionista è in beta; si riattiva da solo quando la beta finisce (is_beta=false).
create or replace function public.enforce_free_quote_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tier   subscription_tier;
  v_role   text;
  v_beta   boolean;
  v_count  int;
begin
  select subscription_tier, role::text into v_tier, v_role from public.profiles where id = new.owner_id;
  if v_tier <> 'FREE' then return new; end if;

  -- Beta del ruolo del professionista: FORNITORE→supplier, WP→wedding_planner, LOCATION→location.
  select coalesce((select is_beta from public.beta_status where role = case v_role
      when 'FORNITORE' then 'supplier'
      when 'WEDDING_PLANNER' then 'wedding_planner'
      when 'LOCATION' then 'location'
      else 'supplier' end), false)
    into v_beta;
  if v_beta then return new; end if;   -- in beta: nessun limite (non c'è modo di passare a PREMIUM)

  select count(*) into v_count from public.quotes
    where owner_id = new.owner_id and status in ('BOZZA','INVIATO','ACCETTATO');
  if v_count >= 10 then
    raise exception 'Hai raggiunto il limite di 10 preventivi attivi del piano FREE. Aggiorna a PREMIUM o archivia preventivi vecchi.'
      using errcode = 'P0001';
  end if;
  return new;
end$$;
