-- FASE 6.2 — Feature flag "nuovo modello"
--
-- Aggiunge a `profiles` la colonna `nuovo_modello_attivo` (bool, default false).
-- Il frontend usa questo flag per renderizzare i componenti del workflow
-- guidato (ProssimaMossa, RiconciliazioneCard, ChatEvento, SaluteEventoBadge,
-- tab Scadenzario, kebab cambiamenti evento) SOLO se attivo.
--
-- Toggle in pannello profilo / admin: ognuno aggiorna SUL PROPRIO record
-- (gli admin possono editare tutti via la policy admin gia` esistente su
-- profiles).
--
-- Idempotente: usa `add column if not exists`. Nessuna RLS aggiuntiva
-- necessaria (profiles ha gia` policy update-self e update-admin).

alter table public.profiles
  add column if not exists nuovo_modello_attivo boolean not null default false;

comment on column public.profiles.nuovo_modello_attivo is
  'FASE 6.2: feature flag per il "nuovo modello" (workflow guidato). Se true, il frontend mostra ProssimaMossa, RiconciliazioneCard, ChatEvento, SaluteEventoBadge, tab Scadenzario, menu Cambiamenti evento. Default false. Toggle nel profilo utente; admin puo` cambiarlo per chiunque.';

-- Indice solo sui true: query veloce per "elenco profili che hanno il nuovo
-- modello attivo" (utile in admin / observability).
create index if not exists idx_profiles_nuovo_modello_attivo
  on public.profiles(id)
  where nuovo_modello_attivo = true;
