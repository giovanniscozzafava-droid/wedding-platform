# Osservatorio Planfully — il cassetto

Modulo **CONGELATO** (PRP v2). Niente build finché il **gate di Fase 1** non è verde:
**5 branch di sicurezza chiusi** + **dati reali** (oggi `n = 0`) + **firma legale §7**. Nessuno dei
tre è codice.

## Indice

1. **[PHASE0-schema-audit.md](./PHASE0-schema-audit.md)** — Fase 0 (fatta). Audit schema: lo schema
   regge l'aggregazione; gap categoria (→ aggregare per `subrole`) e gap geo (→ risolto).
2. **[DECISIONS-D1-D7.md](./DECISIONS-D1-D7.md)** — decisioni di progetto chiuse sui default del PRP.
3. **[DECISION-D8.md](./DECISION-D8.md)** — soglia di go-live (data-driven, cella-per-cella).
4. **[PHASE1-implementation-spec.md](./PHASE1-implementation-spec.md)** — blueprint Fase 1 pronto:
   migrazioni (consenso, snapshot), viste motore con `HAVING k` + anti-dominanza, refresh mensile,
   RPC di lettura, contratto UI, test della Definition of Done.

## Codice già a terra (Fase 0)

- `supabase/migrations/20260620000000_observatory_phase0_macro_area.sql` — `it_macro_area(province)`,
  funzione pura provincia→ripartizione ISTAT. **Committata, NON applicata** (modulo congelato).

## Cosa NON esiste ancora (per scelta)

Nessuna tabella consenso/snapshot, nessuna vista materializzata, nessun cron, nessuna UI. Tutto il
SQL di Fase 1 vive **dentro** lo spec, non in `supabase/migrations/`, così non si auto-applica.

## Quando il gate scatta

Seguire l'ordine di rollout in `PHASE1-implementation-spec.md` §8. La prima metrica che si accende
sarà quasi certamente l'indice prezzi o la stagionalità (dipendono dall'anagrafica, non dallo
storico trattative).
