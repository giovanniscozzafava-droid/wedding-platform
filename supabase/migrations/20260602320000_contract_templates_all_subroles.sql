-- ============================================================================
-- UN MODELLO DI CONTRATTO PER OGNI PROFESSIONISTA DEL NOSTRO ELENCO.
-- Genera un contratto "legal-grade" per TUTTI i subrole (inclusi gli alias),
-- componendo: premesse/parti con anagrafica (merge), oggetto con voci del
-- preventivo, articolo SPECIALIZZATO del mestiere, corrispettivo + caparra
-- confirmatoria, recesso/penali, responsabilità, forza maggiore, GDPR,
-- riservatezza, foro competente, approvazione clausole vessatorie (1341-1342).
-- Idempotente (ON CONFLICT su subrole). Non sostituisce il parere di un legale.
-- ============================================================================

-- Funzione compositrice: dato il "prefisso anagrafica" (fornitore|capostipite),
-- il nome della parte, l'intro dell'oggetto e gli articoli specializzati,
-- ritorna l'intero set di sezioni con i segnaposto {{...}}.
create or replace function public.build_default_contract_sections(
  p_prefix       text,            -- 'fornitore' | 'capostipite'
  p_party_noun   text,            -- 'Fornitore' | 'Gestore' | 'Organizzatore'
  p_oggetto_intro text,           -- es. 'il servizio fotografico'
  p_special      jsonb            -- array di articoli specializzati (può essere '[]')
)
returns jsonb
language plpgsql
immutable
as $$
declare
  T text := '{{' || p_prefix || '_';   -- prefisso token, es. '{{fornitore_'
  nome text := T || 'nome}}';
  piva text := T || 'piva}}';
  cf   text := T || 'cf}}';
  ind  text := T || 'indirizzo}}';
  tel  text := T || 'telefono}}';
  pn   text := p_party_noun;
begin
  return
    jsonb_build_array(
      jsonb_build_object('heading','Premesse e parti',
        'body', pn || ': ' || nome || ', P.IVA ' || piva || ', C.F. ' || cf ||
                ', con sede in ' || ind || ', tel. ' || tel || ' (di seguito "' || pn || '");' || E'\n' ||
                'COMMITTENTE: {{cliente_nome}}, email {{cliente_email}} (di seguito "Committente").' || E'\n' ||
                'Premesso che il Committente intende affidare al ' || pn ||
                ' le prestazioni di seguito descritte per l''evento "{{evento_titolo}}" del {{evento_data}} presso {{evento_luogo}}, le parti convengono quanto segue.'),
      jsonb_build_object('heading','Art. 1 — Oggetto',
        'body', 'Il ' || pn || ' si obbliga a eseguire ' || p_oggetto_intro ||
                ', con organizzazione di mezzi propri e gestione a proprio rischio, comprensivo delle seguenti prestazioni:' || E'\n' ||
                '{{voci_preventivo}}' || E'\n' ||
                'Le prestazioni sono eseguite a regola d''arte secondo gli standard professionali del settore.')
    )
    || coalesce(p_special, '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object('heading','Corrispettivo, caparra e pagamenti',
        'body', 'Il corrispettivo complessivo è pari a {{preventivo_totale}} (IVA inclusa salvo diversa indicazione). ' ||
                'Alla sottoscrizione il Committente versa, a titolo di caparra confirmatoria ex art. 1385 c.c., il 30% del corrispettivo; il saldo è dovuto entro la data dell''evento. ' ||
                'In caso di inadempimento del Committente il ' || pn || ' può recedere trattenendo la caparra; in caso di inadempimento del ' || pn || ' il Committente può esigere il doppio della caparra, salvo il maggior danno.'),
      jsonb_build_object('heading','Tempi ed esecuzione',
        'body', 'Le prestazioni sono rese nei luoghi, nelle date e negli orari concordati. Eventuali variazioni vanno comunicate tempestivamente per iscritto e accettate dall''altra parte.'),
      jsonb_build_object('heading','Obblighi del ' || pn,
        'body', 'Il ' || pn || ' garantisce professionalità, diligenza, puntualità, idoneità dei mezzi impiegati, rispetto delle normative applicabili e, ove prevista per l''attività svolta, idonea copertura assicurativa per responsabilità civile verso terzi.'),
      jsonb_build_object('heading','Obblighi del Committente',
        'body', 'Il Committente garantisce l''accesso ai luoghi, le autorizzazioni necessarie, la veridicità delle informazioni fornite e la corresponsione del corrispettivo nei termini pattuiti.'),
      jsonb_build_object('heading','Recesso e penali',
        'body', 'In caso di recesso del Committente: oltre 90 giorni dall''evento è trattenuto il 30% (caparra); tra 90 e 30 giorni è dovuto il 50%; entro 30 giorni è dovuto il 100% del corrispettivo, a titolo di penale e a ristoro delle attività e dell''indisponibilità già maturate.'),
      jsonb_build_object('heading','Responsabilità e assicurazione',
        'body', 'Il ' || pn || ' risponde dei danni a esso imputabili per dolo o colpa. È esclusa la responsabilità per danni derivanti da forza maggiore, da fatto del Committente o di terzi, o da informazioni inesatte fornite dal Committente. Salvi i casi di dolo o colpa grave, la responsabilità del ' || pn || ' è comunque contenuta entro l''importo del corrispettivo.'),
      jsonb_build_object('heading','Forza maggiore',
        'body', 'Nessuna delle parti è responsabile per inadempimenti dovuti a cause di forza maggiore o caso fortuito (calamità naturali, provvedimenti dell''autorità, epidemie, scioperi, gravi impedimenti di salute documentati). In tali ipotesi le parti concorderanno in buona fede il recupero della prestazione in data alternativa o, se impossibile, la restituzione delle somme versate al netto delle spese documentate già sostenute.'),
      jsonb_build_object('heading','Riservatezza',
        'body', 'Le parti si impegnano a mantenere riservata ogni informazione acquisita in ragione del presente contratto e a non divulgarla a terzi, salvo quanto necessario all''esecuzione o imposto dalla legge.'),
      jsonb_build_object('heading','Trattamento dei dati personali (GDPR)',
        'body', 'I dati personali sono trattati ai sensi del Reg. UE 2016/679 e del D.Lgs. 196/2003, per le sole finalità di esecuzione del contratto e di adempimento degli obblighi di legge, per il tempo a ciò necessario. L''interessato può esercitare i diritti di cui agli artt. 15-22 GDPR ai recapiti in epigrafe. I dati potranno essere gestiti tramite la piattaforma Planfully (Fuyue S.r.l.) quale fornitore del servizio tecnologico.'),
      jsonb_build_object('heading','Comunicazioni e modifiche',
        'body', 'Ogni modifica al presente contratto è valida solo se concordata per iscritto. Le comunicazioni si intendono validamente effettuate agli indirizzi email indicati in epigrafe.'),
      jsonb_build_object('heading','Legge applicabile e foro competente',
        'body', 'Il contratto è regolato dalla legge italiana. Per ogni controversia è competente in via esclusiva il foro del luogo di residenza/sede del Committente, ove consumatore; in difetto, il foro della sede del ' || pn || '. Le parti tenteranno preventivamente una composizione bonaria.'),
      jsonb_build_object('heading','Sottoscrizione',
        'body', 'Letto, approvato e sottoscritto.' || E'\n' ||
                'Il ' || pn || ' ' || nome || ' __________      Il Committente {{cliente_nome}} __________' || E'\n' ||
                'Luogo e data __________'),
      jsonb_build_object('heading','Approvazione specifica delle clausole (artt. 1341-1342 c.c.)',
        'body', 'Ai sensi degli artt. 1341 e 1342 c.c. il Committente dichiara di approvare specificamente le clausole su: Corrispettivo, caparra e pagamenti; Recesso e penali; Responsabilità e assicurazione; Forza maggiore; Foro competente. Luogo e data __________  —  Firma del Committente per approvazione specifica __________.')
    );
end$$;

-- ── Articoli specializzati per gruppo di mestiere ──────────────────────────
do $$
declare
  -- gruppi di articoli specializzati (jsonb array di 1+ articoli)
  s_foto jsonb := jsonb_build_array(
    jsonb_build_object('heading','Diritti d''autore e licenza d''uso',
      'body','Le opere realizzate sono tutelate dalla L. 633/1941. Il Fornitore resta titolare dei diritti d''autore; al Committente è concessa licenza d''uso personale e non commerciale del materiale consegnato. Sono vietati la modifica sostanziale, la rivendita e l''uso commerciale senza consenso scritto del Fornitore.'),
    jsonb_build_object('heading','Consegna e liberatoria immagini',
      'body','Il materiale è consegnato nei tempi concordati, salvo proroghe per cause non imputabili al Fornitore. Il Committente, anche per gli invitati ripresi, autorizza il Fornitore all''uso di una selezione per portfolio e finalità promozionali, salvo diniego scritto prima dell''evento; resta fermo il diritto alla tutela dell''immagine ex art. 10 c.c. e GDPR.'));
  s_food jsonb := jsonb_build_array(
    jsonb_build_object('heading','Numero ospiti, sicurezza alimentare e allergeni',
      'body','Il numero minimo garantito e quello definitivo sono comunicati per iscritto almeno 7 giorni prima e costituiscono base di calcolo del corrispettivo. Il Fornitore opera nel rispetto della normativa igienico-sanitaria (Reg. CE 852/2004, HACCP) e fornisce le informazioni sugli allergeni (Reg. UE 1169/2011); il Committente comunica per iscritto e in anticipo allergie e intolleranze degli ospiti.'));
  s_dolci jsonb := jsonb_build_array(
    jsonb_build_object('heading','Prodotti alimentari, allergeni e conservazione',
      'body','I prodotti sono realizzati nel rispetto della normativa igienico-sanitaria (HACCP) e con informazione sugli allergeni (Reg. UE 1169/2011). La conservazione dopo la consegna è a carico del Committente. Variazioni di gusti/decori vanno concordate per iscritto con congruo anticipo.'));
  s_fiori jsonb := jsonb_build_array(
    jsonb_build_object('heading','Deperibilità e sostituzioni stagionali',
      'body','Trattandosi di prodotti deperibili e soggetti a disponibilità stagionale, il Fornitore può sostituire varietà o colori con altri di pari valore e resa estetica, dandone preventiva comunicazione ove possibile. L''allestimento e l''eventuale ritiro avvengono negli orari concordati.'));
  s_allest jsonb := jsonb_build_array(
    jsonb_build_object('heading','Montaggio, materiali a noleggio e sicurezza',
      'body','Montaggio e smontaggio avvengono negli orari concordati con la location. I materiali forniti a noleggio restano di proprietà del Fornitore: il Committente ne risponde per smarrimento o danni e può essere richiesto un deposito cauzionale. Gli impianti sono installati nel rispetto delle norme di sicurezza; deve essere disponibile idonea alimentazione elettrica.'));
  s_beauty jsonb := jsonb_build_array(
    jsonb_build_object('heading','Prova, igiene e reazioni allergiche',
      'body','Su richiesta è prevista una prova preliminare. Il Fornitore impiega prodotti professionali e procedure igieniche; il Committente segnala eventuali allergie o sensibilità cutanee per consentire un test preventivo. Il servizio è reso sul posto negli orari concordati, nel rispetto delle tempistiche di preparazione.'));
  s_abiti jsonb := jsonb_build_array(
    jsonb_build_object('heading','Prove, misure e proprietà del capo',
      'body','Il numero di prove e le misure sono concordati. In caso di noleggio, il capo resta di proprietà del Fornitore e va restituito nei termini e nelle condizioni pattuite, rispondendo il Committente di danni o smarrimento; in caso di confezione/vendita, la proprietà passa al saldo. Modifiche successive alla prova finale possono comportare costi aggiuntivi.'));
  s_location jsonb := jsonb_build_array(
    jsonb_build_object('heading','Capienza, sicurezza e cauzione',
      'body','Il Committente rispetta la capienza massima autorizzata, gli orari, i limiti acustici e le norme di sicurezza ed evacuazione della struttura. È facoltà del Gestore richiedere un deposito cauzionale, restituito entro 15 giorni previa verifica degli spazi. Il Committente risponde dei danni arrecati da sé, dai propri ospiti o dai fornitori da esso incaricati; il Gestore non risponde della custodia di beni personali.'));
  s_auto jsonb := jsonb_build_array(
    jsonb_build_object('heading','Veicolo, conducente e assicurazione',
      'body','Il Fornitore impiega veicolo in regola con revisione e copertura assicurativa RC, condotto da personale abilitato. Le tratte, i punti di ritiro e gli orari sono quelli concordati; ritardi dovuti a traffico, forza maggiore o cause non imputabili non costituiscono inadempimento. Eventuali danni al veicolo causati dai passeggeri sono a carico del Committente.'));
  s_musica jsonb := jsonb_build_array(
    jsonb_build_object('heading','Esecuzione tecnica, SIAE e limiti acustici',
      'body','Il Fornitore impiega impianto idoneo agli spazi e rispetta gli orari e i limiti acustici della location e della normativa locale. Gli adempimenti SIAE per le esecuzioni musicali, salvo diversa pattuizione scritta, sono a carico del Committente quale organizzatore dell''evento.'));
  s_piro jsonb := jsonb_build_array(
    jsonb_build_object('heading','Autorizzazioni, abilitazioni e distanze di sicurezza',
      'body','Lo spettacolo è eseguito da personale abilitato (fochino/patentino) nel rispetto delle autorizzazioni di legge (artt. 47 e 57 TULPS, eventuale SCIA) e delle distanze di sicurezza dal pubblico e dagli edifici. Il Fornitore dispone di idonea copertura assicurativa. Il Committente garantisce le autorizzazioni di accesso al luogo dello sparo. In caso di condizioni meteo o di sicurezza non idonee, lo spettacolo può essere sospeso o rinviato.'));
  s_celebrante jsonb := jsonb_build_array(
    jsonb_build_object('heading','Natura della cerimonia',
      'body','La cerimonia ha contenuto simbolico/personalizzato secondo gli accordi e, se non officiata dall''autorità competente, non produce effetti civili o religiosi. I testi e i rituali sono concordati col Committente.'));
  s_anim jsonb := jsonb_build_array(
    jsonb_build_object('heading','Sicurezza dei partecipanti e benessere animale',
      'body','Le attività sono svolte nel rispetto della sicurezza dei partecipanti, con la sorveglianza necessaria; per i minori resta ferma la vigilanza dei genitori. Ove siano impiegati animali, il Fornitore ne garantisce il benessere e il possesso delle autorizzazioni previste, nel rispetto delle regole della location.'));
  s_show jsonb := jsonb_build_array(
    jsonb_build_object('heading','Prestazione artistica',
      'body','La prestazione ha natura artistica e si svolge per la durata e nelle condizioni concordate, in spazio idoneo messo a disposizione dal Committente. Il contenuto e lo stile sono rimessi alla sensibilità professionale dell''artista, nel rispetto delle indicazioni ricevute.'));
  s_booth jsonb := jsonb_build_array(
    jsonb_build_object('heading','Noleggio attrezzatura e stampe',
      'body','L''attrezzatura è fornita a noleggio con assistenza di un operatore ove previsto e resta di proprietà del Fornitore; il Committente risponde di danni o sottrazioni durante l''uso da parte degli ospiti. Le stampe/i contenuti digitali sono erogati secondo quanto pattuito.'));
  s_stampe jsonb := jsonb_build_array(
    jsonb_build_object('heading','Bozze, approvazione e proprietà grafica',
      'body','Il Fornitore sottopone una o più bozze; la stampa avviene solo dopo approvazione scritta del Committente, che risponde di refusi nei testi approvati. I file grafici e i progetti restano di proprietà intellettuale del Fornitore, salvo diverso accordo. Quantità e tempi di consegna sono quelli pattuiti.'));
  s_bar jsonb := jsonb_build_array(
    jsonb_build_object('heading','Somministrazione bevande e responsabilità',
      'body','La somministrazione avviene nel rispetto della normativa vigente. Il Fornitore può rifiutare la somministrazione di alcolici a minori o a persone in stato di evidente ebbrezza. Attrezzatura e banco sono forniti come da accordi; il Committente garantisce gli allacci necessari.'));
  s_staff jsonb := jsonb_build_array(
    jsonb_build_object('heading','Personale, mansioni e responsabilità',
      'body','Il Fornitore mette a disposizione personale qualificato per le mansioni, gli orari e il dress code concordati. In caso di servizio di custodia (guardaroba, parcheggio, navetta) la responsabilità è limitata ai casi di dolo o colpa; per i mezzi di trasporto resta ferma la copertura assicurativa RC.'));
  s_wp jsonb := jsonb_build_array(
    jsonb_build_object('heading','Mandato di coordinamento',
      'body','L''Organizzatore coordina l''evento e i rapporti con i fornitori terzi nei limiti del mandato conferito. Salvo diverso accordo scritto, i contratti con i singoli fornitori sono stipulati direttamente dal Committente; l''Organizzatore risponde della propria attività di coordinamento e non delle prestazioni materiali dei terzi.'));

  r record;
begin
  for r in
    select * from (values
      -- subrole,            title,                                              prefix,        party,          oggetto_intro,                              special
      ('fotografo',          'Contratto di servizio fotografico',                'fornitore',   'Fornitore',    'il servizio fotografico',                  s_foto),
      ('videomaker',         'Contratto di servizio video',                      'fornitore',   'Fornitore',    'il servizio video',                        s_foto),
      ('fioraio',            'Contratto per addobbi floreali',                   'fornitore',   'Fornitore',    'gli addobbi e le composizioni floreali',   s_fiori),
      ('catering',           'Contratto di servizio catering',                   'fornitore',   'Fornitore',    'il servizio di ristorazione',              s_food),
      ('chef',               'Contratto per personal chef',                      'fornitore',   'Fornitore',    'il servizio di cucina',                    s_food),
      ('show_cooking',       'Contratto per show cooking',                       'fornitore',   'Fornitore',    'il servizio di show cooking',              s_food),
      ('food_truck',         'Contratto per food truck',                         'fornitore',   'Fornitore',    'il servizio di street food',               s_food),
      ('maitre',             'Contratto per servizio di sala',                   'fornitore',   'Fornitore',    'il servizio di sala',                      s_food),
      ('pasticcere',         'Contratto per torte e dolci',                      'fornitore',   'Fornitore',    'la fornitura di torte e dolci',            s_dolci),
      ('sweet_table',        'Contratto per sweet table',                        'fornitore',   'Fornitore',    'l''allestimento dello sweet table',        s_dolci),
      ('confettata',         'Contratto per confettata',                         'fornitore',   'Fornitore',    'il servizio di confettata',                s_dolci),
      ('musica',             'Contratto per servizio musicale',                  'fornitore',   'Fornitore',    'il servizio musicale e di intrattenimento',s_musica),
      ('dj',                 'Contratto per servizio DJ',                        'fornitore',   'Fornitore',    'il servizio di DJ set',                    s_musica),
      ('band',               'Contratto per band live',                          'fornitore',   'Fornitore',    'l''esibizione musicale dal vivo',          s_musica),
      ('allestimenti',       'Contratto per allestimenti',                       'fornitore',   'Fornitore',    'gli allestimenti e le scenografie',        s_allest),
      ('luci',               'Contratto per light design',                       'fornitore',   'Fornitore',    'il servizio di illuminazione',             s_allest),
      ('illuminotecnica',    'Contratto per illuminotecnica',                    'fornitore',   'Fornitore',    'il servizio di illuminotecnica',           s_allest),
      ('noleggio',           'Contratto per noleggio attrezzature',              'fornitore',   'Fornitore',    'il noleggio di attrezzature e arredi',     s_allest),
      ('make_up',            'Contratto per servizio make-up',                   'fornitore',   'Fornitore',    'il servizio di trucco',                    s_beauty),
      ('hairstylist',        'Contratto per servizio hairstyling',               'fornitore',   'Fornitore',    'il servizio di acconciatura',              s_beauty),
      ('parrucchiere',       'Contratto per servizio acconciatura',              'fornitore',   'Fornitore',    'il servizio di acconciatura',              s_beauty),
      ('estetista',          'Contratto per servizi estetici',                   'fornitore',   'Fornitore',    'i trattamenti estetici',                   s_beauty),
      ('beauty',             'Contratto per servizi beauty',                     'fornitore',   'Fornitore',    'i servizi beauty',                         s_beauty),
      ('abiti',              'Contratto di atelier (abito)',                     'fornitore',   'Fornitore',    'la fornitura/confezione dell''abito',      s_abiti),
      ('atelier',            'Contratto di atelier',                             'fornitore',   'Fornitore',    'la fornitura/confezione degli abiti',      s_abiti),
      ('location',           'Contratto di concessione della location',          'capostipite', 'Gestore',      'la concessione in uso degli spazi',        s_location),
      ('auto',               'Contratto per auto e trasporti',                   'fornitore',   'Fornitore',    'il servizio di auto/trasporto',            s_auto),
      ('fuochista',          'Contratto per spettacolo pirotecnico',             'fornitore',   'Fornitore',    'lo spettacolo pirotecnico',                s_piro),
      ('pirotecnico',        'Contratto per spettacolo pirotecnico',             'fornitore',   'Fornitore',    'lo spettacolo pirotecnico',                s_piro),
      ('celebrante',         'Contratto per cerimonia simbolica',                'fornitore',   'Fornitore',    'l''officiatura della cerimonia',           s_celebrante),
      ('animazione',         'Contratto per servizio di animazione',             'fornitore',   'Fornitore',    'il servizio di animazione',                s_anim),
      ('animali',            'Contratto per servizi con animali',                'fornitore',   'Fornitore',    'il servizio con impiego di animali',       s_anim),
      ('falconiere',         'Contratto per spettacolo di falconeria',           'fornitore',   'Fornitore',    'lo spettacolo di falconeria',              s_anim),
      ('magia',              'Contratto per spettacolo di magia',                'fornitore',   'Fornitore',    'lo spettacolo di magia/illusionismo',      s_show),
      ('illusionista',       'Contratto per spettacolo di illusionismo',         'fornitore',   'Fornitore',    'lo spettacolo di illusionismo',            s_show),
      ('mentalista',         'Contratto per spettacolo di mentalismo',           'fornitore',   'Fornitore',    'lo spettacolo di mentalismo',              s_show),
      ('livepainter',        'Contratto per live painting',                      'fornitore',   'Fornitore',    'la performance di live painting',          s_show),
      ('caricaturista',      'Contratto per caricature dal vivo',                'fornitore',   'Fornitore',    'il servizio di caricature dal vivo',       s_show),
      ('calligrafo',         'Contratto per servizi di calligrafia',             'fornitore',   'Fornitore',    'i lavori di calligrafia',                  s_stampe),
      ('photobooth',         'Contratto per photobooth',                         'fornitore',   'Fornitore',    'il servizio di photobooth',                s_booth),
      ('stampe',             'Contratto per stampe e grafica',                   'fornitore',   'Fornitore',    'i lavori di stampa e grafica',             s_stampe),
      ('inviti',             'Contratto per inviti e partecipazioni',            'fornitore',   'Fornitore',    'la realizzazione di inviti e partecipazioni',s_stampe),
      ('bomboniere',         'Contratto per bomboniere',                         'fornitore',   'Fornitore',    'la fornitura di bomboniere',               s_stampe),
      ('bartender',          'Contratto per servizio bar',                       'fornitore',   'Fornitore',    'il servizio bar',                          s_bar),
      ('open_bar',           'Contratto per open bar',                           'fornitore',   'Fornitore',    'il servizio di open bar',                  s_bar),
      ('sommelier',          'Contratto per servizio sommelier',                 'fornitore',   'Fornitore',    'il servizio di sommellerie',               s_bar),
      ('hostess',            'Contratto per servizio hostess',                   'fornitore',   'Fornitore',    'il servizio di accoglienza',               s_staff),
      ('steward',            'Contratto per servizio steward',                   'fornitore',   'Fornitore',    'il servizio di steward',                   s_staff),
      ('valet',             'Contratto per valet parking',                       'fornitore',   'Fornitore',    'il servizio di valet parking',             s_staff),
      ('navetta',            'Contratto per servizio navetta',                   'fornitore',   'Fornitore',    'il servizio di navetta/transfer',          s_staff),
      ('wedding_planner',    'Contratto di coordinamento evento',                'capostipite', 'Organizzatore','il coordinamento e l''organizzazione dell''evento', s_wp),
      ('altro',              'Contratto di prestazione di servizi',              'fornitore',   'Fornitore',    'la prestazione di servizi',                '[]'::jsonb)
    ) as v(subrole, title, prefix, party, oggetto, special)
  loop
    insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
    values (
      r.subrole, r.title,
      public.build_default_contract_sections(r.prefix, r.party, r.oggetto, r.special),
      'Modello a scopo organizzativo, non costituisce consulenza legale. Adatta importi, percentuali e clausole alla tua situazione e fai verificare il testo a un professionista prima della firma.'
    )
    on conflict (subrole) do update set
      title = excluded.title,
      sections = excluded.sections,
      legal_disclaimer = excluded.legal_disclaimer,
      updated_at = now();
  end loop;
end$$;
