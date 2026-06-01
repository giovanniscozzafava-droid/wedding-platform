# Controllo di sicurezza Planfully — spiegato in parole semplici
_1 giugno 2026_

## Cosa ho fatto
Ho messo alla prova tutta l'app come farebbero insieme **un ladro che cerca di entrare** e **un ispettore che cerca difetti**. L'ho fatto con **8 squadre contemporaneamente**, ognuna su una parte diversa (chi può vedere cosa, se i passaggi del matrimonio funzionano in ordine, se i dati restano coerenti, ecc.).

Per ogni problema "grave" trovato, ho mandato un **secondo controllore col compito di smontarlo** — per evitare falsi allarmi. E ho costruito un **intero matrimonio finto, dall'inizio alla fine**, per vedere se la catena regge.

In totale: ore di analisi. Sono usciti **67 sospetti**.

---

## La buona notizia: quasi tutti erano falsi allarmi
Dei 23 problemi segnalati come "gravi", **19 erano falsi allarmi**: il secondo controllore li ha smontati. Vuol dire che l'app è **più solida di quanto sembrasse** a prima vista.

---

## 🔴 Il problema vero — già sistemato
C'era **una falla seria**, e l'ho chiusa subito.

Tre "registri interni" dell'app (le **firme dei preventivi**, le **firme dei contratti**, e il **conteggio dei tentativi di contatto**) erano lasciati con la **porta aperta**. Chiunque, anche un perfetto sconosciuto senza account, poteva:

- **leggere i dati personali di tutti i clienti di tutti i wedding planner**: nome, email, telefono, **numero della carta d'identità**, indirizzo IP;
- **cancellare o modificare le firme** archiviate (cioè manomettere le prove legali);
- e, con una "chiave" trovata lì dentro, **accettare o rifiutare i preventivi al posto dei clienti**.

Era come avere l'archivio dei contratti firmati lasciato sul marciapiede, aperto.

**L'ho chiuso a chiave.** Ora un estraneo che prova ad aprire quei registri si becca un "accesso negato". Ho verificato che da fuori non si vede più nulla e che il funzionamento normale dell'app continua a girare. **È già attivo in produzione.**

---

## ✅ Cosa funziona bene (verificato davvero, non a parole)
- Ogni wedding planner / coppia / fornitore **vede solo i propri dati**, non quelli degli altri.
- Il **percorso completo di un matrimonio funziona**: arriva il contatto → diventa evento e preventivo (con i dati che si portano dietro da soli) → il preventivo viene accettato → si costruisce il matrimonio (invitati, tavoli, programma). Tutto fila.
- Il problema dell'accettazione preventivo che avevo corretto giorni fa **regge** ancora.

---

## 🟡 Cosa resta da migliorare (niente di rotto, non urgente)
Sono "paletti di buon senso" che oggi mancano:

- l'app **accetta numeri assurdi** se inseriti (prezzo negativo, 2 miliardi di invitati, una data di fine prima dell'inizio). Non capita nell'uso normale, ma meglio bloccarli.
- i **link dei preventivi non scadono mai**: chi riceve un link può riaprirlo per sempre.
- la regola "il contratto si firma solo quando tutto il budget è approvato" oggi è controllata solo nella schermata, non nel cuore del sistema: un wedding planner potrebbe aggirarla (ma danneggerebbe solo sé stesso).
- su alcuni eventi mancano delle **notifiche alla coppia**.

Ho già **preparato la correzione** per i "numeri assurdi", ma **non l'ho attivata**: è una modifica che non mi avevi chiesto e tocca la struttura del database, quindi è giusto che la decida tu. È lì pronta (`supabase/proposals/`).

---

## ⚠️ Una cosa che devi decidere tu
Le "chiavi" dei preventivi che erano esposte **prima** che chiudessi la falla andrebbero **cambiate per sicurezza**. Il punto: cambiarle **invalida i link già inviati ai clienti veri** (chi ha un preventivo aperto dovrebbe riceverne uno nuovo). Per questo non l'ho fatto da solo — **dimmi tu se procedere.**

---

## In una riga
**Una porta aperta seria, trovata e chiusa subito. Il resto dell'app regge bene. Una lista di rifiniture pronte, di cui solo una richiede una tua scelta.**

_Versione tecnica completa: `STRESS-AUDIT-REPORT.md`_
