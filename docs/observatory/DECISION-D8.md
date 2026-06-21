# Osservatorio Planfully — Decisione D8 (soglia minima di go-live)

**Scopo:** definire *quando* l'Osservatorio può accendersi. Documento di progettazione, **nessun
build**. Chiude D8 dopo D1–D7.

Principio guida: **il gate è il dato, non un numero indovinato.** Non decidiamo "si parte a 300
`quote_items`" come fosse una soglia magica; il go-live scatta quando **almeno una cella reale
supera `k`**. I numeri indicativi qui sotto servono solo a stimare *quando* sarà probabile, non
sono il trigger.

---

## 1. Regola di go-live (hard)

L'Osservatorio si pubblica solo se esiste **≥ 1 cella** che soddisfa **tutti** questi requisiti, per
**≥ 1 metrica** di lancio (D2), in **≥ 1 macro-area** (D3):

1. `k_entities ≥ soglia D1` (≥5 in generale, ≥7 per il prezzo),
2. guardia anti-dominanza: nessun fornitore > 40% delle osservazioni della cella (D1),
3. consenso `granted` attivo per tutte le entità conteggiate (principio 6).

Se **zero celle** qualificano → l'Osservatorio resta **nascosto** (niente "osservatorio vuoto", che
è la versione finta del prodotto). Non si mostra una UI con dappertutto "dati insufficienti".

**Accensione cella-per-cella (soft launch).** Non c'è un big-bang. Ogni cella si accende da sola
appena attraversa `k` (coerente con l'auto-collasso D3). Il "go-live" è solo *la prima cella che si
accende*; da lì l'Osservatorio cresce da solo col campione.

---

## 2. Minimo per metrica (derivato da k, non arbitrario)

| Metrica (D2) | Entità protetta | Prima luce quando… | Dipende da |
|---|---|---|---|
| **Indice prezzi mediano** | fornitore | **≥ 7** fornitori consenzienti dello **stesso subrole** nella **stessa macro-area**, ciascuno con ≥1 servizio attivo | `services` + consenso — **non** serve storico preventivi |
| **Stagionalità domanda** | evento | **≥ 5** eventi (`calendar_entries`) nel bucket macro-area pubblicato | `calendar_entries` |
| **Conversione preventivo→firmato** | fornitore | **≥ 5** fornitori con ≥1 preventivo **con esito** (accettato/rifiutato) nello stesso subrole | `quotes` (storico transazionale) |

**Osservazione chiave:** la metrica che si accende **per prima** è quasi certamente l'**indice
prezzi** o la **stagionalità**, perché dipendono da *anagrafica* (servizi a listino, date evento) e
non da uno storico di trattative. La **conversione** arriva più tardi: richiede preventivi *chiusi*.

---

## 3. Stima indicativa di onboarding (solo per pianificare, NON è il gate)

Per far concentrare **7 fornitori dello stesso subrole nella stessa macro-area** servono molti più
di 7 fornitori totali (si spalmano su subrole e geo diversi). Stima grezza:

- **Indice prezzi (prima luce):** ordine di **~20–40 fornitori** consenzienti onboardati, perché
  7 cadano sullo stesso `subrole × macro-area` (es. *fotografo × Sud*). Dipende molto da quanto i
  primi capostipiti reclutano nello stesso settore/area.
- **Stagionalità (prima luce):** ~**5 eventi confermati** in una macro-area — raggiungibile prima.
- **Conversione (prima luce):** ~**5 fornitori** con preventivi chiusi nello stesso subrole →
  in termini di volume, l'ordine di **"alcune centinaia di `quote_items`"** del PRP è coerente se
  vogliamo coprire più subrole/aree, non una singola cella.

Questi numeri si **tarano sui dati reali** dei primi capostipiti: oggi `n = 0`, quindi sono solo
ipotesi di lavoro.

---

## 4. Readiness check (da implementare in Fase 1, non ora)

Il go-live non si valuta "a occhio": in Fase 1 il refresh mensile (D5) calcola le viste e una query
di prontezza risponde sì/no. Forma logica (pseudo, **non** da eseguire ora — le tabelle sono Fase 1):

```
-- VERO se almeno una cella supererebbe k + anti-dominanza + consenso, per una metrica qualsiasi.
select exists (
  select 1 from <mv_metrica>            -- vista materializzata della metrica
  where k_entities >= :k_soglia         -- 5, oppure 7 per il prezzo
    and max_share <= 0.40               -- guardia anti-dominanza
);
```

Finché ritorna FALSE per tutte le metriche → l'Osservatorio non si pubblica. Quando ritorna TRUE per
almeno una → si accendono **solo** le celle che qualificano. È auto-misurante: il gate non richiede
una decisione umana ricorrente.

---

## 5. Interazioni

- **D5 (cadenza):** il go-live non può precedere la chiusura del **primo periodo snapshot** con dati
  sufficienti. Prima dello snapshot, nessuna pubblicazione.
- **Consenso (principio 6):** un fornitore senza `granted` non conta per `k`; una revoca lo fa uscire
  al refresh successivo, e una cella può **ri-spegnersi** se scende sotto `k`. È corretto: la cella
  segue il dato.
- **Validazione legale §7:** anche a gate tecnico verde, il go-live in produzione richiede la firma
  del legale (antitrust / GDPR-consenso / IP). È l'ultimo lucchetto, non-codice.

---

## 6. Esito D8 · **CHIUSA**

- Go-live = **≥1 cella oltre `k` + anti-dominanza + consenso**, accensione **cella-per-cella**.
- Prima metrica probabile: **indice prezzi** o **stagionalità** (anagrafica, non storico).
- Soglie volume = **indicative e da tarare**, non trigger.
- Readiness **auto-misurante** via query (Fase 1).
- Ultimo lucchetto: **firma legale**.

Con D1–D8 chiuse, restano fuori dal codice solo: **5 branch di sicurezza** + **dati reali** + **firma
legale**. Il cassetto dell'Osservatorio è completo e pronto a scattare quando arrivano i capostipiti.
