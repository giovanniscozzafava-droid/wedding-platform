-- ============================================================================
-- Pacchetti professione — Verticalizzazione (FASE 1)
-- ============================================================================
-- Introduce un motore di "vestizione" del prodotto in base alla professione
-- del fornitore. Non sostituisce nulla di esistente: aggiunge tabelle template
-- e una FK opzionale su profiles.professione_id. Chi non sceglie ha fallback
-- 'Generico'.
--
-- Tabelle nuove:
--   - professioni            (definizione professione + etichette UI + default)
--   - servizio_template      (catalogo servizi-tipo per professione)
--   - clausola_template      (clausole contrattuali per professione)
--   - consiglio              (consigli operativi contestuali)
--   - checklist_template     (checklist giorno-evento)
--
-- Estensione profiles:
--   - professione_id          uuid FK -> professioni(id)  (set null on delete)
--   - capacita_secondarie     uuid[]  (predispone multi-professione, non usato)
--
-- RLS: SELECT a tutti gli authenticated sulle 5 tabelle template,
-- INSERT/UPDATE/DELETE solo ADMIN.
-- Idempotente: usa create table if not exists / add column if not exists.
-- ============================================================================

-- ─── 1) Tabella professioni ─────────────────────────────────────────────────
create table if not exists public.professioni (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  slug            text not null unique,
  -- gruppo macro per organizzare le card in onboarding:
  --   IMMAGINE, COORDINAMENTO, LUOGO_CIBO, ALLESTIMENTI, BELLEZZA,
  --   MUSICA, ABBIGLIAMENTO, MOBILITA, EXTRA, FALLBACK
  gruppo          text not null,
  -- nome icona Lucide (es. 'Camera', 'Flower2', 'Music', ...)
  icona           text,
  -- etichette UI dipendenti dalla professione (servizio_label, catalogo_label,
  -- preventivo_label, empty_state, ecc.). Drive le viste a runtime.
  etichette       jsonb not null default '{}'::jsonb,
  -- default suggeriti per i nuovi servizi del professionista
  -- es. {"quantity_basis_default": "FLAT", "service_unit_default": "EVENTO"}
  unita_default   jsonb not null default '{}'::jsonb,
  attiva          boolean not null default true,
  sort_order      int not null default 100,
  created_at      timestamptz not null default now()
);

create index if not exists idx_professioni_gruppo_sort
  on public.professioni(gruppo, sort_order)
  where attiva;

alter table public.professioni enable row level security;

drop policy if exists "professioni_read_auth" on public.professioni;
create policy "professioni_read_auth" on public.professioni
  for select using (auth.uid() is not null and attiva);

drop policy if exists "professioni_write_admin" on public.professioni;
create policy "professioni_write_admin" on public.professioni
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── 2) Tabella servizio_template ───────────────────────────────────────────
create table if not exists public.servizio_template (
  id              uuid primary key default gen_random_uuid(),
  professione_id  uuid not null references public.professioni(id) on delete cascade,
  nome            text not null,
  descrizione     text,
  prezzo_base     numeric(10,2),
  -- enum quantity_basis: FLAT | PER_GUEST | PER_TABLE | PER_HOUR
  quantity_basis  text check (quantity_basis in ('FLAT','PER_GUEST','PER_TABLE','PER_HOUR')),
  -- enum service_unit: PEZZO | PERSONA | ORA | EVENTO
  service_unit    text check (service_unit in ('PEZZO','PERSONA','ORA','EVENTO')),
  sort_order      int default 100,
  -- se true, incluso nel "pack di default" pre-selezionato in importazione
  is_default_pack boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists idx_servizio_template_prof
  on public.servizio_template(professione_id, sort_order);

alter table public.servizio_template enable row level security;

drop policy if exists "servizio_template_read_auth" on public.servizio_template;
create policy "servizio_template_read_auth" on public.servizio_template
  for select using (auth.uid() is not null);

drop policy if exists "servizio_template_write_admin" on public.servizio_template;
create policy "servizio_template_write_admin" on public.servizio_template
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── 3) Tabella clausola_template ───────────────────────────────────────────
create table if not exists public.clausola_template (
  id              uuid primary key default gen_random_uuid(),
  professione_id  uuid not null references public.professioni(id) on delete cascade,
  -- OGGETTO | CORRISPETTIVI | PAGAMENTI | RECESSO | FORZA_MAGGIORE |
  -- RESPONSABILITA | PROPRIETA_INTELLETTUALE | PRIVACY_GDPR | FORO |
  -- SOSTITUZIONI | ALTRE
  categoria       text,
  -- INTERO | SEGNALAZIONE | NULL (universale)
  per_modalita    text check (per_modalita in ('INTERO','SEGNALAZIONE') or per_modalita is null),
  titolo          text not null,
  body            text not null,
  sort_order      int default 100,
  created_at      timestamptz not null default now()
);

create index if not exists idx_clausola_template_prof
  on public.clausola_template(professione_id, sort_order);

alter table public.clausola_template enable row level security;

drop policy if exists "clausola_template_read_auth" on public.clausola_template;
create policy "clausola_template_read_auth" on public.clausola_template
  for select using (auth.uid() is not null);

drop policy if exists "clausola_template_write_admin" on public.clausola_template;
create policy "clausola_template_write_admin" on public.clausola_template
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── 4) Tabella consiglio ───────────────────────────────────────────────────
create table if not exists public.consiglio (
  id              uuid primary key default gen_random_uuid(),
  professione_id  uuid not null references public.professioni(id) on delete cascade,
  contesto        text not null check (contesto in ('PREVENTIVO','SERVIZI','CONTRATTI','GIORNO')),
  titolo          text not null,
  testo           text not null,
  sort_order      int default 100,
  created_at      timestamptz not null default now()
);

create index if not exists idx_consiglio_prof_contesto
  on public.consiglio(professione_id, contesto, sort_order);

alter table public.consiglio enable row level security;

drop policy if exists "consiglio_read_auth" on public.consiglio;
create policy "consiglio_read_auth" on public.consiglio
  for select using (auth.uid() is not null);

drop policy if exists "consiglio_write_admin" on public.consiglio;
create policy "consiglio_write_admin" on public.consiglio
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── 5) Tabella checklist_template ──────────────────────────────────────────
create table if not exists public.checklist_template (
  id              uuid primary key default gen_random_uuid(),
  professione_id  uuid not null references public.professioni(id) on delete cascade,
  voce            text not null,
  -- PRIMA_EVENTO | ARRIVO | DURANTE | PARTENZA
  momento         text check (momento in ('PRIMA_EVENTO','ARRIVO','DURANTE','PARTENZA')),
  sort_order      int default 100,
  created_at      timestamptz not null default now()
);

create index if not exists idx_checklist_template_prof
  on public.checklist_template(professione_id, momento, sort_order);

alter table public.checklist_template enable row level security;

drop policy if exists "checklist_template_read_auth" on public.checklist_template;
create policy "checklist_template_read_auth" on public.checklist_template
  for select using (auth.uid() is not null);

drop policy if exists "checklist_template_write_admin" on public.checklist_template;
create policy "checklist_template_write_admin" on public.checklist_template
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  ) with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
  );

-- ─── 6) Estensione profiles ─────────────────────────────────────────────────
alter table public.profiles
  add column if not exists professione_id uuid references public.professioni(id) on delete set null;

alter table public.profiles
  add column if not exists capacita_secondarie uuid[] not null default '{}'::uuid[];

create index if not exists idx_profiles_professione_id
  on public.profiles(professione_id);

-- ─── 7) Seed professione FALLBACK 'Generico' ────────────────────────────────
-- Lo seediamo prima, cosi` possiamo fare il backfill di profiles in coda.
insert into public.professioni (nome, slug, gruppo, icona, etichette, unita_default, sort_order)
values (
  'Generico',
  'generico',
  'FALLBACK',
  'Briefcase',
  jsonb_build_object(
    'servizio_label',   'I tuoi servizi',
    'catalogo_label',   'Catalogo servizi',
    'preventivo_label', 'Servizio',
    'empty_state',      'Crea il tuo primo servizio',
    'icona',            'Briefcase'
  ),
  jsonb_build_object(
    'quantity_basis_default', 'FLAT',
    'service_unit_default',   'EVENTO'
  ),
  999
)
on conflict (slug) do update set
  nome          = excluded.nome,
  gruppo        = excluded.gruppo,
  icona         = excluded.icona,
  etichette     = excluded.etichette,
  unita_default = excluded.unita_default,
  sort_order    = excluded.sort_order,
  attiva        = true;

-- ─── 8) Seed professione FOTOGRAFO ──────────────────────────────────────────
insert into public.professioni (nome, slug, gruppo, icona, etichette, unita_default, sort_order)
values (
  'Fotografo',
  'fotografo',
  'IMMAGINE',
  'Camera',
  jsonb_build_object(
    'servizio_label',   'Reportage e pacchetti',
    'catalogo_label',   'I miei pacchetti foto',
    'preventivo_label', 'Pacchetto foto',
    'empty_state',      'Crea il tuo primo pacchetto fotografico',
    'icona',            'Camera'
  ),
  jsonb_build_object(
    'quantity_basis_default', 'FLAT',
    'service_unit_default',   'EVENTO'
  ),
  10
)
on conflict (slug) do update set
  nome          = excluded.nome,
  gruppo        = excluded.gruppo,
  icona         = excluded.icona,
  etichette     = excluded.etichette,
  unita_default = excluded.unita_default,
  attiva        = true;

-- Servizi-tipo Fotografo (idempotente: clean & re-seed per slug)
delete from public.servizio_template
 where professione_id = (select id from public.professioni where slug = 'fotografo');

insert into public.servizio_template
  (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Reportage matrimonio - giornata completa',
   'Copertura dai preparativi al taglio della torta. Consegna foto editate in alta risoluzione tramite galleria online dedicata.',
   2200.00, 'FLAT', 'EVENTO', 10, true),
  ('Servizio fidanzamento (engagement)',
   'Shooting di coppia 1-2 ore in location concordata, ideale per scaldarsi con la fotocamera prima del giorno del si''. Consegna 50-70 foto editate.',
   350.00, 'FLAT', 'EVENTO', 20, true),
  ('Album fine art 30x30 cm 60 pagine',
   'Album in carta fotografica fine art con copertina in tela o pelle. Editing e progettazione grafica incluse, 2 revisioni.',
   450.00, 'FLAT', 'PEZZO', 30, true),
  ('Stampe fotografiche fine art 30x40 (set di 3)',
   'Tre stampe d''autore su carta cotone, pronte da incorniciare. Selezione concordata tra fotografo e coppia.',
   180.00, 'FLAT', 'PEZZO', 40, false),
  ('Servizio second-shooter (secondo fotografo)',
   'Secondo fotografo a copertura per i preparativi sposo o per i grandi numeri di ospiti. Aumenta il numero di scatti e i punti di vista.',
   600.00, 'FLAT', 'EVENTO', 50, false),
  ('Selezione foto retouch fine-art 50 scatti',
   'Selezione fine-art con ritocco avanzato (pelle, color grading, eliminazione distrazioni) di 50 scatti scelti dalla coppia.',
   300.00, 'FLAT', 'PEZZO', 60, false),
  ('Photobox digitale + galleria online 12 mesi',
   'Galleria online privata protetta da password, valida 12 mesi, con download in alta risoluzione e versione condivisibile con gli ospiti.',
   120.00, 'FLAT', 'EVENTO', 70, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'fotografo';

-- Clausole Fotografo
delete from public.clausola_template
 where professione_id = (select id from public.professioni where slug = 'fotografo');

insert into public.clausola_template
  (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO',
   'Reportage e consegna materiali',
   'Il Fotografo si impegna a realizzare il reportage fotografico del matrimonio di {{client_name}} previsto per il {{event_date}} presso {{event_location}}. La prestazione comprende: presenza in loco per le ore concordate, scatto reportage, post-produzione e consegna delle immagini editate in alta risoluzione tramite galleria online privata.',
   10),
  ('CORRISPETTIVI',
   'Acconto, saldo e tempi di consegna',
   'Il corrispettivo complessivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% a titolo di acconto alla firma, 70% a saldo entro sette (7) giorni prima dell''evento. La consegna delle foto editate avviene entro sessanta (60) giorni dalla data dell''evento; in caso di periodi di alta stagione (maggio-settembre) i tempi possono estendersi fino a novanta (90) giorni, previa comunicazione.',
   20),
  ('PROPRIETA_INTELLETTUALE',
   'Diritti d''autore e uso portfolio',
   'I diritti d''autore restano in capo al Fotografo ai sensi della L. 633/41. Il Cliente acquisisce licenza d''uso personale e non commerciale delle immagini consegnate. Il Fotografo si riserva il diritto di utilizzare una selezione delle immagini per portfolio, sito web, social e materiali promozionali, salvo richiesta scritta di riservatezza espressa entro la firma del contratto.',
   30),
  ('FORZA_MAGGIORE',
   'Sostituzione con professionista equivalente',
   'In caso di impossibilita'' del Fotografo a presenziare per causa di forza maggiore (malattia certificata, infortunio, calamita''), il Fotografo si impegna a fornire un sostituto di pari livello professionale appartenente alla propria rete, mantenendo invariato il corrispettivo. La post-produzione e la consegna restano in capo al Fotografo originario.',
   40)
) as c(categoria, titolo, body, sort_order)
where slug = 'fotografo';

-- Consigli Fotografo
delete from public.consiglio
 where professione_id = (select id from public.professioni where slug = 'fotografo');

insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Includi sempre l''engagement',
   'Includi sempre engagement: aiuta la coppia a sentirsi a suo agio davanti all''obiettivo e ti permette di arrivare al giorno conoscendoli gia''. Aumenta il prezzo medio del pacchetto e riduce gli imprevisti.',
   10),
  ('SERVIZI', 'Stima 60 giorni di consegna',
   'Stima 60 giorni di consegna: meglio prudenti che bruciati. In alta stagione (mag-set) sii esplicito sui 90 giorni: i clienti soddisfatti sono quelli che ricevono prima di quanto promesso.',
   10),
  ('CONTRATTI', 'Diritto di portfolio nero su bianco',
   'Specifica nero su bianco il diritto di portfolio: senza clausola scritta, ogni pubblicazione richiede consenso ad hoc. Se la coppia preferisce riservatezza, prevedi un supplemento "no portfolio".',
   10),
  ('GIORNO', 'Arrivo 2h prima del rito',
   'Arriva 2h prima del rito per i preparativi sposa: e'' il momento piu'' ricco emotivamente e quello che fa la differenza nel racconto finale. Briefing con WP o coordinatrice sala il giorno prima.',
   10),
  ('GIORNO', 'Due corpi + quattro ottiche',
   'Sempre 2 corpi macchina + 4 ottiche di backup. Una macchina che si rompe a meta'' cerimonia e'' una crisi irrecuperabile: l''attrezzatura ridondata e'' parte del prezzo che paghi al cliente.',
   20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'fotografo';

-- Checklist giorno Fotografo
delete from public.checklist_template
 where professione_id = (select id from public.professioni where slug = 'fotografo');

insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Backup batterie cariche (almeno 4 per corpo)', 'PRIMA_EVENTO', 10),
  ('Memory cards formattate, doppio slot attivo',  'PRIMA_EVENTO', 20),
  ('Sopralluogo location o briefing telefonico',   'PRIMA_EVENTO', 30),
  ('Shot list condivisa con sposi (10 must-have)', 'PRIMA_EVENTO', 40),
  ('Recap orari con Wedding Planner / coordinatrice sala', 'PRIMA_EVENTO', 50),
  ('Verifica luce naturale per slot foto coppia',  'ARRIVO', 10),
  ('Carica accessori: flash, fari LED, riflettori','ARRIVO', 20),
  ('Pulizia sensori e ottiche',                    'PRIMA_EVENTO', 60)
) as x(voce, momento, sort_order)
where slug = 'fotografo';

-- ─── 9) Seed professione FIORISTA ───────────────────────────────────────────
insert into public.professioni (nome, slug, gruppo, icona, etichette, unita_default, sort_order)
values (
  'Fiorista',
  'fiorista',
  'ALLESTIMENTI',
  'Flower2',
  jsonb_build_object(
    'servizio_label',   'I tuoi allestimenti floreali',
    'catalogo_label',   'Catalogo allestimenti',
    'preventivo_label', 'Allestimento floreale',
    'empty_state',      'Crea il tuo primo allestimento',
    'icona',            'Flower2'
  ),
  jsonb_build_object(
    'quantity_basis_default', 'FLAT',
    'service_unit_default',   'PEZZO'
  ),
  20
)
on conflict (slug) do update set
  nome          = excluded.nome,
  gruppo        = excluded.gruppo,
  icona         = excluded.icona,
  etichette     = excluded.etichette,
  unita_default = excluded.unita_default,
  attiva        = true;

-- Servizi-tipo Fiorista
delete from public.servizio_template
 where professione_id = (select id from public.professioni where slug = 'fiorista');

insert into public.servizio_template
  (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Bouquet sposa fine-art',
   'Bouquet di design realizzato con fiori di stagione, legatura in nastro di seta naturale. Prova bouquet con la sposa inclusa nella tariffa.',
   180.00, 'FLAT', 'PEZZO', 10, true),
  ('Centrotavola tondo medio (set di 10)',
   'Composizione floreale tonda media (30-35 cm) per centrotavola. Tariffa per pezzo, calcolata sul numero di tavoli effettivo.',
   120.00, 'PER_TABLE', 'PEZZO', 20, true),
  ('Arco/altare cerimonia rito civile',
   'Arco floreale per cerimonia simbolica o civile, montaggio in loco e smontaggio post-evento inclusi. Struttura in metallo o legno fornita dal fiorista.',
   850.00, 'FLAT', 'EVENTO', 30, true),
  ('Allestimento ingresso location',
   'Composizioni di benvenuto all''ingresso: cascate floreali, urne, ghirlande. Pensato per accogliere gli ospiti e dare il tono dell''evento.',
   380.00, 'FLAT', 'EVENTO', 40, true),
  ('Boutonniere sposo e testimoni (cad.)',
   'Mini-composizione per occhiello, coordinata col bouquet. Tariffa al pezzo, set tipico 4-6 boutonniere.',
   18.00, 'FLAT', 'PEZZO', 50, true),
  ('Sedute cerimonia - tralci laterali (set 20)',
   'Tralci floreali per fissaggio su sedute cerimonia, set di 20 pezzi. Smonta facile, ottimo effetto fotografico.',
   280.00, 'FLAT', 'PEZZO', 60, false),
  ('Sweet table - decorazione floreale',
   'Allestimento floreale dedicato al tavolo dei dolci/confettata: ghirlande, vasetti, fiori a tema.',
   250.00, 'FLAT', 'EVENTO', 70, false),
  ('Petali per il lancio (kg)',
   'Petali freschi naturali per il lancio degli ospiti, tariffa al chilogrammo. Quantita'' tipica: 1.5-3 kg.',
   35.00, 'FLAT', 'PEZZO', 80, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'fiorista';

-- Clausole Fiorista
delete from public.clausola_template
 where professione_id = (select id from public.professioni where slug = 'fiorista');

insert into public.clausola_template
  (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO',
   'Allestimenti floreali e tempi montaggio',
   'Il Fiorista si impegna a realizzare gli allestimenti floreali per il matrimonio di {{client_name}} del {{event_date}} presso {{event_location}}, secondo il mood condiviso e il preventivo allegato. Sono inclusi: progettazione composizioni, fornitura fiori, trasporto, montaggio in loco e smontaggio post-evento entro le ore concordate.',
   10),
  ('CORRISPETTIVI',
   'Anticipo e stagionalita'' dei fiori',
   'Il corrispettivo complessivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 50% a titolo di anticipo alla firma del contratto (necessario per il pre-ordine dei fiori), 50% a saldo entro sette (7) giorni prima dell''evento. Eventuali fiori richiesti fuori stagione comportano un sovrapprezzo dal +30% al +100% comunicato e accettato prima dell''acquisto.',
   20),
  ('SOSTITUZIONI',
   'Fiori stagionali alternativi a parita'' di costo',
   'In caso di indisponibilita'' al mercato fioraio di una o piu'' varieta'' previste nel preventivo (fattore stagionale, climatico o di filiera), il Fiorista si riserva il diritto di sostituirle con varieta'' equivalenti per colore e stile, mantenendo invariato il costo. Le sostituzioni vengono comunicate al Cliente non appena rilevate.',
   30),
  ('RECESSO',
   'Penali post acquisto fiori',
   'In caso di recesso da parte del Cliente, le seguenti penali si applicano sul corrispettivo complessivo: fino a sessanta (60) giorni prima dell''evento trattenimento del 20%; da sessanta (60) a quindici (15) giorni prima trattenimento del 50%; da quattordici (14) a sette (7) giorni prima trattenimento del 80%; nei sette (7) giorni precedenti l''evento penale del 100%, in quanto i fiori sono gia'' stati acquistati e non rivendibili.',
   40)
) as c(categoria, titolo, body, sort_order)
where slug = 'fiorista';

-- Consigli Fiorista
delete from public.consiglio
 where professione_id = (select id from public.professioni where slug = 'fiorista');

insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Indica sempre alternativa stagionale',
   'Indica sempre alternativa stagionale: i fiori fuori stagione raddoppiano il prezzo e qualche volta non arrivano. Proporre due opzioni (stagionale + premium) ti protegge e da'' al cliente potere decisionale.',
   10),
  ('SERVIZI', 'Bouquet sposa la mattina stessa',
   'Bouquet sposa va fatto la mattina stessa, non la sera prima: i fiori freschi della giornata si vedono in foto. Se devi consegnarlo per i preparativi alle 8, sveglia alle 5.',
   10),
  ('CONTRATTI', 'Clausola fiori last-minute',
   'Clausola specifica per fiori non disponibili last-minute: il mercato fioraio puo'' essere imprevedibile (clima, festivita''). Senza clausola di sostituzione, l''indisponibilita'' di una varieta'' diventa una contestazione legale.',
   10),
  ('GIORNO', 'Quattro ore prima per l''allestimento',
   'Arriva 4h prima dell''inizio cerimonia per allestimento sala/altare: i grandi allestimenti (arco, cascate, sedute) richiedono tempo e luce naturale per i ritocchi.',
   10),
  ('GIORNO', 'Tieni 10% di fiori in scorta',
   'Tieni 10% di fiori di scorta per ritocchi: sempre qualcosa si rovina durante il trasporto o il montaggio. Quel 10% e'' la differenza tra un allestimento perfetto e uno con buchi visibili in foto.',
   20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'fiorista';

-- Checklist giorno Fiorista
delete from public.checklist_template
 where professione_id = (select id from public.professioni where slug = 'fiorista');

insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Carico furgone refrigerato verificato',           'PRIMA_EVENTO', 10),
  ('Bouquet sposa preparato la mattina stessa',       'PRIMA_EVENTO', 20),
  ('Briefing montaggio con responsabile location',    'ARRIVO', 10),
  ('Allestimento arco/altare entro -3h cerimonia',    'ARRIVO', 20),
  ('Centrotavola sui tavoli con i nomi corretti',     'ARRIVO', 30),
  ('Set fiori di scorta per ritocchi (10%)',          'DURANTE', 10),
  ('Smontaggio e ritiro materiali noleggio',          'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'fiorista';

-- ─── 10) Backfill profiles.professione_id = 'generico' per chi non l'ha ─────
-- Best-effort, solo profili attualmente NULL. I nuovi profili dovranno
-- scegliere in onboarding; chi salta avra' ugualmente il fallback.
update public.profiles
   set professione_id = (select id from public.professioni where slug = 'generico')
 where professione_id is null;

-- ============================================================================
-- Note finali:
-- - Idempotenza: tutte le insert seed sono delete+insert tranne le 3
--   professioni che usano on conflict (slug). Rilanciando la migration i seed
--   tornano allo stato canonico senza errori.
-- - Nessuna view o RPC introdotta: il frontend joina direttamente.
-- - Le tabelle template hanno SELECT a tutti gli authenticated: cosi` il WP
--   che invita un fornitore puo` mostrare un anteprima del catalogo template
--   anche prima che il fornitore sia loggato.
-- ============================================================================
