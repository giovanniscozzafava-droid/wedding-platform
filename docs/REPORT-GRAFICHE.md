# REPORT-GRAFICHE — Landing Planfully (registro "filiera")

**Data:** 20 luglio 2026 · **Perimetro:** landing pubblica (`/`) + pagine collegate (`/richiedi-accesso`, cookie banner) + favicon/OG.

---

## ⚠ PREMESSA BLOCCANTE — il set `assets/svg/` non è nel bundle

Il README §Assets richiede di copiare `assets/svg/` e di usare **solo** quei file per marchio, favicon, pattern e icone (vietando lucide e SVG inline nuovi). **Quella cartella non è stata fornita.** Il bundle ricevuto contiene solo:

- `Planfully Landing.dc.html` (prototipo)
- `planfully-symbol-cipresso.svg`
- `planfully-symbol-cipresso-light.svg`
- `README.md`

Quindi il vincolo "usa solo `assets/svg/`" è stato applicato per i **2 soli asset disponibili** (il simbolo, nelle due varianti). Per tutto il resto del set — favicon dedicati, lockup orizzontale, `og-image.svg`, cartella `pattern/`, 122 icone `icone/` + `icone-light/`, varianti mono — ho fatto la scelta più conforme possibile con ciò che c'era, e la elenco qui sotto. **Appena mi fornisci `assets/svg/`, sostituisco.**

---

## (a) Asset grafici ad-hoc / vecchi / inline

| # | Asset | Dove | Stato / motivo |
|---|---|---|---|
| 1 | Archi dell'anello (SVG inline) | `src/pages/public/PublicHomePage.tsx` righe **55-57** (hero) e **105-107** (Accesso) | **Conforme.** Il README §Marchio ammette gli archi inline "come nel prototipo o dai file `pattern/`". I file `pattern/` non forniti → inline. |
| 2 | `og-landing.png` (anteprima social) | `public/og-landing.png`, referenziata in `index.html` | **Ad-hoc.** Generata via Playwright (claim su carta + archi) perché `marchio/og-image.svg` non fornito. |
| 3 | `planfully-symbol-cipresso.png` | `public/brand/planfully-symbol-cipresso.png` | **Ad-hoc.** Generata dal SVG fornito, serve alle **email** (i client non renderizzano SVG). Il set non includeva un PNG del simbolo. |
| 4 | Favicon | `index.html` righe 5-8 | **Conforme ai 2 asset.** Ora usa `planfully-symbol-cipresso.svg` (light) + `-light.svg` (dark) + `.png` (apple-touch). Il set prevedeva `favicon.svg`/`favicon-dark.svg` dedicati (non forniti) → uso il simbolo. |
| 5 | Marchio footer landing | `src/pages/public/PublicHomePage.tsx` (footer) | **Conforme.** Convertito da SVG inline a `<img src="/brand/planfully-symbol-cipresso.svg">` (file del set). |
| 6 | Vecchi asset brand **oro** | `public/brand/planfully-symbol.svg`, `planfully-symbol-light.svg`, `planfully-logo.svg`, `planfully-logo-horizontal.svg` + `.png` | **Restano.** Usati dall'**app interna** (dashboard, brand oro/Bodoni non ancora rebrandizzato). Fuori dal perimetro landing. |
| 7 | Sprite icone app | `public/icons.svg` | **Resta.** Icone esistenti dell'app, non del set. Fuori perimetro landing. |
| 8 | Icone `lucide-react` | tutta l'**app interna** (es. `src/pages/AccessRequestsAdminPage.tsx` non ne usa; la maggior parte delle pagine sì) | **Fuori perimetro.** La **landing pubblica e le sue pagine** (`PublicHomePage`, `AccessRequestPage`, `CookieBanner`) **non usano lucide né alcun SVG estraneo**. L'app interna sì → rebrand futuro quando arriva il set icone. |

---

## (b) Icone necessarie assenti dal set

- **Perimetro landing: nessuna.** Il design è tipografico (Jost + Plex Mono + archi + simbolo); non richiede icone. Verificato: `PublicHomePage`, `AccessRequestPage`, `CookieBanner` non contengono icone.
- **Perimetro app interna:** le 122 icone `icone/` + `icone-light/` servirebbero per sostituire `lucide-react` quando si rebrandizza la dashboard. Non disponibili → l'app resta su lucide finché il set non è fornito. **Nessuna icona inventata.**

---

## Conclusione

La **landing e il suo ecosistema pubblico** (favicon, OG, cookie, form accesso) sono conformi al brand con i 2 asset forniti; non contengono icone di terze parti né SVG inventati (solo gli archi inline, ammessi). Restano da sostituire, **quando fornisci `assets/svg/`**: favicon dedicati, lockup orizzontale, `og-image.svg` (al posto del PNG ad-hoc), e — se si estende il rebrand all'app — le 122 icone al posto di lucide.
