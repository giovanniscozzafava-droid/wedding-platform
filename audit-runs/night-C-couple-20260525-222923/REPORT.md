# AGENT C — Audit Coppia Sposi (PROD planfully.it)
Timestamp: 20260525-222923
User: giovanni.scozzafava+sposo@gmail.com
Wedding: 7a19a8a2-75a8-4ffe-8eb5-f155785e9dea (slug: giovanni-e-pingu)

## Bugs summary
- CRITICAL: 0
- HIGH: 0
- MEDIUM: 1
- LOW: 0
- Tot: 1

## Bugs

### 1. [MEDIUM] Invite — Impossibile seed-are un invito di test
_invalid input value for enum couple_role: "TESTIMONE"_


## Log
```
AGENT-C couple audit — out=/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-C-couple-20260525-222923

## PUBLIC PAGES (no auth)
→ /w/giovanni-e-pingu
  hero h1: Giovanni e Pingu
  RSVP form-ish elements: 2
→ /privacy
→ /cookie
→ /p/preview/808106f5-5442-471b-9f12-82a814169339
  quote preview body len: 822
→ /p/accept/808106f5-5442-471b-9f12-82a814169339
→ /p/reject/808106f5-5442-471b-9f12-82a814169339
→ /p/contract/0a46ca52-f5e5-4339-9fc9-b58e93ce2fad

## INVITO COPPIA flow
  seed invite ERR: {"code":"PGRST204","details":null,"hint":null,"message":"Could not find the 'invited_email' column of 'wedding_couple_members' in the schema cache"}
  seed invite ERR2: {"code":"22P02","details":null,"hint":null,"message":"invalid input value for enum couple_role: \"TESTIMONE\""}
  [BUG MEDIUM] Invite :: Impossibile seed-are un invito di test — invalid input value for enum couple_role: "TESTIMONE"
→ /login (couple)
  POST-LOGIN URL: https://planfully.it/couple

## DASHBOARD /couple
  logo Planfully presente OK
  hero h1: Giovanni e Pingu
  countdown presente: true
  documenti sezioni: 2
  console-errors [mood-add]: ["console: Failed to load resource: the server responded with a status of 502 ()"]
  console-errors [playlist]: ["console: Failed to load resource: the server responded with a status of 502 ()"]
  console-errors [playlist-add]: ["console: Failed to load resource: the server responded with a status of 502 ()"]
  console-errors [bomboniere]: ["console: Failed to load resource: the server responded with a status of 502 ()"]
  console-errors [website]: ["console: Failed to load resource: the server responded with a status of 502 ()"]
  sito ospiti link: https://planfully.it/w/giovanni-e-pingu
  Programma: pulsanti change-request count=0

## ACCESS BLOCKS (coppia non deve vedere WP pages)
  /weddings → https://planfully.it/couple
  /suppliers → https://planfully.it/couple
  /catalog → https://planfully.it/couple

## LOGOUT
  POST-LOGOUT URL: https://planfully.it/login

## CLEANUP AGENT-C-*
  cleanup mood_items: Could not find the table 'public.mood_items' in the schema cache
  cleanup mood_board: Could not find the table 'public.mood_board' in the schema cache
  cleanup playlist_items: Could not find the table 'public.playlist_items' in the schema cache
  cleanup playlists: Could not find the table 'public.playlists' in the schema cache
  cleanup couple_change_requests: column couple_change_requests.song_title does not exist
  cleanup members: 0 rimossi
```
