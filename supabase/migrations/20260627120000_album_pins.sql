-- PIN sul catalogo PDF con COMMENTO che resta sul pin + CONVERSAZIONE cliente↔fotografo.
-- Il cliente lascia un pin sul modello, scrive il commento (materiale/colore opzionali), il fotografo
-- legge e risponde nel thread; alla fine il cliente fa "Ok, scelgo questo!" → status CHOSEN.
-- Sicurezza: chi può agire sull'evento (coppia + fotografo) via public.album_can_edit(entry).

create table if not exists public.album_pins (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null,
  catalog_id uuid,
  page int not null default 1,
  x real not null,                 -- coordinate normalizzate 0..1 sulla pagina
  y real not null,
  comment text,                    -- il testo scritto sul pin
  material text,                   -- es. "Pelle di legno"
  color text,                      -- es. "Cristalwhite"
  status text not null default 'OPEN',   -- OPEN | CHOSEN
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists album_pins_entry on public.album_pins (entry_id, page);
alter table public.album_pins enable row level security;
drop policy if exists album_pins_party on public.album_pins;
create policy album_pins_party on public.album_pins
  for all using (public.album_can_edit(entry_id)) with check (public.album_can_edit(entry_id));

create table if not exists public.album_pin_messages (
  id uuid primary key default gen_random_uuid(),
  pin_id uuid not null references public.album_pins(id) on delete cascade,
  entry_id uuid not null,          -- denormalizzato per RLS semplice
  author_id uuid default auth.uid(),
  author_role text not null,       -- 'client' | 'pro'
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists album_pin_msg_pin on public.album_pin_messages (pin_id, created_at);
alter table public.album_pin_messages enable row level security;
drop policy if exists album_pin_msg_party on public.album_pin_messages;
create policy album_pin_msg_party on public.album_pin_messages
  for all using (public.album_can_edit(entry_id)) with check (public.album_can_edit(entry_id));

drop trigger if exists trg_album_pins_upd on public.album_pins;
create trigger trg_album_pins_upd before update on public.album_pins
  for each row execute function public.set_updated_at();
