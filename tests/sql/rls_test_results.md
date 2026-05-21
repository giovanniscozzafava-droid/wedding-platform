# RLS test results — 2026-05-21 18:25:59

```
DO
psql:<stdin>:84: NOTICE:  TEST 1 OK (Mario vede 5 servizi suoi, 0 altri)
psql:<stdin>:102: DO
NOTICE:  TEST 2 OK (Mario non vede servizi di Fioreria Bianchi)
DO
psql:<stdin>:122: NOTICE:  TEST 3 OK (Giulia vede 8+5+6 servizi dei collab)
DO
DO
psql:<stdin>:140: NOTICE:  TEST 4 OK (Giulia non vede servizi di Villa Aurora, niente collab)
psql:<stdin>:159: NOTICE:  TEST 5 OK (Giulia owner vede 1 entry con notes)
DO
psql:<stdin>:188: NOTICE:  TEST 6 OK (Mario vede 1 entry via view ridotta, nessun campo sensibile esposto)
DO
psql:<stdin>:223: NOTICE:  TEST 7a OK (Mario non puo` modificare quote di Giulia)
psql:<stdin>:223: NOTICE:  TEST 7b OK (Giulia owner puo` modificare il suo quote)
DO
psql:<stdin>:266: NOTICE:  TEST 8 OK (anon: SELECT diretto bloccato, RPC con token OK, token errato NULL)
DO
DELETE 1
DELETE 1
DELETE 0
DELETE 1
```

## Esito: ✅ tutti i test passati (9 notice OK)
