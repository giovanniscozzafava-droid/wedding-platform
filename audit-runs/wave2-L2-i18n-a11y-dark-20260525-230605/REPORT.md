# Wave2-L2 Audit Report — I18N + A11Y + Dark Mode (retry)

Run: 2026-05-25T21:09:06.402Z
Base: https://planfully.it
Roles: wp, fornitore, sposo

## Verdict: FAIL (too many MEDIUM)

## Summary
- Bugs: 15 (HIGH=0 MEDIUM=11 LOW=4)
- I18N issues: 4
- A11Y findings (pages scanned): 14
- Dark mode findings: 16
- Screenshots: 27

## I18N
By type:
- plural_mismatch: 4

### Sample (first 20)
- **[wp:weddings]** plural_mismatch: `625

PREVENTIVO` — 1 giugno 2026 CONFERMATA VALORE € 31.625 PREVENTIVO ACCETTATO REVISION v1 Apri dashboard Gin
- **[wp:weddings]** plural_mismatch: `414

PREVENTIVO` — 17 giugno 2026 OPZIONATA VALORE € 23.414 PREVENTIVO INVIATO REVISION v1 Apri dashboard Giova
- **[wp:weddings]** plural_mismatch: `000

PREVENTIVO` — ettembre 2027 CONFERMATA VALORE € 28.000 PREVENTIVO — REVISION v1 Apri dashboard Andrea e So
- **[wp:weddings]** plural_mismatch: `000

PREVENTIVO` — ettembre 2027 CONFERMATA VALORE € 32.000 PREVENTIVO ACCETTATO REVISION v1 Apri dashboard Pla

## A11Y
Per-page summary (h1Count, iconBtnNoLabel, inputNoLabel, imgNoAlt):
- **[PUBLIC:login]** h1=2 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=5 inputs=2 imgs=5)
- **[wp:home]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=6 inputs=0 imgs=4)
- **[wp:weddings]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=6 inputs=0 imgs=4)
- **[wp:suppliers]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=15 inputs=0 imgs=12)
- **[wp:quotes]** h1=1 iconBtnNoLabel=3 inputNoLabel=0 imgNoAlt=0 (totals: btns=10 inputs=0 imgs=4)
- **[wp:profile]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=8 inputs=3 imgs=4)
- **[fornitore:home]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=6 inputs=0 imgs=4)
- **[fornitore:calendar]** h1=1 iconBtnNoLabel=2 inputNoLabel=0 imgNoAlt=0 (totals: btns=52 inputs=0 imgs=4)
- **[fornitore:quotes]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=8 inputs=0 imgs=4)
- **[fornitore:profile]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=8 inputs=5 imgs=4)
- **[sposo:home]** h1=1 iconBtnNoLabel=2 inputNoLabel=0 imgNoAlt=0 (totals: btns=13 inputs=0 imgs=3)
- **[sposo:invitati]** h1=1 iconBtnNoLabel=2 inputNoLabel=0 imgNoAlt=0 (totals: btns=13 inputs=0 imgs=3)
- **[sposo:budget]** h1=1 iconBtnNoLabel=2 inputNoLabel=0 imgNoAlt=0 (totals: btns=13 inputs=0 imgs=3)
- **[sposo:profile]** h1=1 iconBtnNoLabel=0 inputNoLabel=0 imgNoAlt=0 (totals: btns=6 inputs=3 imgs=3)

## Dark Mode
- **[wp:DARK-persist]** OK persistence ok
- **[wp:home]** OK true
- **[wp:weddings]** OK true
- **[wp:suppliers]** OK true
- **[wp:quotes]** OK true
- **[wp:profile]** OK true
- **[fornitore:DARK-persist]** OK persistence ok
- **[fornitore:home]** OK true
- **[fornitore:calendar]** OK true
- **[fornitore:quotes]** OK true
- **[fornitore:profile]** OK true
- **[sposo:DARK-persist]** OK persistence ok
- **[sposo:home]** OK true
- **[sposo:invitati]** OK true
- **[sposo:budget]** OK true
- **[sposo:profile]** OK true

## Bugs (HIGH)
- (none)

## Bugs (MEDIUM, first 40)
- [wp:quotes] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [wp:quotes] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [wp:quotes] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [fornitore:calendar] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [fornitore:calendar] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [sposo:home] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [sposo:home] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [sposo:invitati] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [sposo:invitati] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [sposo:budget] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition
- [sposo:budget] Icon button missing aria-label — <button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition

## Notes
- Lightweight a11y check (no axe-core injection) chosen for stability — counts heading hierarchy, icon-only buttons without aria-label, inputs missing label, and images without alt.
- Dark mode test toggles via common selectors (aria-label, lucide icons). PDF download not exercised in this retry (out of safe scope).
- Couple toggle: tested on sposo role pages.

## Files
- bugs.json / bugs.jsonl (live append)
- i18n-issues.json / i18n-issues.jsonl
- a11y-findings.json / a11y-findings.jsonl
- dark-findings.json / dark-findings.jsonl
- run.log
- 27 PNG screenshots
