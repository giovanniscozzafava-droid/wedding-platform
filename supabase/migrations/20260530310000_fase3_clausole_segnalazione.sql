-- FASE 3.2 — Template fornitore filtrabili per modalita_incasso + 4 clausole
-- standard di SEGNALAZIONE.
--
-- Razionale: il WP/LOCATION in modalita SEGNALAZIONE incassa solo la propria
-- parcella e il fornitore viene pagato direttamente dalla coppia. Servono
-- clausole pre-redatte specifiche per quel modello (oggetto, corrispettivi
-- segnalazione, provvigione, GDPR-segnalazione) cosi` che il builder
-- StandardClausesBuilder possa filtrarle.

-- 1) Aggiungi colonna per_modalita su supplier_contract_templates -----------
alter table public.supplier_contract_templates
  add column if not exists per_modalita public.modalita_incasso not null default 'INTERO';

comment on column public.supplier_contract_templates.per_modalita is
  'Modalita di incasso target per il template: INTERO o SEGNALAZIONE. Default INTERO per backward compatibility.';

create index if not exists idx_sct_per_modalita
  on public.supplier_contract_templates(fornitore_id, per_modalita);

-- 2) Aggiungi colonna per_modalita su standard_contract_clauses -------------
-- NULL = clausola valida per entrambe le modalita.
alter table public.standard_contract_clauses
  add column if not exists per_modalita public.modalita_incasso;

comment on column public.standard_contract_clauses.per_modalita is
  'Se valorizzata, la clausola e visibile solo per quella modalita (INTERO/SEGNALAZIONE). NULL = entrambe.';

create index if not exists idx_std_clauses_per_modalita
  on public.standard_contract_clauses(per_modalita) where per_modalita is not null;

-- 3) Seed delle 4 clausole standard SEGNALAZIONE ---------------------------
insert into public.standard_contract_clauses
  (category, slug, title, body, placeholders, sort_order, is_default, per_modalita)
values
('OGGETTO', 'oggetto-segnalazione',
 'Oggetto (modello segnalazione)',
 'Con il presente contratto, il Wedding Planner si impegna a segnalare al Cliente fornitori qualificati e a coordinare l''organizzazione del matrimonio di {{client_name}} previsto per il giorno {{event_date}} presso {{event_location}}. I contratti con i singoli fornitori (catering, fotografo, musica, location ecc.) saranno stipulati direttamente tra il Cliente e ciascun fornitore.',
 array['client_name', 'event_date', 'event_location'], 11, true, 'SEGNALAZIONE'),

('CORRISPETTIVI', 'corrispettivi-segnalazione',
 'Corrispettivi (modello segnalazione)',
 'A fronte dell''attivita` di segnalazione, consulenza e coordinamento prestata, il Cliente corrispondera` al Wedding Planner la parcella forfettaria di {{parcella_amount}} euro IVA inclusa. Gli importi dovuti ai singoli fornitori saranno regolati direttamente dal Cliente con ciascun fornitore, in base ai rispettivi contratti.',
 array['parcella_amount'], 21, true, 'SEGNALAZIONE'),

('CORRISPETTIVI', 'provvigione-segnalazione',
 'Provvigione di segnalazione',
 'Il Cliente prende atto e accetta che il Wedding Planner potra` percepire dai fornitori segnalati una provvigione commerciale sul contratto firmato dal Cliente con il fornitore. Tale provvigione e` gia` ricompresa nei prezzi praticati al Cliente dai fornitori e non comporta alcun onere ulteriore a carico del Cliente. Il Wedding Planner garantisce trasparenza e si impegna a segnalare esclusivamente fornitori selezionati per qualita` e affidabilita`.',
 array[]::text[], 25, true, 'SEGNALAZIONE'),

('PRIVACY_GDPR', 'privacy-segnalazione',
 'Trattamento dei dati (GDPR — modello segnalazione)',
 'Le parti si impegnano al rispetto del Regolamento UE 2016/679 (GDPR). Il Wedding Planner trattera` i dati personali del Cliente per le sole finalita` di coordinamento e segnalazione. Ai fini dell''esecuzione del contratto, e con il consenso del Cliente, il Wedding Planner potra` comunicare ai fornitori segnalati i dati minimi necessari (nome, contatto, data e luogo dell''evento). Ciascun fornitore agira` come titolare autonomo del trattamento per la parte di propria competenza. L''informativa privacy completa e` consultabile su planfully.it/privacy.',
 array[]::text[], 81, true, 'SEGNALAZIONE')

on conflict (slug) do update set
  body         = excluded.body,
  title        = excluded.title,
  placeholders = excluded.placeholders,
  is_default   = excluded.is_default,
  per_modalita = excluded.per_modalita,
  updated_at   = now();

-- 4) Aggiorna la RPC list_standard_clauses per esporre per_modalita -------
create or replace function public.list_standard_clauses()
returns table (
  id           uuid,
  category     text,
  slug         text,
  title        text,
  body         text,
  placeholders text[],
  sort_order   int,
  is_default   boolean,
  per_modalita text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    id, category, slug, title, body, placeholders, sort_order, is_default,
    per_modalita::text
    from public.standard_contract_clauses
   where is_active
   order by sort_order, category;
$$;

grant execute on function public.list_standard_clauses() to authenticated;
