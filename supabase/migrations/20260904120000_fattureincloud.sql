-- Fatture in Cloud: «gestirò le fatture sia per il mio studio fotografico che
-- per Fuyue, sulla stessa SRL, distinte per numerazione — /A per fotografia
-- (comprese album e stampa), sequenziale semplice per Fuyue» (Giovanni, 03-04/09/2026).
--
-- Non è "la fattura di Giovanni": è una feature per OGNI professionista Planfully
-- che collega la propria azienda Fatture in Cloud. Stesso schema di Google Drive
-- (drive_connections + drive-crypto.ts): OAuth2, token cifrati AES-GCM, mai in
-- chiaro nel DB. La "serie di numerazione" di Fatture in Cloud è un campo libero
-- (`numeration`, es. "/A") passato a ogni fattura creata: qui la configuriamo,
-- non la inventiamo — un professionista può averne quante ne vuole.

create table public.fic_oauth_states (
  state text primary key,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.fic_oauth_states enable row level security;
revoke all on public.fic_oauth_states from anon, authenticated;

create table public.fic_connections (
  professional_id   uuid primary key references public.profiles(id) on delete cascade,
  company_id        text not null,          -- id azienda su Fatture in Cloud (GET /user/companies)
  company_name      text,
  access_token_enc  bytea,                  -- AES-GCM app-side (edge), MAI plaintext
  refresh_token_enc bytea,
  token_expires_at  timestamptz,
  connected_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.fic_connections is 'Una azienda Fatture in Cloud per professionista. Token sempre cifrati; li usa solo il backend per creare/leggere documenti, mai il browser.';

create table public.fic_numerations (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  label           text not null,            -- es. "Fotografia (album, stampa)", "Fuyue — servizi"
  numeration      text,                     -- es. "/A"; null/'' = serie predefinita (sequenziale semplice)
  is_default      boolean not null default false,
  created_at      timestamptz not null default now()
);
create index fic_numerations_pro_idx on public.fic_numerations (professional_id, created_at);
comment on table public.fic_numerations is 'Serie di numerazione configurate dal professionista: quale "numeration" passare a Fatture in Cloud per ogni tipo di documento/prodotto.';

alter table public.fic_connections enable row level security;
alter table public.fic_numerations enable row level security;

revoke all on public.fic_connections, public.fic_numerations from anon;
grant select, insert, update, delete on public.fic_numerations to authenticated;
grant select, delete on public.fic_connections to authenticated;  -- niente insert/update diretti: solo l'edge OAuth (service_role) scrive i token; delete = "scollega"

create policy fic_conn_owner on public.fic_connections for all
  using (professional_id = auth.uid() or public.is_admin());
create policy fic_num_owner on public.fic_numerations for all
  using (professional_id = auth.uid() or public.is_admin())
  with check (professional_id = auth.uid() or public.is_admin());

-- Una sola serie di default per professionista: se ne marchi una nuova, le altre
-- perdono il vessillo (il senso di "default" è "una").
create or replace function public.fic_numerations_single_default()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.fic_numerations set is_default = false
     where professional_id = new.professional_id and id <> new.id and is_default;
  end if;
  return new;
end$$;
create trigger fic_numerations_single_default_trg
  after insert or update of is_default on public.fic_numerations
  for each row when (new.is_default) execute function public.fic_numerations_single_default();
