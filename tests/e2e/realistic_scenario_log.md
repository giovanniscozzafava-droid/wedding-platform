# Wedding Platform - Stress Test 30 giorni

Avvio: 2026-05-21T14:14:12.194Z


## Giorno 1

- ✅ Step 1: Verifica seed (login admin): 6 utenti + 4 collab + 23 servizi (1051ms)

## Giorno 3

- ✅ Step 2: Verifica disponibilita` Villa Aurora il 15/09/2026 (1036ms)

## Giorno 4

  · totale cliente € 27674, margine € 3114 (12.68%)
- ✅ Step 3: Giulia crea preventivo De Luca con 6 voci e markup 15% (62ms)

## Giorno 5

  · access_token e674ab47…, calendar entry IN_TRATTATIVA il 2026-09-15
- ✅ Step 4: Genera PDF NEUTRA e invia al cliente (1177ms)

## Giorno 6

- ✅ Step 5: Cliente De Luca apre /p/preview/:token (anon) (670ms)

## Giorno 7

  · nuovo totale € 28191.5 (drone +450 cost +517,50 cliente)
- ✅ Step 6: Giulia aggiunge "Riprese drone" e rigenera PDF (98ms)

## Giorno 8

  · price_versions: vecchia chiusa, nuova €220; snapshot preventivo invariato €180
- ✅ Step 7: Fioreria aggiorna prezzo Bouquet 180→220; snapshot quote invariato (1013ms)

## Giorno 10

- ✅ Step 8: Cliente De Luca accetta → status ACCETTATO + calendar OPZIONATA (763ms)

## Giorno 12

  · 15/09 occupato → Giulia sposta Marini al 22/09
- ✅ Step 9: Verifica conflitto data 15/09 (entry OPZIONATA presente) (15ms)
- ✅ Step 10: Crea preventivo Marini al 22/09 (data libera) (115ms)

## Giorno 15

  · 2 notify invoked
- ✅ Step 11: Reminder 7 giorni: invoke calendar-notify per ognuno (750ms)

## Giorno 18

  · 11esimo bloccato dal trigger enforce_free_quote_limit
- ✅ Step 12: Giulia FREE: 11esimo preventivo attivo viene rifiutato (102ms)

## Giorno 20

  · PDF PREMIUM url nSMuYChTQiW7KN38oNABghRMWwaBsiK08KBqEeas…
- ✅ Step 13: Upgrade PREMIUM + brand colori, PDF rigenerato variant=PREMIUM (78ms)

## Giorno 25

- ✅ Step 14: Cliente Marini rifiuta → status RIFIUTATO + entry CANCELLATA (787ms)

## Giorno 28

  · iCal lunghezza 333 bytes
- ✅ Step 15: Mario esporta iCal: file contiene VEVENT del 15/09 (1267ms)

## Giorno 30

  · users=6, services=23, quotes=10, entries=2, notif=0
- ✅ Step 16: Audit finale (admin): counts utenti/servizi/preventivi/entries (984ms)

## Risultato finale

✅ Tutti i 16 step completati con successo.
