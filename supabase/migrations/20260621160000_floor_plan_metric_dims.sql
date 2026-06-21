-- PIANTINA IN SCALA: misure reali della sala (metri). La sala può esistere SENZA immagine
-- (solo metratura → planimetria generica in scala), quindi image_url diventa opzionale.
-- I dati sala restano riusabili dalla libreria del proprietario (floor_plans) per i prossimi eventi.

alter table public.floor_plans
  alter column image_url drop not null;
alter table public.floor_plans
  add column if not exists width_m  real,
  add column if not exists length_m real;

alter table public.event_floor_plans
  alter column image_url drop not null;
alter table public.event_floor_plans
  add column if not exists width_m    real,
  add column if not exists length_m   real,
  add column if not exists venue_name text,
  add column if not exists room_name  text;

comment on column public.event_floor_plans.width_m  is 'Larghezza reale sala (m) per disegnare in scala';
comment on column public.event_floor_plans.length_m is 'Profondità reale sala (m) per disegnare in scala';
