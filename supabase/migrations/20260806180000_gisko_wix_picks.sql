-- Dove finiscono le scelte del provino: quali foto del vecchio sito Wix restano,
-- quali sono da copertina (corona) e quali si buttano.
--
-- Sta qui e non su un file del portatile perche' la selezione si fa dal telefono,
-- a pezzi, in giorni diversi: deve sopravvivere al Mac spento.
--
-- Nessuno entra da fuori: la tabella non ha policy per anon/authenticated, si
-- passa solo dalla edge function gisko-provino, che chiede una parola d'ordine.
create table if not exists public.gisko_wix_picks (
  photo_id   text primary key,
  scelta     text not null check (scelta in ('top', 'tieni', 'scarta')),
  updated_at timestamptz not null default now()
);

comment on table public.gisko_wix_picks is
  'Provino delle foto ancora servite dal vecchio sito Wix: tenute, da copertina, scartate. Scritta solo dalla edge function gisko-provino.';

alter table public.gisko_wix_picks enable row level security;
-- niente policy: solo service_role (cioe' la edge function) legge e scrive

create index if not exists idx_gisko_wix_picks_scelta on public.gisko_wix_picks(scelta);
