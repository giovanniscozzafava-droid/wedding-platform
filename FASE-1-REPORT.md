# FASE 1 — Fondamenta

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivi
Posare le fondamenta del nuovo modello capostipite:

1. **Questionario-once**: il wizard di onboarding non si riapre mai una volta completato.
2. **Modus operandi**: WP/LOCATION dichiarano default `INTERO` vs `SEGNALAZIONE`, con override per singolo evento.
3. **Stato evento**: macchina a stati workflow per `calendar_entries` con transizioni validate da trigger.
4. **Audit log**: tabella append-only su entità critiche (calendar_entries, quotes, quote_items, event_guests, event_tables).

## Migrazioni create

| File | Descrizione |
| --- | --- |
| `supabase/migrations/20260530100000_fase1_questionario_once.sql` | `profiles.onboarding_completato_il timestamptz` + backfill da `onboarding_complete=true`. |
| `supabase/migrations/20260530110000_fase1_modus_operandi.sql` | `type modalita_incasso` enum + `profiles.modalita_incasso_default`, `parcella_default`, `applica_ricarico_default` + `calendar_entries.modalita_incasso` (override). |
| `supabase/migrations/20260530120000_fase1_evento_stato.sql` | `type evento_stato` enum + `calendar_entries.evento_stato` (default `LEAD`) + `fn_validate_evento_stato_transition()` + trigger BEFORE UPDATE. |
| `supabase/migrations/20260530130000_fase1_audit_log.sql` | `audit_log` (append-only) + `fn_audit()` security definer + trigger AFTER su 5 tabelle + RLS read admin-only, no INSERT da client. |

## File frontend toccati

- `frontend/src/lib/auth.tsx` — campo `onboarding_completato_il` in `Profile` + fetch.
- `frontend/src/components/auth/RequireAuth.tsx` — gate `/onboarding` redirige a `/` quando il timestamp è valorizzato.
- `frontend/src/pages/auth/GenericOnboardingForm.tsx` — scrive `onboarding_completato_il = now()` al salvataggio.
- `frontend/src/pages/auth/CoupleOnboardingWizard.tsx` — idem.
- `frontend/src/pages/auth/ProviderOnboardingWizard.tsx` — idem + nuovo step "Modus operandi" condizionale per WP/LOCATION.

## Workflow `evento_stato`

```
LEAD → INCARICO_FIRMATO → PREVENTIVI → PREVENTIVO_FIRMATO →
CONTRATTO → PIANIFICAZIONE → CHECKLIST → SVOLTO
```

- `ANNULLATO` è raggiungibile da **qualunque** stato che non sia `SVOLTO`.
- `SVOLTO` e `ANNULLATO` sono **finali**: nessuna uscita.
- Forward-only: non si torna indietro nella sequenza canonica.
- Il trigger usa SQLSTATE `22023` per errori di transizione.

## RLS audit_log

- `enable row level security` attivo.
- Policy `audit_log_select_admin`: solo `is_admin()` legge.
- Nessuna policy INSERT/UPDATE/DELETE → deny-by-default; la tabella si popola solo via `fn_audit()` che gira come `security definer`.

## Verifiche

### Build frontend
`cd /Users/giovanniscozzafava/Repository/wedding-platform/frontend && npm run build` → **PASS** (`built in 1.09s`, nessun errore TS).

### DB reset
`supabase db reset --local` fallisce in fase **seed** (errore pre-esistente, `null value in column "referrer_id"` nel seed `20260526380000_seed_test_tier_oro.sql`: la variabile `v_sara` non viene trovata). Verificato che lo stesso errore si presenta su HEAD pulito senza le modifiche di FASE 1 → non è imputabile a questa fase.

### Verifica diretta migrazioni
Applicate via `psql` direttamente sul DB locale, tutte le 4 hanno chiuso senza errori. Verifica oggetti:

```
typname: evento_stato, modalita_incasso  (2 enum nuovi)
profiles columns: applica_ricarico_default, modalita_incasso_default,
                  onboarding_completato_il, parcella_default
calendar_entries columns: evento_stato, modalita_incasso
trigger evento_stato: trg_calendar_entries_evento_stato
trigger audit: trg_audit_calendar_entries / _event_guests / _event_tables /
               _quote_items / _quotes (3 eventi each: INSERT/UPDATE/DELETE)
audit_log table: presente
```

### Smoke test state machine + audit log
- `LEAD → INCARICO_FIRMATO`: OK
- `INCARICO_FIRMATO → LEAD`: bloccato (`Transizione evento non consentita: si puo` solo avanzare`)
- `INCARICO_FIRMATO → CHECKLIST` (jump avanti): OK
- `CHECKLIST → ANNULLATO`: OK
- `ANNULLATO → SVOLTO`: bloccato (`ANNULLATO e` uno stato finale`)
- Audit log: 4 righe registrate (1 INSERT + 3 UPDATE) sull'entry di test.

## Mobile-first

Lo step "Modus operandi" segue lo stesso layout responsive del wizard esistente:
- colonna singola, `Field` e `Input` shadcn esistenti
- checkbox con touch target ≥44px (`h-5 w-5 min-w-[44px]` su mobile, ridimensionato su sm)
- una azione primaria (`Avanti` / `Completa profilo`)

## Criticità / Note

- **Seed locale rotto pre-esistente**: il seed `20260526380000_seed_test_tier_oro.sql` non riesce a trovare il profilo "Sara" e abortisce; non blocca FASE 1 ma rende impossibile usare `supabase db reset` come strumento di verifica end-to-end. Da affrontare in una fase di pulizia seed dedicata, fuori scope FASE 1.
- **`profile` cast `any`**: per evitare di modificare `database.types.ts` (che è generato e fuori scope della fase), i nuovi campi vengono scritti via cast `(supabase.from('profiles') as any).update(...)` e letti via `(profile as any)`. Regenerare i types con `npm run db:types` in una fase successiva risolverà il cast.
- **`onboarding_complete` legacy**: viene mantenuto per compatibilità; il nuovo timestamp `onboarding_completato_il` è il "questionario-once". Entrambi sono scritti al completamento.
