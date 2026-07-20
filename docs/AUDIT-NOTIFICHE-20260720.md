# Audit del sistema notifiche — 20 luglio 2026

Partito dal caso **Daisy_Lab21** (Elisabetta Citraro, FORNITORE): invitata sul cerchio dell'evento *Ilaria e Giuseppe* (owner Giovanni), non ha ricevuto **né notifica né email**. L'indagine ha trovato **due bug distinti**, uno dei quali sistemico.

---

## 1. Architettura reale (mappata, non presunta)

Ci sono **due sistemi di notifica in-app paralleli**, con scopi diversi:

| Sistema | Tabella | Scritto da | Letto da | Scopo |
|---|---|---|---|---|
| **Campanello** | `user_notifications` | `push_user_notification(user,type,title,body,link,ref)` | `NotificationBell` (RPC `list_notifications`, `unread_notifications_count`) | "Hai una notifica" — badge rosso |
| **Prossima Mossa** | `notifiche` | insert diretto (es. `trg_admin_notify_new_profile`) | `ProssimaMossa` (filtra `stato=PENDING`, ordina per priorità) | "Cosa fare adesso" — task operativi |

**Conseguenza pratica:** una notifica scritta in `notifiche` **non appare nel campanello**, e viceversa. Va scelto il canale giusto per ogni evento. (Correzione applicata: la notifica *nuovo iscritto Maestranze* stava in `notifiche` ma per un admin che guarda il campanello era invisibile → spostata su `user_notifications`.)

Le **email** hanno a loro volta due vie:
- **`functions.invoke` dal frontend** (l'utente clicca) → parte subito, non dipende da nulla lato DB. Es. `contract-send`, `quote-send`, `invite-supplier`, `suggested-suppliers-notify`.
- **Trigger DB → `net.http_post` → edge** (evento server-side) → dipende dal **gate GUC** (vedi §3). Es. `lead-notify`, `circle-notify`, `album-final-notify`, `album-nudge-run`, `send-digest`.

---

## 2. BUG 1 — Regressione: il cerchio non avvisava più nessuno

**Causa.** `20260611190000_circle_notifications.sql` aveva aggiunto le notifiche in-app a `suggest_supplier_to_event` e `respond_circle_suggestion`. Poi `20260711100000_circle_suggestion_kind.sql`, riscrivendo le stesse funzioni per aggiungere il campo `kind`, con `create or replace` ha **cancellato tutte le `push_user_notification`**. Dall'11/07 aggiungere un fornitore al cerchio non generava più alcuna notifica.

**Evidenza.** Gli sposi di *Ilaria e Giuseppe* avevano **0 notifiche** in entrambe le tabelle; la suggestion PENDING di Daisy esisteva ma non aveva avvisato nessuno.

**Fix** (`20260720100000_circle_notifications_restore.sql`): notifiche ripristinate mantenendo il `kind`. **Novità**: su evento futuro ora si avvisa **anche il fornitore proposto** ("sei stato proposto, in attesa di conferma degli sposi") — prima non sapeva di essere stato invitato, che era esattamente il reclamo di Giovanni.

**Verificato** (impersonazione, net-zero): dopo la proposta, sposo `circle_request=1`, fornitore `circle_proposed=1`.

---

## 3. BUG 2 — Sistemico: nessuna email server-side è mai partita

**Causa.** Le GUC `app.supabase_url` e `app.functions_anon_key` **non erano mai state configurate in produzione**. Erano solo istruzioni nei commenti di `20260701280000_notifications_hardening.sql`, mai eseguite. Ogni hook che manda email via `net.http_post` + `notify_guc_ready` trovava le GUC vuote → `notify_guc_ready` ritornava `false` → la POST veniva saltata. **Solo la notifica in-app partiva, mai l'email.**

Questo spiega "neanche una mail" per Daisy — **e per ogni nuovo lead** (`lead-notify` = email "nuova richiesta cliente"), e album. Ed è la ragione delle note sparse nel codice tipo *"finché le email non sono stabili"*.

**Verificato** nel contesto PostgREST reale: `url_set: false, key_set: false`.

**Perché non era banale.** `ALTER DATABASE SET` / `ALTER ROLE SET` richiedono privilegi di superuser: sul Supabase gestito il migration role riceve `permission denied`. Le GUC si possono settare solo dal SQL Editor del dashboard (superuser), non da migration.

**Fix senza privilegi** (`20260720140000_notify_config.sql`): config in tabella `notify_config` + iniezione via `set_config(..., true)` **locale alla transazione** (permesso a chiunque), dentro `notify_guc_ready` — che ogni hook chiama *prima* di leggere le GUC. Zero modifiche agli hook. La anon key (pubblica per design, già nel bundle di planfully.it) è popolata via API, **non entra in git**.

**Verificato**: edge `circle-notify` manda 2 email reali (`sent: [sposi, fornitore]`); `notify_guc_ready` ora ritorna `true`.

---

## 4. Stato dei flussi email da trigger DB (gate GUC)

| Edge (trigger) | Notifica in-app | Email | Stato dopo il fix |
|---|---|---|---|
| `lead-notify` (nuovo lead) | ✅ | ⛔→✅ | **acceso** (usa `notify_guc_ready`) |
| `circle-notify` (cerchio) | ⛔→✅ | ⛔→✅ | **acceso** (nuovo + gate) |
| `album-final-notify` | ✅ | ⛔→✅ | **acceso** (`20260720170000`, +1 riga) |
| `album-nudge-run` | — | ⛔→✅ | **acceso** (`20260720170000`, +1 riga) |
| `send-digest` (cron riepilogo) | — | ⛔ | **ancora spento** — vedi §6 |

Le email **invoke dal frontend** (contract-send, quote-send, invite-supplier, ecc.) non erano toccate da questo bug: partono già, se Resend è configurato.

---

## 5. Prerequisito operativo

Il fix vive nella tabella `notify_config` (una riga, popolata in prod il 20/07). Se le chiavi vengono **ruotate** (blocker SEC-00), va aggiornata la `anon_key` in quella riga, o le email server-side tornano a spegnersi. È l'unico punto da ricordare.

---

## 6. Residui (non chiusi in questo giro)

1. **`send-digest` ancora spento.** È un cron di riepilogo (`invia_digest_giornaliero`, loop su una vista): stesso fix di una riga (`perform public._notify_load_config()` prima di leggere le GUC), non applicato qui perché è secondario e il corpo è più lungo. Da fare + verificare che il cron giri.
2. **Recupero avviso arretrato a Daisy.** La sua suggestion PENDING esiste da prima del fix. Ri-mandarle ora l'avviso significa mandare email a **persone reali** (Elisabetta + la coppia cliente) per un'azione di 3 giorni fa: **non eseguito in autonomia**. Alla prossima proposta parte tutto; per l'arretrato decide Giovanni (basta ri-cliccare "aggiungi Daisy", ora funziona).
3. **Due sistemi paralleli** (`user_notifications` vs `notifiche`). Funzionano ma sono un terreno fertile per bug come questo. Andrebbe deciso una volta quale canale usa ogni classe di evento, o unificati dietro un solo helper.

---

## 7. File

- `20260720100000_circle_notifications_restore.sql` — ripristino notifiche cerchio + fornitore proposto
- `supabase/functions/circle-notify/` — edge email cerchio
- `20260720140000_notify_config.sql` — tabella config + `_notify_load_config` + `notify_guc_ready` riscritta
- `20260720160000_waitlist_notify_bell.sql` — notifica waitlist → campanello
- `20260720170000_album_email_on.sql` — accende email album-final + album-nudge
- Verifiche net-zero: `20260720110000`, `20260720150000`
