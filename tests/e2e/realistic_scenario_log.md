# Wedding Platform - Stress Test 30 giorni

Avvio: 2026-05-21T16:28:42.196Z


## Giorno 1

- ✅ Step 1: Verifica seed (login admin): 6 utenti + 4 collab + 23 servizi (1629ms)

## Giorno 3

- ✅ Step 2: Verifica disponibilita` Villa Aurora il 15/09/2026 (2026ms)

## Giorno 4

  · totale cliente € 27674, margine € 3114 (12.68%)
- ✅ Step 3: Giulia crea preventivo De Luca con 6 voci e markup 15% (68ms)

## Giorno 5

  · access_token b4da0938…, calendar entry IN_TRATTATIVA il 2026-09-15
- ✅ Step 4: Genera PDF NEUTRA e invia al cliente (4248ms)

## Giorno 6

- ✅ Step 5: Cliente De Luca apre /p/preview/:token (anon) (884ms)

## Giorno 7

  · nuovo totale € 28191.5 (drone +450 cost +517,50 cliente)
- ✅ Step 6: Giulia aggiunge "Riprese drone" e rigenera PDF (127ms)

## Giorno 8

  · price_versions: vecchia chiusa, nuova €220; snapshot preventivo invariato €180
- ✅ Step 7: Fioreria aggiorna prezzo Bouquet 180→220; snapshot quote invariato (1836ms)

## Giorno 10

- ✅ Step 8: Cliente De Luca accetta → status ACCETTATO + calendar OPZIONATA (1850ms)

## Giorno 12

  · 15/09 occupato → Giulia sposta Marini al 22/09
- ✅ Step 9: Verifica conflitto data 15/09 (entry OPZIONATA presente) (14ms)
- ✅ Step 10: Crea preventivo Marini al 22/09 (data libera) (125ms)

## Giorno 15

  · 2 notify invoked
- ✅ Step 11: Reminder 7 giorni: invoke calendar-notify per ognuno (485ms)

## Giorno 18

  · 11esimo bloccato dal trigger enforce_free_quote_limit
- ✅ Step 12: Giulia FREE: 11esimo preventivo attivo viene rifiutato (105ms)

## Giorno 20

  · PDF PREMIUM url 4sxC81hqQlTiP82iOTCHd0qQqIaNbFwDgVtrNziY…
- ✅ Step 13: Upgrade PREMIUM + brand colori, PDF rigenerato variant=PREMIUM (91ms)

## Giorno 25

- ✅ Step 14: Cliente Marini rifiuta → status RIFIUTATO + entry CANCELLATA (1061ms)

## Giorno 28

  · iCal lunghezza 333 bytes
- ✅ Step 15: Mario esporta iCal: file contiene VEVENT del 15/09 (2126ms)

## Giorno 30

  · users=6, services=23, quotes=10, entries=2, notif=0
- ✅ Step 16: Audit finale (admin): counts utenti/servizi/preventivi/entries (1872ms)

## Risultato finale

✅ Tutti i 16 step completati con successo.
