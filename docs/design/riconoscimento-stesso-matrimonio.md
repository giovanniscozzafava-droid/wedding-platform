# Riconoscimento "stesso matrimonio" — design

## Problema
Due (o più) fornitori possono creare/seguire lo **stesso matrimonio reale** in record-evento
separati, perché gli sposi si sono registrati con **email diverse** presso fornitori diversi
(es. la sposa dà la sua email al fotografo, lo sposo la sua al catering). Oggi sono due
`calendar_entries` scollegate → due cerchi separati per un unico evento.

Obiettivo: **riconoscere** che sono lo stesso matrimonio e, **previo consenso**, **unificare il
cerchio** (un solo anello, copertura condivisa), **senza** mai esporre i dati sensibili/privati
di un fornitore all'altro.

## Segnali e punteggio (deterministici, lato DB)
Per ogni coppia di eventi candidati si calcola uno score sommando i segnali:

| Segnale | Fonte | Punti |
|---|---|---|
| Email coppia coincidente (una qualsiasi su entrambi) | `wedding_couple_members.email` | +50 |
| Telefono coincidente | `wedding_couple_members.phone` / lead | +30 |
| **Stessa data** (`date_from`) | `calendar_entries` | +20 |
| **Stessa location** (venue/città normalizzate) | `ceremony_venue_name`, `ceremony_city`, `destination_location` | +20 |
| Nomi sposi simili (trigram bride/groom) | `couple_preferences`, `wedding_couple_members` | +15 |

**Soglia**: score ≥ **60** ⇒ *candidato "stesso matrimonio"*.
Esempi che scattano: stessa email (50) + stessa data (20) = 70; oppure stessa data (20) +
stessa location (20) + nomi simili (15) = 55 → **no** da solo (sotto soglia, evita falsi
positivi su date popolari) ma + telefono o email sì. La soglia è il parametro da tarare.

## Privacy — regola d'oro
Il rilevamento produce un **candidato**, **non** un'unione automatica e **non** espone PII.
- Finché è `CANDIDATE`, un fornitore vede solo *"potrebbe essere lo stesso matrimonio seguito
  da un altro fornitore — stessa data e location"* + i **motivi** (segnali), **mai** i dati
  dell'altro evento.
- L'unione (`CONFIRMED`) richiede un **consenso esplicito**: degli **sposi** (preferito) o
  **consenso reciproco** dei due fornitori, oppure admin.
- Anche dopo l'unione, la RLS sui dati sensibili **non cambia**: ognuno vede i propri
  preventivi/contratti/pagamenti; si condivide solo l'**organizzazione + cerchio + foto**
  (le stesse porte già esistenti).

## Modello dati
```sql
create table wedding_links (
  id uuid pk default gen_random_uuid(),
  event_a uuid references calendar_entries on delete cascade,
  event_b uuid references calendar_entries on delete cascade,
  score int not null,
  signals jsonb not null,                 -- {email:true,date:true,venue:true,...}
  status text not null default 'CANDIDATE'-- CANDIDATE | CONFIRMED | REJECTED
    check (status in ('CANDIDATE','CONFIRMED','REJECTED')),
  confirmed_by uuid, confirmed_role text, -- 'COUPLE' | 'SUPPLIER_MUTUAL' | 'ADMIN'
  created_at timestamptz default now(),
  unique (least(event_a,event_b), greatest(event_a,event_b))
);
```

## Meccanica
1. **Detection** — `detect_wedding_links(p_entry)` (SECURITY DEFINER, chiamata su create/update
   evento + **cron notturno** di riconciliazione). Confronta `p_entry` con gli altri eventi
   futuri non-rifiutati, calcola lo score, fa upsert in `wedding_links` come `CANDIDATE`.
2. **Esposizione** (RLS su `wedding_links`): un utente vede una riga solo se è **membro** di
   uno dei due eventi; dei campi vede `score`/`signals`/`status`, **non** l'altro `event`
   finché non è `CONFIRMED`.
3. **Conferma** — `confirm_wedding_link(p_link, p_decision)`:
   - se chi conferma è negli sposi di uno dei due eventi → `CONFIRMED (COUPLE)`;
   - se entrambi i fornitori confermano → `CONFIRMED (SUPPLIER_MUTUAL)`;
   - admin → `CONFIRMED (ADMIN)`. `REJECTED` chiude il candidato (non si ripropone).
4. **Unione del cerchio** — `get_event_ring` (e `_photo_circle_member`) considerano i membri
   di **tutti** gli eventi `CONFIRMED`-linkati: un solo anello, copertura sommata; le foto/porte
   restano gestite dalle policy attuali (estese all'insieme degli eventi linkati).

## UX
- **Dashboard evento (fornitore/planner)**: banner *"Sembra lo stesso matrimonio seguito anche
  da un altro fornitore — stessa data e location. Confermi?"* → `È lo stesso` / `No, è un altro`.
  La conferma "forte" (unione reale) richiede l'ok degli sposi.
- **Lato sposi**: *"Abbiamo notato 2 fornitori che organizzano il tuo matrimonio separatamente —
  vuoi unirli nel tuo unico cerchio?"* → un click unisce.
- **Niente PII prima della conferma**: il banner mostra solo i motivi, non nomi/contatti altrui.

## Anti-abuso / falsi positivi
- Soglia tarabile; data popolare da sola non basta (serve email/telefono o location+nomi).
- `REJECTED` impedisce il ripresentarsi della stessa coppia.
- Solo i membri vedono i candidati; conferma forte gated agli sposi.
- Log delle conferme (`confirmed_by/role`) per audit.

## Roll-out a fasi
1. **F1 — Detection + banner candidato** (nessuna unione): tabella + `detect_wedding_links` +
   cron + banner read-only. Valore subito, rischio zero.
2. **F2 — Conferma + unione cerchio/foto** (`confirm_wedding_link`, estensione `get_event_ring`
   e `_photo_circle_member` agli eventi linkati).
3. **F3 — Lato sposi** (unione one-click) + tuning soglia su dati reali.

## Stato
Solo progettazione (richiesta #4). Pronto a implementare la **F1** su tuo via.
