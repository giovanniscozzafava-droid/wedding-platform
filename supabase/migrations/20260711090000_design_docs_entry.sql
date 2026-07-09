-- Lega un progetto dello Studio disegno a un EVENTO (opzionale): così la grafica/stationery
-- (inviti, tableau, menu, segnaposto) vive dentro l'evento. Il progetto resta di proprietà del
-- disegnatore (owner_id), entry_id è solo un tag/filtro. RLS invariata (owner-only).
alter table public.design_docs add column if not exists entry_id uuid references public.calendar_entries(id) on delete set null;
create index if not exists idx_design_docs_entry on public.design_docs(entry_id);
