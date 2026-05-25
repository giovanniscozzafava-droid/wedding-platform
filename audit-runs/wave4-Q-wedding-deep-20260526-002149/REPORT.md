# Wave 4 — Agent Q — Wedding Dashboard Deep Audit (WP side)

**Run dir**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-Q-wedding-deep-20260526-002149
**Started**: 2026-05-25T22:27:41.405Z
**Target**: https://planfully.it/weddings/fef38167-4ae6-4f6d-b190-52674919072e
**WP**: wp-mini@planfully-demo.it

## Pre-setup
Seed via service-role:
- Wedding AGENT-Q-Test Wedding 2027-12-19 (id `fef38167-4ae6-4f6d-b190-52674919072e`)
- Quote ACCETTATO (id `189bb466-84cd-4f63-a6b2-ffdcd914b1b6`)
- 5 tavoli, 8 momenti scaletta, 50 invitati, couple_preferences

## Tab results (17 totali)

| Tab | Esito | Note |
|-----|-------|------|
| overview | OK | screenshot captured |
| timeline | OK | screenshot captured |
| guests | OK | screenshot captured |
| tables | OK | screenshot captured |
| accommodations | OK | screenshot captured |
| transport | OK | screenshot captured |
| subevents | OK | screenshot captured |
| gadgets | OK | screenshot captured |
| mood | OK | screenshot captured |
| playlist | OK | screenshot captured |
| budget | OK | screenshot captured |
| checklist | OK | screenshot captured |
| contract | OK | screenshot captured |
| website | OK | screenshot captured |
| members | OK | screenshot captured |
| docs | OK | screenshot captured |
| analytics | OK | screenshot captured |

## Bug summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 1 |
| MEDIUM   | 1 |
| LOW      | 1 |

### Bug details

**1. [MEDIUM] [timeline]** Only 0 timeline rows visible — expected 8 seeded

**2. [HIGH] [docs]** .exe upload — no clear rejection message; got ""

**3. [LOW] [contract]** No "Scarica PDF" / contract download button visible

## Screenshots
32 files in `screenshots/`.

## Cleanup
- AGENT-Q-* entities deleted: guests, timeline, tables, participants, couple_preferences, wedding, quote, couple auth user.
