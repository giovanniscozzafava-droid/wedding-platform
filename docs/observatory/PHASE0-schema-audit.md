# Osservatorio Planfully — Fase 0: audit schema

**Deliverable della Fase 0 del PRP (v2).** Risponde a una sola domanda: *lo schema operativo
permette di aggregare DOMANI, quando ci saranno dati reali?* Niente UI, niente viste
osservatorio, niente snapshot. Il modulo resta **CONGELATO** dietro il gate di Fase 1.

Stato dati al momento dell'audit: **n = 0** (nessun capostipite onboardato → nessun preventivo,
nessuno storico prezzi). L'audit verifica la *predisposizione* dello schema, non i dati.

---

## 1. Esito sintetico

| Asse necessario all'aggregazione | Stato | Dove |
|---|---|---|
| Timestamp puliti | ✅ pronto | `created_at`/`updated_at` su `services`, `quotes`, `quote_items`, `calendar_entries`, `price_versions` |
| Prezzo di listino | ✅ pronto | `services.base_price` (corrente) + `price_versions(price, valid_from, valid_until)` (storico) |
| Prezzo realizzato | ✅ pronto | `quote_items.line_client` (prezzo effettivamente messo a preventivo) |
| Categoria normalizzata | ⚠️ gap | `services.category_id` FK presente **ma non normalizzata cross-fornitore** (vedi §2) |
| Geo per fornitore | ⚠️ gap risolto in Fase 0 | `profiles.province` (sigla ISO) presente; **mancava la macro-area** → aggiunta `it_macro_area()` |
| Stato preventivo (conversione) | ✅ pronto | `quotes.status` (`INVIATO`/`ACCETTATO`/`CONVERTITO_IN_CONTRATTO`/`RIFIUTATO`), `sent_at`, `accepted_at` |
| Stagionalità domanda | ✅ pronto | `calendar_entries.date_from`/`date_to`/`status` |
| Consenso aggregato fornitore | ➖ Fase 1 | `supplier_data_consent` è costruzione di Fase 1, fuori dalla Fase 0 |

**Conclusione:** lo schema è **sostanzialmente pronto** per le 3 metriche di lancio (D2). Restavano
due buchi: la **macro-area** (chiuso ora con una funzione pura) e la **normalizzazione categoria**
(da decidere come metodologia in Fase 1 — non richiede migrazione di catalogo).

---

## 2. Il gap categoria (da gestire come metodologia, non come migrazione)

`service_categories` ammette categorie **custom** (`is_standard = false`, `created_by` valorizzato).
Due fornitori possono avere due `category_id` diversi per lo stesso servizio reale → un
`group by category_id` **frammenta** l'aggregato e rompe la k-anonymity per costruzione.

Asse di normalizzazione raccomandato, in ordine di affidabilità:
1. **`profiles.subrole`** del fornitore (tassonomia unica `SUPPLIER_SUBROLES`: fotografo, fioraio,
   catering, …) — è il taglio "per settore" più solido e già coerente con `service_categories.subrole`.
2. Categorie **standard** (`service_categories.is_standard = true`) quando il dato è sufficiente.

→ **Niente migrazione di catalogo ora.** In Fase 1 la vista materializzata aggrega per
`subrole` (o categoria standard), non per `category_id` grezzo.

---

## 3. Il gap geo (chiuso in questa Fase 0)

`profiles` ha `city` e `province` (sigla ISO, es. `CS`, `MI`) ma **non** la ripartizione
geografica richiesta da D3. Aggiunta la funzione pura:

```
public.it_macro_area(province text) -> 'NORD_OVEST'|'NORD_EST'|'CENTRO'|'SUD'|'ISOLE'|NULL
```

Copre tutte le sigle provinciali italiane (incluse le sarde legacy OT/OG/VS/CI). È immutable,
non legge dati, non ha superficie RLS. In Fase 1 il `supplier_geo` del PRP §4.4 diventa una vista
banale: `select id as supplier_id, province, public.it_macro_area(province) as macro_area from profiles`.

Migrazione: `supabase/migrations/20260620000000_observatory_phase0_macro_area.sql`
(committata; **non ancora applicata in prod** — vedi §5).

---

## 4. Mappa metrica → sorgenti (le 3 di lancio, D2)

1. **Indice prezzi mediano** (categoria × macro-area): `services.base_price` filtrato per
   `is_active`, fornitori con consenso `granted`, join `profiles.province → it_macro_area`,
   aggregato per `subrole`. `HAVING count(distinct fornitore_id) >= k`. Storico: `price_versions`.
2. **Stagionalità domanda**: distribuzione di `calendar_entries.date_from` per mese (no identità).
3. **Conversione preventivo→firmato**: `quotes` per `subrole`/categoria, stato terminale
   `CONVERTITO_IN_CONTRATTO`/`ACCETTATO` vs `RIFIUTATO`.

Tutte richiedono il join al consenso (Fase 1) e l'enforcement di `k` (Fase 1).

---

## 5. Cosa NON è stato fatto (e perché)

Per rispetto del vincolo del PRP ("CONGELATO; non iniziare il build prima del gate di Fase 1"):

- ❌ Nessuna tabella `supplier_data_consent` / `observatory_snapshots` / `observatory_external_sources`.
- ❌ Nessuna vista materializzata, nessun refresh schedulato, nessuna UI.
- ⏸️ La micro-migration `it_macro_area` è **committata ma NON applicata in produzione**
  (`supabase db push` lasciato alla decisione esplicita): è innocua, ma applicarla è l'unica
  azione che tocca il DB di un modulo congelato.

---

## 6. Gate per la Fase 1 (dal PRP §8) — stato

- [ ] I cinque branch di sicurezza (`fix/1`…`fix/5`) chiusi.
- [ ] Dati reali sufficienti — **D8** (ordine di ~centinaia di `quote_items`). Oggi: **n = 0**.
- [ ] Decisioni **D1–D7** chiuse (soglia k, set metriche, granularità, chi-vede-cosa, cadenza,
      fonti, proiezioni).

Finché questi tre non sono verdi, la Fase 1 **non parte**. La Fase 0 è completa: lo schema è
predisposto e l'unico campo mancante (macro-area) è pronto nel cassetto.
