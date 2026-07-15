# GUARDRAIL DESIGN — validi per OGNI sessione e OGNI modifica

Questi guardrail nascono dal restyling "Partitura" (`docs/design/PROMPT-CLAUDE-CODE-RESTYLING.md`).
Ogni PR/commit che tocca **UI, email o PDF** deve dichiarare nel messaggio: **"Guardrail design verificati"**.
Se una richiesta futura entra in conflitto con questi guardrail, **fermarsi e chiedere conferma** invece di derogare.
Questo è un restyling di **presentazione**: non toccare logica di business, RPC, migrazioni, policy RLS, né `data-testid`.

## §0 Regole non negoziabili

1. **Loghi ufficiali intoccabili.** Usare SEMPRE gli asset in `frontend/public/brand/` così come sono. Mai
   ridisegnare/ricolorare/distorcere il simbolo. Varianti solo cambiando `currentColor`/fill, mai la geometria.
   **Contrasto ≥ 4.5:1**: inchiostro (`--fg`) su superfici chiare, crema (`#FAF5EA`) su superfici scure. Mai
   logo tono su tono col fondo (vale anche per favicon, og:image, email, PDF).
2. **Coerenza su ogni superficie**: app (WP/Location/Fornitore/Sposi), pagine pubbliche (login, preventivo,
   contratto, wedding site), PDF, tutte le email transazionali, stati vuoti/errore. Stessi font, colori, formati.
3. **Niente emoji, mai** (UI, email, PDF, toast, empty state). Icone: solo lucide, `strokeWidth={1.5}`,
   `currentColor`, mai dentro chip colorati.
4. **Un solo formatter monetario**: `frontend/src/lib/money.ts` (`eur`/`eurInt`) → `Intl.NumberFormat('it-IT',
   {style:'currency',currency:'EUR'})` = "23.414,00 €". Vietato `toFixed`, template con € manuale, punto decimale.
5. **Un solo bottone primario per schermata.**

## §1 Tipografia (SOLO queste 3 famiglie)

| Ruolo    | Famiglia (`var`)            | Uso |
|----------|-----------------------------|-----|
| Display  | `--font-display` → **Bodoni Moda Variable** (400/600, italic) | titoli, importi grandi |
| UI       | `--font-sans` → **Schibsted Grotesk Variable** (400/500/600)  | testo, nav, bottoni, form |
| Dati     | `--font-mono` → **Fragment Mono** (400) | date, codici pratica (PRV-042), contatori, eyebrow |

- Eyebrow/kicker: Fragment Mono ~10.5px, `letter-spacing:.2em`, uppercase, colore `--gold-600`.
- Corsivo Bodoni SOLO per l'accento emotivo del titolo pagina (una frase per pagina).
- **NB**: i vecchi font (Fraunces/Playfair/Cormorant/Great Vibes/Cinzel/Inter) restano importati SOLO perché
  usati dagli strumenti di design (copertine album, tableau, poster). Non usarli per l'UI.

## §2 Palette — uso severo (token in `index.css`, nessun hex arbitrario)

- **Oro** = brand e azione · **Salvia** = confermato/successo · **Rosa** = errore/annullato · **Ambra** = attesa.
  NIENT'ALTRO. Niente azzurro `--sky` (lo stato "opzionata" → ambra con bordo). Niente viola/lilla.
- Bottone primario: fill `--gold-700`, testo `#FAF5EA` (AA), hover più scuro. MAI testo bianco su `--gold-500`.
- Superfici cliente (portfolio, wedding site, preventivo, contratto, email cliente): carta + inchiostro + un
  solo accento (`--gold-700`). Salvia/ambra/rosa SOLO nel gestionale, mai davanti al cliente.

## §14 Anti-pattern (NON fare)

- Niente gradienti/glassmorphism/ombre colorate/angoli super-arrotondati "per ammodernare".
- Niente nuove famiglie o pesi oltre le 3. Niente varianti componente una-tantum: si aggiunge al sistema.
- Non toccare logica/RPC/migrazioni/RLS. Non rimuovere `data-testid`. Niente miglioramenti fuori scope.
