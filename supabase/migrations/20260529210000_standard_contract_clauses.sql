-- ============================================================================
-- Fase D — Libreria clausole standard per contratti CLIENT_WP
-- ============================================================================
-- Tabella di clausole pre-redatte da Planfully, organizzate per categoria.
-- Il WP puo' costruire un contratto cliente clausola-per-clausola pescando
-- dalla libreria, oppure usare il proprio template (supplier_contract_templates).
--
-- Le clausole sono READ-ONLY per gli utenti (managed by ADMIN/seed).
-- ============================================================================

create table if not exists public.standard_contract_clauses (
  id            uuid primary key default gen_random_uuid(),
  category      text not null,
  -- categoria umana: OGGETTO, CORRISPETTIVI, PAGAMENTI, RECESSO, FORZA_MAGGIORE,
  -- RESPONSABILITA, PROPRIETA_INTELLETTUALE, PRIVACY_GDPR, FORO, ALTRE
  slug          text not null unique,
  title         text not null,
  body          text not null,
  -- placeholder supportati nel body (es. {{client_name}}, {{event_date}}, {{total_amount}}):
  placeholders  text[] not null default '{}'::text[],
  -- ordering & visibility
  sort_order    int not null default 100,
  is_active     boolean not null default true,
  is_default    boolean not null default false, -- consigliata di default nel builder
  -- audit
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_std_clauses_active on public.standard_contract_clauses(category, sort_order) where is_active;

alter table public.standard_contract_clauses enable row level security;

-- Lettura: tutti gli authenticated possono leggere clausole attive.
drop policy if exists "clauses_read_auth" on public.standard_contract_clauses;
create policy "clauses_read_auth" on public.standard_contract_clauses
  for select using (auth.uid() is not null and is_active);

-- Scrittura: solo ADMIN.
drop policy if exists "clauses_write_admin" on public.standard_contract_clauses;
create policy "clauses_write_admin" on public.standard_contract_clauses
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

create trigger trg_std_clauses_updated_at before update on public.standard_contract_clauses
  for each row execute function set_updated_at();

-- ─── Seed iniziale: 10 clausole standard pronte all'uso ─────────────────────
insert into public.standard_contract_clauses (category, slug, title, body, placeholders, sort_order, is_default) values
('OGGETTO', 'oggetto-base',
 'Oggetto del contratto',
 'Con il presente contratto, il Wedding Planner si impegna a organizzare il matrimonio di {{client_name}} previsto per il giorno {{event_date}} presso {{event_location}}. Le prestazioni comprendono il coordinamento dei fornitori, la pianificazione della giornata e l''assistenza on-site come da preventivo allegato.',
 array['client_name', 'event_date', 'event_location'], 10, true),

('CORRISPETTIVI', 'corrispettivi-base',
 'Corrispettivi',
 'A fronte delle prestazioni descritte all''art. 1, il Cliente si impegna a corrispondere al Wedding Planner l''importo complessivo di {{total_amount}} euro IVA inclusa, come dettagliato nel preventivo allegato di cui forma parte integrante.',
 array['total_amount'], 20, true),

('PAGAMENTI', 'pagamenti-30-50-20',
 'Modalità di pagamento (acconto 30% / saldo 50% / 20% post-evento)',
 'Il pagamento avverrà nelle seguenti modalità:
- 30% a titolo di acconto alla firma del presente contratto;
- 50% trenta (30) giorni prima della data dell''evento;
- 20% entro sette (7) giorni dall''evento.
I pagamenti dovranno essere effettuati a mezzo bonifico bancario sui dati indicati a margine.',
 array[]::text[], 30, true),

('PAGAMENTI', 'pagamenti-50-50',
 'Modalità di pagamento (50% acconto / 50% saldo)',
 'Il pagamento avverrà nelle seguenti modalità:
- 50% a titolo di acconto alla firma del presente contratto;
- 50% a saldo trenta (30) giorni prima della data dell''evento.
I pagamenti dovranno essere effettuati a mezzo bonifico bancario.',
 array[]::text[], 31, false),

('RECESSO', 'recesso-graduato',
 'Diritto di recesso (penali graduate)',
 'Il Cliente puo'' recedere dal presente contratto in qualsiasi momento con comunicazione scritta. Le penali applicate sono:
- recesso entro 180 giorni dall''evento: trattenuto il 30% dell''importo complessivo;
- recesso tra 90 e 180 giorni: trattenuto il 50% dell''importo complessivo;
- recesso entro 90 giorni: trattenuto il 100% dell''importo complessivo.
Resta salvo il diritto al risarcimento di eventuali maggiori danni documentabili.',
 array[]::text[], 40, true),

('FORZA_MAGGIORE', 'forza-maggiore-rinvio',
 'Forza maggiore (rinvio data)',
 'In caso di impossibilita'' sopravvenuta non imputabile alle parti (calamita'' naturali, pandemie, provvedimenti dell''autorita''), le parti concordano fin d''ora la possibilita'' di rinviare l''evento entro 24 mesi dalla data originaria, alle medesime condizioni economiche. La modifica della data non costituisce recesso.',
 array[]::text[], 50, true),

('RESPONSABILITA', 'responsabilita-pro',
 'Responsabilità del Wedding Planner',
 'Il Wedding Planner agisce con la diligenza richiesta dalla propria professione. La responsabilita'' verso il Cliente e'' limitata alle prestazioni direttamente erogate. Per le prestazioni dei fornitori terzi (catering, fotografo, musica, location ecc.) la responsabilita'' resta in capo a ciascun fornitore secondo i rispettivi contratti.',
 array[]::text[], 60, true),

('PROPRIETA_INTELLETTUALE', 'foto-pubblicazione',
 'Diritti d''immagine e pubblicazione',
 'Il Cliente autorizza il Wedding Planner alla pubblicazione di foto e video dell''evento sui propri canali (sito web, social media, materiali promozionali) a fini di portfolio professionale. Il consenso e'' revocabile in qualsiasi momento con richiesta scritta; la revoca non ha effetto retroattivo sui materiali gia'' diffusi.',
 array[]::text[], 70, false),

('PRIVACY_GDPR', 'privacy-base',
 'Trattamento dei dati (GDPR)',
 'Le parti si impegnano al rispetto del Regolamento UE 2016/679 (GDPR). Il Wedding Planner trattera'' i dati personali del Cliente e degli invitati esclusivamente per le finalita'' contrattuali. L''informativa privacy completa e'' consultabile su planfully.it/privacy.',
 array[]::text[], 80, true),

('FORO', 'foro-competente',
 'Foro competente',
 'Per qualsiasi controversia derivante dall''interpretazione o esecuzione del presente contratto sara'' competente in via esclusiva il Foro del luogo di residenza del Cliente, salva diversa imposizione di legge.',
 array[]::text[], 90, true)
on conflict (slug) do nothing;

comment on table public.standard_contract_clauses is
  'Fase D workflow: libreria clausole pre-redatte da Planfully per costruire contratti CLIENT_WP clausola-per-clausola. ADMIN-managed.';

-- ─── RPC: lista clausole organizzate per categoria, con placeholder risolti ─
create or replace function public.list_standard_clauses()
returns table (
  id           uuid,
  category     text,
  slug         text,
  title        text,
  body         text,
  placeholders text[],
  sort_order   int,
  is_default   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select id, category, slug, title, body, placeholders, sort_order, is_default
    from public.standard_contract_clauses
   where is_active
   order by sort_order, category;
$$;

grant execute on function public.list_standard_clauses() to authenticated;
