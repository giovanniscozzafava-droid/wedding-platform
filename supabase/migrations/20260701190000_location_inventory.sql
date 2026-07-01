-- Magazzino ALLESTIMENTO/attrezzatura per location: tovagliato, piatti, sottopiatti, posate,
-- bicchieri, centrotavola, mise en place, arredo, illuminazione… Ogni location lo carica.
-- Distinto dal magazzino food (fb_stock_lots = ingredienti).
create table if not exists public.location_inventory (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.profiles(id) on delete cascade,
  category      text not null default 'ALTRO',
  name          text not null,
  qty           numeric(10,2) not null default 0,
  unit          text not null default 'PZ',
  low_threshold numeric(10,2),
  notes         text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_locinv_loc on public.location_inventory(location_id);
alter table public.location_inventory enable row level security;
drop policy if exists loc_inv_owner on public.location_inventory;
create policy loc_inv_owner on public.location_inventory for all
  using (location_id = auth.uid()) with check (location_id = auth.uid());

-- Seed demo Tenuta delle Grazie (solo se vuoto) — magazzino allestimento realistico per 120 coperti.
do $$
declare v uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34';
begin
  if exists (select 1 from public.profiles where id = v)
     and not exists (select 1 from public.location_inventory where location_id = v) then
    insert into public.location_inventory(location_id, category, name, qty, unit, low_threshold) values
      (v,'TOVAGLIATO','Tovaglie rotonde avorio',30,'PZ',5),
      (v,'TOVAGLIATO','Tovaglioli lino avorio',320,'PZ',40),
      (v,'TOVAGLIATO','Runner oro',40,'PZ',6),
      (v,'TOVAGLIATO','Coprisedia',260,'PZ',20),
      (v,'PIATTI','Piatto piano',420,'PZ',40),
      (v,'PIATTI','Sottopiatto oro',260,'PZ',20),
      (v,'PIATTI','Piatto fondo',320,'PZ',30),
      (v,'PIATTI','Piattino dolce',320,'PZ',30),
      (v,'POSATE','Forchette',520,'PZ',40),
      (v,'POSATE','Coltelli',520,'PZ',40),
      (v,'POSATE','Cucchiai',320,'PZ',30),
      (v,'POSATE','Forchettine dolce',320,'PZ',30),
      (v,'BICCHIERI','Calici vino rosso',300,'PZ',30),
      (v,'BICCHIERI','Calici vino bianco',300,'PZ',30),
      (v,'BICCHIERI','Flûte',260,'PZ',20),
      (v,'BICCHIERI','Bicchieri acqua',320,'PZ',30),
      (v,'CENTROTAVOLA','Composizioni floreali',30,'PZ',3),
      (v,'CENTROTAVOLA','Candelabri',24,'PZ',4),
      (v,'CENTROTAVOLA','Vasi in vetro',40,'PZ',6),
      (v,'MISE_EN_PLACE','Segnaposto',260,'PZ',20),
      (v,'MISE_EN_PLACE','Menu card',260,'PZ',20),
      (v,'MISE_EN_PLACE','Numeri tavolo',30,'PZ',3),
      (v,'MISE_EN_PLACE','Portaconfetti',260,'PZ',20),
      (v,'ARREDO','Sedie Chiavarina oro',260,'PZ',20),
      (v,'ARREDO','Gazebo cerimonia',2,'PZ',NULL),
      (v,'ARREDO','Arco floreale',1,'PZ',NULL),
      (v,'ILLUMINAZIONE','Faretti LED',40,'PZ',6),
      (v,'ILLUMINAZIONE','Catene luminose',20,'PZ',3),
      (v,'ILLUMINAZIONE','Lanterne',30,'PZ',5);
  end if;
end $$;
