-- ============================================================================
-- Pacchetti professione — Seed completo di tutte le professioni (FASE 2)
-- ============================================================================
-- Estende il seed di Fase 1 (Generico/Fotografo/Fiorista) con TUTTE le altre
-- professioni della tassonomia. Un solo file, una transazione implicita per
-- file di migrazione: ON CONFLICT/DELETE+INSERT per idempotenza.
--
-- Strategia idempotente:
--  - professioni:           insert ... on conflict (slug) do update
--  - servizio_template:     delete where professione_id = <slug> + insert
--  - clausola_template:     delete where professione_id = <slug> + insert
--  - consiglio:             delete where professione_id = <slug> + insert
--  - checklist_template:    delete where professione_id = <slug> + insert
--
-- Casi speciali (UX da gestire altrove, qui solo dati):
--  - Celebrante/officiante: spesso non e' un fornitore "pagante", e' una
--    risorsa. Il pacchetto e' presente per dargli un volto in piattaforma.
--    Le clausole sono pensate per inquadramento (rito civile/simbolico/
--    religioso) e gli importi sono fittizi/0.
--  - Hotel/Alloggi: gestito spesso come allotment camere, non come quote
--    unitario. quantity_basis='PER_TABLE' viene riusato come proxy "camera"
--    per coerenza enum.
--  - Transfer/Navette: servizi a corsa o ad orario; vehicle capacity solo
--    nella descrizione.
-- ============================================================================

-- ─── 1) Inserimento professioni (etichette + unita_default) ─────────────────

insert into public.professioni (nome, slug, gruppo, icona, etichette, unita_default, sort_order)
values
  -- IMMAGINE
  ('Videomaker', 'videomaker', 'IMMAGINE', 'Video',
   jsonb_build_object(
     'servizio_label',   'Pacchetti video e wedding film',
     'catalogo_label',   'I miei pacchetti video',
     'preventivo_label', 'Pacchetto video',
     'empty_state',      'Crea il tuo primo wedding film',
     'icona',            'Video'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 11),

  ('Drone / Fotografo aereo', 'drone-fotografo', 'IMMAGINE', 'Plane',
   jsonb_build_object(
     'servizio_label',   'Riprese aeree e droni',
     'catalogo_label',   'Servizi drone',
     'preventivo_label', 'Servizio drone',
     'empty_state',      'Crea il tuo primo servizio aereo',
     'icona',            'Plane'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 12),

  -- COORDINAMENTO
  ('Wedding planner', 'wedding-planner', 'COORDINAMENTO', 'ClipboardList',
   jsonb_build_object(
     'servizio_label',   'I tuoi pacchetti di coordinamento',
     'catalogo_label',   'Pacchetti wedding planning',
     'preventivo_label', 'Pacchetto coordinamento',
     'empty_state',      'Crea il tuo primo pacchetto WP',
     'icona',            'ClipboardList'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 20),

  ('Event / Wedding designer', 'event-designer', 'COORDINAMENTO', 'Palette',
   jsonb_build_object(
     'servizio_label',   'I tuoi concept di design',
     'catalogo_label',   'Concept e mood',
     'preventivo_label', 'Concept design',
     'empty_state',      'Crea il tuo primo concept',
     'icona',            'Palette'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 21),

  -- LUOGO_CIBO
  ('Location', 'location', 'LUOGO_CIBO', 'MapPin',
   jsonb_build_object(
     'servizio_label',   'Spazi e formule della location',
     'catalogo_label',   'Spazi e formule',
     'preventivo_label', 'Affitto location',
     'empty_state',      'Crea il tuo primo spazio',
     'icona',            'MapPin'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 30),

  ('Catering', 'catering', 'LUOGO_CIBO', 'UtensilsCrossed',
   jsonb_build_object(
     'servizio_label',   'I tuoi menu e servizi food',
     'catalogo_label',   'Menu e servizi catering',
     'preventivo_label', 'Servizio catering',
     'empty_state',      'Crea il tuo primo menu',
     'icona',            'UtensilsCrossed'
   ),
   jsonb_build_object('quantity_basis_default','PER_GUEST','service_unit_default','PERSONA'), 31),

  ('Pasticceria / Wedding cake', 'pasticceria-wedding-cake', 'LUOGO_CIBO', 'Cake',
   jsonb_build_object(
     'servizio_label',   'Le tue torte e dessert',
     'catalogo_label',   'Wedding cake e dolci',
     'preventivo_label', 'Wedding cake',
     'empty_state',      'Crea la tua prima wedding cake',
     'icona',            'Cake'
   ),
   jsonb_build_object('quantity_basis_default','PER_GUEST','service_unit_default','PERSONA'), 32),

  ('Confettata', 'confettata', 'LUOGO_CIBO', 'Candy',
   jsonb_build_object(
     'servizio_label',   'Le tue postazioni confettata',
     'catalogo_label',   'Postazioni confettata',
     'preventivo_label', 'Confettata',
     'empty_state',      'Crea la tua prima confettata',
     'icona',            'Candy'
   ),
   jsonb_build_object('quantity_basis_default','PER_GUEST','service_unit_default','PERSONA'), 33),

  -- ALLESTIMENTI
  ('Noleggio scenografie', 'noleggio-scenografie', 'ALLESTIMENTI', 'Package',
   jsonb_build_object(
     'servizio_label',   'I tuoi elementi a noleggio',
     'catalogo_label',   'Catalogo noleggio',
     'preventivo_label', 'Noleggio scenografia',
     'empty_state',      'Crea il tuo primo elemento a noleggio',
     'icona',            'Package'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PEZZO'), 40),

  -- BELLEZZA
  ('Make-up artist', 'makeup-artist', 'BELLEZZA', 'Sparkles',
   jsonb_build_object(
     'servizio_label',   'I tuoi pacchetti make-up',
     'catalogo_label',   'Make-up sposa e ospiti',
     'preventivo_label', 'Servizio make-up',
     'empty_state',      'Crea il tuo primo pacchetto make-up',
     'icona',            'Sparkles'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PERSONA'), 50),

  ('Hair stylist', 'hair-stylist', 'BELLEZZA', 'Scissors',
   jsonb_build_object(
     'servizio_label',   'I tuoi servizi hair',
     'catalogo_label',   'Acconciature sposa e ospiti',
     'preventivo_label', 'Servizio hair',
     'empty_state',      'Crea il tuo primo servizio hair',
     'icona',            'Scissors'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PERSONA'), 51),

  -- MUSICA
  ('Band / Musica dal vivo', 'band-live', 'MUSICA', 'Mic',
   jsonb_build_object(
     'servizio_label',   'I tuoi set musicali dal vivo',
     'catalogo_label',   'Set e formazioni',
     'preventivo_label', 'Musica dal vivo',
     'empty_state',      'Crea il tuo primo set live',
     'icona',            'Mic'
   ),
   jsonb_build_object('quantity_basis_default','PER_HOUR','service_unit_default','ORA'), 60),

  ('DJ service', 'dj-service', 'MUSICA', 'Disc',
   jsonb_build_object(
     'servizio_label',   'I tuoi pacchetti DJ',
     'catalogo_label',   'Pacchetti DJ set',
     'preventivo_label', 'Servizio DJ',
     'empty_state',      'Crea il tuo primo DJ set',
     'icona',            'Disc'
   ),
   jsonb_build_object('quantity_basis_default','PER_HOUR','service_unit_default','ORA'), 61),

  ('Intrattenimento', 'intrattenimento', 'MUSICA', 'PartyPopper',
   jsonb_build_object(
     'servizio_label',   'I tuoi format di intrattenimento',
     'catalogo_label',   'Animazione e show',
     'preventivo_label', 'Intrattenimento',
     'empty_state',      'Crea il tuo primo format',
     'icona',            'PartyPopper'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 62),

  -- ABBIGLIAMENTO
  ('Atelier sposa', 'atelier-sposa', 'ABBIGLIAMENTO', 'Shirt',
   jsonb_build_object(
     'servizio_label',   'Abiti e servizi atelier',
     'catalogo_label',   'Atelier sposa',
     'preventivo_label', 'Abito sposa',
     'empty_state',      'Crea il tuo primo abito',
     'icona',            'Shirt'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PEZZO'), 70),

  ('Sartoria sposo', 'sartoria-sposo', 'ABBIGLIAMENTO', 'Shirt',
   jsonb_build_object(
     'servizio_label',   'Abiti e servizi sartoria',
     'catalogo_label',   'Sartoria sposo',
     'preventivo_label', 'Abito sposo',
     'empty_state',      'Crea il tuo primo abito sartoriale',
     'icona',            'Shirt'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PEZZO'), 71),

  ('Gioielli / Fedi', 'gioielli-fedi', 'ABBIGLIAMENTO', 'Gem',
   jsonb_build_object(
     'servizio_label',   'I tuoi gioielli e fedi',
     'catalogo_label',   'Fedi e gioielli sposi',
     'preventivo_label', 'Gioiello',
     'empty_state',      'Crea il tuo primo gioiello',
     'icona',            'Gem'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PEZZO'), 72),

  -- MOBILITA
  ('Auto / Wedding car', 'wedding-car', 'MOBILITA', 'Car',
   jsonb_build_object(
     'servizio_label',   'Le tue auto da cerimonia',
     'catalogo_label',   'Wedding car',
     'preventivo_label', 'Auto sposi',
     'empty_state',      'Crea la tua prima wedding car',
     'icona',            'Car'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 80),

  ('Transfer / Navette', 'transfer-navette', 'MOBILITA', 'Bus',
   jsonb_build_object(
     'servizio_label',   'I tuoi servizi transfer',
     'catalogo_label',   'Transfer e navette ospiti',
     'preventivo_label', 'Servizio transfer',
     'empty_state',      'Crea il tuo primo servizio transfer',
     'icona',            'Bus'
   ),
   jsonb_build_object('quantity_basis_default','PER_HOUR','service_unit_default','ORA'), 81),

  ('Hotel / Alloggi', 'hotel-alloggi', 'MOBILITA', 'BedDouble',
   jsonb_build_object(
     'servizio_label',   'Le tue tariffe camere',
     'catalogo_label',   'Camere e allotment',
     'preventivo_label', 'Allotment camere',
     'empty_state',      'Crea la tua prima tariffa camera',
     'icona',            'BedDouble'
   ),
   jsonb_build_object('quantity_basis_default','PER_TABLE','service_unit_default','PEZZO'), 82),

  -- EXTRA
  ('Fuochi d''artificio', 'fuochi-artificio', 'EXTRA', 'Sparkle',
   jsonb_build_object(
     'servizio_label',   'I tuoi spettacoli pirotecnici',
     'catalogo_label',   'Pirotecnica',
     'preventivo_label', 'Spettacolo pirotecnico',
     'empty_state',      'Crea il tuo primo show pirotecnico',
     'icona',            'Sparkle'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 90),

  ('Open bar / Mixology', 'open-bar-mixology', 'EXTRA', 'Wine',
   jsonb_build_object(
     'servizio_label',   'I tuoi pacchetti bar',
     'catalogo_label',   'Open bar e mixology',
     'preventivo_label', 'Servizio bar',
     'empty_state',      'Crea il tuo primo open bar',
     'icona',            'Wine'
   ),
   jsonb_build_object('quantity_basis_default','PER_GUEST','service_unit_default','PERSONA'), 91),

  ('Postazioni speciali', 'postazioni-speciali', 'EXTRA', 'Coffee',
   jsonb_build_object(
     'servizio_label',   'Le tue postazioni a tema',
     'catalogo_label',   'Postazioni food experience',
     'preventivo_label', 'Postazione tematica',
     'empty_state',      'Crea la tua prima postazione',
     'icona',            'Coffee'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 92),

  ('Bomboniere', 'bomboniere', 'EXTRA', 'Gift',
   jsonb_build_object(
     'servizio_label',   'Le tue bomboniere',
     'catalogo_label',   'Bomboniere',
     'preventivo_label', 'Bomboniera',
     'empty_state',      'Crea la tua prima bomboniera',
     'icona',            'Gift'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PEZZO'), 93),

  ('Inviti / Stationery', 'inviti-stationery', 'EXTRA', 'Mail',
   jsonb_build_object(
     'servizio_label',   'I tuoi inviti e stationery',
     'catalogo_label',   'Inviti e wedding suite',
     'preventivo_label', 'Wedding suite',
     'empty_state',      'Crea la tua prima suite',
     'icona',            'Mail'
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','PEZZO'), 94),

  ('Celebrante / Officiante', 'celebrante-officiante', 'EXTRA', 'BookOpen',
   jsonb_build_object(
     'servizio_label',   'I tuoi format di cerimonia',
     'catalogo_label',   'Cerimonie simboliche e civili',
     'preventivo_label', 'Cerimonia',
     'empty_state',      'Crea il tuo primo format cerimonia',
     'icona',            'BookOpen',
     'is_risorsa',       true
   ),
   jsonb_build_object('quantity_basis_default','FLAT','service_unit_default','EVENTO'), 95)

on conflict (slug) do update set
  nome          = excluded.nome,
  gruppo        = excluded.gruppo,
  icona         = excluded.icona,
  etichette     = excluded.etichette,
  unita_default = excluded.unita_default,
  sort_order    = excluded.sort_order,
  attiva        = true;

-- ============================================================================
-- VIDEOMAKER
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'videomaker');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Wedding film - giornata completa', 'Riprese dai preparativi al taglio della torta. Consegna trailer 3-5 minuti + film esteso 15-25 minuti in 4K, montaggio cinematografico con color grading.', 2400.00, 'FLAT', 'EVENTO', 10, true),
  ('Highlight cinematic 3-5 minuti', 'Trailer cinematico breve, ideale per social: ritmo serrato, musica licenziata, color grading professionale. Consegna in 4K e versione vertical 9:16 per stories.', 800.00, 'FLAT', 'EVENTO', 20, true),
  ('Film esteso 20-30 minuti', 'Wedding film esteso con voce sposi, rito integrale, brindisi, primi balli. Consegna su pendrive personalizzata + link privato.', 600.00, 'FLAT', 'EVENTO', 30, true),
  ('Riprese cerimonia multi-camera (2 op.)', 'Due operatori sincronizzati per cerimonia: piano largo + dettagli. Audio da impianto sala via cavo XLR.', 700.00, 'FLAT', 'EVENTO', 40, true),
  ('Save the date video (pre-wedding)', 'Mini film 60-90 secondi girato in location prescelta, da condividere come invito digitale animato.', 450.00, 'FLAT', 'EVENTO', 50, false),
  ('Voice over sposi (registrazione lettere)', 'Sessione di registrazione voce sposi (lettere o promesse) in studio o in location, integrata nel film come tessuto narrativo.', 200.00, 'FLAT', 'EVENTO', 60, false),
  ('Aerial coverage drone (operatore ENAC)', 'Riprese aeree con drone certificato ENAC, scenari panoramici e top-down. Compreso permesso volo dove richiesto.', 350.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'videomaker';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'videomaker');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Wedding film e consegna materiali', 'Il Videomaker si impegna a realizzare il wedding film del matrimonio di {{client_name}} del {{event_date}} presso {{event_location}}. Sono inclusi: presenza operatore/i per le ore concordate, riprese in 4K, post-produzione, color grading, sound design e consegna su supporto digitale.', 10),
  ('CORRISPETTIVI', 'Acconto, saldo e tempi di consegna', 'Il corrispettivo complessivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% acconto alla firma, 70% a saldo entro sette (7) giorni prima dell''evento. Consegna del trailer entro sessanta (60) giorni e del film esteso entro centoventi (120) giorni dalla data dell''evento.', 20),
  ('PROPRIETA_INTELLETTUALE', 'Diritti d''autore e licenze musicali', 'I diritti d''autore del wedding film restano in capo al Videomaker. Il Cliente acquisisce licenza d''uso personale e non commerciale. Le musiche utilizzate provengono da library licenziate (Musicbed/Artlist/SCF SIAE); il Cliente non potra'' caricare il film su piattaforme che monetizzano (es. YouTube) senza preventiva verifica con il Videomaker.', 30),
  ('FORZA_MAGGIORE', 'Backup attrezzatura e sostituzione', 'Il Videomaker garantisce backup di tutte le memorie ENTRO la giornata stessa su doppio supporto. In caso di impossibilita'' a presenziare per forza maggiore documentata, il Videomaker si impegna a fornire un sostituto di pari livello professionale.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'videomaker';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'videomaker');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Vendi trailer + film esteso', 'Vendi pacchetto trailer + film esteso, non solo il film lungo: il trailer e'' quello che la coppia condivide sui social ed e'' il tuo miglior strumento di marketing organico.', 10),
  ('SERVIZI', 'Audio da impianto sala via XLR', 'In cerimonia prendi sempre audio dall''impianto sala via XLR + lavalier sullo sposo come backup: l''audio scarso e'' il primo motivo di reclamo sui wedding film.', 10),
  ('CONTRATTI', 'Specifica le licenze musicali', 'Specifica esplicitamente da quali library prendi le musiche: senza riferimento alla licenza, ogni upload su YouTube/Vimeo del cliente puo'' generare un claim e farti chiamare in causa.', 10),
  ('GIORNO', 'Backup memorie ENTRO la giornata', 'Backup memorie ENTRO la giornata stessa su due dischi diversi prima di tornare a casa: la macchina rubata o l''hard disk che si rompe sono incubi raccontati in ogni community videomaker.', 10),
  ('GIORNO', 'Coordinati col fotografo prima', 'Coordinati col fotografo il giorno prima per non incrociarvi negli scatti: i wedding film con il fotografo nel quadro durante il primo ballo sono inguardabili.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'videomaker';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'videomaker');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Batterie cariche (2 set completi)', 'PRIMA_EVENTO', 10),
  ('Memory cards formattate + spare', 'PRIMA_EVENTO', 20),
  ('Briefing con fotografo per coordinamento riprese', 'PRIMA_EVENTO', 30),
  ('Test audio lavalier sposo e cavi XLR', 'PRIMA_EVENTO', 40),
  ('Sopralluogo luoghi cerimonia/ricevimento', 'PRIMA_EVENTO', 50),
  ('Setup multi-camera cerimonia (-1h)', 'ARRIVO', 10),
  ('Backup dischi prima di lasciare la location', 'PARTENZA', 10),
  ('Doppia copia su disco a casa entro 24h', 'PARTENZA', 20)
) as x(voce, momento, sort_order)
where slug = 'videomaker';

-- ============================================================================
-- DRONE / FOTOGRAFO AEREO
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'drone-fotografo');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Riprese drone cerimonia + ricevimento', 'Operatore ENAC con drone classe C0/C1. Riprese aeree cerimonia (esterna), arrivo sposi, panoramica location, ritratto coppia dall''alto. Consegna footage 4K editato.', 650.00, 'FLAT', 'EVENTO', 10, true),
  ('Top-down ritratto coppia (sequenza)', 'Sequenza dedicata al ritratto sposi dall''alto: scia floreale, geometrie, sviluppi cinematici. Output 30-60 secondi montati.', 250.00, 'FLAT', 'EVENTO', 20, true),
  ('Fly-over location (panoramica)', 'Volo panoramico sulla tenuta/location, da usare come opening shot in wedding film. Consegna in 4K 50fps.', 200.00, 'FLAT', 'EVENTO', 30, true),
  ('Permesso volo zone regolamentate', 'Richiesta autorizzazione ENAC per voli in zone CTR/atypical (vicinanze aeroporti, riserve naturali, centri urbani). Pratica e tempi di attesa variabili.', 150.00, 'FLAT', 'EVENTO', 40, false),
  ('Operatore secondario per backup drone', 'Secondo operatore con drone di riserva pronto, per garantire continuita'' in caso di guasto. Consigliato per eventi con tempo limitato (5 min in cerimonia).', 300.00, 'FLAT', 'EVENTO', 50, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'drone-fotografo';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'drone-fotografo');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Riprese aeree e certificazioni', 'L''Operatore drone, in possesso di patentino ENAC A2/STS e di assicurazione RC voli aeromobili a pilotaggio remoto, si impegna a realizzare riprese aeree per l''evento di {{client_name}} del {{event_date}} presso {{event_location}}, nel rispetto del Regolamento UE 2019/947.', 10),
  ('FORZA_MAGGIORE', 'Condizioni meteo e impossibilita'' volo', 'In caso di condizioni meteo avverse (vento sostenuto > 35 km/h, pioggia, visibilita'' ridotta) o restrizioni di volo non prevedibili al momento della firma (NOTAM, eventi terzi), il volo potra'' essere annullato per ragioni di sicurezza. In tal caso il Cliente non avra'' diritto al rimborso del costo della trasferta, ma il corrispettivo riprese verra'' ridotto del 70%.', 20),
  ('RESPONSABILITA', 'Assicurazione e responsabilita'' civile', 'L''Operatore e'' coperto da polizza RC voli con massimale di 1.000.000 di euro come da Regolamento ENAC. La responsabilita'' per eventuali danni causati dal mezzo aereo e'' integralmente in capo all''Operatore.', 30),
  ('PROPRIETA_INTELLETTUALE', 'Diritti immagini aeree', 'I diritti d''autore delle riprese aeree restano in capo all''Operatore. Il Cliente acquisisce licenza personale non commerciale. L''Operatore puo'' utilizzare estratti per portfolio salvo richiesta scritta di riservatezza.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'drone-fotografo';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'drone-fotografo');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Verifica zona volo subito', 'Verifica la zona di volo prima del preventivo: alcune location sono in CTR aeroportuale o aree protette dove i permessi richiedono 30-60 giorni e non sono garantiti.', 10),
  ('SERVIZI', 'Clausola meteo nero su bianco', 'Inserisci clausola meteo esplicita: il vento sopra i 35 km/h ti obbliga a non volare per legge. Senza clausola scritta, il cliente puo'' contestare il "mancato servizio" anche se sei tu a salvare la sua giornata.', 10),
  ('CONTRATTI', 'Esibisci patentino e assicurazione', 'Esibisci sempre patentino ENAC + polizza RC come allegati al contratto: e'' il primo segnale di professionalita'' e ti distingue dagli operatori occasionali.', 10),
  ('GIORNO', 'Sopralluogo aereo il giorno prima', 'Fai sopralluogo aereo il giorno prima dell''evento per identificare ostacoli (cavi, alberi alti, antenne) non visibili dalle mappe. Anche 10 minuti di volo di ricognizione cambiano tutto.', 10),
  ('GIORNO', 'Coordinati con WP per finestre volo', 'Concorda con WP/fotografo le finestre di volo (in genere: arrivo sposi, post-cerimonia, ritratto coppia): la regola "non sovrappormi al fotografo" e'' anti-conflitto.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'drone-fotografo';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'drone-fotografo');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Verifica meteo e finestra vento (-48h)', 'PRIMA_EVENTO', 10),
  ('Check NOTAM e restrizioni area', 'PRIMA_EVENTO', 20),
  ('Patentino ENAC + polizza in PDF su telefono', 'PRIMA_EVENTO', 30),
  ('Batterie drone cariche (almeno 6)', 'PRIMA_EVENTO', 40),
  ('Sopralluogo aereo ricognitivo', 'ARRIVO', 10),
  ('Coordinamento finestre volo con WP e foto', 'ARRIVO', 20),
  ('Check sicurezza zona decollo/atterraggio', 'DURANTE', 10),
  ('Backup footage su 2 supporti prima della partenza', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'drone-fotografo';

-- ============================================================================
-- WEDDING PLANNER
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'wedding-planner');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Full planning (12-18 mesi)', 'Coordinamento completo dalla scelta location alla regia del giorno. Selezione fornitori, gestione budget, design concept, timeline, ospiti. Incontri illimitati.', 6500.00, 'FLAT', 'EVENTO', 10, true),
  ('Partial planning (4-6 mesi)', 'Subentro a metà percorso: ottimizzazione fornitori già scelti, costruzione timeline, regia del giorno. Consigliato per chi ha già preso decisioni grosse.', 3500.00, 'FLAT', 'EVENTO', 20, true),
  ('Coordinamento del giorno (Day-coordination)', 'Solo regia operativa del giorno: timeline minuto-per-minuto, gestione fornitori in loco, problem solving. Briefing finali nelle 6 settimane precedenti.', 1500.00, 'FLAT', 'EVENTO', 30, true),
  ('Consulenza budget e selezione fornitori', 'Pacchetto consulenziale 3-5 incontri per scelta fornitori e impostazione budget. Senza coordinamento giorno.', 800.00, 'FLAT', 'EVENTO', 40, false),
  ('Design concept e mood board', 'Definizione del concept estetico: paletta colori, mood board, indicazioni per fioristi/stationery/allestimenti. Vendibile separato.', 600.00, 'FLAT', 'EVENTO', 50, false),
  ('Gestione invitati e RSVP digitale', 'Setup piattaforma RSVP digitale, follow-up ospiti, gestione menu speciali (allergie, vegetariani, bambini), tableau de mariage.', 450.00, 'FLAT', 'EVENTO', 60, false),
  ('Destination wedding management', 'Supplemento per matrimoni fuori regione/estero: scouting location, logistica trasferte fornitori, gestione documentale.', 2000.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'wedding-planner';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'wedding-planner');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Coordinamento e mandato senza rappresentanza', 'Il Wedding Planner si impegna a svolgere attivita'' di consulenza e coordinamento per il matrimonio di {{client_name}} del {{event_date}} presso {{event_location}}. Il Wedding Planner agisce in nome e per conto del Cliente con mandato senza rappresentanza: i contratti coi fornitori restano in capo al Cliente, salvo diverso accordo scritto.', 10),
  ('CORRISPETTIVI', 'Fee fissa e principio anti-kickback', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa, suddivisi in: 30% alla firma, 30% a 90 giorni dall''evento, 40% a saldo 15 giorni prima. Il Wedding Planner dichiara di non percepire commissioni occulte dai fornitori e di rendere trasparenti eventuali sconti convenzionati.', 20),
  ('RESPONSABILITA', 'Limite responsabilita'' su fornitori terzi', 'La responsabilita'' del Wedding Planner e'' limitata alla diligenza professionale nella selezione e nel coordinamento. Per le prestazioni dei fornitori terzi (catering, fotografo, fiorista, ecc.) la responsabilita'' resta in capo ai singoli fornitori, con cui il Cliente sottoscrive contratti separati.', 30),
  ('RECESSO', 'Penali graduate per recesso Cliente', 'In caso di recesso da parte del Cliente, si applicano le seguenti penali sul corrispettivo: fino a 180 giorni prima dell''evento trattenimento del 20%; da 180 a 90 giorni trattenimento del 50%; da 90 a 30 giorni trattenimento del 80%; sotto i 30 giorni penale del 100%.', 40),
  ('PRIVACY_GDPR', 'Trattamento dati ospiti', 'I dati personali degli ospiti raccolti per RSVP/tableau de mariage vengono trattati ai sensi del Reg. UE 2016/679 esclusivamente per la pianificazione dell''evento e cancellati entro 90 giorni dall''evento stesso, salvo diverso accordo.', 50)
) as c(categoria, titolo, body, sort_order)
where slug = 'wedding-planner';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'wedding-planner');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Fee fissa, mai percentuale del budget', 'Vendi fee fissa, mai percentuale sul budget: la percentuale ti mette in conflitto di interessi (piu'' spendono, piu'' guadagni) e il cliente alla lunga lo percepisce.', 10),
  ('SERVIZI', 'Day-coordination come gateway', 'Vendi sempre il day-coordination come pacchetto entry-level: e'' il modo per intercettare coppie che pensano di non aver bisogno di un WP e farsi conoscere senza il committment del full planning.', 10),
  ('CONTRATTI', 'Dichiara anti-kickback nero su bianco', 'Inserisci sempre la dichiarazione anti-kickback in contratto: e'' un fortissimo segnale di trasparenza e ti distingue da chi maschera commissioni occulte.', 10),
  ('GIORNO', 'Timeline minuto-per-minuto stampata', 'Stampa la timeline minuto-per-minuto e dalla a tutti i fornitori la sera prima: un foglio A4 con orari e contatti vale piu'' di 30 messaggi WhatsApp.', 10),
  ('GIORNO', 'Tienti almeno 30 minuti di buffer', 'Inserisci almeno 30 minuti di buffer tra i blocchi (preparativi-cerimonia, aperitivo-cena, taglio-balli): il giorno scivola sempre, e il buffer e'' la differenza tra "rilassati" e "in affanno".', 20),
  ('GIORNO', 'Una persona = una decisione', 'Definisci in anticipo chi prende le decisioni nei momenti caldi (la sposa? lo sposo? la madre?). Senza una persona di riferimento univoca, le scelte dell''ultimo minuto diventano discussioni.', 30)
) as x(contesto, titolo, testo, sort_order)
where slug = 'wedding-planner';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'wedding-planner');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Timeline finale stampata x tutti i fornitori', 'PRIMA_EVENTO', 10),
  ('Briefing telefonico fornitori (-72h)', 'PRIMA_EVENTO', 20),
  ('Conferma orari arrivo singoli fornitori', 'PRIMA_EVENTO', 30),
  ('Tableau de mariage finale stampato', 'PRIMA_EVENTO', 40),
  ('Kit emergenza (cucito, antinfiammatori, cerotti, scotch)', 'PRIMA_EVENTO', 50),
  ('Arrivo in location 2h prima cerimonia', 'ARRIVO', 10),
  ('Verifica setup sala con responsabile location', 'ARRIVO', 20),
  ('Coordinamento arrivo fornitori e timing', 'DURANTE', 10),
  ('Gestione discorsi e momenti emozionali', 'DURANTE', 20),
  ('Saluto sposi e raccolta documenti/regali', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'wedding-planner';

-- ============================================================================
-- EVENT / WEDDING DESIGNER
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'event-designer');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Concept design completo + execution', 'Sviluppo concept estetico (paletta, mood, materiali) + esecuzione allestimenti chiavi in mano. Render 3D location inclusi.', 4500.00, 'FLAT', 'EVENTO', 10, true),
  ('Mood board e art direction', 'Definizione mood board, paletta colori, tipografie, riferimenti materici. Vendibile a coppie che hanno fiorista/allestitore ma vogliono coerenza estetica.', 900.00, 'FLAT', 'EVENTO', 20, true),
  ('Lighting design serale', 'Progettazione luci ambiente per cena e party: catene calde, faretti architetturali, fari da ballo. Studio fotometrico location.', 1200.00, 'FLAT', 'EVENTO', 30, true),
  ('Tableau de mariage di design', 'Tableau de mariage scenografico (cornice grande formato, tableau verticale, installazione floreale dedicata).', 450.00, 'FLAT', 'EVENTO', 40, true),
  ('Print stationery in coordinato', 'Set stationery in coordinato col concept: menu, segnaposto, programma, ringraziamenti, libretto cerimonia. Stampa inclusa fino a 120 ospiti.', 750.00, 'FLAT', 'EVENTO', 50, false),
  ('Render 3D location pre-evento', 'Tre rendering fotorealistici degli spazi allestiti, per dare alla coppia visione preliminare e ai fornitori spec esecutive.', 600.00, 'FLAT', 'EVENTO', 60, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'event-designer';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'event-designer');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Concept design e direzione artistica', 'L''Event Designer si impegna a sviluppare concept estetico e direzione artistica per il matrimonio di {{client_name}} del {{event_date}} presso {{event_location}}, secondo brief condiviso. Sono inclusi: mood board, paletta materica, render 3D e specifica tecnica per i fornitori esecutivi.', 10),
  ('PROPRIETA_INTELLETTUALE', 'Diritti d''autore sul concept', 'Il concept design e tutti i materiali progettuali (mood board, render, specifiche) restano di proprieta'' intellettuale dell''Event Designer. Il Cliente acquisisce licenza d''uso limitata al proprio evento. L''Event Designer puo'' utilizzare immagini dell''evento per portfolio.', 20),
  ('SOSTITUZIONI', 'Materiali alternativi a parita'' di stile', 'In caso di indisponibilita'' di materiali specifici (carta, tessuti, fiori secchi, oggettistica) al momento dell''esecuzione, l''Event Designer si riserva il diritto di sostituirli con elementi equivalenti per stile e qualita''.', 30),
  ('CORRISPETTIVI', 'Acconto e pagamento per fasi', 'Il corrispettivo complessivo e'' di {{total_amount}} euro IVA inclusa: 30% alla firma per inizio progettazione, 30% all''approvazione concept (entro 60gg pre-evento), 40% a saldo 7gg pre-evento.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'event-designer';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'event-designer');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Vendi mood board come prima vendita', 'Vendi il mood board come ingresso a basso costo (€500-900): converte molto bene, dimostra capacita'' progettuale e spesso poi diventa un full design.', 10),
  ('SERVIZI', 'Render 3D vendono molto', 'Investi sui render 3D: il cliente che vede in 3D lo spazio allestito firma molto piu'' velocemente di chi vede solo mood board 2D.', 10),
  ('CONTRATTI', 'Tutela il concept per portfolio', 'Specifica che il concept resta tuo per portfolio: alcuni clienti vogliono "esclusiva visiva" — in quel caso fai pagare supplemento NDA esplicito.', 10),
  ('GIORNO', 'Sopralluogo finale -7gg', 'Fai sopralluogo finale 7gg prima coi fornitori esecutivi (fiorista, noleggio, location): le sorprese al montaggio vengono dai dettagli sottovalutati 3 settimane prima.', 10),
  ('GIORNO', 'Reference fotografiche con te', 'Porta sempre con te le reference fotografiche del concept stampate: nel caos del montaggio la memoria visiva non basta, serve un PDF a portata di mano.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'event-designer';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'event-designer');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Sopralluogo finale con fornitori esecutivi', 'PRIMA_EVENTO', 10),
  ('PDF concept stampato + reference visive', 'PRIMA_EVENTO', 20),
  ('Verifica spedizioni materiali noleggio/import', 'PRIMA_EVENTO', 30),
  ('Conferma stampa stationery e tableau', 'PRIMA_EVENTO', 40),
  ('Briefing montaggio con fiorista e allestitore', 'ARRIVO', 10),
  ('Verifica posizionamento elementi scenografici', 'ARRIVO', 20),
  ('Lighting check pre-cena', 'DURANTE', 10),
  ('Documentazione fotografica allestimento per portfolio', 'DURANTE', 20)
) as x(voce, momento, sort_order)
where slug = 'event-designer';

-- ============================================================================
-- LOCATION
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'location');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Esclusiva venue intera giornata', 'Affitto esclusivo location dalle 10:00 fino a fine evento (max 02:00). Sala interna + giardino + parcheggio ospiti. Custode in loco.', 5500.00, 'FLAT', 'EVENTO', 10, true),
  ('Cerimonia simbolica in giardino', 'Spazio dedicato per rito civile/simbolico in giardino: pedana, sedie cerimonia (fino a 120 ospiti), impianto audio base.', 1200.00, 'FLAT', 'EVENTO', 20, true),
  ('Aperitivo welcome in dehors', 'Spazio dehors/terrazza dedicato aperitivo benvenuto: tavoli alti, gazebo, illuminazione. Setup standard incluso.', 800.00, 'FLAT', 'EVENTO', 30, true),
  ('Pacchetto camere sposi + 5 familiari', 'Suite sposi + 5 camere doppie per familiari, notte dell''evento + colazione. Late checkout 14:00.', 1400.00, 'FLAT', 'EVENTO', 40, true),
  ('Extending hours fino alle 04:00', 'Estensione orario chiusura dalle 02:00 alle 04:00 per party prolungato. Include custode e pulizia.', 600.00, 'PER_HOUR', 'ORA', 50, false),
  ('Sala interna per pioggia (plan B)', 'Garanzia di sala interna utilizzabile come piano B in caso di maltempo, decisione comunicabile entro 48h prima.', 0.00, 'FLAT', 'EVENTO', 60, true),
  ('Suite sposi pre-wedding (notte prima)', 'Suite sposi anche la notte precedente al matrimonio, per preparativi tranquilli. Colazione inclusa.', 250.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'location';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'location');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Concessione esclusiva e orari', 'La Location concede in esclusiva gli spazi indicati per il matrimonio di {{client_name}} del {{event_date}} dalle ore X alle ore Y. La concessione include: spazi indicati nel preventivo, parcheggio ospiti, servizi igienici, illuminazione base, custode in loco per tutta la durata.', 10),
  ('CORRISPETTIVI', 'Acconto, saldo e cauzione', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% acconto alla firma (a fermo data), 50% a 60 giorni dall''evento, 20% a saldo 7gg pre-evento. Cauzione danni di 1.000 euro versata 7gg pre-evento e restituita entro 30gg post-evento previa verifica integrita''.', 20),
  ('RESPONSABILITA', 'Danni a immobili e arredi', 'Eventuali danni ad immobili, arredi, opere d''arte o aree esterne causati da invitati o fornitori del Cliente sono a carico del Cliente medesimo, che si impegna a tenere indenne la Location. La Location e'' assicurata per RC fabbricato verso terzi.', 30),
  ('FORZA_MAGGIORE', 'Pioggia, calamita'', emergenze sanitarie', 'In caso di pioggia o maltempo la Location garantisce sala interna alternativa senza supplemento, comunicabile entro 48h pre-evento. In caso di calamita''/emergenze sanitarie che impediscano l''evento, il Cliente puo'' rinviare ad altra data entro 12 mesi senza penali, conservando acconti gia'' versati.', 40),
  ('RECESSO', 'Penali da recesso Cliente', 'Recesso Cliente: oltre 12 mesi prima trattenimento 20%; 12-6 mesi trattenimento 50%; 6-3 mesi trattenimento 70%; sotto 3 mesi penale 100%, salvo subentro di altro evento sulla data.', 50)
) as c(categoria, titolo, body, sort_order)
where slug = 'location';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'location');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Plan B pioggia in chiaro', 'Specifica subito nel preventivo che il plan B pioggia e'' incluso e gratuito: e'' il primo motivo di indecisione dei clienti, toglierlo dall''equazione velocizza la chiusura.', 10),
  ('SERVIZI', 'Pacchetti camere come up-sell', 'Vendi pacchetto camere familiari come up-sell: chi viene da fuori non vuole guidare la notte, e tu fai marginalita'' extra sul giorno dopo.', 10),
  ('CONTRATTI', 'Cauzione danni in contratto', 'Inserisci cauzione danni nero su bianco con importo definito: senza cauzione, le ammaccature ad arredi dopo party finiscono in lite.', 10),
  ('GIORNO', 'Custode in loco h24', 'Custode in loco h24 il giorno evento: dal montaggio fioristi alle 7 alla pulizia notte alle 4, deve esserci sempre qualcuno con le chiavi e la testa lucida.', 10),
  ('GIORNO', 'Briefing fornitori arrivo location', 'Briefing fornitori all''arrivo (foglio firme orario): chi entra, da dove, dove parcheggia, dove smonta. Senza disciplina arrivi, succedono il 90% degli incidenti.', 20),
  ('CONTRATTI', 'Limite decibel sera tardi', 'Specifica limite decibel sera tardi (ordinanze comunali): la festa che va a tutta voce alle 02:00 e'' anche l''origine del 70% delle multe e dei vicini arrabbiati.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'location';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'location');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Verifica meteo + decisione plan B (-48h)', 'PRIMA_EVENTO', 10),
  ('Briefing staff custode/maitre/pulizie', 'PRIMA_EVENTO', 20),
  ('Pulizia approfondita spazi (-24h)', 'PRIMA_EVENTO', 30),
  ('Verifica funzionamento bagni e impianti', 'PRIMA_EVENTO', 40),
  ('Apertura cancelli per fornitori (-4h cerimonia)', 'ARRIVO', 10),
  ('Foglio firme accesso fornitori', 'ARRIVO', 20),
  ('Indicazione punti parcheggio ospiti', 'ARRIVO', 30),
  ('Monitoraggio sala/giardino/bagni durante evento', 'DURANTE', 10),
  ('Verifica decibel post 22:00 (ordinanza)', 'DURANTE', 20),
  ('Pulizia notte + verifica chiusura sicurezze', 'PARTENZA', 10),
  ('Verifica integrita'' arredi per cauzione', 'PARTENZA', 20)
) as x(voce, momento, sort_order)
where slug = 'location';

-- ============================================================================
-- CATERING
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'catering');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Aperitivo di benvenuto 60 minuti', 'Aperitivo a buffet 60 minuti: 8-10 finger food caldi/freddi, postazione bollicine, postazione cocktail base. Prezzo a persona.', 35.00, 'PER_GUEST', 'PERSONA', 10, true),
  ('Menu degustazione 5 portate', 'Menu seduti 5 portate: antipasto + primo + secondo + sorbetto + dolce. Vini in abbinamento, acqua, caffe''. Servizio al tavolo.', 95.00, 'PER_GUEST', 'PERSONA', 20, true),
  ('Postazione formaggi DOP', 'Postazione tematica con 12-15 formaggi DOP/IGP italiani, mieli artigianali, mostarde, pane. Tagliere al momento.', 18.00, 'PER_GUEST', 'PERSONA', 30, true),
  ('Postazione salumi e bolliti', 'Postazione salumeria con prosciutto crudo tagliato al coltello, salumi tipici, bolliti caldi serviti al momento.', 16.00, 'PER_GUEST', 'PERSONA', 40, true),
  ('Open bar premium (4h)', 'Open bar 4 ore con barman dedicato: cocktail classici, premium spirits, vini, birre artigianali, soft drinks. Per ospite adulto.', 28.00, 'PER_GUEST', 'PERSONA', 50, true),
  ('Servizio sala (maitre + 1 cameriere ogni 10 ospiti)', 'Personale di sala: 1 maitre + 1 cameriere ogni 10 invitati. Coordinamento sala, servizio al tavolo, gestione brindisi.', 12.00, 'PER_GUEST', 'PERSONA', 60, true),
  ('Menu bambini (under 12)', 'Menu dedicato bambini: pasta al sugo, cotoletta + patate, gelato. Servizio in parallelo ad adulti.', 35.00, 'PER_GUEST', 'PERSONA', 70, false),
  ('Menu speciali (vegano/celiaco/halal)', 'Menu speciali certificati con linea di produzione dedicata (no cross-contamination). Sovrapprezzo per ospite.', 8.00, 'PER_GUEST', 'PERSONA', 80, false),
  ('Cake cutting + dessert table', 'Servizio taglio torta + accompagnamento dolci: mini-pastry, frutta, cioccolatini. Postazione dedicata.', 12.00, 'PER_GUEST', 'PERSONA', 90, false),
  ('Trasferta fuori zona (sopra 50km)', 'Supplemento trasferta personale e attrezzature oltre i 50km dalla sede operativa.', 350.00, 'FLAT', 'EVENTO', 100, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'catering';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'catering');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Servizio catering e composizione menu', 'Il Catering si impegna a fornire il servizio di ristorazione per il matrimonio di {{client_name}} del {{event_date}} presso {{event_location}} per un numero stimato di N invitati. Sono inclusi: progettazione menu, fornitura derrate, personale di cucina e sala, mise en place, servizio al tavolo, sgombero e pulizia post-cena.', 10),
  ('CORRISPETTIVI', 'Conferma numero ospiti e fluttuazioni', 'Il corrispettivo a persona e'' di X euro IVA inclusa, su numero stimato di N ospiti. Il numero definitivo deve essere comunicato per iscritto entro quindici (15) giorni dall''evento. Una variazione fino al -10% e'' tollerata senza penale; oltre il -10% il Cliente paga comunque il 90% del numero pattuito. Aumenti +10% sono accettati salvo capienza cucina.', 20),
  ('RESPONSABILITA', 'HACCP e tracciabilita'' alimentare', 'Il Catering opera in regime HACCP con certificazione attiva e personale formato. Tutti gli alimenti sono tracciabili tramite DDT. Eventuali intolleranze/allergie devono essere comunicate al momento della conferma definitiva (-15gg) per la predisposizione di menu speciali con linee di produzione separate.', 30),
  ('FORZA_MAGGIORE', 'Sostituzione ingredienti stagionali', 'Per ragioni di stagionalita''/disponibilita'' di mercato, alcuni ingredienti del menu possono essere sostituiti con altri di pari qualita'' e tipologia. Sostituzioni di entita'' significativa vengono comunicate al Cliente con almeno 7gg di anticipo.', 40),
  ('SOSTITUZIONI', 'Variazioni menu post-firma', 'Modifiche al menu post-firma sono ammesse fino a 30gg pre-evento senza supplemento. Tra 30 e 15gg pre-evento le modifiche comportano fee amministrativa di 150 euro. Sotto i 15gg modifiche solo per intolleranze documentate.', 50)
) as c(categoria, titolo, body, sort_order)
where slug = 'catering';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'catering');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Soglia minima ospiti', 'Imposta soglia minima ospiti (di solito 60-80): sotto quella soglia il costo personale rende la marginalita'' negativa. Comunicalo subito, evita brutte sorprese.', 10),
  ('SERVIZI', 'Postazioni vendono molto', 'Vendi postazioni tematiche come up-sell: formaggi DOP, salumi, gelato artigianale. Aggiungono 15-25 euro a persona e i clienti le adorano in foto.', 10),
  ('CONTRATTI', 'Fluttuazione ospiti nero su bianco', 'Specifica regola fluttuazione ospiti (es. -10% senza penale, oltre paghi 90%): le defezioni last-minute sono fisiologiche e senza clausola scritta diventano contestazioni.', 10),
  ('CONTRATTI', 'Intolleranze 15gg prima', 'Specifica deadline intolleranze a 15gg pre-evento con linee separate certificate: la cross-contamination e'' il rischio numero uno e i menu speciali richiedono pianificazione cucina.', 20),
  ('GIORNO', 'Sopralluogo cucina della location', 'Sopralluogo della cucina della location obbligatorio: capacita'' frigo, attacchi elettrici, lavabi, cappe. Una cucina sottodimensionata e'' un disastro.', 10),
  ('GIORNO', 'Briefing con responsabile sala', 'Briefing -1h cena col responsabile sala location e WP: orari portate, gestione brindisi, coordinamento col DJ per i tempi della torta.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'catering';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'catering');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma numero ospiti definitivo (-15gg)', 'PRIMA_EVENTO', 10),
  ('Conferma menu speciali (vegano/celiaco/allergie)', 'PRIMA_EVENTO', 20),
  ('Sopralluogo cucina location (-7gg)', 'PRIMA_EVENTO', 30),
  ('Verifica DDT derrate fresche (-24h)', 'PRIMA_EVENTO', 40),
  ('Carico camion frigo + non frigo verificato', 'PRIMA_EVENTO', 50),
  ('Arrivo cucina + setup brigata (-4h aperitivo)', 'ARRIVO', 10),
  ('Mise en place sala con maitre', 'ARRIVO', 20),
  ('Briefing camerieri (assegnazione tavoli)', 'ARRIVO', 30),
  ('Coordinamento brindisi e tempi portate con DJ/WP', 'DURANTE', 10),
  ('Servizio cake cutting + dessert table', 'DURANTE', 20),
  ('Pulizia cucina e sgombero (post-cena)', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'catering';

-- ============================================================================
-- PASTICCERIA / WEDDING CAKE
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'pasticceria-wedding-cake');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Wedding cake 3 piani classica', 'Torta a 3 piani con pasta di zucchero o crema burro: gusti classici (vaniglia, cioccolato, frutti rossi). Decorazioni floreali fresche/zucchero. Per circa 80-100 ospiti.', 450.00, 'FLAT', 'EVENTO', 10, true),
  ('Wedding cake 4 piani con fiori freschi', 'Torta a 4 piani decorata con fiori freschi coordinati col bouquet. Strati alternati di gusti diversi. Per 120-150 ospiti.', 750.00, 'FLAT', 'EVENTO', 20, true),
  ('Naked cake / Semi-naked', 'Torta a 2-3 piani in stile rustic chic, glassa minimale, frutti freschi e fiori. Per 80-120 ospiti.', 380.00, 'FLAT', 'EVENTO', 30, true),
  ('Cake topper su misura (sposi)', 'Topper personalizzato sposi in zucchero o porcellana, modellato a mano su foto. Da concordare 90gg pre-evento.', 120.00, 'FLAT', 'PEZZO', 40, false),
  ('Mignon pasticceria mignon (cad.)', 'Pasticceria mignon assortita: bigne'', tartellette, mini-mousse, mini-millefoglie. Prezzo al pezzo (4-6 pezzi/ospite consigliati).', 1.20, 'PER_GUEST', 'PEZZO', 50, true),
  ('Confetti decorativi (sacchetto)', 'Confetti tradizionali Sulmona/Andria, assortimento gusti, sacchettini personalizzati con nome ospite.', 4.50, 'PER_GUEST', 'PEZZO', 60, false),
  ('Dolci della tradizione regionale', 'Set dolci tipici regionali (cassata, pastiera, sfogliatelle, ecc.) per chi vuole una nota territoriale a fine cena.', 6.00, 'PER_GUEST', 'PERSONA', 70, false),
  ('Servizio taglio e impiattatura', 'Pasticcere in loco per taglio torta, decorazione finale, impiattatura. Coordina col DJ il momento spettacolare.', 250.00, 'FLAT', 'EVENTO', 80, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'pasticceria-wedding-cake';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'pasticceria-wedding-cake');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Wedding cake e dolci accessori', 'La Pasticceria si impegna a realizzare la wedding cake e i dolci accessori per il matrimonio di {{client_name}} del {{event_date}} secondo brief estetico condiviso. Compresi: progettazione, prova torta (1 sessione fino a 2 persone), produzione, trasporto refrigerato, allestimento al tavolo torta.', 10),
  ('CORRISPETTIVI', 'Acconto e finalizzazione 30gg pre-evento', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% acconto alla firma per prenotazione data, 70% a saldo 7gg pre-evento. La definitiva del numero ospiti e finalizzazione design devono pervenire per iscritto entro 30gg pre-evento.', 20),
  ('RESPONSABILITA', 'Catena del freddo e HACCP', 'La Pasticceria garantisce HACCP attivo e catena del freddo dal laboratorio alla location (trasporto refrigerato). Una volta consegnata e collocata, la conservazione in loco e'' a carico del Cliente/Location, che deve garantire ambiente fresco (max 24°C) e ombra.', 30),
  ('SOSTITUZIONI', 'Fiori freschi alternativi', 'Le decorazioni con fiori freschi sono coordinate col fiorista del matrimonio. In caso di indisponibilita'' della varieta'' richiesta, la Pasticceria si riserva di concordare alternative cromaticamente coerenti col fiorista.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'pasticceria-wedding-cake';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'pasticceria-wedding-cake');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Prova torta a pagamento', 'Vendi la prova torta a pagamento (€50-80 a coppia): i clienti che pagano la prova si presentano e sono seri, gli altri sondano senza intenzione.', 10),
  ('SERVIZI', 'Mignon piu'' marginali della cake', 'I mignon sono piu'' marginali della cake (margine 60-70% vs 40% wedding cake): proponi sempre set 4-6 pezzi a ospite come up-sell.', 10),
  ('CONTRATTI', 'Catena del freddo limita responsabilita''', 'Specifica in contratto che dopo la consegna la conservazione in loco e'' a carico del cliente/location: senza clausola, una torta sciolta al caldo diventa colpa tua.', 10),
  ('GIORNO', 'Consegna a -3h dal taglio', 'Consegna la torta 2-3h prima del taglio (mai prima): piu'' tempo passa in location, piu'' rischia col caldo. Coordinati con WP sul timing preciso.', 10),
  ('GIORNO', 'Trasporto refrigerato + kit ritocco', 'Trasporto sempre refrigerato + kit ritocco (sac a poche di scorta, fiori extra, gelatina spray): la torta che arriva con un buco non si butta, si ritocca.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'pasticceria-wedding-cake';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'pasticceria-wedding-cake');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma definitiva design + ospiti (-30gg)', 'PRIMA_EVENTO', 10),
  ('Coordinamento fiori freschi con fiorista (-15gg)', 'PRIMA_EVENTO', 20),
  ('Produzione torta (-48h)', 'PRIMA_EVENTO', 30),
  ('Verifica trasporto refrigerato + auto frigo', 'PRIMA_EVENTO', 40),
  ('Consegna torta a -3h dal taglio', 'ARRIVO', 10),
  ('Allestimento tavolo torta + decoro floreale', 'ARRIVO', 20),
  ('Ritocchi finali + foto post-allestimento', 'ARRIVO', 30),
  ('Taglio torta e impiattatura', 'DURANTE', 10),
  ('Servizio cake table chiuso post-taglio', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'pasticceria-wedding-cake';

-- ============================================================================
-- CONFETTATA
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'confettata');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Confettata classica (12 gusti)', 'Postazione confettata classica con 12 gusti tradizionali (mandorla, cioccolato fondente/latte/bianco, frutti, liquore). Allestimento elegante.', 7.00, 'PER_GUEST', 'PERSONA', 10, true),
  ('Confettata premium (18 gusti)', 'Postazione premium 18 gusti con confetti gourmet (pistacchio Bronte, nocciola Piemonte IGP, gianduia, frutti tropicali).', 11.00, 'PER_GUEST', 'PERSONA', 20, true),
  ('Sweet table - mignon dolci e frutta', 'Tavolo dolci con mignon assortiti, frutta fresca, macarons, marshmallow. Coordinata estetica col concept.', 14.00, 'PER_GUEST', 'PERSONA', 30, true),
  ('Postazione cioccolato fondente colato', 'Postazione fontana cioccolato fondente con frutta da intingere, marshmallow, biscotti. Operatore dedicato.', 9.00, 'PER_GUEST', 'PERSONA', 40, false),
  ('Sacchettini personalizzati (cad.)', 'Sacchettini in tessuto/carta personalizzati con nome ospiti + nastrino sposi. Disponibili in 8 colori.', 1.20, 'PER_GUEST', 'PEZZO', 50, true),
  ('Allestimento scenografico (cornice, banner, fiori)', 'Allestimento scenografico tavolo confettata: cornice grande, banner sposi, vasi con fiori coordinati. Setup chiavi in mano.', 280.00, 'FLAT', 'EVENTO', 60, true),
  ('Operatore confettata dedicato (2h)', 'Operatore presente al tavolo confettata 2h per servizio ai sacchettini, gestione attrezzature, rifornimento.', 120.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'confettata';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'confettata');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Allestimento confettata e fornitura', 'Il Fornitore si impegna a fornire e allestire la postazione confettata per il matrimonio di {{client_name}} del {{event_date}}. Compresi: confetti nei gusti pattuiti, sacchettini personalizzati, allestimento estetico, ritiro materiali noleggiati post-evento.', 10),
  ('CORRISPETTIVI', 'Quantita'' e arrotondamenti', 'Il corrispettivo a persona e'' di X euro IVA inclusa, su numero ospiti definitivo comunicato a -15gg. Le quantita'' di confetti sono dimensionate per assicurare 80-100g per ospite. Eventuale confettata avanzata resta al Cliente.', 20),
  ('RESPONSABILITA', 'Allergeni e ingredienti', 'I confetti possono contenere frutta secca (mandorla, nocciola, pistacchio): l''etichettatura allergeni e'' esposta in postazione. Eventuali allergie gravi devono essere comunicate per la pianificazione di una mini-postazione "senza frutta secca" separata.', 30),
  ('SOSTITUZIONI', 'Variazioni gusti per disponibilita''', 'In caso di indisponibilita'' di un gusto specifico, il Fornitore puo'' sostituirlo con altro di pari categoria, dandone comunicazione preventiva via email.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'confettata';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'confettata');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Up-sell gusti premium', 'Vendi il pacchetto premium con gusti gourmet (Bronte, Piemonte IGP): il differenziale di +4-5 euro a persona e'' percepito come "lusso accessibile" e converte bene.', 10),
  ('SERVIZI', 'Sacchettini personalizzati', 'I sacchettini personalizzati con nome ospite sono il dettaglio piu'' Instagrammabile del tavolo confettata: investi qui anche se costa.', 10),
  ('CONTRATTI', 'Allergeni esposti', 'Esponi sempre il cartello allergeni nero su bianco: confetti = frutta secca quasi sempre, e una reazione allergica e'' un problema serio.', 10),
  ('GIORNO', 'Apertura tavolo dopo cena', 'Il tavolo confettata si apre dopo il taglio della torta, non prima: aperto in aperitivo si svuota in 20 minuti e non resta nulla per il momento giusto.', 10),
  ('GIORNO', 'Foto allestimento prima ospiti', 'Scatta foto allestimento prima che arrivino gli ospiti: dopo 5 minuti diventa il caos e perdi tutte le foto belle del tavolo intatto.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'confettata';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'confettata');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma definitiva gusti + ospiti (-15gg)', 'PRIMA_EVENTO', 10),
  ('Personalizzazione sacchettini (nomi ospiti)', 'PRIMA_EVENTO', 20),
  ('Coordinamento estetica con WP/designer', 'PRIMA_EVENTO', 30),
  ('Carico furgone + verifica confetti', 'PRIMA_EVENTO', 40),
  ('Arrivo location -2h apertura confettata', 'ARRIVO', 10),
  ('Allestimento tavolo + cartello allergeni', 'ARRIVO', 20),
  ('Foto allestimento prima dell''apertura', 'ARRIVO', 30),
  ('Apertura post taglio torta (coordinata con WP)', 'DURANTE', 10),
  ('Rifornimento progressivo durante serata', 'DURANTE', 20),
  ('Riconsegna materiale + chiusura tavolo', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'confettata';

-- ============================================================================
-- NOLEGGIO SCENOGRAFIE
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'noleggio-scenografie');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Set tavoli imperiali (per 10 posti)', 'Tavoli imperiali rettangolari 3m x 1m con tovagliato lino. Capienza 10 ospiti per tavolo. Trasporto e montaggio inclusi.', 95.00, 'PER_TABLE', 'PEZZO', 10, true),
  ('Sedie Chiavarina (cad.)', 'Sedie Chiavarina dorate o bianche con cuscino imbottito. Tariffa al pezzo. Sconto su lotti oltre 100 unita''.', 4.50, 'FLAT', 'PEZZO', 20, true),
  ('Sedie Tiffany trasparenti (cad.)', 'Sedie Tiffany cristallo trasparente con cuscino. Effetto scenografico per cerimonie. Tariffa al pezzo.', 5.50, 'FLAT', 'PEZZO', 30, true),
  ('Arco floreale struttura ferro (no fiori)', 'Struttura arco in ferro battuto per cerimonia esterna, da decorare a cura del fiorista. Montaggio incluso.', 220.00, 'FLAT', 'EVENTO', 40, true),
  ('Gazebo bianco 6x6m', 'Gazebo bianco professionale 6x6m con pareti laterali rimovibili, ideale per aperitivo o piano B pioggia.', 380.00, 'FLAT', 'EVENTO', 50, true),
  ('Catene luminose (a metro)', 'Catene luminose luce calda LED, vendute al metro lineare. Effetto bistrot/giardino.', 6.00, 'FLAT', 'PEZZO', 60, true),
  ('Vasi cilindrici vetro centrotavola (set 10)', 'Vasi cilindrici in vetro trasparente per centrotavola/cerimonia. Set da 10 pezzi, varie altezze.', 60.00, 'PER_TABLE', 'PEZZO', 70, false),
  ('Pedana matrimoniale 6x4m', 'Pedana modulare per cerimonia in giardino o sala, copertura tappeto sposi. Altezza 20cm.', 350.00, 'FLAT', 'EVENTO', 80, false),
  ('Tovagliato lino premium (per tavolo)', 'Tovaglia in puro lino + 12 tovaglioli, varie colorazioni. Lavaggio incluso, ritiro post-evento.', 28.00, 'PER_TABLE', 'PEZZO', 90, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'noleggio-scenografie';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'noleggio-scenografie');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Noleggio materiali e movimentazione', 'Il Noleggiatore concede in locazione temporanea il materiale dettagliato in preventivo per il matrimonio di {{client_name}} del {{event_date}} presso {{event_location}}. Compresi: trasporto andata/ritorno, montaggio professionale, smontaggio post-evento, lavaggio tovagliato.', 10),
  ('RESPONSABILITA', 'Danni, ammanchi e riconsegna', 'Il Cliente e'' responsabile per danni, ammanchi o rotture causati durante l''utilizzo. Il valore di ripristino per pezzo e'' indicato in apposito listino allegato. Eventuali danni vengono addebitati post-evento entro 15gg dalla riconsegna, previa documentazione fotografica.', 20),
  ('CORRISPETTIVI', 'Cauzione danni e modalita''', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% acconto alla firma, 70% a saldo 15gg pre-evento. Cauzione danni di 500-1.500 euro (in base entita'' noleggio) versata 7gg pre-evento e restituita entro 15gg post-evento previa verifica integrita''.', 30),
  ('FORZA_MAGGIORE', 'Annullamento per maltempo', 'In caso di pioggia che renda impossibile l''utilizzo del materiale outdoor (es. tovagliato giardino, catene luminose esterne), il Cliente puo'' richiedere sostituzione con materiale equivalente indoor senza supplemento, decisione comunicabile entro 24h pre-evento.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'noleggio-scenografie';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'noleggio-scenografie');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Listino danni allegato', 'Allega listino danni per pezzo dettagliato al contratto: senza listino esposto, ogni ammanco diventa una contestazione su "quanto vale davvero".', 10),
  ('SERVIZI', 'Vendi pacchetti completi tavolo', 'Vendi pacchetti completi "tavolo da 10" (tavolo + sedie + tovagliato + vasi): la marginalita'' e'' maggiore e la coppia paga meno mental load.', 10),
  ('CONTRATTI', 'Cauzione proporzionale al noleggio', 'Imposta cauzione proporzionale al valore noleggiato (10-15%): senza cauzione, la riconsegna in cattive condizioni diventa una battaglia di settimane.', 10),
  ('GIORNO', 'Inventario pre + post evento', 'Inventario fotografico pre-evento + inventario pezzi alla riconsegna: senza prova visiva, il "lo era gia'' rotto" diventa la versione del cliente.', 10),
  ('GIORNO', 'Montaggio -6h dalla cerimonia', 'Programma montaggio -6h da inizio cerimonia: i grandi noleggi (gazebo, pedana, arco) hanno sempre intoppi e con anticipo si recupera senza panico.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'noleggio-scenografie';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'noleggio-scenografie');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma definitiva quantita'' (-15gg)', 'PRIMA_EVENTO', 10),
  ('Sopralluogo location per accessi camion', 'PRIMA_EVENTO', 20),
  ('Carico materiale verificato + lista colli', 'PRIMA_EVENTO', 30),
  ('Inventario fotografico pre-evento', 'PRIMA_EVENTO', 40),
  ('Arrivo location e accesso (-6h)', 'ARRIVO', 10),
  ('Montaggio tavoli/sedie/scenografie', 'ARRIVO', 20),
  ('Coordinamento con fiorista per posizionamento', 'ARRIVO', 30),
  ('Smontaggio post-evento (notte o mattina dopo)', 'PARTENZA', 10),
  ('Inventario pezzi al ritiro + foto danni', 'PARTENZA', 20),
  ('Restituzione cauzione entro 15gg', 'PARTENZA', 30)
) as x(voce, momento, sort_order)
where slug = 'noleggio-scenografie';

-- ============================================================================
-- MAKE-UP ARTIST
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'makeup-artist');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Make-up sposa + prova trucco', 'Make-up sposa giorno evento (durata circa 90 min) + prova trucco in studio 1-2 mesi prima (durata 90-120 min). Prodotti professionali long-lasting.', 350.00, 'FLAT', 'PERSONA', 10, true),
  ('Make-up sposa airbrush', 'Make-up sposa con tecnica airbrush per finish HD perfetto in foto/video. Resa fino a 14h, idrorepellente. Include prova trucco.', 480.00, 'FLAT', 'PERSONA', 20, true),
  ('Make-up mamma sposa/sposo', 'Make-up mamme sposi o testimoni stretti, durata 45 min. Prodotti professionali long-lasting.', 90.00, 'FLAT', 'PERSONA', 30, true),
  ('Make-up ospite (durata 30 min)', 'Make-up ospiti/damigelle, durata 30 min. Tariffa per ospite, sconto progressivo oltre 5 persone.', 65.00, 'FLAT', 'PERSONA', 40, true),
  ('Ritocco trucco sera (post-cena)', 'Ritorno della MUA per ritocco trucco prima del taglio torta e ballo. Sostituzione rossetto, ciglia fix, fondotinta.', 150.00, 'FLAT', 'EVENTO', 50, false),
  ('Trial run extra (oltre la prova standard)', 'Prova trucco aggiuntiva oltre quella inclusa nel pacchetto sposa. Utile per spose indecise tra piu'' look.', 120.00, 'FLAT', 'PERSONA', 60, false),
  ('Trasferta fuori provincia', 'Supplemento trasferta MUA oltre la provincia di sede operativa. Calcolato su km e tempi.', 80.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'makeup-artist';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'makeup-artist');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Make-up sposa e accompagnatrici', 'La Make-up Artist si impegna a realizzare il make-up della sposa {{client_name}} per il giorno del matrimonio del {{event_date}}, oltre eventuali make-up per accompagnatrici (mamme/testimoni/ospiti) come da preventivo. Sono inclusi: prova trucco preliminare, esecuzione il giorno evento, eventuali ritocchi.', 10),
  ('CORRISPETTIVI', 'Acconto e prova trucco', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% acconto alla firma (a fermo data), 70% a saldo il giorno della prova trucco. La prova trucco e'' obbligatoria e va effettuata almeno 30gg prima dell''evento.', 20),
  ('RESPONSABILITA', 'Allergie e patch test', 'La Sposa dichiara di aver comunicato eventuali allergie/intolleranze a cosmetici. In caso di dubbio, la Make-up Artist mette a disposizione patch test almeno 7gg prima della prova trucco. La MUA utilizza esclusivamente prodotti professionali certificati.', 30),
  ('FORZA_MAGGIORE', 'Sostituzione con MUA equivalente', 'In caso di impossibilita'' della MUA per causa di forza maggiore documentata (malattia, infortunio), la stessa si impegna a fornire una sostituta di pari livello professionale della propria rete, previo accordo con la Sposa, senza supplemento di costo.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'makeup-artist';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'makeup-artist');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Pacchetto sposa+accompagnatrici', 'Vendi sempre il pacchetto sposa + accompagnatrici insieme: la marginalita'' aggregata e'' molto piu'' alta e logisticamente vai meno in trasferta.', 10),
  ('SERVIZI', 'Airbrush per spose foto-dipendenti', 'Proponi airbrush alle spose con pelle problematica o molto attente alle foto: la differenza in HD si vede e giustifica i +130 euro di supplemento.', 10),
  ('CONTRATTI', 'Patch test in clausola', 'Specifica patch test obbligatorio per spose con storia di allergie: una reazione il giorno del matrimonio e'' uno dei peggiori incubi del settore.', 10),
  ('GIORNO', 'Arriva 3h e mezzo prima del si''', 'Arriva 3.5h prima della cerimonia per la sposa (90 min) + accompagnatrici. Calcola sempre 30 min di buffer per intoppi (ciglia fix che non aderiscono, sposa emozionata).', 10),
  ('GIORNO', 'Kit ritocco da lasciare alla sposa', 'Lascia kit ritocco mini alla sposa: rossetto del giorno, polvere matt, blotting paper. Spese in piu'' minime, gradimento massimo.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'makeup-artist';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'makeup-artist');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma prodotti utilizzati post prova trucco', 'PRIMA_EVENTO', 10),
  ('Patch test allergie (-7gg dalla prova)', 'PRIMA_EVENTO', 20),
  ('Verifica kit completo + scadenze prodotti', 'PRIMA_EVENTO', 30),
  ('Carica batterie airbrush + compressore', 'PRIMA_EVENTO', 40),
  ('Arrivo location preparativi (-3.5h cerimonia)', 'ARRIVO', 10),
  ('Make-up sposa (90 min)', 'ARRIVO', 20),
  ('Make-up accompagnatrici a seguire', 'ARRIVO', 30),
  ('Kit ritocco mini lasciato alla sposa', 'PARTENZA', 10),
  ('Eventuale ritorno per ritocco sera', 'DURANTE', 10)
) as x(voce, momento, sort_order)
where slug = 'makeup-artist';

-- ============================================================================
-- HAIR STYLIST
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'hair-stylist');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Acconciatura sposa + prova', 'Acconciatura sposa giorno evento (60-90 min) + prova hair styling in studio 1-2 mesi prima. Test extension/accessori inclusi.', 320.00, 'FLAT', 'PERSONA', 10, true),
  ('Acconciatura sposa con extension naturale', 'Acconciatura sposa con extension capelli veri russi/europei (clip-in temporanee). Prova trucco e fitting extension inclusi.', 480.00, 'FLAT', 'PERSONA', 20, true),
  ('Hair styling mamma sposa/sposo', 'Acconciatura mamme sposi o testimoni, durata 45 min. Piega o raccolto, fissatura long-lasting.', 80.00, 'FLAT', 'PERSONA', 30, true),
  ('Hair styling ospite (piega o raccolto)', 'Hair styling ospiti/damigelle, durata 30-45 min. Piega bionda o raccolto base. Sconto progressivo oltre 5.', 55.00, 'FLAT', 'PERSONA', 40, true),
  ('Cambio acconciatura sera (post-cena)', 'Trasformazione acconciatura sposa pre-ballo: da raccolto a sciolto, o aggiunta extension/accessorio. Ritorno della stylist.', 130.00, 'FLAT', 'EVENTO', 50, false),
  ('Servizio sposo (taglio + styling)', 'Taglio capelli + styling sposo il giorno evento. Eventuale rasatura barba, profumazione.', 70.00, 'FLAT', 'PERSONA', 60, false),
  ('Trasferta fuori provincia', 'Supplemento trasferta oltre la provincia di sede operativa.', 70.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'hair-stylist';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'hair-stylist');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Hair styling sposa e accompagnatrici', 'L''Hair Stylist si impegna a realizzare l''acconciatura della sposa {{client_name}} per il matrimonio del {{event_date}} e di eventuali accompagnatrici come da preventivo, comprensivo di prova hair styling preliminare e servizio il giorno evento.', 10),
  ('CORRISPETTIVI', 'Acconto e prova hair', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% acconto alla firma, 70% a saldo il giorno della prova. La prova hair styling e'' obbligatoria e va effettuata 30gg pre-evento, contestualmente o separatamente dalla prova trucco.', 20),
  ('RESPONSABILITA', 'Trattamenti tricologici condivisi', 'La Sposa dichiara eventuali trattamenti chimici recenti (decolorazioni, stirature, permanenti) che possono incidere sulla resa dell''acconciatura. L''Hair Stylist consiglia di non effettuare trattamenti aggressivi nei 30gg precedenti la cerimonia.', 30),
  ('FORZA_MAGGIORE', 'Sostituzione con stylist equivalente', 'In caso di impossibilita'' dell''Hair Stylist per forza maggiore, sara'' fornita sostituta di pari livello della propria rete, previo accordo con la Sposa, senza supplemento.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'hair-stylist';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'hair-stylist');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Pacchetto hair+make-up combinato', 'Crea pacchetto combinato con make-up artist di fiducia: sconti incrociati + arrivo coordinato la mattina, la sposa non gestisce due fornitori separati.', 10),
  ('SERVIZI', 'Extension cambia il fatturato', 'Vendi sempre extension come opzione: anche su capelli non corti, l''effetto volume in foto e'' tanto e il margine sull''extension e'' molto alto.', 10),
  ('CONTRATTI', 'Disclaimer trattamenti chimici', 'Inserisci disclaimer su trattamenti chimici nei 30gg precedenti: se la sposa fa una decolorazione 3 giorni prima, l''acconciatura non tiene e non e'' colpa tua.', 10),
  ('GIORNO', 'Inizia 3h prima della cerimonia', 'Inizia 3h prima della cerimonia: piega + raccolto richiedono tempo, e una sposa pettinata di corsa si vede dalle foto.', 10),
  ('GIORNO', 'Fissaggi multipli (anti-vento, anti-umido)', 'Doppio strato di fissaggio (lacca leggera + lacca strong) + spilloni nascosti: vento, umido, abbracci forti delle nonne. Tutto attenta.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'hair-stylist';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'hair-stylist');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma trattamenti chimici sposa (-30gg)', 'PRIMA_EVENTO', 10),
  ('Prova hair styling con accessori definitivi', 'PRIMA_EVENTO', 20),
  ('Verifica kit completo + strumenti elettrici', 'PRIMA_EVENTO', 30),
  ('Coordinamento orari con MUA', 'PRIMA_EVENTO', 40),
  ('Arrivo location (-3h cerimonia)', 'ARRIVO', 10),
  ('Acconciatura sposa (60-90 min)', 'ARRIVO', 20),
  ('Acconciature accompagnatrici', 'ARRIVO', 30),
  ('Fissaggio finale + check con sposa', 'ARRIVO', 40),
  ('Eventuale cambio acconciatura sera', 'DURANTE', 10)
) as x(voce, momento, sort_order)
where slug = 'hair-stylist';

-- ============================================================================
-- BAND / MUSICA DAL VIVO
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'band-live');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Trio acustico aperitivo (2h)', 'Trio chitarra/voce/contrabbasso o piano per aperitivo: cover lounge e bossa, repertorio elegante. 2 ore di musica live.', 750.00, 'FLAT', 'EVENTO', 10, true),
  ('Band cena 5 elementi (3h)', 'Band 5 elementi (voce, chitarra, basso, batteria, tastiere) per cena: cover italiana/internazionale a basso volume. 3 ore.', 2400.00, 'FLAT', 'EVENTO', 20, true),
  ('Band ballo 7 elementi (4h)', 'Band ballo 7 elementi con sezione fiati: repertorio dance/swing/soul/funk. 4 ore di party scatenato.', 3800.00, 'FLAT', 'EVENTO', 30, true),
  ('Cantante solista cerimonia', 'Cantante solista con accompagnamento per cerimonia rito civile/simbolico: 4-5 brani con voce live. Repertorio classico/contemporaneo.', 550.00, 'FLAT', 'EVENTO', 40, true),
  ('Quartetto d''archi cerimonia', 'Quartetto d''archi classico per cerimonia: ingresso sposa, scambio anelli, uscita. Repertorio classico o adattamenti pop.', 850.00, 'FLAT', 'EVENTO', 50, true),
  ('Voce + piano primo ballo personalizzato', 'Versione live e personalizzata del brano del primo ballo: voce + piano, arrangiamento dedicato. Provata con sposi pre-evento.', 350.00, 'FLAT', 'EVENTO', 60, false),
  ('Service audio luci + tecnico (band)', 'Service audio professionale (PA, monitor, mixer) + luci da palco + tecnico in regia per tutta la serata. Incluso col pacchetto band ballo.', 800.00, 'FLAT', 'EVENTO', 70, true),
  ('Extra hour band (oltre 4h)', 'Estensione band oltre le 4 ore canoniche: tariffa oraria per ogni ora aggiuntiva oltre orario contrattuale.', 350.00, 'PER_HOUR', 'ORA', 80, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'band-live';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'band-live');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Musica live e repertorio', 'La Band si impegna a fornire intrattenimento musicale dal vivo per il matrimonio di {{client_name}} del {{event_date}} secondo formazione e durata pattuite. Compresi: musicisti, service audio dedicato (se previsto), scaletta concordata con sposi, prove tecniche pre-evento.', 10),
  ('CORRISPETTIVI', 'Acconto e SIAE separata', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 30% alla firma, 70% a saldo a fine serata in contanti o entro 7gg pre-evento bonifico. NB: i diritti SIAE per esecuzioni live restano a carico del Cliente/Location e non sono inclusi nel corrispettivo.', 20),
  ('RESPONSABILITA', 'Norme sicurezza palco e impianti', 'La Band utilizza impianti certificati a norma CE e dichiara la potenza elettrica richiesta (kW). La Location/Cliente deve garantire alimentazione adeguata e zona palco protetta da intemperie. Eventuali extra elettrici (gruppo elettrogeno) sono a carico Cliente.', 30),
  ('FORZA_MAGGIORE', 'Sostituzione musicisti malati', 'In caso di indisposizione di un musicista, la Band si impegna a fornire sostituto di pari livello professionale. La formazione minima garantita resta quella indicata in preventivo.', 40),
  ('SOSTITUZIONI', 'Scaletta e personalizzazione brani', 'La scaletta finale viene condivisa coi Clienti almeno 30gg pre-evento. Eventuali brani specifici non in repertorio richiedono studio aggiuntivo e supplemento dedicato (vedi voce "voce+piano personalizzato").', 50)
) as c(categoria, titolo, body, sort_order)
where slug = 'band-live';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'band-live');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Pacchetti aperitivo/cena/ballo modulari', 'Vendi sempre i 3 momenti modulari (aperitivo/cena/ballo): chi prende solo "ballo" spesso poi aggiunge anche aperitivo. Lascia decidere alla coppia, ma incoraggia il pacchetto totale.', 10),
  ('SERVIZI', 'Primo ballo personalizzato come up-sell', 'Vendi sempre l''arrangiamento personalizzato del primo ballo: la coppia paga volentieri 300-400 euro per avere "la loro canzone" suonata dal vivo invece che in playback.', 10),
  ('CONTRATTI', 'SIAE chiarisci subito', 'Specifica nero su bianco che SIAE e'' a carico del cliente: alcuni clienti pensano sia incluso e poi diventa una sorpresa amara post-evento.', 10),
  ('CONTRATTI', 'Potenza elettrica dichiarata', 'Dichiara la potenza elettrica necessaria (in genere 12-18 kW per band+luci): location vecchie con impianto sottodimensionato saltano e tu rischi la serata.', 20),
  ('GIORNO', 'Sopralluogo location 30gg prima', 'Sopralluogo audio location 30gg pre-evento: misure stanza, posizione palco, prese elettriche, distanza dalla cucina. Risparmi 2h di setup il giorno.', 10),
  ('GIORNO', 'Soundcheck -2h cena', 'Soundcheck a -2h cena, mai durante: dopo che gli ospiti arrivano, regolare i volumi della batteria diventa un incubo.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'band-live';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'band-live');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Scaletta finale condivisa con sposi (-30gg)', 'PRIMA_EVENTO', 10),
  ('Sopralluogo audio location (-30gg)', 'PRIMA_EVENTO', 20),
  ('Brani personalizzati provati (primo ballo)', 'PRIMA_EVENTO', 30),
  ('Carico furgone strumenti + service', 'PRIMA_EVENTO', 40),
  ('Coordinamento orari con WP/catering', 'PRIMA_EVENTO', 50),
  ('Arrivo location (-4h cerimonia/cena)', 'ARRIVO', 10),
  ('Montaggio palco + cablaggio audio luci', 'ARRIVO', 20),
  ('Soundcheck completo (-2h cena)', 'ARRIVO', 30),
  ('Gestione momenti chiave (entrata sposi, brindisi, primo ballo)', 'DURANTE', 10),
  ('Smontaggio strumenti post-evento', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'band-live';

-- ============================================================================
-- DJ SERVICE
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'dj-service');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('DJ set completo (aperitivo+cena+ballo)', 'DJ set per intera giornata: musica aperitivo lounge, cena soft, ballo dance. 8-10 ore di servizio con service audio incluso.', 1800.00, 'FLAT', 'EVENTO', 10, true),
  ('DJ set ballo serale (4h)', 'DJ set ballo dalle 22:00 alle 02:00. Service audio + impianto luci basico. Pacchetto entry-level dopo band.', 950.00, 'FLAT', 'EVENTO', 20, true),
  ('Service audio professionale', 'Service audio: PA stereo, monitor, mixer 12 canali, microfoni wireless per discorsi. Tecnico in regia.', 600.00, 'FLAT', 'EVENTO', 30, true),
  ('Impianto luci da ballo', 'Luci da ballo: moving heads, par LED, strobi, smoke machine. Programmazione cue su brani chiave.', 450.00, 'FLAT', 'EVENTO', 40, true),
  ('Karaoke o GuestDJ corner', 'Postazione karaoke o "ospite alla console" supervisionata per momenti divertenti. Setup dedicato.', 250.00, 'FLAT', 'EVENTO', 50, false),
  ('Microfono wireless cerimonia/discorsi', 'Microfono wireless gelato + impianto voce dedicato per cerimonia e discorsi cena. Standalone separato dal ballo.', 200.00, 'FLAT', 'EVENTO', 60, true),
  ('Pista LED dancefloor (4x4m)', 'Pista da ballo LED interattiva 4x4m, programmabile con effetti. Forte effetto wow in foto.', 800.00, 'FLAT', 'EVENTO', 70, false),
  ('Extra hour DJ (oltre orario)', 'Estensione DJ oltre orario contrattuale, tariffa oraria.', 180.00, 'PER_HOUR', 'ORA', 80, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'dj-service';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'dj-service');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Servizio DJ e service audio', 'Il DJ si impegna a fornire intrattenimento musicale per il matrimonio di {{client_name}} del {{event_date}} secondo durata e formula pattuite. Compresi: DJ, service audio, eventuali impianti luci, scaletta personalizzata coi sposi.', 10),
  ('CORRISPETTIVI', 'Acconto, saldo e SIAE', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 30% acconto alla firma, 70% saldo entro 7gg pre-evento. I diritti SIAE per la riproduzione musicale durante l''evento sono a carico del Cliente/Location secondo normativa vigente.', 20),
  ('RESPONSABILITA', 'Sicurezza elettrica e ordinanze comunali', 'Il DJ utilizza impianti certificati CE e dichiara potenza elettrica richiesta. Il rispetto di eventuali limiti decibel/ordinanze comunali (chiusura musica notturna) e'' coordinato con la Location.', 30),
  ('SOSTITUZIONI', 'Scaletta e brani non disponibili', 'La scaletta finale (must-have + must-avoid) viene definita con gli sposi 30gg pre-evento. Eventuali brani non disponibili nei cataloghi del DJ vengono comunicati e sostituiti con alternative simili.', 40),
  ('FORZA_MAGGIORE', 'DJ sostituto', 'In caso di impossibilita'' del DJ per causa di forza maggiore documentata, sara'' fornito sostituto di pari livello professionale appartenente alla propria rete.', 50)
) as c(categoria, titolo, body, sort_order)
where slug = 'dj-service';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'dj-service');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Microfoni separati per cerimonia', 'Vendi sempre i microfoni cerimonia/discorsi come voce separata: spesso il cliente pensa siano inclusi e poi scopre il sovrapprezzo. Trasparenza vince.', 10),
  ('SERVIZI', 'Luci da ballo cambiano la serata', 'Spingi sull''impianto luci: senza luci, il ballo e'' una sala accesa con musica. Le luci sono la differenza tra "serata simpatica" e "serata indimenticabile".', 10),
  ('CONTRATTI', 'Must-have/Must-avoid in lista', 'Specifica la lista must-have (10-15 brani imprescindibili) E must-avoid (brani da non suonare per assoluto): gli sposi hanno memorie precise da proteggere.', 10),
  ('GIORNO', 'Soundcheck cerimonia + ballo separati', 'Fai soundcheck cerimonia E ballo separati, in 2 momenti diversi: i livelli e la posizione dei microfoni sono diversi e non si possono tarare insieme.', 10),
  ('GIORNO', 'Energia crescente nel set', 'Pianifica curva energia crescente nel set ballo: 22-23 medio tempo, 23-01 dance peak, 01-02 hit di chiusura. Tutto piatto = pista vuota.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'dj-service';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'dj-service');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Scaletta must-have/must-avoid condivisa (-30gg)', 'PRIMA_EVENTO', 10),
  ('Sopralluogo audio location (-15gg)', 'PRIMA_EVENTO', 20),
  ('Verifica brani primo ballo / brindisi / taglio', 'PRIMA_EVENTO', 30),
  ('Carico service + impianti verificato', 'PRIMA_EVENTO', 40),
  ('Arrivo location (-3h cerimonia)', 'ARRIVO', 10),
  ('Setup audio cerimonia + microfoni wireless', 'ARRIVO', 20),
  ('Setup audio ballo + impianto luci', 'ARRIVO', 30),
  ('Soundcheck cerimonia + soundcheck ballo (separati)', 'ARRIVO', 40),
  ('Coordinamento momenti chiave (entrate, brindisi, primo ballo, taglio)', 'DURANTE', 10),
  ('Curva energia ballo (medio -> peak -> chiusura)', 'DURANTE', 20),
  ('Smontaggio service post-evento', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'dj-service';

-- ============================================================================
-- INTRATTENIMENTO
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'intrattenimento');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Photobooth con stampe (4h)', 'Photobooth professionale con stampante istantanea: stampe formato Polaroid, sfondo personalizzato, accessori divertenti. Operatore incluso.', 750.00, 'FLAT', 'EVENTO', 10, true),
  ('Magie da tavolo (close-up magic)', 'Mago itinerante tra i tavoli durante aperitivo o cena: magie close-up con carte, monete, anelli. Durata 2h, 8-10 tavoli.', 550.00, 'FLAT', 'EVENTO', 20, true),
  ('Show live percussioni (15 min)', 'Show percussionistico spettacolare durante taglio torta o primo ballo: tamburi giapponesi, fuoco coreografato, energia adrenalinica.', 850.00, 'FLAT', 'EVENTO', 30, true),
  ('Animazione bambini (con baby parking)', 'Animatori per bambini: giochi, baby dance, magic show kids, baby parking dedicato durante cena. Per 5-15 bambini.', 480.00, 'FLAT', 'EVENTO', 40, true),
  ('Caricaturista live (sketch ospiti)', 'Caricaturista esegue sketch dei volti ospiti durante aperitivo, da portare a casa come ricordo. 8-12 caricature/ora.', 380.00, 'FLAT', 'EVENTO', 50, false),
  ('Mentalist/illusionista da palco (30 min)', 'Spettacolo da palco di mentalismo/illusionismo prima del taglio torta. Coinvolge il pubblico in interazioni sorprendenti.', 950.00, 'FLAT', 'EVENTO', 60, false),
  ('Fire show fine serata (10 min)', 'Spettacolo del fuoco a fine serata in giardino: jongleurs di fuoco, coreografia musicata, finale spettacolare per le foto.', 700.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'intrattenimento';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'intrattenimento');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Prestazione artistica e durata', 'L''Artista/Intrattenitore si impegna a fornire la prestazione artistica indicata per il matrimonio di {{client_name}} del {{event_date}} nei tempi e modi pattuiti. Sono inclusi: arrivo in loco con anticipo per setup, esecuzione, ritiro materiali.', 10),
  ('CORRISPETTIVI', 'Acconto e saldo serata', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 30% acconto alla firma, 70% saldo a fine serata o entro 7gg pre-evento.', 20),
  ('RESPONSABILITA', 'Sicurezza show pirotecnici/fuoco', 'Per spettacoli con fuoco o effetti speciali, l''Artista dichiara di operare con permessi e assicurazione RC dedicata. Zona di esibizione delimitata, distanza minima ospiti rispettata, presenza estintore obbligatoria a cura dell''Artista.', 30),
  ('FORZA_MAGGIORE', 'Sostituzione e meteo show outdoor', 'In caso di indisposizione dell''Artista, sara'' fornito sostituto di pari livello. Per spettacoli outdoor, in caso di pioggia/vento forte lo show viene spostato indoor o annullato con rimborso del 50% (gia'' sostenuti costi di trasferta e prove).', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'intrattenimento';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'intrattenimento');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Show breve > show lungo', 'Vendi sempre show brevi (10-15 min) di alto impatto: rispetto a show da 1h, l''attenzione del pubblico matrimonio non regge oltre 15-20 min.', 10),
  ('SERVIZI', 'Photobooth come ricordo', 'Photobooth con stampe immediate e'' uno dei servizi che gli ospiti ricordano di piu'' (e portano a casa): facile up-sell con sfondo personalizzato sposi.', 10),
  ('CONTRATTI', 'Sicurezza fuoco nero su bianco', 'Per show con fuoco, allega permessi e polizza RC al contratto: senza questi documenti, la location/comune puo'' bloccare tutto il giorno stesso.', 10),
  ('GIORNO', 'Coordinati con DJ/WP per cue', 'Concorda i cue con DJ/WP: il tuo show ha senso solo se musica e luci sono coordinate. Senza brief, lo show "parte" mentre il DJ sta facendo altro.', 10),
  ('GIORNO', 'Setup invisibile pre-show', 'Setup pre-show invisibile agli ospiti (in cucina, dietro le quinte): se ti vedono trasportare materiali in sala, perdi l''effetto sorpresa.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'intrattenimento';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'intrattenimento');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma orario show con WP (-15gg)', 'PRIMA_EVENTO', 10),
  ('Brief musicale per DJ (se cue musicali)', 'PRIMA_EVENTO', 20),
  ('Per show fuoco: verifica permessi location', 'PRIMA_EVENTO', 30),
  ('Carica materiali + verifica funzionamento', 'PRIMA_EVENTO', 40),
  ('Arrivo location (-2h dallo show)', 'ARRIVO', 10),
  ('Setup nascosto dietro le quinte', 'ARRIVO', 20),
  ('Briefing finale con DJ (cue musicale)', 'ARRIVO', 30),
  ('Esecuzione show nel momento concordato', 'DURANTE', 10),
  ('Smontaggio materiali fine serata', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'intrattenimento';

-- ============================================================================
-- ATELIER SPOSA
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'atelier-sposa');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Abito sposa pret-a-couture', 'Abito sposa pret-a-couture: scelta tra collezione atelier, 3 prove di sartoria incluse, accessori di base. Fascia entry premium.', 2800.00, 'FLAT', 'PEZZO', 10, true),
  ('Abito sposa haute couture su misura', 'Abito sposa haute couture realizzato su misura: figurino dedicato, 4-5 prove sartoriali, scelta tessuti pregiati (seta, organza, pizzo Calais).', 6500.00, 'FLAT', 'PEZZO', 20, true),
  ('Velo lungo e accessori capelli', 'Velo lungo (200-300 cm) abbinato all''abito + accessori capelli (tiara, fermagli, fiori in tessuto). Coordinato con hair stylist.', 380.00, 'FLAT', 'PEZZO', 30, true),
  ('Scarpe sposa su misura', 'Scarpe sposa su misura con pellame nobile, plantare personalizzato per comfort h+12. Indicatissime se si balla molto.', 450.00, 'FLAT', 'PEZZO', 40, false),
  ('Secondo abito (cambio post-cena)', 'Secondo abito per il ballo (piu'' corto, comodo, con stoffe a tema): cambio veloce post-cena, perfetto per spose dinamiche.', 1400.00, 'FLAT', 'PEZZO', 50, false),
  ('Prova hair/make-up in atelier', 'Sessione coordinata con hair stylist e MUA direttamente in atelier per verificare look completo (acconciatura + trucco + abito).', 0.00, 'FLAT', 'EVENTO', 60, true),
  ('Stiraggio e consegna giorno evento', 'Servizio stiraggio finale a vapore + consegna abito alla sposa il giorno del matrimonio nella location preparativi.', 250.00, 'FLAT', 'EVENTO', 70, true),
  ('Custodia abito post-matrimonio', 'Pulizia professionale + custodia museale dell''abito post-evento. Da ritirare entro 14gg dal matrimonio.', 320.00, 'FLAT', 'PEZZO', 80, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'atelier-sposa';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'atelier-sposa');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Confezionamento abito e prove sartoriali', 'L''Atelier si impegna a confezionare l''abito sposa per il matrimonio di {{client_name}} del {{event_date}}. Sono comprese: il numero di prove sartoriali indicato (3-5), modifiche di vestibilita'' standard, consegna stirata 3-7gg pre-evento. Le modifiche fuori dai parametri vanno preventivate a parte.', 10),
  ('CORRISPETTIVI', 'Acconto, saldi e variazioni taglia', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa. Pagamento: 50% alla firma (necessario per ordine tessuti), 30% alla prima prova, 20% al ritiro. In caso di variazione significativa peso/misure (oltre +/- 3 taglie), eventuali rifacimenti saranno preventivati a parte.', 20),
  ('RESPONSABILITA', 'Cura e custodia post-prove', 'Dopo l''ultima prova e fino al ritiro definitivo, l''abito resta in custodia dell''Atelier. In caso di ritiro anticipato a richiesta della Sposa, la responsabilita'' per danni/macchie pre-evento passa alla Sposa stessa.', 30),
  ('RECESSO', 'Penali da recesso e tessuti gia'' tagliati', 'In caso di recesso: oltre 12 mesi pre-evento trattenimento 50% (gia'' progettazione); 12-6 mesi 70% (tessuti tagliati); sotto 6 mesi penale 100% (abito in lavorazione). I tessuti pregiati su misura non sono rivendibili.', 40),
  ('FORO', 'Foro competente', 'Per qualsiasi controversia relativa al presente contratto e'' competente in via esclusiva il Foro di [citta'' atelier], salvo diversa indicazione legale obbligatoria.', 50)
) as c(categoria, titolo, body, sort_order)
where slug = 'atelier-sposa';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'atelier-sposa');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Numero prove nero su bianco', 'Specifica esattamente il numero di prove incluse: senza, le prove "extra" diventano contestazioni e tu lavori gratis.', 10),
  ('SERVIZI', 'Secondo abito ballo come up-sell', 'Vendi il secondo abito ballo: marginalita'' alta (margine 40-50%) e gli sposi adorano "il momento del cambio". Push subito alla scelta dell''abito principale.', 10),
  ('CONTRATTI', 'Clausola variazione peso', 'Inserisci clausola variazione peso/taglia con franchigia (+/- 2-3 taglie): senza, la sposa che dimagrisce molto/perde tonicita'' si aspetta rifacimenti gratuiti illimitati.', 10),
  ('SERVIZI', 'Stiraggio + consegna in location', 'Includi sempre stiraggio finale + consegna in location nei preparativi: e'' il dettaglio che la sposa ricorda. Un abito che arriva piegato in valigia e'' un disastro.', 20),
  ('GIORNO', 'Kit emergenza nascosto in abito', 'Cuci kit emergenza minimo nell''abito (filo, ago, spilli, profumo): la sposa lo trovera'' se servisse e ti ringrazia per la vita.', 10)
) as x(contesto, titolo, testo, sort_order)
where slug = 'atelier-sposa';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'atelier-sposa');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Ultima prova sartoriale (-30gg)', 'PRIMA_EVENTO', 10),
  ('Coordinamento con hair/MUA per look totale', 'PRIMA_EVENTO', 20),
  ('Verifica accessori (velo, scarpe, gioielli)', 'PRIMA_EVENTO', 30),
  ('Stiraggio a vapore finale (-48h)', 'PRIMA_EVENTO', 40),
  ('Consegna abito in location preparativi', 'ARRIVO', 10),
  ('Vestizione assistita (se richiesta sposa)', 'ARRIVO', 20),
  ('Foto post-vestizione per documentazione', 'ARRIVO', 30),
  ('Ritiro abito post-evento (entro 7gg)', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'atelier-sposa';

-- ============================================================================
-- SARTORIA SPOSO
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'sartoria-sposo');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Abito sposo su misura (3 pezzi)', 'Abito su misura 3 pezzi (giacca + pantalone + gilet): tessuto Loro Piana o equivalente, 3 prove sartoriali. Camicia coordinata.', 1800.00, 'FLAT', 'PEZZO', 10, true),
  ('Tight cerimonia tradizionale', 'Tight tradizionale per cerimonia formale (mattino): giacca, panciotto, pantalone rigato, plastron. Coordinato con cilindro.', 2400.00, 'FLAT', 'PEZZO', 20, true),
  ('Smoking nero con papillon', 'Smoking sartoriale nero con paramani in seta + papillon e fascia. Ideale per cerimonia serale/black tie.', 2000.00, 'FLAT', 'PEZZO', 30, true),
  ('Camicia su misura', 'Camicia su misura in cotone egiziano/popeline pregiato. 2-3 prove sartoriali, polsini gemello.', 250.00, 'FLAT', 'PEZZO', 40, true),
  ('Cravatta o papillon in seta', 'Cravatta o papillon in seta jacquard coordinato. Possibilita'' di abbinamento con accessori sposa.', 90.00, 'FLAT', 'PEZZO', 50, true),
  ('Scarpe stringate cuoio dipinto a mano', 'Scarpe stringate in cuoio italiano, finitura dipinta a mano. Personalizzabili con suola brand.', 380.00, 'FLAT', 'PEZZO', 60, false),
  ('Accessori (gemelli, fermacravatta, fazzoletto)', 'Set accessori sposo: gemelli argento/oro, fermacravatta, fazzoletto da taschino in seta.', 150.00, 'FLAT', 'PEZZO', 70, false),
  ('Stiraggio e consegna giorno evento', 'Stiraggio professionale + consegna abito sposo in location preparativi.', 200.00, 'FLAT', 'EVENTO', 80, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'sartoria-sposo';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'sartoria-sposo');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Confezionamento abito sposo e accessori', 'La Sartoria si impegna a confezionare l''abito sposo e gli accessori per il matrimonio di {{client_name}} del {{event_date}}. Sono comprese: il numero di prove pattuito, modifiche di vestibilita'' standard, consegna stirata 3-7gg pre-evento.', 10),
  ('CORRISPETTIVI', 'Acconto e variazioni peso', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 50% acconto alla firma (ordine tessuti), 30% alla prima prova, 20% al ritiro. Variazioni peso oltre +/- 8 kg dalla misurazione iniziale richiedono preventivo aggiuntivo.', 20),
  ('RESPONSABILITA', 'Cura post-consegna', 'Dopo il ritiro definitivo, la cura e custodia dell''abito passano allo Sposo. La Sartoria non risponde di macchie, strappi o danni sopravvenuti tra consegna ed evento.', 30),
  ('RECESSO', 'Penali graduate', 'In caso di recesso: oltre 6 mesi trattenimento 30%; 6-3 mesi 60%; sotto 3 mesi 90% (abito in lavorazione, tessuti gia'' tagliati).', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'sartoria-sposo';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'sartoria-sposo');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Sposo paga sempre meno della sposa', 'Aspettati che lo sposo investa la meta'' della sposa: imposta pacchetti realistici 1500-3000 euro come standard, non confrontarli con atelier sposa.', 10),
  ('SERVIZI', 'Vendi accessori in pacchetto', 'Vendi pacchetto "look totale" (abito + camicia + cravatta + scarpe + accessori): marginalita'' aggregata alta e lo sposo non torna 4 volte per dimenticanze.', 10),
  ('CONTRATTI', 'Variazione peso sposo (+/- 8kg)', 'Sposi stressati ingrassano/dimagriscono: clausola variazione peso da firma a evento con franchigia evita contestazioni.', 10),
  ('GIORNO', 'Ultima prova -30gg', 'Ultima prova -30gg pre-evento (non meno!): se serve qualche ritocco resta tempo. Sotto i 30gg le modifiche di vestibilita'' non sono garantite.', 10),
  ('GIORNO', 'Kit cucito + stain remover', 'Lascia kit cucito mini + stain remover nella valigia abito: macchie di sugo/vino sull''abito sposo sono frequenti, salvarle in tempo cambia la giornata.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'sartoria-sposo';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'sartoria-sposo');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Ultima prova sartoriale (-30gg)', 'PRIMA_EVENTO', 10),
  ('Verifica accessori (camicia, cravatta, scarpe)', 'PRIMA_EVENTO', 20),
  ('Stiraggio professionale (-48h)', 'PRIMA_EVENTO', 30),
  ('Kit cucito + stain remover in valigia', 'PRIMA_EVENTO', 40),
  ('Consegna abito in location preparativi sposo', 'ARRIVO', 10),
  ('Vestizione assistita (se richiesta)', 'ARRIVO', 20),
  ('Foto post-vestizione', 'ARRIVO', 30),
  ('Ritiro abito post-evento (entro 7gg)', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'sartoria-sposo';

-- ============================================================================
-- GIOIELLI / FEDI
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'gioielli-fedi');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Fedi nuziali oro giallo 18kt (paio)', 'Coppia fedi in oro giallo 18kt classiche/comode/sahariane. Incisione interna inclusa (nomi + data). Punzonatura titolo garantita.', 950.00, 'FLAT', 'PEZZO', 10, true),
  ('Fedi nuziali oro bianco 18kt (paio)', 'Coppia fedi in oro bianco 18kt con rodiatura. Modelli classici o moderni a sezione confort. Incisione inclusa.', 1100.00, 'FLAT', 'PEZZO', 20, true),
  ('Fedi nuziali oro rosa 18kt (paio)', 'Coppia fedi in oro rosa 18kt: la lega oro/rame conferisce sfumatura calda, trend recente molto richiesto.', 1050.00, 'FLAT', 'PEZZO', 30, true),
  ('Fedi platino 950 (paio)', 'Coppia fedi in platino 950 alta densita'': resistenza superiore all''oro, naturalmente ipoallergenico, peso piu'' importante al dito.', 2400.00, 'FLAT', 'PEZZO', 40, false),
  ('Anello fidanzamento solitario (1 ct)', 'Anello solitario con diamante centrale 1 ct, certificato GIA, colore F-G, purezza VS1-VS2. Montatura oro bianco/giallo a scelta.', 4500.00, 'FLAT', 'PEZZO', 50, false),
  ('Personalizzazione anello fidanzamento', 'Personalizzazione anello fidanzamento esistente: incisione, ridimensionamento, sostituzione pietre, pulitura professionale.', 180.00, 'FLAT', 'PEZZO', 60, false),
  ('Parure sposa (orecchini + bracciale)', 'Parure orecchini + bracciale coordinati per la sposa. Oro o argento, perline coltivate, pietre dure.', 850.00, 'FLAT', 'PEZZO', 70, false),
  ('Cofanetto consegna fedi cerimonia', 'Cofanetto/cuscino velluto per consegna fedi durante cerimonia. Coordinato con i colori del matrimonio.', 65.00, 'FLAT', 'PEZZO', 80, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'gioielli-fedi';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'gioielli-fedi');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Fornitura fedi e certificazioni', 'L''Orafo/Gioielliere si impegna a fornire le fedi nuziali e gli eventuali gioielli accessori per il matrimonio di {{client_name}} del {{event_date}}, con relativa certificazione del titolo (oro 750, platino 950) e, per le pietre, certificazione gemmologica (es. GIA, IGI) ove dichiarata.', 10),
  ('CORRISPETTIVI', 'Acconto e personalizzazione', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 30% acconto alla firma (per inizio lavorazione), 70% al ritiro/consegna. La personalizzazione (incisione, modifica modello standard) e'' inclusa per le incisioni base; personalizzazioni avanzate sono preventivate a parte.', 20),
  ('RESPONSABILITA', 'Garanzia legale e usura', 'L''Orafo applica garanzia legale 24 mesi su difetti di lavorazione. Sono esclusi: usura normale, deformazioni da impatto, perdita di pietre per uso improprio. La rodiatura dell''oro bianco e'' soggetta a usura naturale (ritocco consigliato ogni 2-3 anni).', 30),
  ('SOSTITUZIONI', 'Misura anello e ridimensionamento', 'In caso di errore di misura comunicato dal Cliente, il primo ridimensionamento (entro 6 mesi dal ritiro) e'' gratuito. Ridimensionamenti successivi sono soggetti a tariffa standard.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'gioielli-fedi';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'gioielli-fedi');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Tempo lavorazione 45-60 giorni', 'Specifica subito tempi di lavorazione (45-60 giorni per fedi su misura): chi ordina sotto i 30gg pre-matrimonio rischia di non avere le fedi. Sii chiaro.', 10),
  ('SERVIZI', 'Cofanetto cerimonia compreso', 'Includi sempre il cofanetto cerimonia nelle fedi base: e'' un dettaglio economico ma molto fotografato e percepito come "atelier vero".', 10),
  ('CONTRATTI', 'Certificazioni in contratto', 'Esibisci sempre certificato del titolo (punzonatura 750 = 18kt) e per i diamanti il certificato gemmologico: senza, il cliente con esperienza diffida.', 10),
  ('GIORNO', 'Consegna 7-15gg prima', 'Consegna le fedi 7-15gg pre-evento (mai meno): la coppia deve provarle, prendere le misure giuste, fare foto. Non fartelo mai chiedere dopo.', 10),
  ('GIORNO', 'Promemoria al testimone', 'Ricorda alla coppia di affidare le fedi a un testimone con cofanetto: il rischio "fedi dimenticate a casa il giorno X" e'' un classico.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'gioielli-fedi';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'gioielli-fedi');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma misure definitive (-60gg)', 'PRIMA_EVENTO', 10),
  ('Verifica incisione interna fedi', 'PRIMA_EVENTO', 20),
  ('Certificazione titolo + gemmologica', 'PRIMA_EVENTO', 30),
  ('Pulitura/lucidatura finale (-7gg)', 'PRIMA_EVENTO', 40),
  ('Consegna fedi alla coppia (-7gg)', 'PRIMA_EVENTO', 50),
  ('Cofanetto cerimonia consegnato', 'PRIMA_EVENTO', 60),
  ('Ridimensionamento entro 6 mesi (se errore misura)', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'gioielli-fedi';

-- ============================================================================
-- AUTO / WEDDING CAR
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'wedding-car');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Auto sposi vintage italiana (Alfa, Fiat 500)', 'Wedding car vintage italiana (Alfa Giulia, Fiat 500 d''epoca, Lancia): autista in livrea, fiocco bianco, 3-4h di servizio. Tragitto preparativi-cerimonia-ricevimento.', 650.00, 'FLAT', 'EVENTO', 10, true),
  ('Auto sposi premium (Mercedes, BMW serie 7)', 'Auto sposi moderna premium con autista: Mercedes classe S o BMW serie 7. Vetri privacy, pelle interna chiara, fiocco/decoro bianco discreto.', 480.00, 'FLAT', 'EVENTO', 20, true),
  ('Auto sposi lusso (Rolls Royce, Bentley)', 'Wedding car di lusso: Rolls Royce Phantom o Bentley. Autista in livrea, riservata per occasioni di prestigio. Disponibilita'' limitata.', 1500.00, 'FLAT', 'EVENTO', 30, true),
  ('Cabriolet sposi (Maggiolino, Mini Cooper)', 'Auto cabriolet (Maggiolino Cabrio, Mini Cooper Cabrio): perfetta per matrimoni primaverili/estivi. Effetto romantico, tetto aperto per foto.', 550.00, 'FLAT', 'EVENTO', 40, false),
  ('Auto americana anni 50/60 (Cadillac, Chevrolet)', 'Auto americana d''epoca (Cadillac Coupe, Chevrolet Bel Air): perfetta per matrimoni a tema retro/rockabilly. Statement piece.', 800.00, 'FLAT', 'EVENTO', 50, false),
  ('Carrozza con cavalli (per cerimonia)', 'Carrozza vittoriana con coppia di cavalli, cocchiere in livrea. Adatta a parchi/ville storiche con accesso adeguato. 1-2h di servizio.', 1800.00, 'FLAT', 'EVENTO', 60, false),
  ('Trasferta extra fuori provincia', 'Supplemento trasferta auto + autista per servizi oltre la provincia di sede operativa.', 200.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'wedding-car';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'wedding-car');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Servizio NCC wedding car', 'Il Noleggiatore si impegna a fornire servizio Noleggio Con Conducente per il matrimonio di {{client_name}} del {{event_date}}, includendo: autista in divisa, vettura concordata, decoro standard wedding (fiocchi bianchi), tragitti preparativi-cerimonia-ricevimento secondo timeline.', 10),
  ('CORRISPETTIVI', 'Acconto e franchigia chilometrica', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 30% acconto alla firma, 70% saldo entro 7gg pre-evento. Sono compresi fino a 100 km/evento; km eccedenti vengono fatturati a 1,5 euro/km. Eventuali soste >30 min in attesa sono incluse.', 20),
  ('RESPONSABILITA', 'Assicurazione e licenza NCC', 'Il Noleggiatore opera in regime di licenza NCC ai sensi della L. 21/1992, con polizza Kasko sull''auto e RC trasportati. Eventuali danni causati da invitati (interno auto) sono a carico del Cliente con franchigia di 500 euro.', 30),
  ('FORZA_MAGGIORE', 'Guasto auto e vettura sostitutiva', 'In caso di guasto della vettura prevista, il Noleggiatore garantisce vettura sostitutiva di pari categoria. In caso di indisponibilita'' assoluta, il Cliente ha diritto a rimborso del 100% del corrispettivo.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'wedding-car';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'wedding-car');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Franchigia km nero su bianco', 'Specifica franchigia km inclusa (es. 100 km) e tariffa eccedente: clienti che mettono cerimonia/ricevimento a 80 km di distanza si aspettano sia tutto incluso.', 10),
  ('SERVIZI', 'Vintage italiana sempre richieste', 'Le vintage italiane (Alfa Giulia, 500 d''epoca) sono le piu'' richieste e marginali: investi nella loro manutenzione, sono il tuo cavallo di battaglia.', 10),
  ('CONTRATTI', 'Licenza NCC obbligatoria', 'Allega copia licenza NCC + assicurazione al contratto: senza licenza, sei abusivo e una verifica della polizia stradale ferma il servizio (e ti multa).', 10),
  ('GIORNO', 'Auto pulita lucida -2h', 'Lavaggio + cera auto -2h dalla partenza: anche su vintage, le foto in HD mostrano ogni macchia/polvere. La pulizia e'' il 50% del servizio.', 10),
  ('GIORNO', 'Vettura backup nel parco', 'Tieni sempre vettura backup nel parco auto: se la principale ha un guasto la mattina del matrimonio (succede!), hai 1h per recuperare.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'wedding-car';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'wedding-car');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma tragitto + orari con sposi (-7gg)', 'PRIMA_EVENTO', 10),
  ('Verifica tecnica auto + tagliando recente', 'PRIMA_EVENTO', 20),
  ('Lavaggio + cera auto (-24h)', 'PRIMA_EVENTO', 30),
  ('Decoro auto (fiocchi, fiori) la mattina', 'PRIMA_EVENTO', 40),
  ('Carburante pieno + verifica gomme', 'PRIMA_EVENTO', 50),
  ('Arrivo location preparativi puntuale', 'ARRIVO', 10),
  ('Apertura porte assistita per sposa', 'DURANTE', 10),
  ('Pulizia interno auto post-trasferta', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'wedding-car';

-- ============================================================================
-- TRANSFER / NAVETTE
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'transfer-navette');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Navetta 16 posti GT (oraria)', 'Minibus GT 16 posti aria condizionata, autista NCC. Tariffa oraria, ideale per shuttle ospiti hotel-location-hotel.', 65.00, 'PER_HOUR', 'ORA', 10, true),
  ('Navetta 30 posti GT (oraria)', 'Autobus GT 30 posti, autista NCC. Per matrimoni con grandi gruppi: shuttle aeroporto-hotel o hotel-location.', 95.00, 'PER_HOUR', 'ORA', 20, true),
  ('Autobus GT 50 posti', 'Autobus GT 50 posti per grandi numeri (matrimoni 100+ ospiti): collegamento parcheggio remoto-location o hotel-location.', 130.00, 'PER_HOUR', 'ORA', 30, true),
  ('Transfer aeroporto ospiti VIP', 'Transfer aeroporto-hotel con vettura Mercedes/Audi business, autista in giacca/cravatta. Welcome ospiti VIP.', 120.00, 'FLAT', 'EVENTO', 40, false),
  ('Shuttle continuo fine serata (3h)', 'Shuttle continuo fine serata da location a hotel ospiti: piu'' viaggi tra 01:00 e 04:00 per smistare ospiti senza attese.', 480.00, 'FLAT', 'EVENTO', 50, true),
  ('Pacchetto giornata completa (8h)', 'Pacchetto giornata: navetta + autista a disposizione 8h, per coprire arrivo, trasferimenti, fine serata. Tariffa scontata.', 580.00, 'FLAT', 'EVENTO', 60, true),
  ('Autista NCC dedicato per ospite anziano', 'NCC auto privata dedicata a ospite con difficolta'' motorie/anziano: trasporto porta-a-porta hotel-location-hotel.', 250.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'transfer-navette';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'transfer-navette');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Servizio NCC e capacita'' veicoli', 'Il Noleggiatore si impegna a fornire servizio Noleggio Con Conducente per il matrimonio di {{client_name}} del {{event_date}}. Veicoli, capacita'' posti e durata sono come da preventivo. Compresi: autisti NCC con licenza, veicoli a norma CE, climatizzazione.', 10),
  ('CORRISPETTIVI', 'Tariffe orarie e attese', 'Il corrispettivo orario e'' indicato per veicolo. Le ore di attesa tra trasferimenti rientrano nel computo orario al 100% (es. autista in attesa allo stop). Eventuali tariffe notturne (22:00-06:00) maggiorate del 15%.', 20),
  ('RESPONSABILITA', 'Comportamento ospiti e danni', 'Il Cliente e'' responsabile per danni causati dagli ospiti all''interno dei mezzi (pulizia straordinaria per vomito, danni a sedili, ecc.). Penale forfettaria 200 euro per pulizia straordinaria; danni superiori a perizia.', 30),
  ('FORZA_MAGGIORE', 'Guasto mezzo e sostituzione', 'In caso di guasto di un veicolo, il Noleggiatore garantisce mezzo sostitutivo equivalente entro 60 minuti. Eventuale ritardo nei tempi di pickup oltre i 60 min comporta riduzione 30% sul corrispettivo del mezzo coinvolto.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'transfer-navette';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'transfer-navette');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Pacchetto giornata vs orario', 'Vendi pacchetto giornata (8h) come opzione preferita: tariffa scontata vs orario, ma marginalita'' totale maggiore. Cliente percepisce convenienza.', 10),
  ('SERVIZI', 'Shuttle continuo fine serata', 'Il "fine serata continuo" (01-04) e'' il servizio che salva la giornata: senza, ospiti rimangono bloccati e qualcuno guida ubriaco. E'' un servizio da push hard.', 10),
  ('CONTRATTI', 'Tariffe notturne nero su bianco', 'Specifica maggiorazione notturna (15-20% post 22:00): senza, il cliente che chiede shuttle alle 03:00 contesta il sovrapprezzo.', 10),
  ('CONTRATTI', 'Penale pulizia straordinaria', 'Inserisci penale forfettaria pulizia straordinaria (200 euro): in matrimoni dove si beve molto, succede. Senza penale scritta, il costo lo paghi tu.', 20),
  ('GIORNO', 'Briefing autista con WP', 'Briefing autista con WP la mattina: numero ospiti per fascia, dove parcheggiare, contatto interno. Autisti senza briefing causano ritardi.', 10),
  ('GIORNO', 'Cartelli "Wedding [Nomi]" nei mezzi', 'Cartelli "Wedding [Nomi]" sui finestrini dei mezzi: ospiti riconoscono al volo senza chiamare la WP.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'transfer-navette';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'transfer-navette');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma piano trasporti con WP (-7gg)', 'PRIMA_EVENTO', 10),
  ('Briefing autisti su orari e contatti', 'PRIMA_EVENTO', 20),
  ('Verifica tecnica mezzi + carburante', 'PRIMA_EVENTO', 30),
  ('Cartelli "Wedding [Nomi]" pronti', 'PRIMA_EVENTO', 40),
  ('Veicoli backup a disposizione', 'PRIMA_EVENTO', 50),
  ('Posizionamento mezzi punti di pickup', 'ARRIVO', 10),
  ('Conta ospiti per ogni viaggio', 'DURANTE', 10),
  ('Coordinamento shuttle fine serata 01-04', 'DURANTE', 20),
  ('Pulizia mezzi post-evento', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'transfer-navette';

-- ============================================================================
-- HOTEL / ALLOGGI
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'hotel-alloggi');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Suite sposi notte evento (con colazione)', 'Suite sposi notte dell''evento, colazione in camera/sala. Late checkout 14:00 incluso. Welcome amenities sposi (frutta, bollicine).', 280.00, 'FLAT', 'PEZZO', 10, true),
  ('Camera doppia standard convenzionata', 'Camera doppia/matrimoniale standard per ospiti del matrimonio, tariffa convenzionata. Colazione inclusa.', 110.00, 'PER_TABLE', 'PEZZO', 20, true),
  ('Camera doppia superior convenzionata', 'Camera doppia superior (vista, terrazzo, dimensione maggiore) per ospiti VIP. Colazione inclusa.', 160.00, 'PER_TABLE', 'PEZZO', 30, true),
  ('Junior suite familiari (4 persone)', 'Junior suite per famiglie con bambini: 1 letto matrimoniale + divano letto. Colazione inclusa.', 220.00, 'PER_TABLE', 'PEZZO', 40, true),
  ('Allotment 10 camere convenzionate', 'Pacchetto allotment 10 camere riservate al gruppo matrimonio, tariffa convenzionata fissa. Booking ospiti gestito da hotel direttamente.', 1080.00, 'FLAT', 'EVENTO', 50, true),
  ('Welcome bag ospiti in camera', 'Welcome bag personalizzata sposi consegnata in camera ospiti: prodotti locali, mappa zona, programma evento. Per camera.', 22.00, 'PER_TABLE', 'PEZZO', 60, false),
  ('Sala riunioni per testimoni/cerimonia civile', 'Sala riunioni hotel utilizzabile per cerimonia civile (capienza fino a 80) o briefing testimoni mattina.', 350.00, 'FLAT', 'EVENTO', 70, false),
  ('Brunch giorno dopo (post-wedding)', 'Brunch giorno dopo matrimonio per ospiti residenti: buffet light dalle 10 alle 12. Tariffa per ospite adulto.', 28.00, 'PER_GUEST', 'PERSONA', 80, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'hotel-alloggi';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'hotel-alloggi');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Allotment camere e tariffe convenzionate', 'L''Hotel si impegna a riservare un allotment di camere a tariffa convenzionata per gli ospiti del matrimonio di {{client_name}} del {{event_date}}. Le camere restano in allotment esclusivo fino a 60gg pre-evento; le invendute rientrano disponibilita'' generale dell''hotel.', 10),
  ('CORRISPETTIVI', 'Acconto allotment e booking ospiti', 'Il Cliente versa acconto pari al 20% del valore allotment alla firma (a fermo periodo). Le camere effettivamente vendute al gruppo sono fatturate dall''Hotel direttamente al Cliente o ai singoli ospiti secondo accordo. La suite sposi viene fatturata sempre direttamente al Cliente.', 20),
  ('FORZA_MAGGIORE', 'Allotment 30/60/90 giorni e penali no-show', 'Le camere non confermate dagli ospiti entro 60gg pre-evento rientrano in disponibilita'' generale. Penali no-show ospite: cancellazione fino a 30gg pre-evento gratuita; 30-15gg trattenimento 50%; <15gg penale 100% prima notte. Le penali no-show sono a carico del singolo ospite, salvo subentro del Cliente.', 30),
  ('RESPONSABILITA', 'Danni e comportamento ospiti', 'Eventuali danni causati dagli ospiti alle camere o aree comuni sono addebitati al singolo ospite registrato. In caso di mancato recupero, l''Hotel puo'' rivalersi sul Cliente principale del matrimonio.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'hotel-alloggi';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'hotel-alloggi');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Allotment 30/60/90gg modulato', 'Imposta allotment modulato: blocco totale fino a 90gg, parziale 60-30gg, libero <30gg. Cosi'' non resti con camere vuote per matrimoni che riducono il blocco a meta'' strada.', 10),
  ('SERVIZI', 'Up-sell suite + brunch giorno dopo', 'Vendi sempre suite sposi + brunch giorno dopo come pacchetto premium: marginalita'' alta e gli sposi spendono volentieri.', 10),
  ('CONTRATTI', 'Penali no-show in chiaro per ospite', 'Spiega bene le penali no-show ai single ospiti via email/landing dedicata: senza, il "non sono potuto venire" diventa una causa di rimborso.', 10),
  ('CONTRATTI', 'Welcome bag come dettaglio premium', 'Includi welcome bag come servizio standard nelle camere allotment: piccolo costo, grande percezione di hotel attento.', 20),
  ('GIORNO', 'Check-in ospiti staggered', 'Coordinati con WP per check-in ospiti scaglionato: arrivi 14-19 invece di tutti alle 17, eviti coda in reception e ospiti incazzati.', 10),
  ('GIORNO', 'Sala briefing testimoni mattina', 'Offri sala interna per briefing testimoni mattina: zero costo per te, alto valore percepito.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'hotel-alloggi';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'hotel-alloggi');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Verifica allotment camere a -60gg', 'PRIMA_EVENTO', 10),
  ('Conferma camere effettive ospiti (-30gg)', 'PRIMA_EVENTO', 20),
  ('Setup welcome bag in camere (-24h)', 'PRIMA_EVENTO', 30),
  ('Briefing reception per check-in gruppo', 'PRIMA_EVENTO', 40),
  ('Allestimento suite sposi (amenities)', 'PRIMA_EVENTO', 50),
  ('Check-in scaglionato 14-19', 'DURANTE', 10),
  ('Gestione shuttle hotel-location con NCC', 'DURANTE', 20),
  ('Late checkout suite sposi (14:00)', 'PARTENZA', 10),
  ('Verifica danni camere e charge ospiti', 'PARTENZA', 20)
) as x(voce, momento, sort_order)
where slug = 'hotel-alloggi';

-- ============================================================================
-- FUOCHI D'ARTIFICIO
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'fuochi-artificio');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Spettacolo pirotecnico 5 minuti', 'Spettacolo pirotecnico classico 5 minuti, finale matrimonio. Cascate, code, bombe colorate fino a 30m altezza. Inclusi permessi e SCIA.', 1500.00, 'FLAT', 'EVENTO', 10, true),
  ('Spettacolo pirotecnico 10 minuti coreografato', 'Spettacolo coreografato 10 minuti con musica sincronizzata. Effetti speciali, bombe in coreografia, finale a cascata. Show da concorso.', 3200.00, 'FLAT', 'EVENTO', 20, true),
  ('Cascata pirotecnica per taglio torta', 'Cascata di scintille fredde per il taglio della torta o ingresso pista. Effetto fontana indoor/outdoor, 90 secondi.', 450.00, 'FLAT', 'EVENTO', 30, true),
  ('Show pirotecnico silenzioso (eco-friendly)', 'Show pirotecnico solo luce, senza esplosioni rumorose: ideale per location con vincoli acustici (centri storici, vicinanze animali).', 2400.00, 'FLAT', 'EVENTO', 40, false),
  ('Sparoflux/Cold spark per primo ballo', 'Sparoflux/cold spark machine durante primo ballo: getti di scintille fredde indoor, sicure per uso in sala. Configurazione 2-4 unita''.', 380.00, 'FLAT', 'EVENTO', 50, false),
  ('Permessi e SCIA per location', 'Pratica permessi VVF e SCIA presso autorita'' locali. Tempi tipici 30-45gg pre-evento.', 250.00, 'FLAT', 'EVENTO', 60, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'fuochi-artificio';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'fuochi-artificio');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Spettacolo pirotecnico e licenze', 'Il Pirotecnico, in possesso di licenza ex artt. 47-51 TULPS, si impegna a realizzare spettacolo pirotecnico per il matrimonio di {{client_name}} del {{event_date}}. Include: pratica VVF/SCIA presso autorita'' locali, fornitura artifici di categoria F2/F3, allestimento e firing, smaltimento residui.', 10),
  ('RESPONSABILITA', 'Sicurezza, distanze e polizza RC', 'Il Pirotecnico opera nel rispetto del DM 19/09/2002 e successive integrazioni. Distanza minima ospiti rispettata (50-100m secondo calibro), assicurazione RC dedicata massimale 5.000.000 euro. Eventuali infortuni causati dallo show sono a carico dell''assicurazione del Pirotecnico.', 20),
  ('FORZA_MAGGIORE', 'Meteo avverso e divieti VVF', 'In caso di vento >25 km/h, pioggia battente, divieti VVF (allerta caldo/secco), lo show puo'' essere annullato per sicurezza. In tal caso il Cliente paga il 50% del corrispettivo (costi gia'' sostenuti: artifici acquistati, SCIA presentata, montaggio). Rinvio gratuito ad altra data entro 12 mesi.', 30),
  ('CORRISPETTIVI', 'Acconto e tempistica permessi', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 50% acconto alla firma (necessario per inizio pratica permessi e acquisto artifici), 50% saldo a -7gg pre-evento. La pratica SCIA richiede 30-45gg: ordine sotto i 30gg pre-evento non garantisce permessi in tempo.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'fuochi-artificio';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'fuochi-artificio');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Permessi 45gg in chiaro', 'Specifica subito: SCIA richiede 30-45gg, non accetti ordini sotto i 30gg. Tutela del cliente e tutela tua.', 10),
  ('SERVIZI', 'Cold spark indoor come up-sell', 'Vendi cold spark per primo ballo/taglio torta come servizio piccolo (300-500 euro): effetto wow garantito, marginalita'' alta, zero attriti con location.', 10),
  ('CONTRATTI', 'Polizza RC 5M visibile', 'Allega copia polizza RC (massimale 5M) e licenza TULPS al contratto: prova di professionalita'' che ti distingue dal pirotecnico abusivo.', 10),
  ('CONTRATTI', 'Penale meteo asimmetrica', 'Penale meteo asimmetrica: tu non vai (50% al cliente per costi sostenuti), il cliente cancella per altri motivi (100%). E'' fair.', 20),
  ('GIORNO', 'Sopralluogo location -7gg', 'Sopralluogo location -7gg per identificare zona firing, distanze ospiti, vento prevalente, alberi/strutture. Mai improvvisare.', 10),
  ('GIORNO', 'Briefing WP/DJ per cue spettacolo', 'Briefing con WP e DJ per cue dello spettacolo: musica deve partire 5 sec prima dello scoppio. Senza sync, lo show perde 50%.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'fuochi-artificio';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'fuochi-artificio');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('SCIA presentata e approvata (-30gg)', 'PRIMA_EVENTO', 10),
  ('Sopralluogo location e mappa firing', 'PRIMA_EVENTO', 20),
  ('Verifica meteo (-48h)', 'PRIMA_EVENTO', 30),
  ('Carico artifici certificati + DDT', 'PRIMA_EVENTO', 40),
  ('Briefing WP e DJ per cue musicale', 'PRIMA_EVENTO', 50),
  ('Allestimento zona firing (-3h spettacolo)', 'ARRIVO', 10),
  ('Delimitazione safety distance ospiti', 'ARRIVO', 20),
  ('Estintore + kit emergenza pronti', 'ARRIVO', 30),
  ('Esecuzione show sincronizzato con musica', 'DURANTE', 10),
  ('Verifica residui spenti + raccolta', 'PARTENZA', 10),
  ('Smaltimento secondo normativa', 'PARTENZA', 20)
) as x(voce, momento, sort_order)
where slug = 'fuochi-artificio';

-- ============================================================================
-- OPEN BAR / MIXOLOGY
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'open-bar-mixology');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Open bar classico 4 ore', 'Open bar 4 ore con barman professionista: cocktail classici (Spritz, Negroni, Aperol, Mojito), vini, birre, soft drinks. Per ospite adulto.', 22.00, 'PER_GUEST', 'PERSONA', 10, true),
  ('Open bar premium 4 ore', 'Open bar premium 4h: cocktail signature, premium spirits (gin Hendricks, rum Diplomatico, whisky Aberlour), bollicine, vini cantine selezionate.', 35.00, 'PER_GUEST', 'PERSONA', 20, true),
  ('Mixology show con bartender', 'Bartender flair show: cocktail preparati in front-stage con tecniche di mixology spettacolare. Coinvolgente per gli ospiti.', 18.00, 'PER_GUEST', 'PERSONA', 30, true),
  ('Postazione gin & tonic gourmet', 'Postazione dedicata gin & tonic con 8-10 gin selezionati e abbinamenti botanici. Bartender dedicato spiega le combinazioni.', 14.00, 'PER_GUEST', 'PERSONA', 40, false),
  ('Postazione cocktail analcolici (mocktail)', 'Postazione cocktail analcolici di alta qualita'' per ospiti astemi, donne incinte, bambini. Mocktail freschi e instagrammabili.', 8.00, 'PER_GUEST', 'PERSONA', 50, false),
  ('Bar mobile vintage (Ape Piaggio o cart)', 'Bar mobile vintage (Ape Piaggio attrezzata, cart americano) per aperitivo o angolo gin: instagrammabile, statement piece.', 480.00, 'FLAT', 'EVENTO', 60, false),
  ('Cocktail signature personalizzato', 'Creazione di cocktail signature personalizzato sposi (nome dedicato, bottle bottom design, ricetta esclusiva): bonus emozionale.', 250.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'open-bar-mixology';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'open-bar-mixology');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Servizio bar e fornitura bevande', 'Il Fornitore si impegna a fornire servizio open bar per il matrimonio di {{client_name}} del {{event_date}} secondo formula e durata pattuite. Compresi: barman professionisti, attrezzature, bicchieri, ghiaccio, decorazioni cocktail, fornitura bevande.', 10),
  ('CORRISPETTIVI', 'Tariffe a persona e ospiti adulti', 'Il corrispettivo a persona si applica al numero di ospiti adulti definitivo (-15gg pre-evento). I bambini under 14 non rientrano nel conteggio. Tariffe IVA inclusa.', 20),
  ('RESPONSABILITA', 'Somministrazione alcolici e minori', 'Il Fornitore opera in regime di somministrazione alcolici autorizzata (SCIA). Il personale di bar e'' formato a riconoscere e rifiutare la somministrazione a minori e a ospiti visibilmente ubriachi, secondo art. 689 c.p.', 30),
  ('FORZA_MAGGIORE', 'Sostituzione marche e disponibilita''', 'In caso di indisponibilita'' di marche specifiche di spirits/vini comunicate in preventivo, il Fornitore si riserva di sostituirle con equivalenti di pari qualita'' della stessa fascia, dandone comunicazione al Cliente.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'open-bar-mixology';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'open-bar-mixology');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Premium vs classico differenziale grosso', 'Tra classico e premium imposta differenziale grande (10-15 euro): chi sceglie premium lo fa per orgoglio, non per risparmio. Vendi qualita''.', 10),
  ('SERVIZI', 'Cocktail signature come gancio', 'Vendi cocktail signature sposi (250 euro) come up-sell emozionale: poco costo, alto valore percepito, dettaglio condiviso sui social.', 10),
  ('CONTRATTI', 'No alcol a minori in clausola', 'Inserisci esplicitamente clausola "no alcol a minori": tutela legale tua e responsabilizza il cliente sulla gestione invitati.', 10),
  ('GIORNO', 'Postazione analcolici sempre', 'Imposta sempre postazione analcolici (anche minima): ospiti astemi/incinte/bambini si sentono trascurati senza, e il social-mention della sposa indispone.', 10),
  ('GIORNO', 'Backup ghiaccio sempre', 'Backup ghiaccio doppio dell''atteso: matrimoni d''estate consumano il triplo. Senza, alle 23 il bar e'' chiuso.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'open-bar-mixology';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'open-bar-mixology');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma numero ospiti adulti (-15gg)', 'PRIMA_EVENTO', 10),
  ('Verifica disponibilita'' marche premium', 'PRIMA_EVENTO', 20),
  ('Backup ghiaccio doppio quantita'' attesa', 'PRIMA_EVENTO', 30),
  ('Briefing barman su signature sposi', 'PRIMA_EVENTO', 40),
  ('Setup bar -2h aperitivo', 'ARRIVO', 10),
  ('Mise en place bicchieri + decorazioni', 'ARRIVO', 20),
  ('Postazione analcolici dedicata visibile', 'ARRIVO', 30),
  ('Apertura bar in coordinata con WP', 'DURANTE', 10),
  ('Rifornimento progressivo ghiaccio/spirits', 'DURANTE', 20),
  ('Smaltimento bottiglie + pulizia', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'open-bar-mixology';

-- ============================================================================
-- POSTAZIONI SPECIALI
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'postazioni-speciali');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Coffee station gourmet (espresso bar)', 'Espresso bar gourmet con barista: caffe'' di qualita'', cappuccino latte art, decaffeinati, te'' selezionati. Postazione operativa 2h.', 480.00, 'FLAT', 'EVENTO', 10, true),
  ('Gelato bar artigianale (carrettino vintage)', 'Carrettino gelato vintage con 6-8 gusti gelato artigianale + topping. Gelataio dedicato 2h. Coppette o cono.', 650.00, 'FLAT', 'EVENTO', 20, true),
  ('Sigar room (lounge sigari)', 'Lounge angolo sigari per ospiti uomini: 3-4 marche sigari premium (Cohiba, Romeo y Julieta), poltrone, tagliasigari, accendini.', 350.00, 'FLAT', 'EVENTO', 30, true),
  ('Postazione crepe / waffle dolci', 'Postazione crepe + waffle dolci preparati al momento: cioccolato, Nutella, frutta fresca, panna, gelato. Operatore 2h.', 420.00, 'FLAT', 'EVENTO', 40, false),
  ('Aperitivo italiano regionale', 'Postazione "Italia in 5 regioni": 5 territori italiani con prodotti tipici e bollicine abbinate (Franciacorta, Trentodoc, Prosecco DOC).', 580.00, 'FLAT', 'EVENTO', 50, false),
  ('Pizza station con forno mobile', 'Pizza al taglio o pizzette gourmet preparate al momento in forno mobile a legna/gas. Pizzaiolo professionista 2h.', 750.00, 'FLAT', 'EVENTO', 60, false),
  ('Late night snack (post-party 02:00)', 'Postazione snack notturno: panini gourmet, hamburger sliders, hot dog, patatine fritte fresche. Ideale post-party.', 480.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'postazioni-speciali';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'postazioni-speciali');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Postazione e durata operativa', 'Il Fornitore si impegna ad allestire e gestire la postazione tematica per il matrimonio di {{client_name}} del {{event_date}}, per la durata pattuita (in genere 2h). Compresi: fornitura prodotti, attrezzatura, personale dedicato, allestimento e smontaggio.', 10),
  ('CORRISPETTIVI', 'Tariffa forfettaria evento', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa (tariffa evento, non a persona). Pagamento: 30% acconto alla firma, 70% saldo a -7gg pre-evento. Tariffa valida per gruppi fino a 150 ospiti; sopra applicato sovrapprezzo proporzionale.', 20),
  ('RESPONSABILITA', 'HACCP food/bev e sicurezza', 'Il Fornitore opera in regime HACCP con certificazione attiva. Eventuali allergie/intolleranze devono essere comunicate per la predisposizione di alternative. Per postazioni con fiamme (forno legna, crepe), l''area e'' delimitata con distanze di sicurezza.', 30),
  ('FORZA_MAGGIORE', 'Postazioni outdoor e meteo', 'Per postazioni allestite outdoor, in caso di maltempo il Fornitore garantisce setup indoor alternativo (previo accordo location) senza supplemento. Annullamento della postazione per impossibilita'' assoluta comporta restituzione 100%.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'postazioni-speciali';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'postazioni-speciali');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Tariffa evento, non a persona', 'Vendi sempre come tariffa evento (NON per persona): clienti capiscono il valore "stazione tematica" e non si fanno il conto a persona che li scoraggerebbe.', 10),
  ('SERVIZI', 'Gelato bar e Coffee station bestseller', 'Gelato bar artigianale e coffee station gourmet sono i due piu'' venduti: investi su quei due e padroneggia tutto.', 10),
  ('CONTRATTI', 'Sovrapprezzo over 150 ospiti', 'Inserisci sovrapprezzo over 150 ospiti: matrimoni grossi richiedono piu'' prodotto e operatori. Senza clausola, il margine cade.', 10),
  ('GIORNO', 'Postazione dopo aperitivo, prima cena', 'Apri postazione tematica nella finestra "post-aperitivo, pre-cena" o "post-cena, pre-ballo": prima/durante cena la gente non si alza.', 10),
  ('GIORNO', 'Foto allestimento da subito', 'Scatta foto allestimento prima dell''apertura: e'' il momento Instagrammabile, dopo 5 minuti diventa il caos.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'postazioni-speciali';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'postazioni-speciali');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Conferma orario apertura con WP (-15gg)', 'PRIMA_EVENTO', 10),
  ('Verifica HACCP prodotti freschi', 'PRIMA_EVENTO', 20),
  ('Carico furgone attrezzature + ingredienti', 'PRIMA_EVENTO', 30),
  ('Setup postazione (-1h apertura)', 'ARRIVO', 10),
  ('Mise en place + foto allestimento', 'ARRIVO', 20),
  ('Apertura postazione coordinata con WP', 'DURANTE', 10),
  ('Rifornimento progressivo prodotti', 'DURANTE', 20),
  ('Chiusura postazione + smontaggio', 'PARTENZA', 10),
  ('Smaltimento residui food/bev', 'PARTENZA', 20)
) as x(voce, momento, sort_order)
where slug = 'postazioni-speciali';

-- ============================================================================
-- BOMBONIERE
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'bomboniere');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Bomboniera classica con confetti', 'Bomboniera classica: sacchetto in tessuto/carta + 5 confetti tradizionali + bigliettino sposi personalizzato. Tariffa al pezzo.', 5.50, 'FLAT', 'PEZZO', 10, true),
  ('Bomboniera artigianale ceramica', 'Bomboniera in ceramica dipinta a mano (vasetto, statuina, oggettistica utile). Coordinata estetica col matrimonio.', 12.00, 'FLAT', 'PEZZO', 20, true),
  ('Bomboniera utile (pianta grassa, candela)', 'Bomboniera utile a doppia funzione: pianta grassa in vasetto personalizzato, candela in barattolo, mini-piantina aromatica.', 9.00, 'FLAT', 'PEZZO', 30, true),
  ('Bomboniera solidale (donazione associazione)', 'Bomboniera solidale: pergamena con donazione a nome ospite a associazione benefica scelta dagli sposi (Lega Tumori, Save the Children, WWF).', 7.00, 'FLAT', 'PEZZO', 40, true),
  ('Bomboniera gastronomica (mini-conserva)', 'Bomboniera gastronomica artigianale: mini-marmellata, mini-miele, mini-olio EVO, mini-vino con etichetta personalizzata.', 8.50, 'FLAT', 'PEZZO', 50, false),
  ('Bomboniera digitale (NFT/QR donazione)', 'Bomboniera digitale: QR code o NFT con donazione a progetto sociale. Trend recente, sostenibile, low-impact.', 4.00, 'FLAT', 'PEZZO', 60, false),
  ('Confezionamento personalizzato (nastro, tag)', 'Confezionamento personalizzato: nastrino seta con nome ospite, tag in carta cotone con data sposi.', 1.80, 'FLAT', 'PEZZO', 70, true)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'bomboniere';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'bomboniere');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Bomboniere e tempi di lavorazione', 'Il Fornitore si impegna a produrre le bomboniere personalizzate per il matrimonio di {{client_name}} del {{event_date}}. Compresi: prototipo di approvazione, produzione, confezionamento personalizzato, consegna location o domicilio sposi.', 10),
  ('CORRISPETTIVI', 'Acconto e quantita'' definitiva', 'Il corrispettivo a pezzo e'' di X euro IVA inclusa, su quantita'' stimata di N pezzi (=N ospiti adulti + 10% scorta). Definitiva quantita'' a -30gg pre-evento. Pagamento: 30% acconto alla firma (necessario per inizio produzione), 70% al ritiro/consegna.', 20),
  ('SOSTITUZIONI', 'Tonalita'' artigianali e finiture', 'Per prodotti artigianali (ceramica dipinta, candele, vasetti) sono ammesse lievi variazioni di tonalita'' tra pezzi: trattandosi di lavorazione manuale, la perfetta uniformita'' non e'' garantibile.', 30),
  ('RECESSO', 'Penali post-produzione', 'In caso di recesso: oltre 60gg pre-evento trattenimento 30%; 60-30gg 60% (produzione avviata); sotto 30gg penale 100% (bomboniere personalizzate non rivendibili).', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'bomboniere';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'bomboniere');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', '+10% scorta nel preventivo', 'Imposta sempre +10% scorta sulle quantita'' (es. 100 ospiti = 110 bomboniere): coppie dimenticano qualcuno, ospiti last-minute, pezzi rotti.', 10),
  ('SERVIZI', 'Solidali in trend', 'Le bomboniere solidali sono il trend: vendi pacchetto "solidale 50% + utile 50%" per coppie che vogliono mix tra ricordo e responsabilita''.', 10),
  ('CONTRATTI', 'Disclaimer lavorazione artigianale', 'Specifica nero su bianco che ceramica/candele artigianali hanno variazioni tonali: senza, ogni differenza minima diventa contestazione.', 10),
  ('GIORNO', 'Consegna -3gg location', 'Consegna a location -3gg pre-evento: cosi'' WP/responsabile sala dispone con calma. Last-minute = ansia + errori.', 10),
  ('GIORNO', 'Disposizione tableau + uscita', 'Concorda con WP la disposizione: tableau de mariage all''ingresso o sacchetto uscita. Senza accordo, restano confuse nel banco.', 20)
) as x(contesto, titolo, testo, sort_order)
where slug = 'bomboniere';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'bomboniere');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Quantita'' definitiva +10% scorta (-30gg)', 'PRIMA_EVENTO', 10),
  ('Prototipo approvato + foto', 'PRIMA_EVENTO', 20),
  ('Verifica produzione completa', 'PRIMA_EVENTO', 30),
  ('Confezionamento finale + tag personalizzati', 'PRIMA_EVENTO', 40),
  ('Consegna location (-3gg)', 'PRIMA_EVENTO', 50),
  ('Coordinamento disposizione con WP', 'ARRIVO', 10),
  ('Verifica numero bomboniere disposte', 'ARRIVO', 20),
  ('Eventuale ritiro pezzi non distribuiti', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'bomboniere';

-- ============================================================================
-- INVITI / STATIONERY
-- ============================================================================
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'inviti-stationery');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Wedding suite carta stampa digitale', 'Wedding suite completa stampa digitale: invito principale + RSVP card + busta. Per famiglia/ospite. Set 80 ospiti.', 6.50, 'FLAT', 'PEZZO', 10, true),
  ('Wedding suite stampa letterpress', 'Wedding suite letterpress (incisione a pressione): texture tangibile premium. Carta cotone, tipografia tradizionale.', 14.00, 'FLAT', 'PEZZO', 20, true),
  ('Save the Date (digitale o cartaceo)', 'Save the Date in versione digitale (PDF interattivo, animazione email) o cartacea minimale. Inviato 6-12 mesi pre-evento.', 3.50, 'FLAT', 'PEZZO', 30, true),
  ('Menu personalizzato (carta + stampa)', 'Menu personalizzato sposi stampa pregiata, formato A5 o lungo (5x21). Da disporre sul tavolo per ogni ospite.', 2.50, 'PER_GUEST', 'PEZZO', 40, true),
  ('Segnaposto + tableau de mariage', 'Segnaposti calligrafici per ogni ospite + tableau de mariage di design. Soluzione coordinata grafica.', 4.00, 'PER_GUEST', 'PEZZO', 50, true),
  ('Libretto cerimonia (8-12 pagine)', 'Libretto cerimonia stampato: programma rito, brani, letture, ringraziamenti. Formato 14x21, stampa offset.', 4.50, 'PER_GUEST', 'PEZZO', 60, false),
  ('Calligrafia manuale buste/menu', 'Servizio calligrafia manuale: indirizzi su buste, nomi su segnaposti, menu personalizzati a mano. Per pezzo.', 2.20, 'FLAT', 'PEZZO', 70, false),
  ('Sito web wedding personalizzato', 'Sito web matrimonio personalizzato (programma, RSVP digitale, location, hotel consigliati, registry). Online 6 mesi pre-evento.', 350.00, 'FLAT', 'EVENTO', 80, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'inviti-stationery';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'inviti-stationery');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Progettazione e produzione stationery', 'Lo Studio si impegna a progettare e produrre la suite di stationery per il matrimonio di {{client_name}} del {{event_date}}. Compresi: design grafico (2-3 revisioni incluse), prototipo approvazione, stampa, confezionamento, consegna.', 10),
  ('CORRISPETTIVI', 'Acconto e revisioni', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 30% acconto alla firma (inizio design), 70% saldo all''approvazione bozza finale (pre-stampa). Sono incluse 2-3 revisioni grafiche; revisioni successive comportano fee aggiuntiva di 60 euro/revisione.', 20),
  ('PROPRIETA_INTELLETTUALE', 'Diritti d''autore su progetto grafico', 'Il progetto grafico, font custom e illustrazioni originali restano di proprieta'' intellettuale dello Studio. Il Cliente acquisisce licenza d''uso limitata al proprio matrimonio. Lo Studio puo'' utilizzare progetto per portfolio salvo richiesta scritta di esclusiva.', 30),
  ('SOSTITUZIONI', 'Carta e disponibilita'' fornitori', 'In caso di indisponibilita'' di specifica carta/colore presso il fornitore, lo Studio si riserva di sostituire con equivalente di pari qualita''. Sostituzioni di entita'' significativa vengono concordate col Cliente.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'inviti-stationery';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'inviti-stationery');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Wedding suite > singolo invito', 'Vendi sempre wedding suite completa (invito+rsvp+menu+segnaposto+tableau): la suite coordinata e'' percepita premium, marginalita'' aggregata >> singolo invito.', 10),
  ('SERVIZI', 'Letterpress giustifica +100%', 'Letterpress giustifica un prezzo doppio rispetto al digitale: la texture tangibile e'' un valore "sentito al tatto" che il cliente apprezza appena la vede.', 10),
  ('CONTRATTI', 'Limite revisioni grafiche', 'Specifica numero revisioni incluse (2-3): senza limite, ti ritrovi con clienti indecisi che fanno 10 revisioni e tu lavori a costo zero.', 10),
  ('SERVIZI', 'Calligrafia su busta = wow', 'Vendi calligrafia manuale su buste: 100-200 euro extra di marginalita'' alta, e effetto wow alla cassetta postale dell''ospite.', 20),
  ('GIORNO', 'Setup tableau -3h cerimonia', 'Setup tableau de mariage + segnaposti -3h cerimonia: prima che arrivino gli ospiti, le foto degli allestimenti pristine sono il tuo marketing.', 10)
) as x(contesto, titolo, testo, sort_order)
where slug = 'inviti-stationery';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'inviti-stationery');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Approvazione bozza finale stampa (-60gg)', 'PRIMA_EVENTO', 10),
  ('Verifica nomi ospiti per segnaposti/buste', 'PRIMA_EVENTO', 20),
  ('Stampa wedding suite (-45gg)', 'PRIMA_EVENTO', 30),
  ('Spedizione inviti agli ospiti (-30gg)', 'PRIMA_EVENTO', 40),
  ('Conferma tableau + segnaposti finali (-15gg)', 'PRIMA_EVENTO', 50),
  ('Consegna setup giorno evento in location', 'ARRIVO', 10),
  ('Disposizione segnaposti su tavoli', 'ARRIVO', 20),
  ('Setup tableau de mariage all''ingresso', 'ARRIVO', 30),
  ('Foto allestimento finale per portfolio', 'ARRIVO', 40)
) as x(voce, momento, sort_order)
where slug = 'inviti-stationery';

-- ============================================================================
-- CELEBRANTE / OFFICIANTE
-- ============================================================================
-- NOTA UX: il Celebrante e' una "risorsa" non un fornitore pagante in molti
-- casi (officiante civile pubblico, sacerdote). Il pacchetto esiste per dargli
-- presenza/agenda in piattaforma. Per celebranti simbolici privati i prezzi
-- sono indicativi.
delete from public.servizio_template where professione_id = (select id from public.professioni where slug = 'celebrante-officiante');
insert into public.servizio_template (professione_id, nome, descrizione, prezzo_base, quantity_basis, service_unit, sort_order, is_default_pack)
select id, x.nome, x.descrizione, x.prezzo_base, x.qb, x.su, x.sort_order, x.def
from public.professioni, (values
  ('Cerimonia simbolica personalizzata', 'Cerimonia simbolica privata personalizzata sposi: scrittura testo, prove preliminari, conduzione 45-60 minuti. Riti opzionali (sabbia, candele, vino).', 750.00, 'FLAT', 'EVENTO', 10, true),
  ('Cerimonia civile fuori comune sede', 'Servizio di accompagnamento per matrimonio civile in location diversa da comune sede: pratiche amministrative, prove, presenza.', 350.00, 'FLAT', 'EVENTO', 20, true),
  ('Rito del nodo / sabbia / candele', 'Modulo rito simbolico aggiuntivo (Handfasting, sabbia colorata, accensione candele): integra cerimonia base. Include materiali.', 180.00, 'FLAT', 'EVENTO', 30, true),
  ('Cerimonia bilingue (italiano/inglese)', 'Cerimonia simbolica bilingue per matrimoni con ospiti stranieri: parti recitate in 2 lingue, scrittura testo doppio.', 200.00, 'FLAT', 'EVENTO', 40, false),
  ('Sessione scrittura testi sposi (2-3 incontri)', 'Sessioni dedicate alla scrittura del testo cerimonia, raccolta storia sposi, definizione struttura. 2-3 incontri.', 250.00, 'FLAT', 'EVENTO', 50, true),
  ('Prove pre-cerimonia in location', 'Prova generale in location il giorno prima del matrimonio: posizioni, tempi, ingressi. Coordinamento con WP.', 150.00, 'FLAT', 'EVENTO', 60, false),
  ('Officiante religioso esterno (parrocchia)', 'Servizio di richiesta e coordinamento sacerdote esterno (matrimoni misti, parrocchie non di residenza). Pratica diocesana.', 200.00, 'FLAT', 'EVENTO', 70, false)
) as x(nome, descrizione, prezzo_base, qb, su, sort_order, def)
where slug = 'celebrante-officiante';

delete from public.clausola_template where professione_id = (select id from public.professioni where slug = 'celebrante-officiante');
insert into public.clausola_template (professione_id, categoria, per_modalita, titolo, body, sort_order)
select id, c.categoria, null, c.titolo, c.body, c.sort_order
from public.professioni, (values
  ('OGGETTO', 'Conduzione cerimonia e natura simbolica', 'Il Celebrante si impegna a condurre la cerimonia simbolica/personalizzata per il matrimonio di {{client_name}} del {{event_date}}. Si precisa che la cerimonia simbolica NON ha valore legale: il matrimonio acquista efficacia civile esclusivamente tramite la cerimonia in comune o concordataria a parte.', 10),
  ('CORRISPETTIVI', 'Acconto e scrittura testo', 'Il corrispettivo e'' di {{total_amount}} euro IVA inclusa: 30% acconto alla firma (inizio progettazione cerimonia), 70% saldo a -7gg pre-evento. Sono incluse 2-3 sessioni di scrittura/revisione testo; sessioni aggiuntive sono preventivate a parte.', 20),
  ('FORZA_MAGGIORE', 'Sostituzione celebrante', 'In caso di impossibilita'' del Celebrante per causa di forza maggiore documentata, lo stesso si impegna a fornire un sostituto di pari livello professionale, briefato sui testi gia'' redatti, senza supplemento.', 30),
  ('PROPRIETA_INTELLETTUALE', 'Testi cerimonia e diritti d''autore', 'I testi scritti dal Celebrante per la cerimonia restano di proprieta'' intellettuale dell''autore. Il Cliente acquisisce licenza d''uso per il proprio matrimonio. Il Celebrante puo'' citare estratti in portfolio salvo richiesta scritta di riservatezza.', 40)
) as c(categoria, titolo, body, sort_order)
where slug = 'celebrante-officiante';

delete from public.consiglio where professione_id = (select id from public.professioni where slug = 'celebrante-officiante');
insert into public.consiglio (professione_id, contesto, titolo, testo, sort_order)
select id, x.contesto, x.titolo, x.testo, x.sort_order
from public.professioni, (values
  ('PREVENTIVO', 'Chiarezza simbolica vs civile', 'Specifica chiaramente che cerimonia simbolica NON sostituisce civile: senza, alcune coppie pensano sia sufficiente e poi scoprono di non essere sposati legalmente.', 10),
  ('SERVIZI', 'Up-sell riti simbolici', 'Vendi riti simbolici (sabbia, nodo, candele) come moduli aggiuntivi: emozionanti, fotogenici, marginalita'' alta. Lascia che la coppia scelga.', 10),
  ('CONTRATTI', 'Disclaimer legalita''', 'Inserisci disclaimer nel contratto: "questa cerimonia non ha valore legale". Tutela tua e chiarezza per la coppia.', 10),
  ('GIORNO', 'Sopralluogo location -7gg', 'Sopralluogo location -7gg pre-evento: posizione altare, orientamento sposi (luce), camminata sposa, posizione testimoni. Cambia tutto.', 10),
  ('GIORNO', 'Microfono wireless con DJ', 'Coordinati con DJ/audio per microfono wireless: senza voce amplificata, gli ospiti dopo la quarta fila non sentono nulla.', 20),
  ('GIORNO', 'Copia testo + buffer 5 min', 'Stampa 2 copie del testo (tua + backup): tieni 5 min di buffer mentale per silenzi emotivi. Il Celebrante che corre rovina il momento.', 30)
) as x(contesto, titolo, testo, sort_order)
where slug = 'celebrante-officiante';

delete from public.checklist_template where professione_id = (select id from public.professioni where slug = 'celebrante-officiante');
insert into public.checklist_template (professione_id, voce, momento, sort_order)
select id, x.voce, x.momento, x.sort_order
from public.professioni, (values
  ('Stesura finale testo cerimonia (-30gg)', 'PRIMA_EVENTO', 10),
  ('Sopralluogo location (-7gg)', 'PRIMA_EVENTO', 20),
  ('Prova generale con sposi (-1gg)', 'PRIMA_EVENTO', 30),
  ('Verifica microfono wireless con DJ', 'PRIMA_EVENTO', 40),
  ('Stampa 2 copie testo + backup digitale', 'PRIMA_EVENTO', 50),
  ('Arrivo location (-1h cerimonia)', 'ARRIVO', 10),
  ('Coordinamento con WP per timing ingresso sposa', 'ARRIVO', 20),
  ('Test audio finale microfono', 'ARRIVO', 30),
  ('Conduzione cerimonia (45-60 min)', 'DURANTE', 10),
  ('Saluto sposi + foto di rito', 'PARTENZA', 10)
) as x(voce, momento, sort_order)
where slug = 'celebrante-officiante';

-- ============================================================================
-- FINE SEED - 24 professioni nuove + 3 di Fase 1 (Generico/Fotografo/Fiorista)
-- ============================================================================
