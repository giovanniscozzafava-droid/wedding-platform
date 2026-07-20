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

## (b) Icone app interna — copertura del set (analisi 20/07)

- **Perimetro landing: nessuna icona.** `PublicHomePage`, `AccessRequestPage`, `CookieBanner` sono tipografici.
- **Perimetro app interna:** misurato l'uso reale di `lucide-react` — **236 icone distinte** in 227 file. Il set ne ha **122**. Mappando i nomi (Calendar→calendario, User→utente, ...): **109 coperte, 127 MANCANTI**.

**⚠ Conseguenza:** una sostituzione completa lucide→set è **impossibile con il set attuale** — mancano 127 icone. Il README §Assets vieta sia le librerie di icone sia l'inventare le mancanti. Un mix (metà set, metà lucide) su 227 file sarebbe **più incoerente** del lucide uniforme (che oggi è già ricolorato a inchiostro dal token `--fg`, quindi coerente nel colore). Quindi la sostituzione **non è stata applicata**: il passo corretto è **ampliare il set con le 127 icone sotto**, poi sostituire.

**Icone da aggiungere al set** (nomi lucide usati senza equivalente):

Accessibility, AlertOctagon, ArrowDownAZ, ArrowDownCircle, ArrowDownRight, ArrowDownUp, ArrowUpCircle, AtSign, Award, Baby, BadgeCheck, BedDouble, Bold, BookHeart, BookImage, BookMarked, BookOpen, BookOpenCheck, Briefcase, Bug, Bus, Calculator, CalendarHeart, CalendarRange, Car, Carrot, CheckSquare, ChefHat, Church, ClipboardCheck, Clock3, Clock4, Code, Code2, Coffee, Coins, Crop, Crown, Eraser, FileArchive, FileCheck2, FileDown, FileImage, FileUp, Flame, FlipHorizontal2, FlipVertical2, Flower2, FolderPlus, Frame, Gift, Grid3x3, Handshake, HardDrive, HardHat, Hash, Heading2, Heading3, Heart, HelpCircle, ImagePlus, Images, Inbox, Italic, Layers, LayoutPanelTop, Leaf, LifeBuoy, Lightbulb, ListOrdered, ListPlus, MessageSquareHeart, MessageSquarePlus, MessageSquareReply, MessageSquareText, Mic, Monitor, MousePointerClick, Move, NotebookPen, PackageCheck, Palette, PartyPopper, PauseCircle, PenLine, PenTool, Percent, PhoneCall, Plane, Power, Presentation, QrCode, Quote, RectangleVertical, Redo, Redo2, RotateCcw, Ruler, Save, Scale, Scissors, Shapes, ShieldAlert, Ship, ShoppingBag, ShoppingCart, Shuffle, Sliders, Sparkles, Square, Star, Table2, ThumbsDown, TicketPercent, Train, TrendingDown, Trophy, Type, Undo, Undo2, UserCheck, UserRound, UserX, Wallet, Wand2, Wrench, Zap.

Molte sono specialistiche del prodotto (Church, ChefHat, PartyPopper, BedDouble per il wedding; Bold/Italic/Type per l'editor; Crop/Eraser/Layers/Wand2 per lo Studio disegno). Vanno disegnate nel registro del set (tratto 1.5, 24×24, inchiostro) e aggiunte a `icone/` + `icone-light/`. **Nessuna icona inventata.**

**Nel frattempo** l'app usa lucide **ricolorato dal token** (`--fg` inchiostro / carta), quindi coerente nel colore col brand anche se lo stile non è quello del set. L'helper `src/components/ui/Icona.tsx` è pronto per lo scambio non appena il set è completo.

## Conclusione

La landing e il suo ecosistema pubblico usano **esclusivamente il set** per marchio, favicon, pattern e OG. Nessun SVG inline residuo nella landing (archi e simbolo ora dai file). Nessuna icona di terze parti nel perimetro landing. Restano PNG generati dai file ufficiali del set (OG, apple-touch, simbolo-email) dove il formato SVG non è supportato dal contesto. L'app interna resta su lucide finché non se ne decide il rebrand: l'helper `Icona` è pronto.
