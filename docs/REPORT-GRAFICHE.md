# REPORT-GRAFICHE — Landing Planfully (registro "filiera")

**Aggiornato:** 20 luglio 2026 · **Perimetro:** landing pubblica (`/`) + pagine collegate (`/richiedi-accesso`, cookie banner) + favicon/OG.

---

## Set `assets/svg/` — RICEVUTO e integrato

Il set completo del README §Assets è stato fornito e **copiato in `frontend/public/assets/svg/`** (258 file):

| Cartella | File | Uso |
|---|---|---|
| `marchio/` | 10 (favicon, favicon-dark, og-image, lockup ×2, symbol cipresso ×2, symbol mono ×3) | favicon, OG, simbolo footer |
| `pattern/` | 4 (archi-carta, archi-carta-tripli, archi-inchiostro, arco-aperto-punto) | archi hero + Accesso |
| `icone/` | 122 (tratto 1.5, inchiostro #181F1B) | app interna (via helper) |
| `icone-light/` | 122 (variante carta #F4F3EE) | app interna su fondi scuri |

Le `icone-light/` sono state generate dallo swap simmetrico `#181F1B ↔ #F4F3EE` sulle `icone/` (verificato).

## Integrazione nel codice

| Elemento | Prima | Ora |
|---|---|---|
| Favicon | `planfully-symbol.svg` (oro) → poi cipresso in `public/brand/` | **`assets/svg/marchio/favicon.svg`** (light) + `favicon-dark.svg` (dark) |
| apple-touch-icon | — | `public/apple-touch-icon.png` (180×180, generato dal `favicon.svg` del set) |
| og:image | JPG vecchio B2C → PNG ad-hoc | **`public/og-landing.png`** (1200×630, generato dall'`og-image.svg` UFFICIALE del set) |
| Archi hero | `<svg>` inline | **`<img src="/assets/svg/pattern/archi-carta.svg">`** |
| Archi Accesso | `<svg>` inline | **`<img src="/assets/svg/pattern/archi-inchiostro.svg">`** |
| Simbolo footer | `<svg>` inline → `public/brand/` | **`assets/svg/marchio/planfully-symbol-cipresso.svg`** |
| Icone (app) | `lucide-react` | helper **`src/components/ui/Icona.tsx`** pronto (`<Icona nome="filiera" />`), mappa i 122 nomi del set |

## (a) Asset ad-hoc rimasti

| Asset | Motivo |
|---|---|
| `public/og-landing.png` | I crawler OG non renderizzano SVG → serve PNG. **Generato dal file ufficiale del set** (`marchio/og-image.svg`), non inventato. |
| `public/apple-touch-icon.png` | apple-touch richiede PNG → generato dal `favicon.svg` del set. |
| `public/brand/planfully-symbol-cipresso.png` | Le email non renderizzano SVG → PNG dal simbolo. Fuori perimetro landing (usato da `emailShell`). |
| Vecchi asset oro in `public/brand/` (`planfully-symbol.svg`, `planfully-logo*.svg`, ...) | Restano per l'**app interna** (brand oro/Bodoni, non ancora rebrandizzata). Fuori perimetro landing. |
| `lucide-react` nell'app interna | Fuori perimetro landing. L'helper `Icona` è l'infrastruttura per sostituirlo al rebrand dell'app. |

## (b) Icone necessarie assenti dal set

- **Perimetro landing: nessuna.** Design tipografico, non usa icone. `PublicHomePage`, `AccessRequestPage`, `CookieBanner` non contengono icone.
- **Perimetro app interna:** il set copre 122 icone; la sostituzione di lucide è pronta (helper `Icona`) ma non applicata (rebrand app fuori scope). Nessuna icona inventata.

## Conclusione

La landing e il suo ecosistema pubblico usano **esclusivamente il set** per marchio, favicon, pattern e OG. Nessun SVG inline residuo nella landing (archi e simbolo ora dai file). Nessuna icona di terze parti nel perimetro landing. Restano PNG generati dai file ufficiali del set (OG, apple-touch, simbolo-email) dove il formato SVG non è supportato dal contesto. L'app interna resta su lucide finché non se ne decide il rebrand: l'helper `Icona` è pronto.
