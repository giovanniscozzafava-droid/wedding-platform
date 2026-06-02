-- ============================================================================
-- MODELLI DI CONTRATTO "LEGAL GRADE".
-- Riscrittura dei modelli di default con clausole complete in stile legale
-- italiano: premesse e parti (anagrafica completa via merge), oggetto con voci
-- del preventivo, corrispettivo + caparra confirmatoria (art. 1385 c.c.),
-- recesso e penali, forza maggiore, responsabilita`/assicurazione, diritti
-- d'autore e liberatoria immagini (foto/video), GDPR, riservatezza, foro
-- competente e approvazione specifica delle clausole vessatorie (artt.
-- 1341-1342 c.c.). I segnaposto {{...}} restano e vengono riempiti alla
-- creazione del contratto (create_contract_from_clauses).
-- NB: modelli a scopo organizzativo, non sostituiscono il parere di un legale.
-- ----------------------------------------------------------------------------

-- Clausole comuni riutilizzate (forza maggiore, GDPR, riservatezza, foro,
-- approvazione vessatorie). Definite come testo per comporre i modelli.
do $$
declare
  c_forza   jsonb;
  c_privacy jsonb;
  c_riserv  jsonb;
  c_foro    jsonb;
  c_comunic jsonb;
  c_vess    jsonb;
begin
  c_forza := jsonb_build_object('heading','Forza maggiore',
    'body', 'Nessuna delle parti è responsabile per inadempimenti dovuti a cause di forza maggiore o caso fortuito (a titolo esemplificativo: calamità naturali, provvedimenti dell''autorità, epidemie, scioperi, gravi impedimenti di salute documentati). In tali ipotesi le parti concorderanno in buona fede il recupero della prestazione in data alternativa o, se impossibile, la restituzione delle somme versate al netto delle spese documentate già sostenute.');
  c_riserv := jsonb_build_object('heading','Riservatezza',
    'body', 'Le parti si impegnano a mantenere riservata ogni informazione acquisita in ragione del presente contratto e a non divulgarla a terzi, salvo quanto necessario all''esecuzione della prestazione o imposto dalla legge.');
  c_privacy := jsonb_build_object('heading','Trattamento dei dati personali (GDPR)',
    'body', E'I dati personali delle parti sono trattati ai sensi del Regolamento UE 2016/679 e del D.Lgs. 196/2003 e ss.mm.ii., per le sole finalità di esecuzione del presente contratto, di adempimento degli obblighi di legge (fiscali e contabili) e per il tempo a ciò necessario. Il conferimento è necessario per la stipula; il mancato conferimento ne impedisce l''esecuzione. L''interessato può esercitare i diritti di cui agli artt. 15-22 GDPR (accesso, rettifica, cancellazione, limitazione, opposizione, portabilità) contattando la controparte ai recapiti indicati in epigrafe.\nLe parti danno atto che i dati potranno essere gestiti tramite la piattaforma Planfully (Fuyue S.r.l.) in qualità di responsabile/fornitore del servizio tecnologico.');
  c_comunic := jsonb_build_object('heading','Comunicazioni e modifiche',
    'body', 'Ogni modifica al presente contratto è valida solo se concordata per iscritto tra le parti. Le comunicazioni si intendono validamente effettuate agli indirizzi email indicati in epigrafe.');
  c_foro := jsonb_build_object('heading','Legge applicabile e foro competente',
    'body', 'Il presente contratto è regolato dalla legge italiana. Per ogni controversia relativa alla sua interpretazione, esecuzione o risoluzione è competente in via esclusiva il foro del luogo di residenza/sede del Committente, ove consumatore; in difetto, il foro del luogo di sede del Fornitore. Le parti si impegnano a tentare preventivamente una composizione bonaria.');
  c_vess := jsonb_build_object('heading','Approvazione specifica delle clausole (artt. 1341-1342 c.c.)',
    'body', 'Ai sensi e per gli effetti degli artt. 1341 e 1342 c.c., il Committente dichiara di aver letto e di approvare specificamente le clausole relative a: Corrispettivo, caparra e pagamenti; Recesso e penali; Limitazioni di responsabilità; Forza maggiore; Foro competente. Luogo e data __________  —  Firma del Committente per approvazione specifica __________.');

  -- ===================== DEFAULT (prestazione di servizi) =====================
  insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
  values ('default', 'Contratto di prestazione di servizi',
    jsonb_build_array(
      jsonb_build_object('heading','Premesse e parti',
        'body', E'Il presente contratto (di seguito "Contratto") è stipulato tra:\nFORNITORE: {{fornitore_nome}}, P.IVA {{fornitore_piva}}, C.F. {{fornitore_cf}}, con sede in {{fornitore_indirizzo}}, tel. {{fornitore_telefono}} (di seguito "Fornitore");\ne\nCOMMITTENTE: {{cliente_nome}}, email {{cliente_email}} (di seguito "Committente").\nPremesso che il Committente intende affidare al Fornitore i servizi di seguito descritti per l''evento "{{evento_titolo}}" del {{evento_data}} presso {{evento_luogo}}, le parti convengono quanto segue.'),
      jsonb_build_object('heading','Art. 1 — Oggetto',
        'body', E'Il Fornitore si obbliga a eseguire, con organizzazione di mezzi propri e gestione a proprio rischio, le seguenti prestazioni:\n{{voci_preventivo}}\nLe prestazioni sono eseguite a regola d''arte secondo gli standard professionali del settore.'),
      jsonb_build_object('heading','Art. 2 — Corrispettivo, caparra e pagamenti',
        'body', E'Il corrispettivo complessivo è pari a {{preventivo_totale}} (IVA inclusa salvo diversa indicazione). Alla sottoscrizione il Committente versa a titolo di caparra confirmatoria, ex art. 1385 c.c., una somma pari al 30% del corrispettivo; il saldo è dovuto entro la data dell''evento. In caso di inadempimento del Committente il Fornitore può recedere trattenendo la caparra; in caso di inadempimento del Fornitore il Committente può esigere il doppio della caparra, salvo il maggior danno.'),
      jsonb_build_object('heading','Art. 3 — Tempi ed esecuzione',
        'body', 'Le prestazioni sono rese nei luoghi, nelle date e negli orari concordati. Eventuali variazioni vanno comunicate tempestivamente per iscritto e accettate dall''altra parte.'),
      jsonb_build_object('heading','Art. 4 — Obblighi del Fornitore',
        'body', 'Il Fornitore garantisce professionalità, diligenza, puntualità, idoneità dei mezzi impiegati e rispetto delle normative applicabili, nonché la copertura assicurativa per responsabilità civile verso terzi ove prevista per l''attività svolta.'),
      jsonb_build_object('heading','Art. 5 — Obblighi del Committente',
        'body', 'Il Committente garantisce l''accesso ai luoghi, le autorizzazioni necessarie, la veridicità delle informazioni fornite e la corresponsione del corrispettivo nei termini pattuiti.'),
      jsonb_build_object('heading','Art. 6 — Recesso e penali',
        'body', 'Salvo quanto previsto all''art. 2, in caso di recesso del Committente: oltre 90 giorni dall''evento è trattenuto il 30% (caparra); tra 90 e 30 giorni è dovuto il 50%; entro 30 giorni è dovuto il 100% del corrispettivo, a titolo di penale e a ristoro delle attività e indisponibilità già maturate.'),
      jsonb_build_object('heading','Art. 7 — Responsabilità e assicurazione',
        'body', 'Il Fornitore risponde dei danni a esso imputabili per dolo o colpa. È esclusa la responsabilità per danni derivanti da forza maggiore, da fatto del Committente o di terzi, o da informazioni inesatte fornite dal Committente. La responsabilità del Fornitore, salvi i casi di dolo o colpa grave, è comunque contenuta entro l''importo del corrispettivo.'),
      c_forza, c_riserv, c_privacy, c_comunic, c_foro,
      jsonb_build_object('heading','Sottoscrizione',
        'body', E'Letto, approvato e sottoscritto.\nIl Fornitore {{fornitore_nome}} __________      Il Committente {{cliente_nome}} __________\nLuogo e data __________'),
      c_vess
    ),
    'Modello a scopo organizzativo, non costituisce consulenza legale. Adatta importi, percentuali e clausole alla tua situazione e fai verificare il testo a un professionista prima della firma.')
  on conflict (subrole) do update set title = excluded.title, sections = excluded.sections, legal_disclaimer = excluded.legal_disclaimer, updated_at = now();

  -- ===================== FOTOGRAFO =====================
  insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
  values ('fotografo', 'Contratto di servizio fotografico',
    jsonb_build_array(
      jsonb_build_object('heading','Premesse e parti',
        'body', E'Tra il FORNITORE (fotografo) {{fornitore_nome}}, P.IVA {{fornitore_piva}}, C.F. {{fornitore_cf}}, sede in {{fornitore_indirizzo}}, tel. {{fornitore_telefono}}, e il COMMITTENTE {{cliente_nome}}, email {{cliente_email}}, per l''evento "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}).'),
      jsonb_build_object('heading','Art. 1 — Oggetto',
        'body', E'Il Fornitore eseguirà il servizio fotografico comprensivo delle prestazioni seguenti:\n{{voci_preventivo}}\nLo stile e l''impostazione creativa sono rimessi alla sensibilità professionale del Fornitore, nel rispetto delle indicazioni del Committente.'),
      jsonb_build_object('heading','Art. 2 — Corrispettivo e caparra',
        'body', 'Corrispettivo complessivo {{preventivo_totale}}. Caparra confirmatoria del 30% alla firma (art. 1385 c.c.), saldo entro l''evento. Disciplina di inadempimento come da art. 1385 c.c.'),
      jsonb_build_object('heading','Art. 3 — Consegna del materiale',
        'body', 'Il materiale (file digitali e/o album) è consegnato nei tempi concordati, salvo proroghe per cause non imputabili al Fornitore. La selezione e la post-produzione sono curate dal Fornitore secondo il proprio standard.'),
      jsonb_build_object('heading','Art. 4 — Diritti d''autore e licenza d''uso',
        'body', 'Le fotografie sono opere dell''ingegno tutelate dalla L. 633/1941. Il Fornitore resta titolare dei diritti d''autore; al Committente è concessa licenza d''uso personale e non commerciale delle immagini consegnate. È vietata la modifica sostanziale, la rivendita e l''uso commerciale senza consenso scritto del Fornitore.'),
      jsonb_build_object('heading','Art. 5 — Liberatoria e uso promozionale',
        'body', 'Il Committente, anche per gli invitati ripresi, autorizza il Fornitore all''uso di una selezione di immagini per il proprio portfolio e per finalità promozionali (sito, social, concorsi), salvo diniego scritto da comunicarsi prima dell''evento. Resta fermo il diritto degli interessati alla tutela della propria immagine ex art. 10 c.c. e GDPR.'),
      jsonb_build_object('heading','Art. 6 — Responsabilità',
        'body', 'In caso di guasto tecnico, smarrimento o cause di forza maggiore che impediscano in tutto o in parte la consegna, la responsabilità del Fornitore è limitata alla restituzione delle somme relative alla parte non eseguita, escluso ogni ulteriore danno, salvo dolo o colpa grave.'),
      jsonb_build_object('heading','Art. 7 — Recesso e penali',
        'body', 'Recesso del Committente: oltre 90 giorni trattenuto il 30% (caparra); tra 90 e 30 giorni 50%; entro 30 giorni 100% del corrispettivo.'),
      c_forza, c_riserv, c_privacy, c_comunic, c_foro,
      jsonb_build_object('heading','Sottoscrizione',
        'body', E'Il Fornitore {{fornitore_nome}} __________      Il Committente {{cliente_nome}} __________\nLuogo e data __________'),
      c_vess
    ),
    'Modello a scopo organizzativo, non è consulenza legale. Le clausole su diritti d''autore, licenza d''uso e liberatoria immagini vanno adattate al caso concreto e verificate da un legale.')
  on conflict (subrole) do update set title = excluded.title, sections = excluded.sections, legal_disclaimer = excluded.legal_disclaimer, updated_at = now();

  -- ===================== CATERING =====================
  insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
  values ('catering', 'Contratto di servizio catering / ristorazione',
    jsonb_build_array(
      jsonb_build_object('heading','Premesse e parti',
        'body', E'Tra il FORNITORE (catering) {{fornitore_nome}}, P.IVA {{fornitore_piva}}, C.F. {{fornitore_cf}}, sede in {{fornitore_indirizzo}}, e il COMMITTENTE {{cliente_nome}}, email {{cliente_email}}, per l''evento "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}).'),
      jsonb_build_object('heading','Art. 1 — Oggetto',
        'body', E'Servizio di ristorazione comprensivo delle voci seguenti:\n{{voci_preventivo}}'),
      jsonb_build_object('heading','Art. 2 — Numero ospiti e conferme',
        'body', 'Il numero minimo garantito e quello definitivo degli ospiti sono comunicati per iscritto almeno 7 giorni prima dell''evento e costituiscono base di calcolo del corrispettivo. Variazioni in aumento sono soddisfatte nei limiti della disponibilità.'),
      jsonb_build_object('heading','Art. 3 — Sicurezza alimentare e allergeni',
        'body', 'Il Fornitore opera nel rispetto della normativa igienico-sanitaria (Reg. CE 852/2004, HACCP) e fornisce, su richiesta, le informazioni sugli allergeni (Reg. UE 1169/2011). Il Committente comunica per iscritto, in anticipo, allergie e intolleranze degli ospiti.'),
      jsonb_build_object('heading','Art. 4 — Corrispettivo e caparra',
        'body', 'Corrispettivo complessivo {{preventivo_totale}}. Caparra confirmatoria del 30% alla firma (art. 1385 c.c.), saldo entro l''evento.'),
      jsonb_build_object('heading','Art. 5 — Responsabilità',
        'body', 'Il Fornitore risponde della qualità e salubrità delle somministrazioni a esso imputabili. È esclusa la responsabilità per somministrazioni di terzi non incaricati e per dati inesatti su allergie non comunicati dal Committente.'),
      jsonb_build_object('heading','Art. 6 — Recesso e penali',
        'body', 'Recesso del Committente: oltre 90 giorni trattenuto il 30% (caparra); tra 90 e 30 giorni 50%; entro 30 giorni 100%, a copertura di approvvigionamenti e personale già impegnati.'),
      c_forza, c_riserv, c_privacy, c_comunic, c_foro,
      jsonb_build_object('heading','Sottoscrizione',
        'body', E'Il Fornitore {{fornitore_nome}} __________      Il Committente {{cliente_nome}} __________\nLuogo e data __________'),
      c_vess
    ),
    'Modello a scopo organizzativo, non è consulenza legale. Verifica gli adempimenti HACCP/allergeni e adatta le quantità minime garantite.')
  on conflict (subrole) do update set title = excluded.title, sections = excluded.sections, legal_disclaimer = excluded.legal_disclaimer, updated_at = now();

  -- ===================== LOCATION =====================
  insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
  values ('location', 'Contratto di concessione in uso della location',
    jsonb_build_array(
      jsonb_build_object('heading','Premesse e parti',
        'body', E'Tra il GESTORE DELLA LOCATION {{capostipite_nome}}, P.IVA {{capostipite_piva}}, C.F. {{capostipite_cf}}, sede in {{capostipite_indirizzo}}, e il COMMITTENTE {{cliente_nome}}, email {{cliente_email}}, per l''evento "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}).'),
      jsonb_build_object('heading','Art. 1 — Oggetto',
        'body', E'Concessione in uso temporaneo degli spazi e dei servizi seguenti per la sola durata dell''evento:\n{{voci_preventivo}}'),
      jsonb_build_object('heading','Art. 2 — Capienza, orari e regole della struttura',
        'body', 'Il Committente si obbliga a rispettare la capienza massima autorizzata, gli orari concordati, i limiti acustici e le norme di sicurezza ed evacuazione della struttura, nonché le disposizioni del personale del Gestore.'),
      jsonb_build_object('heading','Art. 3 — Corrispettivo, caparra e cauzione',
        'body', 'Corrispettivo complessivo {{preventivo_totale}}. Caparra confirmatoria del 30% alla firma (art. 1385 c.c.), saldo entro l''evento. È facoltà del Gestore richiedere un deposito cauzionale a garanzia di eventuali danni, restituito entro 15 giorni previa verifica degli spazi.'),
      jsonb_build_object('heading','Art. 4 — Danni e responsabilità',
        'body', 'Il Committente risponde dei danni arrecati agli spazi, agli arredi e alle attrezzature da sé, dai propri ospiti o dai fornitori da esso incaricati. Il Gestore non risponde della custodia di beni personali introdotti dagli ospiti.'),
      jsonb_build_object('heading','Art. 5 — Fornitori esterni',
        'body', 'L''ingresso di fornitori esterni (catering, allestimenti, musica) è ammesso previo accordo e nel rispetto delle regole della struttura; resta a carico del Committente il loro coordinamento e il ripristino degli spazi.'),
      jsonb_build_object('heading','Art. 6 — Recesso e penali',
        'body', 'Recesso del Committente: oltre 90 giorni trattenuto il 30% (caparra); tra 90 e 30 giorni 50%; entro 30 giorni 100% del corrispettivo.'),
      c_forza, c_riserv, c_privacy, c_comunic, c_foro,
      jsonb_build_object('heading','Sottoscrizione',
        'body', E'Il Gestore {{capostipite_nome}} __________      Il Committente {{cliente_nome}} __________\nLuogo e data __________'),
      c_vess
    ),
    'Modello a scopo organizzativo, non è consulenza legale. Adatta capienza, cauzione, orari e regole della tua struttura e verifica le coperture assicurative.')
  on conflict (subrole) do update set title = excluded.title, sections = excluded.sections, legal_disclaimer = excluded.legal_disclaimer, updated_at = now();

  -- ===================== MUSICA / INTRATTENIMENTO =====================
  insert into public.suggested_contract_templates (subrole, title, sections, legal_disclaimer)
  values ('musica', 'Contratto di servizio musicale / intrattenimento',
    jsonb_build_array(
      jsonb_build_object('heading','Premesse e parti',
        'body', E'Tra il FORNITORE {{fornitore_nome}}, P.IVA {{fornitore_piva}}, C.F. {{fornitore_cf}}, sede in {{fornitore_indirizzo}}, e il COMMITTENTE {{cliente_nome}}, email {{cliente_email}}, per l''evento "{{evento_titolo}}" del {{evento_data}} ({{evento_luogo}}).'),
      jsonb_build_object('heading','Art. 1 — Oggetto',
        'body', E'Servizio musicale/di intrattenimento comprensivo delle voci seguenti:\n{{voci_preventivo}}'),
      jsonb_build_object('heading','Art. 2 — Esecuzione tecnica',
        'body', 'Il Fornitore impiega impianto e strumentazione idonei agli spazi e rispetta gli orari concordati e i limiti acustici imposti dalla location e dalla normativa locale sull''inquinamento acustico.'),
      jsonb_build_object('heading','Art. 3 — Diritti SIAE',
        'body', 'Gli adempimenti relativi ai diritti d''autore (SIAE) per le esecuzioni musicali restano a carico della parte indicata negli accordi; in difetto di diversa pattuizione scritta, sono a carico del Committente in qualità di organizzatore dell''evento.'),
      jsonb_build_object('heading','Art. 4 — Corrispettivo e caparra',
        'body', 'Corrispettivo complessivo {{preventivo_totale}}. Caparra confirmatoria del 30% alla firma (art. 1385 c.c.), saldo entro l''evento.'),
      jsonb_build_object('heading','Art. 5 — Responsabilità',
        'body', 'Il Fornitore risponde del corretto funzionamento della propria strumentazione. È esclusa la responsabilità per mancanze di alimentazione elettrica, inadeguatezza degli spazi o cause di forza maggiore non imputabili.'),
      jsonb_build_object('heading','Art. 6 — Recesso e penali',
        'body', 'Recesso del Committente: oltre 90 giorni trattenuto il 30% (caparra); tra 90 e 30 giorni 50%; entro 30 giorni 100% del corrispettivo.'),
      c_forza, c_riserv, c_privacy, c_comunic, c_foro,
      jsonb_build_object('heading','Sottoscrizione',
        'body', E'Il Fornitore {{fornitore_nome}} __________      Il Committente {{cliente_nome}} __________\nLuogo e data __________'),
      c_vess
    ),
    'Modello a scopo organizzativo, non è consulenza legale. Verifica gli adempimenti SIAE e i limiti acustici locali.')
  on conflict (subrole) do update set title = excluded.title, sections = excluded.sections, legal_disclaimer = excluded.legal_disclaimer, updated_at = now();
end$$;
