# Wave2-L Audit Report — I18N + A11Y + Dark Mode

Run: 2026-05-25T21:07:33.160Z
Base: https://planfully.it
Roles tested: wp, fornitore, sposo

## Summary
- Total bugs: 177 (HIGH=84 MEDIUM=67 LOW=26)
- I18N issues: 5
- A11Y axe-core violations: 19
- Contrast offenders: 135
- Dark mode issues: 1
- Passes: 23
- Screenshots: 20

## WCAG 2.1 AA Verdict: FAIL

## I18N Findings
Top types:
- english_leak: 1
- plural_mismatch: 4

### Sample (first 15)
- **[PUBLIC:login]** english_leak: `Wedding` -- serve — niente di più, niente di meno. Wedding planner / Location Orchestri l'evento, scegli i for
- **[wp:weddings]** plural_mismatch: `625

PREVENTIVO` -- 1 giugno 2026 CONFERMATA VALORE € 31.625 PREVENTIVO ACCETTATO REVISION v1 Apri dashboard Gin
- **[wp:weddings]** plural_mismatch: `414

PREVENTIVO` -- 17 giugno 2026 OPZIONATA VALORE € 23.414 PREVENTIVO INVIATO REVISION v1 Apri dashboard Giova
- **[wp:weddings]** plural_mismatch: `000

PREVENTIVO` -- ettembre 2027 CONFERMATA VALORE € 28.000 PREVENTIVO — REVISION v1 Apri dashboard Andrea e So
- **[wp:weddings]** plural_mismatch: `000

PREVENTIVO` -- ettembre 2027 CONFERMATA VALORE € 32.000 PREVENTIVO ACCETTATO REVISION v1 Apri dashboard Pla

## A11Y Findings
axe rule frequency:
- color-contrast: 232
- region: 44
- heading-order: 5
- button-name: 5
- landmark-one-main: 1

### Top axe issues
- **[PUBLIC:login]** `color-contrast` (serious, 9 nodes) -- Elements must meet minimum color contrast ratio thresholds
- **[PUBLIC:login]** `heading-order` (moderate, 1 nodes) -- Heading levels should only increase by one
- **[PUBLIC:login]** `landmark-one-main` (moderate, 1 nodes) -- Document should have one main landmark
- **[PUBLIC:login]** `region` (moderate, 44 nodes) -- All page content should be contained by landmarks
- **[wp:home]** `color-contrast` (serious, 25 nodes) -- Elements must meet minimum color contrast ratio thresholds
- **[wp:catalog]** `color-contrast` (serious, 39 nodes) -- Elements must meet minimum color contrast ratio thresholds
- **[wp:catalog]** `heading-order` (moderate, 1 nodes) -- Heading levels should only increase by one
- **[wp:weddings]** `color-contrast` (serious, 23 nodes) -- Elements must meet minimum color contrast ratio thresholds
- **[wp:weddings]** `heading-order` (moderate, 1 nodes) -- Heading levels should only increase by one
- **[wp:suppliers]** `color-contrast` (serious, 34 nodes) -- Elements must meet minimum color contrast ratio thresholds
- **[wp:suppliers]** `heading-order` (moderate, 1 nodes) -- Heading levels should only increase by one
- **[wp:calendar]** `button-name` (critical, 2 nodes) -- Buttons must have discernible text

## Top 10 Contrast Violations
| Page | Text | FG | BG | Ratio | Required |
|------|------|----|----|-------|----------|
| PUBLIC:login | "Planfully" | rgb(255,255,255) | rgb(248,245,240) | 1.09:1 | 4.5:1 |
| PUBLIC:login | "Una piattaforma per chi orches" | rgb(255,255,255) | rgb(248,245,240) | 1.09:1 | 3:1 |
| wp:home | "INVIATO" | rgb(221,161,47) | rgb(253,231,195) | 1.89:1 | 4.5:1 |
| wp:suppliers | "catering" | rgb(221,161,47) | rgb(253,231,195) | 1.89:1 | 4.5:1 |
| wp:quotes | "INVIATO" | rgb(221,161,47) | rgb(253,231,195) | 1.89:1 | 4.5:1 |
| wp:finance | "INVIATO" | rgb(221,161,47) | rgb(253,231,195) | 1.89:1 | 4.5:1 |
| wp:brand | "INVIATO" | rgb(221,161,47) | rgb(253,231,195) | 1.89:1 | 4.5:1 |
| PUBLIC:login | "Accedi" | rgb(248,245,240) | rgb(196,154,92) | 2.38:1 | 4.5:1 |
| wp:home | "SOON" | rgb(248,245,240) | rgb(196,154,92) | 2.38:1 | 4.5:1 |
| wp:home | "Nuovo preventivo" | rgb(248,245,240) | rgb(196,154,92) | 2.38:1 | 4.5:1 |

## Dark Mode Findings
- Toggle reachable on every audited page where the AppShell renders.
- Persistence: PASS
- Issues:
- /login (prefers-color-scheme=dark): data-theme=light

## Bug List (HIGH severity only)
- **[wp:home]** contrast 1.89:1 (need 4.5:1) — rgb(221,161,47) on rgb(253,231,195) -- "INVIATO"
- **[wp:home]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:home]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Nuovo preventivo"
- **[wp:home]** contrast 2.39:1 (need 4.5:1) — rgb(93,154,196) on rgb(214,230,240) -- "OPZIONATA"
- **[wp:home]** contrast 2.64:1 (need 4.5:1) — rgb(64,156,110) on rgb(211,232,219) -- "ACCETTATO"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "SERVIZI ATTIVI"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "COLLABORATORI"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "EVENTI (60 GG)"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "MARGINE GENERATO"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "25 mag 2026, 22:42"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "25 mag 2026, 09:47"
- **[wp:home]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "24 mag 2026, 23:29"
- **[wp:catalog]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:catalog]** contrast 2.79:1 (need 4.5:1) — rgb(148,148,148) on rgb(248,245,240) -- "catering · 2 voci"
- **[wp:catalog]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "/PERSONA"
- **[wp:weddings]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:weddings]** contrast 2.39:1 (need 4.5:1) — rgb(93,154,196) on rgb(214,230,240) -- "OPZIONATA"
- **[wp:weddings]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "VALORE"
- **[wp:weddings]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "PREVENTIVO"
- **[wp:weddings]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "REVISION"
- **[wp:suppliers]** contrast 1.89:1 (need 4.5:1) — rgb(221,161,47) on rgb(253,231,195) -- "catering"
- **[wp:suppliers]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:suppliers]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Invita fornitore"
- **[wp:suppliers]** contrast 2.39:1 (need 4.5:1) — rgb(93,154,196) on rgb(214,230,240) -- "fotografo"
- **[wp:suppliers]** contrast 2.64:1 (need 4.5:1) — rgb(64,156,110) on rgb(211,232,219) -- "ACTIVE"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "Marco Ricci"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "Chiara Bellini"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "Luca Marchetti"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "Tenuta delle Grazie"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "giovanni.scozzafava+fornitore@gmail"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "ritogew506@marineso.com"
- **[wp:suppliers]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "Sofia Verdi"
- **[wp:calendar]** axe button-name (critical, 2 nodes) — Buttons must have discernible text
- **[wp:calendar]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:calendar]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Nuovo evento"
- **[wp:calendar]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "26"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "L"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "M"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "G"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "V"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "S"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "D"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "Seleziona un giorno nella griglia"
- **[wp:calendar]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "—"
- **[wp:quotes]** axe button-name (critical, 3 nodes) — Buttons must have discernible text
- **[wp:quotes]** contrast 1.89:1 (need 4.5:1) — rgb(221,161,47) on rgb(253,231,195) -- "INVIATO"
- **[wp:quotes]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:quotes]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Nuovo preventivo"
- **[wp:quotes]** contrast 2.64:1 (need 4.5:1) — rgb(64,156,110) on rgb(211,232,219) -- "ACCETTATO"
- **[wp:quotes]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "v1 · Test Night H · 2026-06-17"
- **[wp:quotes]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "CLIENTE"
- **[wp:quotes]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "MARGINE"
- **[wp:quotes]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "%"
- **[wp:quotes]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "v1 · Andrea Rinaldi & Sofia Conti · 2027-09-25"
- **[wp:quotes]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "v1 · Paolo Pappo · 2026-06-01"
- **[wp:finance]** contrast 1.89:1 (need 4.5:1) — rgb(221,161,47) on rgb(253,231,195) -- "INVIATO"
- **[wp:finance]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:finance]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Nuovo preventivo"
- **[wp:finance]** contrast 2.39:1 (need 4.5:1) — rgb(93,154,196) on rgb(214,230,240) -- "OPZIONATA"
- **[wp:finance]** contrast 2.64:1 (need 4.5:1) — rgb(64,156,110) on rgb(211,232,219) -- "ACCETTATO"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "SERVIZI ATTIVI"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "COLLABORATORI"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "EVENTI (60 GG)"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "MARGINE GENERATO"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "25 mag 2026, 22:42"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "25 mag 2026, 09:47"
- **[wp:finance]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "24 mag 2026, 23:29"
- **[wp:brand]** contrast 1.89:1 (need 4.5:1) — rgb(221,161,47) on rgb(253,231,195) -- "INVIATO"
- **[wp:brand]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:brand]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Nuovo preventivo"
- **[wp:brand]** contrast 2.39:1 (need 4.5:1) — rgb(93,154,196) on rgb(214,230,240) -- "OPZIONATA"
- **[wp:brand]** contrast 2.64:1 (need 4.5:1) — rgb(64,156,110) on rgb(211,232,219) -- "ACCETTATO"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "SERVIZI ATTIVI"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "COLLABORATORI"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "EVENTI (60 GG)"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "MARGINE GENERATO"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "25 mag 2026, 22:42"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "25 mag 2026, 09:47"
- **[wp:brand]** contrast 2.99:1 (need 4.5:1) — rgb(148,148,148) on rgb(255,253,250) -- "24 mag 2026, 23:29"
- **[wp:profile]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "SOON"
- **[wp:profile]** contrast 2.38:1 (need 4.5:1) — rgb(248,245,240) on rgb(196,154,92) -- "Salva modifiche"
- **[wp:profile]** contrast 2.76:1 (need 4.5:1) — rgb(210,134,134) on rgb(255,253,250) -- "Richiedi cancellazione account"
- **[wp:profile]** login failed for forn-mini-foto@planfully-demo.it — https://planfully.it/login
- **[wp:profile]** login failed for giovanni.scozzafava+sposo@gmail.com — https://planfully.it/login

## Bug List (MEDIUM)
- [PUBLIC:login] axe color-contrast — Elements must meet minimum color contrast ratio thresholds
- [PUBLIC:login] public /login has no skip-to-content link
- [wp:home] axe color-contrast (serious, 25 nodes) — Elements must meet minimum color contrast ratio thresholds
- [wp:home] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Wedding Planner"
- [wp:home] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "SERVIZI ATTIVI"
- [wp:home] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "COLLABORATORI"
- [wp:home] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "EVENTI (60 GG)"
- [wp:home] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "MARGINE GENERATO"
- [wp:catalog] axe color-contrast (serious, 39 nodes) — Elements must meet minimum color contrast ratio thresholds
- [wp:catalog] contrast 3.02:1 (need 4.5:1) — rgb(168,138,75) on rgb(248,245,240) -- "CATALOGO"
- [wp:catalog] Form input missing label — input[type=] name= placeholder="Cerca per nome, categoria o descrizione..."
- [wp:catalog] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Wedding Planner"
- [wp:catalog] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "/EVENTO"
- [wp:catalog] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "/PEZZO"
- [wp:catalog] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "NETWORK INDIPENDENTE"
- [wp:catalog] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Privacy"
- [wp:weddings] axe color-contrast (serious, 23 nodes) — Elements must meet minimum color contrast ratio thresholds
- [wp:weddings] contrast 3.02:1 (need 4.5:1) — rgb(168,138,75) on rgb(248,245,240) -- "HUB EVENTI"
- [wp:weddings] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Wedding Planner"
- [wp:weddings] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "VALORE"
- [wp:weddings] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "PREVENTIVO"
- [wp:weddings] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "REVISION"
- [wp:weddings] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "NETWORK INDIPENDENTE"
- [wp:suppliers] axe color-contrast (serious, 34 nodes) — Elements must meet minimum color contrast ratio thresholds
- [wp:suppliers] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Wedding Planner"
- [wp:suppliers] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Tenuta delle Grazie"
- [wp:suppliers] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "giovanni.scozzafava+fornitore@gmail"
- [wp:suppliers] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "ritogew506@marineso.com"
- [wp:suppliers] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Sofia Verdi"
- [wp:calendar] axe color-contrast (serious, 17 nodes) — Elements must meet minimum color contrast ratio thresholds
- [wp:calendar] contrast 3.02:1 (need 4.5:1) — rgb(168,138,75) on rgb(248,245,240) -- "CALENDARIO"
- [wp:calendar] Icon-only button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [wp:calendar] Icon-only button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [wp:calendar] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Wedding Planner"
- [wp:calendar] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "—"
- [wp:calendar] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "NETWORK INDIPENDENTE"
- [wp:calendar] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Privacy"
- [wp:calendar] contrast DARK 3.44:1 — rgb(110,108,102) on rgb(24,22,20) -- "Cookie"
- [wp:quotes] axe color-contrast (serious, 23 nodes) — Elements must meet minimum color contrast ratio thresholds
- [wp:quotes] contrast 3.02:1 (need 4.5:1) — rgb(168,138,75) on rgb(248,245,240) -- "PREVENTIVI"

## Files
- i18n-issues.json (5)
- a11y-violations.json (19)
- contrast-issues.json (135)
- dark-mode-issues.json (1)
- bugs.json (177)
- passes.json (23)
- 20 screenshots (.png)
