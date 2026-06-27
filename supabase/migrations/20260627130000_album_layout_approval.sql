-- Approvazione esplicita dell'impaginazione album da parte del cliente ("Approvo l'album").
create table if not exists public.album_layout_approval (
  entry_id uuid primary key,
  approved_at timestamptz not null default now(),
  approved_by uuid default auth.uid()
);
alter table public.album_layout_approval enable row level security;
drop policy if exists ala_party on public.album_layout_approval;
create policy ala_party on public.album_layout_approval
  for all using (public.album_can_edit(entry_id)) with check (public.album_can_edit(entry_id));
