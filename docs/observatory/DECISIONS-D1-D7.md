# Osservatorio Planfully — Decisioni D1–D7 (bozza di chiusura)

**Scopo:** chiudere le decisioni aperte del PRP §3 con valori operativi, così che il **gate di
Fase 1** possa scattare appena i prerequisiti (5 branch sicurezza + dati reali D8) sono verdi.
Questo è un documento di progettazione: **non autorizza alcun build**. I default proposti dal PRP
vengono qui resi concreti; dove serve validazione legale è segnalato come *condizione*, non blocco.

Legenda stato: **CHIUSA** = decisa, pronta per Fase 1 · **CHIUSA · cond. legale** = decisa salvo
conferma del legale (§7) · **CONFERMA** = serve solo un sì/no esplicito tuo.

---

## D1 — Soglia k di anonimizzazione · **CHIUSA · cond. legale**

**Decisione:** `k ≥ 5` entità (fornitori) distinte per ogni cella pubblicata. Per le metriche di
**prezzo** (le più sensibili lato antitrust) soglia più alta: `k ≥ 7`. Sotto soglia la cella
mostra **"dati insufficienti"**, mai un valore.

**Presidio aggiuntivo (raccomandato):** oltre al conteggio entità, una cella non si pubblica se un
singolo fornitore contribuisce a **> 40%** delle osservazioni della cella (guardia anti-dominanza:
con k=5 ma uno domina, la mediana lo "scopre"). È una mitigazione antitrust standard, a costo zero.

**Implementazione Fase 1:** floor statico già nel constraint `observatory_snapshots.chk_k_floor
(k_entities >= 5)`; la soglia reale (5 / 7) è un parametro del refresh. La guardia anti-dominanza
è un `HAVING max(per_supplier_count)::numeric / count(*) <= 0.40`.

**Condizione:** valore finale (5/7 + 40%) da far confermare al legale insieme a §7 prima del go-live.

---

## D2 — Set di metriche al lancio · **CHIUSA**

**Decisione:** si parte con **3 metriche** (non 5):

1. **Indice prezzi mediano** — per **subrole × macro-area**, payload `{median, p25, p75, n, k}`.
   Mai il singolo prezzo. (Asse `subrole`, non `category_id` grezzo — vedi audit Fase 0 §2.)
2. **Stagionalità della domanda** — distribuzione di `calendar_entries.date_from` per mese.
   Mostra *quando*, mai *chi*.
3. **Tasso di conversione preventivo → firmato** — da `quotes`, stato terminale
   `ACCETTATO`/`CONVERTITO_IN_CONTRATTO` vs `RIFIUTATO`, per subrole.

**Rinviato a Fase 2:** ricarico medio applicato (range, mai puntuale) e andamento prezzi nel tempo
(`price_versions`, trend descrittivo).

Ogni scheda metrica espone sempre: `n`, intervallo, periodo, riga di metodologia, e la nota
"campione Planfully, non rappresentativo dell'intero mercato nazionale".

---

## D3 — Granularità geografica · **CHIUSA**

**Decisione:** **macro-area** al lancio (5 ripartizioni ISTAT: Nord-Ovest/Nord-Est/Centro/Sud/Isole),
già derivabili da `public.it_macro_area(province)` (consegnata in Fase 0).

**Auto-collasso (gerarchia di fallback):** una metrica si pubblica al livello più fine che rispetta
`k`; altrimenti collassa al livello superiore:
`provincia → regione → macro-area → nazionale`.
All'inizio quasi tutto starà a **macro-area o nazionale** (la provincia rompe la k-anonymity con
pochi fornitori). Provincia/regione si "accendono" da sole quando il campione cresce.

---

## D4 — Chi vede cosa · **CHIUSA**

**Decisione:**
- **Lancio → (a) solo capostipiti.** È il pubblico di retention primario.
- **Fase 2 → (b)** il **fornitore** vede *"il tuo dato vs benchmark"* (leva di retention fornitore
  + carburante per l'effetto rete).
- **(c) gate premium** dietro **feature flag Stripe**, che resta **OFF** finché Stripe è progetto
  separato (coerente col resto della contabilità congelata). Nessuna logica di pagamento ora.

Vincolo trasversale (principio 7): nessuna RPC/vista deve poter restituire il dato granulare di un
fornitore identificabile, a nessun ruolo. Il fornitore in (b) vede **solo il proprio dato** + gli
aggregati pubblici, mai i singoli dei concorrenti.

---

## D5 — Cadenza snapshot · **CHIUSA**

**Decisione:** **mensile**. Lo snapshot del mese *m* si calcola sul periodo chiuso e viene
pubblicato all'inizio del mese *m+1*. **Niente real-time.**

È un presidio **antitrust** (dato storico, non un feed di prezzi live tra concorrenti) oltre che di
stabilità. Refresh via **Supabase Cron** → funzione `SECURITY DEFINER` non esposta al client, che
ricalcola le viste materializzate e ripopola `observatory_snapshots`. Pipeline di scrittura e di
lettura separate (principio 8).

---

## D6 — Integrazione fonti pubbliche · **CONFERMA** (default: solo redazionale)

**Decisione proposta:** **solo redazionale manuale**. Una persona inserisce a mano una scheda fonte
(`observatory_external_sources`: ente, anno, url, nota in parole nostre con attribuzione) quando
esce un report rilevante (ISTAT, Convention Bureau Italia, ecc.).

**Vietato qualsiasi fetch automatico o scraping** (principio 1 + §6): rischio copyright/diritti sul
database e divieti espliciti di molte fonti di settore. Le fonti servono a *contestualizzare* il
dato Planfully, mai a sostituirlo.

→ Serve solo la tua **conferma** che NON vogliamo alcun automatismo qui (default: confermato).

---

## D7 — Proiezioni future · **CHIUSA**

**Decisione:** **fuori scope al lancio.** L'Osservatorio nasce **descrittivo** (cosa è successo /
sta succedendo). Le proiezioni arrivano in **Fase 4**, e solo:
- sul **nostro** time-series interno (mai su dati di terzi),
- con **assunzioni dichiarate** e **intervalli** — **mai un numero puntuale "certo"**.

Una proiezione sbagliata su un tool premium B2B costa fiducia: meglio tardi e onesta.

---

## Riepilogo

| Dec. | Esito | Valore operativo |
|---|---|---|
| D1 | CHIUSA · cond. legale | k≥5 (k≥7 prezzi) + guardia anti-dominanza 40% |
| D2 | CHIUSA | 3 metriche: prezzo mediano, stagionalità, conversione |
| D3 | CHIUSA | macro-area, con auto-collasso provincia→regione→macro→nazionale |
| D4 | CHIUSA | lancio solo capostipiti; (b) fornitore in Fase 2; (c) premium flag OFF |
| D5 | CHIUSA | snapshot mensile, cron SECURITY DEFINER, no real-time |
| D6 | CONFERMA | solo redazionale manuale, nessun fetch (default: confermato) |
| D7 | CHIUSA | descrittivo al lancio; proiezioni in Fase 4, intervalli mai punti |

**Restano fuori da questa bozza (non sono D1–D7):**
- **D8** — soglia minima di go-live: l'Osservatorio non si pubblica finché **≥1 metrica** supera `k`
  in **≥1 macro-area**. Si tara sui dati reali dei primi capostipiti (oggi `n = 0`).
- **Validazione legale §7** sui tre fronti (antitrust / GDPR-consenso / IP) prima del go-live.

Con D1–D7 chiuse, il gate di Fase 1 dipende ormai solo da: **5 branch sicurezza** + **dati reali (D8)**
+ **firma legale**. Nessuno dei tre è codice.
