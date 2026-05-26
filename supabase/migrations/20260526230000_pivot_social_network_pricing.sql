-- ============================================================================
-- PIVOT MODEL — Planfully diventa social network del settore eventi italiani.
-- I capostipiti (WP/Location) sono SEMPRE GRATIS: sono il side scarso del
-- two-sided network, vanno acquisiti senza friction. I fornitori hanno trial
-- di 90 giorni dalla registrazione, poi paywall a €29/mese (Plus) o €79/mese
-- (Premium) — monetizzazione concentrata sul lato dell'offerta.
-- ============================================================================

-- 1) Aggiorna messaggi banner per ruolo
update beta_status
   set is_beta       = false,
       free_until    = null,
       planned_price = null,
       message_short = 'Account gratuito per WP e Location.',
       message_long  = 'Su Planfully chi orchestra eventi (Wedding Planner e Location) non paga mai. Costruisci la tua rete privata di fornitori di fiducia e gestisci tutti i tuoi eventi senza commissioni. Sei tu il centro del network.'
 where role = 'wedding_planner';

update beta_status
   set is_beta       = true,
       free_until    = null,                 -- ora dipende dal trial individuale
       planned_price = 29.00,
       planned_period = 'mensile',
       message_short = 'Hai 90 giorni di prova gratis. Costruisci il tuo profilo e candidati alle reti dei capostipiti.',
       message_long  = 'Per i fornitori Planfully è gratis per i primi 90 giorni dalla registrazione: tempo sufficiente per completare il profilo, ricevere candidature, lavorare ai primi eventi. Dopo la prova: Plus €29/mese (profilo completo + analytics) oppure Premium €79/mese (boost visibilità nel feed pubblico + candidatura proattiva agli eventi pubblicati dai WP).'
 where role = 'supplier';

-- 2) Trial individuale per ogni fornitore (90 giorni dal signup)
alter table profiles
  add column if not exists trial_started_at  timestamptz,
  add column if not exists subscription_status text default 'TRIAL' check (subscription_status in ('TRIAL','PLUS','PREMIUM','EXPIRED','LIFETIME')),
  add column if not exists subscription_renews_at timestamptz;

-- Default: chiunque registrato come FORNITORE eredita trial_started_at = created_at
update profiles
   set trial_started_at = coalesce(trial_started_at, created_at)
 where role = 'FORNITORE'
   and trial_started_at is null;

-- I capostipiti hanno subscription LIFETIME (gratis per sempre)
update profiles
   set subscription_status = 'LIFETIME'
 where role in ('WEDDING_PLANNER','LOCATION','ADMIN');

-- 3) Trigger: nuovo fornitore registrato → trial parte automaticamente
create or replace function set_trial_on_supplier_signup()
returns trigger
language plpgsql
as $$
begin
  if NEW.role = 'FORNITORE' and NEW.trial_started_at is null then
    NEW.trial_started_at := now();
    NEW.subscription_status := 'TRIAL';
  elsif NEW.role in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    NEW.subscription_status := 'LIFETIME';
  end if;
  return NEW;
end$$;

drop trigger if exists trg_trial_on_supplier_signup on profiles;
create trigger trg_trial_on_supplier_signup
  before insert on profiles
  for each row execute function set_trial_on_supplier_signup();

-- 4) View comoda: stato trial corrente
create or replace view supplier_trial_status
  with (security_invoker = true)
  as
  select
    p.id                                      as supplier_id,
    p.trial_started_at,
    case
      when p.subscription_status in ('PLUS','PREMIUM','LIFETIME') then null
      when p.trial_started_at is null then null
      else (p.trial_started_at + interval '90 days')
    end                                       as trial_ends_at,
    case
      when p.subscription_status in ('PLUS','PREMIUM','LIFETIME') then 'ACTIVE'
      when p.trial_started_at is null then 'NO_TRIAL'
      when (p.trial_started_at + interval '90 days') > now() then 'TRIAL_ACTIVE'
      else 'TRIAL_EXPIRED'
    end                                       as state,
    case
      when p.subscription_status in ('PLUS','PREMIUM','LIFETIME') then null
      when p.trial_started_at is null then null
      else greatest(0, extract(day from (p.trial_started_at + interval '90 days') - now())::int)
    end                                       as days_left,
    p.subscription_status,
    p.subscription_renews_at
  from profiles p
  where p.id = auth.uid();

grant select on supplier_trial_status to authenticated;

comment on column profiles.trial_started_at is
  'Inizio del trial 90 giorni per i fornitori. Settato automaticamente al signup. NULL per ruoli non-fornitore.';
comment on column profiles.subscription_status is
  'Stato corrente: TRIAL (entro 90gg), PLUS/PREMIUM (paganti), EXPIRED (trial scaduto), LIFETIME (WP/Location gratis per sempre).';
