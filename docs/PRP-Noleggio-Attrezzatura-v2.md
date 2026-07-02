# PRP · Noleggio Attrezzatura tra Professionisti — v2 (Claude Code)

**Stato: CONGELATO dietro il gate strategico.**
Si apre solo dopo: (1) fix di sicurezza chiusi con commit terminale, (2) Stripe connesso,
(3) cinque capostipiti reali onboardati. Motivo tecnico oltre che strategico: senza Stripe
il noleggio non ha transazione (cauzione, pagamento) e degrada a modulo-lead.

---

## 1 · Visione in tre righe

Il professionista mette a noleggio la propria attrezzatura verso altri professionisti della
piattaforma. Non è un marketplace pubblico: è la rete che si presta i ferri del mestiere —
coerente con i vasi comunicanti. L'attrezzatura È GIÀ nel sistema: il noleggio è una proprietà
dell'oggetto fisico esistente, non un nuovo oggetto.

## 2 · Scelta architetturale (PRESA, non in discussione)

**Estensione di `supplier_inventory_items`. Né sezione a sé, né catalogo servizi.**

Motivazioni verificate sul codice:
- `supplier_inventory_items` (migrazione 20260606200000) è già il registro dell'attrezzatura
  fisica del fornitore: name, category ("Audio", "Ottiche", "Luci", "Trasporto"), qty_default,
  active. Usato da SupplierTeamPage per le packing list.
- Il catalogo servizi (`services`) è l'offerta verso il cliente finale (sposi/capostipite in
  preventivo). Il noleggio è B2B tra professionisti: pubblico diverso, flusso diverso. Mescolare
  sporcherebbe il catalogo che il capostipite mostra agli sposi.
- Una sezione a sé violerebbe il principio "un motore + pacchetti dati" e duplicherebbe
  l'inventario.

## 3 · Modello dati (v1 minima)

```sql
alter table public.supplier_inventory_items
  add column if not exists for_rent boolean not null default false,
  add column if not exists rental_price_cents int,           -- prezzo per rental_unit
  add column if not exists rental_unit text                  -- 'GIORNO' | 'EVENTO' | 'WEEKEND'
    check (rental_unit in ('GIORNO','EVENTO','WEEKEND')),
  add column if not exists rental_deposit_cents int,         -- cauzione (informativa in v1)
  add column if not exists rental_visibility text not null default 'RETE'
    check (rental_visibility in ('RETE','PLANFULLY')),
  add column if not exists rental_notes text;                -- condizioni, ritiro/consegna
```

Tabella richieste (v1 = flusso-richiesta, come print_requests ma CON FK, imparando
dall'errore trovato lì — mai id di testo liberi):

```sql
create table public.rental_requests (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.supplier_inventory_items(id) on delete restrict,
  owner_id      uuid not null references public.profiles(id) on delete cascade,   -- chi noleggia
  requester_id  uuid not null references public.profiles(id) on delete cascade,   -- chi chiede
  date_from     date not null,
  date_to       date not null,
  qty           int not null default 1,
  status        text not null default 'RICHIESTA'
    check (status in ('RICHIESTA','ACCETTATA','RIFIUTATA','CONSEGNATA','RIENTRATA','ANNULLATA')),
  -- SNAPSHOT alla richiesta (lezione delle catene food/album: si congela, non si referenzia vivo)
  price_snapshot_cents   int,
  deposit_snapshot_cents int,
  unit_snapshot          text,
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (date_to >= date_from)
);
```

## 4 · Visibilità — due livelli, pattern RLS esistenti

- **RETE**: visibile ai profili con collaborazione ATTIVA con l'owner. Ricalcare la policy
  `capostipite_vede_servizi_collaboratori` (EXISTS su collaborations, status='ACTIVE'),
  estesa in entrambe le direzioni (chi collabora con me vede i miei item a noleggio).
- **PLANFULLY**: visibile a ogni utente autenticato. NON al pubblico anonimo — nessuna
  esposizione anon, memori del caso suggest_alternatives_full.

```sql
-- lettura item a noleggio (bozza, da rifinire in build):
create policy rental_items_visibili on public.supplier_inventory_items for select using (
  supplier_id = auth.uid()
  or (for_rent and rental_visibility = 'PLANFULLY' and auth.uid() is not null)
  or (for_rent and rental_visibility = 'RETE' and exists (
        select 1 from public.collaborations c
        where c.status = 'ACTIVE'
          and ((c.capostipite_id = auth.uid() and c.fornitore_id = supplier_id)
            or (c.fornitore_id  = auth.uid() and c.capostipite_id = supplier_id))))
);
```
NB: la tabella ha già RLS attiva con policy owner-only: la nuova policy si AGGIUNGE (OR),
verificare in build che non allarghi la visibilità di item con for_rent=false.

## 5 · UI (v1 minima)

- In SupplierTeamPage (dove l'inventario già vive): toggle "A noleggio" per item + prezzo,
  unità, cauzione, visibilità, note. Nessuna pagina nuova per l'owner.
- Superficie di scoperta: tab "Noleggio" dentro la pagina rete/scopri esistente (decidere
  in build quale delle due — NON una voce di menu nuova: il menu è già da sfoltire).
- Richiesta: modale con date, quantità, nota → insert in rental_requests → notifica all'owner
  (riusare il pattern user_notifications + email, DOPO che le GUC notifiche sono sistemate).

## 6 · [DECISIONE] — da risolvere PRIMA che Code inizi

**[DECISIONE-1] Disponibilità per-unità e per-data in v1: sì o no?**
Se qty=3 e 2 sono a noleggio dal 12 al 15, il sistema deve dire "ne resta 1"? Questo è un
motore di prenotazione (calendario per item). Proposta: NO in v1 — la richiesta indica le date,
l'owner accetta/rifiuta a mano guardando le sue richieste ACCETTATE sovrapposte. Il sistema
mostra all'owner un avviso di sovrapposizione (query, non vincolo). Vincolo hard = v2.

**[DECISIONE-2] Collisione con la packing list.**
FATTO VERIFICATO: `supplier_team_event_packing` NON referenzia gli item per FK — copia
name/category/qty come testo. Quindi oggi è IMPOSSIBILE bloccare a livello dati "item noleggiato
fuori il 14/09 → non può stare nella packing del 14/09". Opzioni:
  (a) v1: nessun controllo, solo nota nel PRP — rischio: il professionista si presenta
      all'evento senza l'ottica che ha noleggiato fuori;
  (b) prerequisito: aggiungere item_id nullable alla packing e migrare l'aggancio, POI avviso
      soft di collisione. Proposta: (b), perché la collisione è esattamente il tipo di
      "connessione" che dà valore alla piattaforma; ma allunga la stima di ~1 giornata.

**[DECISIONE-3] Transazione: lead o pagamento?**
v1 senza Stripe = flusso-richiesta (come stampe): il sistema fa incontrare, i soldi girano
fuori. Con Stripe attivo: pagamento + cauzione trattenuta/sbloccata su RIENTRATA. Proposta:
il PRP nasce lead-only e la parte pagamenti è un addendum post-Stripe. Da confermare che
questo sia accettabile come v1 o se il modulo debba proprio aspettare Stripe.

**[DECISIONE-4] Danni e responsabilità.**
Fuori scope piattaforma in v1 (nota legale nelle rental_notes, accordo tra le parti).
Confermare che non serve nulla di più (es. checklist stato attrezzatura alla consegna/rientro
come semplici campi testo+foto su rental_requests — costo basso, valore alto in disputa).

## 7 · Guardrail per Code (quando si aprirà)

- NON toccare: la logica packing esistente (salvo DECISIONE-2b), il catalogo `services`,
  le policy owner-only esistenti su supplier_inventory_items.
- OGNI id è una FK. Mai id di testo liberi (anti-pattern print_requests.photo_drive_id).
- Snapshot su ogni transizione di stato che coinvolge un accordo tra due parti
  (prezzo/cauzione congelati alla richiesta — già nel modello dati).
- Nessun grant a anon, su nulla.
- Test rosso→verde su: visibilità RETE (non-collaboratore NON vede), visibilità item
  for_rent=false invariata, snapshot prezzo immutabile dopo ACCETTATA.

## 8 · Stima di massima

Modello dati + RLS + trigger: ~1 giornata. UI owner (toggle in inventario): ~0,5.
Scoperta + richiesta + notifiche: ~1,5. DECISIONE-2b (aggancio packing): +1.
Test: ~1. **Totale: 4–5 giornate.** Non ora.
