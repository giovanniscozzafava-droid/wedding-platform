-- FASE 1.2 — Modus operandi: INTERO vs SEGNALAZIONE
-- Introduciamo l''enum modalita_incasso e i default a livello profilo (WP/LOCATION),
-- con un override puntuale a livello di singolo evento (calendar_entries).
--
-- INTERO        = WP/LOCATION incassa l''intero (paga i fornitori a valle).
-- SEGNALAZIONE  = WP/LOCATION incassa solo la propria parcella; il fornitore
--                 viene pagato direttamente dal cliente.
--
-- parcella_default          = importo (o riferimento) della parcella di
--                             segnalazione/coordinamento del WP/LOCATION.
-- applica_ricarico_default  = se true, il listino mostrato al cliente include
--                             il ricarico configurato (default_markup_percent).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'modalita_incasso') then
    create type public.modalita_incasso as enum ('INTERO','SEGNALAZIONE');
  end if;
end$$;

comment on type public.modalita_incasso is
  'Modus operandi del WP/LOCATION: INTERO (incassa tutto e paga fornitori) | SEGNALAZIONE (incassa solo parcella, fornitore pagato dal cliente).';

alter table public.profiles
  add column if not exists modalita_incasso_default public.modalita_incasso,
  add column if not exists parcella_default        numeric(10,2)
                              check (parcella_default is null or parcella_default >= 0),
  add column if not exists applica_ricarico_default boolean not null default true;

comment on column public.profiles.modalita_incasso_default is
  'Default per nuovi eventi: INTERO o SEGNALAZIONE. NULL = non ancora scelto.';
comment on column public.profiles.parcella_default is
  'Parcella standard di coordinamento/segnalazione (EUR). Usata come default su nuovi eventi.';
comment on column public.profiles.applica_ricarico_default is
  'Se true, il ricarico (default_markup_percent) viene applicato di default ai preventivi.';

-- Override per singolo evento. NULL ⇒ eredita modalita_incasso_default del proprietario.
alter table public.calendar_entries
  add column if not exists modalita_incasso public.modalita_incasso;

comment on column public.calendar_entries.modalita_incasso is
  'Override per singolo evento. NULL = eredita profiles.modalita_incasso_default del proprietario.';

create index if not exists idx_calentry_modalita_incasso
  on public.calendar_entries(modalita_incasso)
  where modalita_incasso is not null;
