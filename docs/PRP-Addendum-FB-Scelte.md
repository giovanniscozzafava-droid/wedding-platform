# PRP-ADDENDUM · F&B Fase "Scelte" — dal menù composto dal cliente alla dispensa a conteggi esatti

> **Stato:** specificato, **CONGELATO dietro il gate**. NON riguarda la demo Baronella (alla Baronella si *racconta* come roadmap — vedi nota finale). **Zero build ora.** Sequenza: dopo il gate e dopo l'onboarding Baronella (i cui menù veri sono il primo banco di prova).

**Riformulazione concordata rispetto alla proposta iniziale:** gli invitati NON votano il menù (il voto resta agli sposi, alla prova — sistema esistente `fb_dish_votes` → `fb_dish_confirm` → `fb_event_dish`); gli invitati **scelgono la propria portata** dove il menù offre alternative, e dichiarano le esigenze alimentari. Il feedback confluisce in statistiche (menu engineering).

**Infrastruttura già esistente su cui si appoggia tutto:**
- `event_guests` con `diet`, RSVP, `party_size` (wedding_suite)
- `fb_cover_groups`: multi-gruppo per evento (OSPITI/BAMBINI/PROFESSIONISTI/BRIGATA) con `fb_explode_event_menu(entry, menu, covers)` che somma su fabbisogno/dispensa/food cost — retro-compatibile
- `fb_dish_votes` + `fb_tasting_sessions` (voto sposi alla prova)
- `fb_generate_purchase_orders` (fabbisogno netto, giacenza sottratta)

---

## WI-S1 · Composizione del menù lato cliente dal catalogo piatti (6h)

Oggi il cliente vota/conferma piatti di un menù **pre-assemblato** dalla location. Il passo in più chiesto da Giovanni: il cliente **compone** il menù scegliendo dai piatti che la location propone.

**Prompt per Code:**
> Aggiungi a `fb_menus` la colonna `kind text default 'FISSO' check (kind in ('FISSO','COMPONIBILE'))` e a `fb_menu_items` le colonne `course text` (APERITIVO/ANTIPASTO/PRIMO/SECONDO/PRE_DESSERT/DESSERT — enum testo con check) e `is_optional boolean default false` + `min_per_course int default 1, max_per_course int default 1` su una nuova tabella `fb_menu_courses (menu_id, course, min_select, max_select)`. Per un menù COMPONIBILE la location carica il paniere (es. 3 antipasti proposti, 4 secondi proposti) con i vincoli per portata (es. SECONDO: min 1 max 2). Vista cliente (pagina coppia, riusa il pattern della prova menu mobile): la coppia seleziona entro i vincoli; la conferma scrive in `fb_event_dish` come oggi — **la cascata a valle non cambia di una riga**, perché l'esplosione parte già da lì. Il food cost si aggiorna live durante la composizione (chiama `fb_event_foodcost` a ogni toggle) così la location può mostrare al cliente l'effetto delle scelte sul prezzo del coperto, se vuole.
> **Test:** menù componibile con vincolo SECONDO max 2 → terza selezione bloccata con messaggio; conferma → `fb_event_dish` coerente; `fb_event_foodcost` risponde con i soli piatti scelti.

## WI-S2 · Scelta portata per invitato + esigenze alimentari → esplosione a conteggi esatti (12h)

Il cuore economico dell'addendum.

**Prompt per Code:**
> (1) Nuova colonna `fb_menu_items.choice_group text` (null = piatto servito a tutti; valorizzato es. 'SECONDO' = il gruppo entro cui ogni invitato sceglie UNA opzione). (2) Nuova tabella `fb_guest_dish_choices (id, entry_id, guest_id → event_guests, menu_item_id → fb_menu_items, created_at, unique(entry_id, guest_id, choice_group_denorm))` — denormalizza il choice_group per il vincolo di unicità. (3) Raccolta: pagina pubblica per la coppia (che compila per i propri ospiti in un elenco rapido) O link per singolo invitato agganciato all'RSVP esistente — **[DECISIONE D-S1: parto con la compilazione da parte della coppia, che è il flusso reale italiano; il link per invitato è la v2]**. Le esigenze `diet` dell'invitato mostrano automaticamente la variante se esiste (convenzione: piatto variante = menu_item con suffisso di categoria, es. course uguale + tag `diet_variant text`).
> (4) **Esplosione v3:** estendi `fb_explode_event_menu` così che, per i menu_item con `choice_group` valorizzato, i coperti del piatto siano `count(scelte) * (1 + buffer)` invece di `covers` — con `buffer numeric default 0.05` parametrico su `fb_event_menus`; per gli invitati SENZA scelta registrata alla data di cutoff (colonna `choices_deadline date` su fb_event_menus), fallback proporzionale sulla distribuzione delle scelte esistenti. I piatti senza choice_group restano a coperti pieni. Food cost, fabbisogno, ordini e foglio di servizio ereditano i conteggi senza altre modifiche (passano tutti dall'esplosione).
> (5) Foglio di servizio/brigata: la stampa espone i conteggi per piatto e per tavolo (join con `event_guests.table_id`) — il cameriere sa che al tavolo 7 sono 5 ricciole e 3 filetti.
> **Test:** 120 invitati, 73 scelgono ricciola e 47 filetto → esplosione ricciola = 77 coperti (buffer 5%) e filetto = 50; fabbisogno gambero invariato (piatto per tutti); invitato con diet='vegano' vede la variante; due scelte dello stesso invitato nello stesso gruppo → vincolo violato; 10 invitati senza scelta al cutoff → riparto proporzionale.

## WI-S3 · Statistiche piatti: menu engineering (8h)

**Prompt per Code:**
> Nuova RPC `fb_menu_engineering(p_location, p_from date, p_to date)` che per ogni ricetta della location aggrega sugli eventi del periodo: (a) **popolarità** = media voti sposi (`fb_dish_votes`) + share di scelta invitati (`fb_guest_dish_choices` sul totale del choice_group); (b) **margine** = prezzo di vendita implicito del coperto (dal menù/servizio collegato) meno food cost del piatto a costi correnti; (c) classificazione a quadrante con soglie sulle mediane: STAR (pop alta, margine alto), PLOWHORSE (pop alta, margine basso), PUZZLE (pop bassa, margine alto), DOG (pop bassa, margine basso). Dashboard: scatter con i piatti nel quadrante (assi popolarità/margine, colori brand), filtro per stagione/menu, drill-down sul piatto (trend voti, trend food cost dallo storico `fb_ingredient_cost_versions`). Dati SOLO first-party della location (RLS owner). Nota Osservatorio: l'aggregazione cross-location (k≥5, solo categorie di piatto, mai ricette identificabili) è fuori scope qui — riferimento al PRP Osservatorio.
> **Test:** fixture con 4 piatti costruiti per cadere uno per quadrante → classificazione attesa; piatto senza voti né scelte → escluso con nota "dati insufficienti", mai classificato DOG per assenza di dati.

---

## Totale: ~26 ore ≈ 3 giornate. Sequenza: dopo il gate e dopo l'onboarding Baronella (i cui menù veri sono il primo banco di prova).

## Nota per la demo (solo racconto, zero build)

Se alla Baronella chiedono "e gli invitati?", la risposta che vende è già vera: *"Oggi gli sposi votano alla prova e il menù confermato arriva fino all'ordine del fornitore — l'avete visto. Il prossimo passo è la scelta della portata per invitato: la cucina saprà di dover fare 73 ricciole e 47 filetti invece di 120 e 120. È in roadmap, e i primi menù su cui lo costruiremo possono essere i vostri."* Una frase, non una slide.
