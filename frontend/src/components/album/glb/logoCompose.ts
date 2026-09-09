// RICOSTRUZIONE DEI LOGHI DEL CATALOGO (cod.01–48) CON I NOMI VERI.
// Ogni codice è un TEMPLATE: l'ornamento è il ritaglio a 300 dpi del catalogo con le zone del testo
// campione cancellate (public/album-logos/<code>.png, alpha), il testo si ricompone nei font
// identificati (public/fonts/logo/*.ttf, tutti liberi) nelle stesse zone, alla stessa misura.
// Coordinate in frazioni del riquadro del catalogo (origine in alto a sinistra).
import { LOGO_TEMPLATES, type LogoTemplate, type TextZone } from '@/components/album/glb/logoTemplates'

const loaded = new Map<string, Promise<void>>()
/** Carica un font di public/fonts/logo con la FontFace API (una volta). */
export function loadLogoFont(family: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  let p = loaded.get(family)
  if (!p) {
    const file = FONT_FILES[family]
    if (!file) return Promise.resolve()
    const face = new FontFace(family, `url(/fonts/logo/${file})`)
    p = face.load().then((f) => { document.fonts.add(f) }).catch(() => {})
    loaded.set(family, p)
  }
  return p
}
/** Famiglia → file in public/fonts/logo (Google Fonts, licenza OFL). */
export const FONT_FILES: Record<string, string> = {
  'Great Vibes': 'greatvibes.ttf', Arizonia: 'arizonia.ttf', 'Mrs Saint Delafield': 'mrssaintdelafield.ttf', 'Oooh Baby': 'ooohbaby.ttf',
  'Ms Madi': 'msmadi.ttf', 'Cormorant Italic': 'cormorant-italic.ttf', 'Cormorant Garamond Italic': 'cormorantgaramond-italic.ttf', Charm: 'charm.ttf',
  'Dawning of a New Day': 'dawningofanewday.ttf', Raleway: 'raleway.ttf', 'Josefin Sans': 'josefinsans.ttf', Quicksand: 'quicksand.ttf',
  'Playfair Display': 'playfairdisplay.ttf', 'Playfair Display Italic': 'playfairdisplay-italic.ttf', 'Bodoni Moda': 'bodonimoda.ttf', 'Bodoni Moda Italic': 'bodonimoda-italic.ttf',
  Sacramento: 'sacramento.ttf', 'Alex Brush': 'alexbrush.ttf', 'Pinyon Script': 'pinyonscript.ttf', Parisienne: 'parisienne.ttf', Allura: 'allura.ttf',
  Montserrat: 'montserrat.ttf', Cinzel: 'cinzel.ttf', Italiana: 'italiana.ttf', 'Poiret One': 'poiretone.ttf', 'Julius Sans One': 'juliussansone.ttf',
  Tangerine: 'tangerine.ttf', 'Herr Von Muellerhoff': 'herrvonmuellerhoff.ttf', 'Monsieur La Doulaise': 'monsieurladoulaise.ttf', 'Homemade Apple': 'homemadeapple.ttf',
  'La Belle Aurore': 'labelleaurore.ttf', 'Bad Script': 'badscript.ttf', 'Shadows Into Light': 'shadowsintolight.ttf', 'Cormorant Upright': 'cormorantupright.ttf', 'Petit Formal Script': 'petitformalscript.ttf',
}

const ornCache = new Map<string, HTMLImageElement | null>()
let onReady: (() => void) | null = null
export function onLogoAssetsReady(cb: () => void) { onReady = cb }
function ornament(code: string): HTMLImageElement | null {
  const url = `/album-logos/${code}.png`
  if (ornCache.has(url)) return ornCache.get(url) ?? null
  const el = new Image(); el.crossOrigin = 'anonymous'; ornCache.set(url, null)
  el.onload = () => { ornCache.set(url, el); onReady?.() }
  el.onerror = () => { ornCache.set(url, null) }
  el.src = url
  return null
}

export type LogoInput = {
  code: string
  names?: string          // «Cristina e Antonio»
  name1?: string; name2?: string
  date?: string           // «15 settembre 2022»
  dateWords?: string      // «quindicisettembreduemilaventidue»
  initials?: [string, string]
  ink: [number, number, number]
}

/** Testo per un ruolo di zona, dai dati della coppia. */
function textFor(zone: TextZone, inp: LogoInput): string {
  const n1 = inp.name1 ?? (inp.names ?? '').split(/\s+e\s+|\s*&\s*/i)[0] ?? ''
  const n2 = inp.name2 ?? (inp.names ?? '').split(/\s+e\s+|\s*&\s*/i)[1] ?? ''
  const ini = inp.initials ?? [n1.charAt(0).toUpperCase(), n2.charAt(0).toUpperCase()]
  switch (zone.role) {
    case 'names': return inp.names ?? `${n1} e ${n2}`.trim()
    case 'names-amp': return `${n1} & ${n2}`
    case 'names-caps': return `${n1} & ${n2}`.toUpperCase()
    case 'name1': return n1
    case 'name2': return n2
    case 'e': return 'e'
    case 'date': return inp.date ?? ''
    case 'date-words': return inp.dateWords ?? (inp.date ?? '').toLowerCase().replace(/\s+/g, '')
    case 'year': return (inp.date ?? '').match(/\d{4}/)?.[0] ?? ''
    case 'day': return (inp.date ?? '').match(/^\d{1,2}/)?.[0] ?? ''
    case 'month-year': return (inp.date ?? '').replace(/^\d{1,2}\s*/, '')
    case 'initials': return `${ini[0]} ${ini[1]}`
    case 'initials-tight': return `${ini[0]}${ini[1]}`
    case 'initial1': return ini[0] ?? ''
    case 'initial2': return ini[1] ?? ''
    case 'initials-amp': return `${ini[0]} & ${ini[1]}`
    case 'fixed': return zone.text ?? ''
  }
}

/** Disegna il logo (ornamento + testi) su un canvas w×h (proporzioni del riquadro del catalogo). */
export function composeLogo(inp: LogoInput, w: number, tone?: (zone: TextZone) => [number, number, number]): HTMLCanvasElement | null {
  const t: LogoTemplate | undefined = LOGO_TEMPLATES[inp.code]
  if (!t) return null
  const h = Math.round(w * t.aspect)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d'); if (!ctx) return null
  if (t.ornament) {
    const im = ornament(inp.code)
    if (im) {
      if (t.ornamentKeepsColor) ctx.drawImage(im, 0, 0, w, h)
      else {
        // ornamento monocromo → nel colore d'inchiostro
        const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h
        const tc = tmp.getContext('2d')!; tc.drawImage(im, 0, 0, w, h)
        const d = tc.getImageData(0, 0, w, h); const px = d.data; const [r, g, b] = inp.ink
        for (let i = 0; i < px.length; i += 4) { if (px[i + 3]! > 0) { px[i] = r; px[i + 1] = g; px[i + 2] = b } }
        tc.putImageData(d, 0, 0); ctx.drawImage(tmp, 0, 0)
      }
    }
  }
  for (const z of t.zones) {
    const text = textFor(z, inp)
    if (!text) continue
    const zx = z.x * w, zy = z.y * h, zw = z.w * w, zh = z.h * h
    const [r, g, b] = z.color ? z.color : tone ? tone(z) : inp.ink
    ctx.save()
    ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.textBaseline = 'middle'; ctx.textAlign = z.align ?? 'center'
    // corpo: dall'altezza della zona, ridotto se il testo non entra in larghezza
    let size = zh * (z.sizeFactor ?? 0.8)
    const font = (s: number) => `${z.weight ?? 400} ${s}px "${z.font}", serif`
    ctx.font = font(size)
    let tw = ctx.measureText(text).width + (z.letterSpacing ? z.letterSpacing * size * text.length : 0)
    if (tw > zw) { size *= zw / tw; ctx.font = font(size); tw = zw }
    const ax = z.align === 'left' ? zx : z.align === 'right' ? zx + zw : zx + zw / 2
    const ay = zy + zh / 2
    if (z.rotate) { ctx.translate(ax, ay); ctx.rotate(z.rotate * Math.PI / 180); ctx.translate(-ax, -ay) }
    if (z.letterSpacing) {
      const ls = z.letterSpacing * size
      const chars = [...text]; const total = chars.reduce((s, ch) => s + ctx.measureText(ch).width, 0) + ls * (chars.length - 1)
      let x = ax - total / 2; ctx.textAlign = 'left'
      for (const ch of chars) { ctx.fillText(ch, x, ay); x += ctx.measureText(ch).width + ls }
    } else ctx.fillText(text, ax, ay)
    ctx.restore()
  }
  return c
}

/** Tutti i font che servono a un template (da precaricare). */
export function fontsOf(code: string): string[] {
  const t = LOGO_TEMPLATES[code]; if (!t) return []
  return Array.from(new Set(t.zones.map((z) => z.font)))
}
