# Report — Eventi non-matrimonio event-aware + stress test
**Data:** notte 2–3 giugno 2026 · Autore: Claude (autonomo) · Tutto deployato su planfully.it

## 1. Causa radice (perché vedevi “matrimonio” ovunque)
Il flusso CLIENTE è nato solo per i matrimoni: il cliente è modellato come *coppia di sposi* (ruolo COUPLE), invitato come *membro coppia*, onboardato con un *wizard da matrimonio*, e mostrato in una dashboard piena di copy nuziale. Il tipo evento (`event_kind`) esisteva sul **preventivo** ma **non veniva propagato** sull’evento (`calendar_entries`) che queste schermate leggono → fallback hardcoded a `matrimonio`. In più, molte stringhe erano scritte a mano (“grande giorno”, “sposa/sposo”, “wedding planner”, icone a cuore).

## 2. Cosa ho sistemato (deployato)

### Propagazione tipo evento
- **Backfill** di tutte le `calendar_entries` dal tipo del loro preventivo.
- **Trigger `sync_entry_event_kind`**: ogni evento creato/aggiornato con un preventivo eredita automaticamente `event_kind`.
- **`resolve_couple_invite`** ora ritorna `event_kind` → la pagina d’invito è event-aware.
- **Causa radice manuale risolta:** aggiunto il selettore **“Tipo di evento”** in `EntryForm` (creazione evento lato WP). Prima non esisteva → ogni evento creato a mano restava “matrimonio”.

### Domande del questionario (wizard) su misura per evento
- **Priorità di spesa** dinamiche: niente “Abito” a una festa aziendale. Es. corporate → *catering, location, intrattenimento, audio/video, allestimento, branding*; battesimo → *catering, location, foto, allestimento, torta, bomboniere*.
- **Placeholder** (vision / must-have / no-grazie) coerenti col tipo evento (niente più “riso, coriandoli, tradizioni religiose” per un evento aziendale).
- Etichette **“Partecipanti”** invece di “Invitati” per il corporate; heading/riepilogo event-aware; **logo Planfully** al posto del cuore.

### Dashboard cliente (`CoupleDashboard`)
- Hero event-aware: niente “Il vostro grande giorno” per eventi non-coppia (mostra il nome del tipo evento).
- Badge ruolo: **“Referente”** invece di “SPOSA” per eventi non-coppia.
- **“Organizzatore”** al posto di “Wedding planner”.
- **Filtro tab**: “Cerimonia” solo per eventi con rito (matrimonio + battesimo/comunione/cresima); “Bomboniere” nascosta per corporate/laurea.
- Neutralizzati tutti i riferimenti residui “matrimonio/wedding planner” nelle sotto-viste (Programma, Documenti, Sito ospiti, Preventivo, Mood).
- Empty-state con logo Planfully.

### Pagina d’invito (`CoupleInviteAcceptPage`)
- Intestazione e messaggi event-aware (“Il tuo evento aziendale sta prendendo forma”).

### Tab profonde
- `TablesTab`: “Tavolo d’onore” invece di “Tavolo sposi”; “Tema evento”.
- `MembersTab` / `SubEventsTab`: testi neutri.

## 3. Stress test — profilo Rosella Elia
**Eseguito a livello dati** (impossibile guidare un browser da qui).

- **Invito creato** per `giovanni.scozzafava+inventa@gmail.com` sull’evento **“Festa aziendale” del 27/06/2026** (di Rosella Elia).
- **`resolve_couple_invite`** → ritorna correttamente:
  ```json
  { "event_kind": "corporate", "wedding_title": "Festa aziendale",
    "planner_name": "Rosella Elia", "email": "giovanni.scozzafava+inventa@gmail.com" }
  ```
  → la pagina d’invito mostrerà “evento aziendale”, non matrimonio. ✅

- **Coerenza event_kind su tutti gli eventi di Rosella:**
  | Evento | entry | preventivo | stato |
  |---|---|---|---|
  | Pinco pallo | matrimonio | matrimonio | OK |
  | Maria e Peppino | matrimonio | matrimonio | OK |
  | Festa aziendale (9/6) | corporate | corporate | OK |
  | Battesimo Antonio (10/6) | battesimo | battesimo | OK |
  | Cippo e Ciappa | matrimonio | matrimonio | OK |
  | Festa aziendale (27/6) | corporate | corporate | OK |
  | **Battesimo Antonio (4/6)** | **matrimonio** | — (no preventivo) | ⚠️ |
  | **Cresima Pinuccia** | **matrimonio** | — (no preventivo) | ⚠️ |

  Tutti gli eventi **con preventivo** sono coerenti. ✅

## 4. Bug ancora aperti / da decidere
1. **Eventi creati a mano senza preventivo** (3 in DB: *Battesimo Antonio 4/6*, *Cresima Pinuccia*, *Battesimo Pinocchio*) sono rimasti `matrimonio`. **Risolto per il futuro** (selettore in EntryForm), ma gli esistenti vanno corretti. Ho provato un UPDATE mirato sui titoli palesi ma è stato **bloccato dal sistema di sicurezza** (modifica massiva inferita su produzione). **Serve tuo via libera** per lanciarlo, oppure apri ogni evento e scegli il tipo (ora possibile).
2. **Ruolo `SPOSA/SPOSO`** nei menu a tendina di Invitati/Membri: per eventi non-coppia è cosmeticamente strano (la dashboard mostra comunque “Referente”). È un enum di ruolo: andrebbe nascosto/relabel quando l’evento non è una coppia. **Basso impatto.**
3. **Residui minori non-cliente:** titoli PDF “Budget matrimonio”/“Checklist matrimonio” (lato WP), `CouplePlanningTab` categorie “Abito sposa/Auto sposi” (tab non mostrata alla coppia). **Basso impatto.**
4. **Email d’invito** (testo): da rendere pienamente event-aware se vuoi (la chiusura lo è già; il corpo per cliente nuovo è generico ma cita ancora elementi nuziali).

## 5. Cosa controllare tu domattina
- Riapri l’invito/dashboard della **Festa aziendale 27/6** (hard refresh): deve essere tutto “evento aziendale”, logo Planfully, niente sposi.
- Decidi sul punto **4.1** (correzione dei 3 eventi vecchi senza preventivo): dimmi “sì correggi” e lo lancio.
