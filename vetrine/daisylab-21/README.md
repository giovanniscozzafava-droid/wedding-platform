# DaisyLab_21 — Sito vetrina

Sito vetrina per **Elisabetta Citraro** (DaisyLab_21), fornitore di stampe, inviti e tableau a Borgia.
Dati offerta + foto importati dal profilo Planfully [`/p/fornitore/elisabetta-citraro`](https://planfully.it/p/fornitore/elisabetta-citraro).

## Stack
- Next.js 16 (App Router) + Tailwind v4
- Immagini servite da Supabase Storage (planfully)
- Modulo contatti → Resend (fallback: log su server)

## Dev
```bash
pnpm install      # o npm install
pnpm dev          # http://localhost:3000
```

## Env (`.env.local`)
```
RESEND_API_KEY=re_xxx
CONTACT_TO_EMAIL=elisabetta@daisylab21.it
CONTACT_FROM_EMAIL=hello@daisylab21.it  # dominio verificato su Resend
```
Senza chiave Resend il form non spedisce ma logga (utile in dev).

## Deploy
`vercel` dalla cartella. Niente DB locale: i dati sono in `lib/data.ts`.

## Aggiornare offerta
Ri-eseguire scrape da Planfully e patchare `lib/data.ts` (script in `/tmp/scrape-daisylab.mjs`).
