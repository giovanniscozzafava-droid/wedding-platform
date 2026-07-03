-- "Il mio stile" multi-PDF: il fotografo carica PIÙ album impaginati; ognuno è una riga (con
-- miniatura + tavole apprese), eliminabile singolarmente. Il profilo aggregato (album_style_profiles)
-- è la MEDIA su tutti questi PDF e resta la fonte per "Impagina con AI".
create table if not exists public.album_style_pdfs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Album',
  thumb text,                       -- data URL della copertina (prima tavola), piccola
  spreads jsonb not null default '[]'::jsonb,
  samples int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.album_style_pdfs enable row level security;

drop policy if exists asp_pdf_sel on public.album_style_pdfs;
drop policy if exists asp_pdf_ins on public.album_style_pdfs;
drop policy if exists asp_pdf_del on public.album_style_pdfs;
create policy asp_pdf_sel on public.album_style_pdfs for select using (owner_id = auth.uid());
create policy asp_pdf_ins on public.album_style_pdfs for insert with check (owner_id = auth.uid());
create policy asp_pdf_del on public.album_style_pdfs for delete using (owner_id = auth.uid());

create index if not exists album_style_pdfs_owner_idx on public.album_style_pdfs (owner_id);
