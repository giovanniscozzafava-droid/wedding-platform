-- STUDIO DISEGNO — documenti salvabili (progetti di stationery / inviti / tableau / segnaposto ecc.)
-- disegnati a mano libera con tavola grafica. Il documento è serializzato (livelli come PNG dataURL)
-- nel campo `doc`; `thumbnail` è una miniatura per la galleria. RLS owner-only. Generico multi-tenant.
create table if not exists public.design_docs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  title      text not null default 'Senza titolo',
  width      int  not null default 1500,
  height     int  not null default 2100,
  doc        text,          -- JSON: { layers:[{name,visible,opacity,blend,data}], ... }
  thumbnail  text,          -- PNG dataURL ridotto per la galleria
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_design_docs_owner on public.design_docs(owner_id, updated_at desc);
alter table public.design_docs enable row level security;
drop policy if exists design_docs_owner on public.design_docs;
create policy design_docs_owner on public.design_docs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop trigger if exists trg_design_docs_upd on public.design_docs;
create trigger trg_design_docs_upd before update on public.design_docs for each row execute function public.set_updated_at();
