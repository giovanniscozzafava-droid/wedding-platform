// Printable dell'evento (segnaposto, cavalieri per tavolo, menu) negli stessi 6 STILI del tableau
// mariage. Ogni pagina A4 è costruita come HTML tematizzato e rasterizzata con html2canvas: così la
// centratura è esatta (CSS), le facce a tendina si ruotano con rotate(180deg) e gli stili coincidono
// con quelli del poster (POSTER_TEMPLATES).
import { attendingGuests, guestsByTable, chunk, tableName, guestTableLabel, type PGuest, type PTable } from './eventPrintShared'
import { getTemplate, type PosterTemplate } from './tableauPosters'

const A4 = { w: 794, h: 1123 } // px @ 96dpi (A4 ritratto)
const FONT_LINK = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Great+Vibes&family=Jost:wght@300;400;500&display=swap'
const esc = (s: string) => (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] || c))

function ensureFonts() {
  if (!document.getElementById('printable-fonts')) {
    const l = document.createElement('link'); l.id = 'printable-fonts'; l.rel = 'stylesheet'; l.href = FONT_LINK
    document.head.appendChild(l)
  }
}
function nameSize(name: string, base: number): number {
  const n = name.length
  if (n > 30) return Math.round(base * 0.55)
  if (n > 22) return Math.round(base * 0.68)
  if (n > 16) return Math.round(base * 0.82)
  return base
}
async function loadLogoPng(url?: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const im = new Image(); im.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => { im.onload = () => res(); im.onerror = () => rej(new Error('logo')); im.src = url })
    const c = document.createElement('canvas'); c.width = im.naturalWidth || 1; c.height = im.naturalHeight || 1
    c.getContext('2d')!.drawImage(im, 0, 0)
    return c.toDataURL('image/png')
  } catch { return null }
}

function newPage(bg: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = `width:${A4.w}px;height:${A4.h}px;position:relative;box-sizing:border-box;background:${bg};overflow:hidden`
  return el
}

async function pagesToPdf(pages: HTMLElement[], filename: string) {
  if (pages.length === 0) throw new Error('Niente da stampare')
  ensureFonts()
  const html2canvas = (await import('html2canvas-pro')).default
  const { jsPDF } = await import('jspdf')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;opacity:1'
  pages.forEach((p) => host.appendChild(p))
  document.body.appendChild(host)
  try {
    try { await (document as any).fonts?.ready } catch { /* no-op */ }
    await new Promise((r) => setTimeout(r, 60)) // lascia applicare i font
    const d = new jsPDF({ unit: 'mm', format: 'a4' })
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i]!, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false })
      if (i > 0) d.addPage()
      d.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297)
    }
    d.save(filename)
  } finally { document.body.removeChild(host) }
}

// ── pezzo di faccia (nome) centrato via CSS ──────────────────────────────────
function nameFaceHTML(t: PosterTemplate, name: string, table: string, base: number): string {
  const fs = nameSize(name, base)
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:0 18px;box-sizing:border-box">
    <div style="font-family:${t.nameFont};color:${t.nameColor};font-size:${fs}px;line-height:1.05;text-align:center;${t.nameItalic ? 'font-style:italic;' : ''}${t.nameUpper ? 'text-transform:uppercase;letter-spacing:.05em;' : ''}overflow-wrap:anywhere">${esc(name)}</div>
    <div style="width:38px;height:2px;background:${t.accent};margin:9px 0"></div>
    ${table ? `<div style="font-family:${t.bodyFont};color:${t.accent};font-size:12px;letter-spacing:.2em;text-transform:uppercase;text-align:center">${esc(table)}</div>` : ''}
  </div>`
}

// ── SEGNAPOSTO ───────────────────────────────────────────────────────────────
export async function exportPlaceCards(guests: PGuest[], tables: PTable[], opts: { variant?: 'card' | 'tent'; styleId?: string }) {
  const att = attendingGuests(guests)
  if (att.length === 0) throw new Error('Nessun invitato da stampare')
  const t = getTemplate(opts.styleId ?? 'sereno')
  const variant = opts.variant ?? 'card'
  const items = att.map((g) => ({ name: g.full_name.trim(), table: guestTableLabel(g, tables) }))
  const perPage = variant === 'card' ? 10 : 8
  const cols = 2, rows = variant === 'card' ? 5 : 4
  const cut = t.dark ? 'rgba(255,255,255,.28)' : 'rgba(0,0,0,.18)'
  const pages = chunk(items, perPage).map((group) => {
    const page = newPage('#ffffff')
    const cells = group.map((it) => {
      if (variant === 'card') {
        return `<div style="background:${t.bg};border:1px dashed ${cut};display:flex;align-items:center;justify-content:center">${nameFaceHTML(t, it.name, it.table, 32)}</div>`
      }
      return `<div style="background:${t.bg};border:1px dashed ${cut};display:flex;flex-direction:column">
        <div style="flex:1;transform:rotate(180deg)">${nameFaceHTML(t, it.name, it.table, 26)}</div>
        <div style="border-top:1.5px dashed ${t.accent};opacity:.7"></div>
        <div style="flex:1">${nameFaceHTML(t, it.name, it.table, 26)}</div>
      </div>`
    }).join('')
    page.innerHTML = `<div style="position:absolute;inset:38px;display:grid;grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${rows},1fr);gap:16px">${cells}</div>
      <div style="position:absolute;left:0;right:0;top:14px;text-align:center;font-family:${t.bodyFont};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${t.accent}">Ritaglia lungo le linee${variant === 'tent' ? ' · piega a metà' : ''}</div>`
    return page
  })
  await pagesToPdf(pages, `segnaposto-${variant}.pdf`)
}

// ── CAVALIERI PER TAVOLO (autoportanti) ──────────────────────────────────────
export async function exportTableSigns(tables: PTable[], guests: PGuest[], opts: { styleId?: string; coupleNames?: string; dateText?: string }) {
  const groups = guestsByTable(guests, tables).filter((g) => g.table)
  if (groups.length === 0) throw new Error('Nessun tavolo con invitati')
  const t = getTemplate(opts.styleId ?? 'sereno')
  const head = [opts.coupleNames?.trim(), opts.dateText?.trim()].filter(Boolean).join(' · ')
  const guide = t.dark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.35)'

  const faceHTML = (tname: string, names: string[]) => {
    const fs = nameSize(tname, 50)
    const two = names.length > 6
    const list = two
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 26px;width:100%;max-width:480px">${names.map((n) => `<div style="text-align:center;font-family:${t.bodyFont};color:${t.guestColor};font-size:16px;line-height:1.5">${esc(n)}</div>`).join('')}</div>`
      : names.map((n) => `<div style="text-align:center;font-family:${t.bodyFont};color:${t.guestColor};font-size:19px;line-height:1.55">${esc(n)}</div>`).join('')
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:18px 28px;box-sizing:border-box">
      ${head ? `<div style="font-family:${t.bodyFont};color:${t.accent};font-size:11px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:6px">${esc(head)}</div>` : ''}
      <div style="font-family:${t.nameFont};color:${t.nameColor};font-size:${fs}px;line-height:1.04;${t.nameItalic ? 'font-style:italic;' : ''}${t.nameUpper ? 'text-transform:uppercase;letter-spacing:.05em;' : ''}">${esc(tname)}</div>
      <div style="width:46px;height:2px;background:${t.accent};margin:11px 0 14px"></div>
      ${list}
    </div>`
  }

  const W = 560, FACE = 332, BASE = 188, TAB = 58, SLIT = 56
  const pages = groups.map((g) => {
    const page = newPage('#ffffff')
    const tname = tableName(g.table!)
    const names = g.guests.map((x) => x.full_name.trim())
    page.innerHTML = `<div style="position:absolute;left:50%;top:36px;transform:translateX(-50%);width:${W}px">
      <div style="height:${SLIT}px;position:relative;text-align:center">
        <div style="font-family:Arial;font-size:11px;color:${guide};letter-spacing:.1em;padding-top:8px">fessura · taglia</div>
        <div style="position:absolute;left:50%;top:34px;transform:translateX(-50%);width:210px;border-top:2px solid ${guide}"></div>
      </div>
      <div style="height:${FACE}px;background:${t.bg};transform:rotate(180deg);border:1px solid ${guide}">${faceHTML(tname, names)}</div>
      <div style="border-top:1.5px dashed ${t.accent}"></div>
      <div style="height:${FACE}px;background:${t.bg};border:1px solid ${guide};border-top:none">${faceHTML(tname, names)}</div>
      <div style="border-top:1.5px dashed ${t.accent}"></div>
      <div style="height:${BASE}px;background:${t.bg};border:1px solid ${guide};border-top:none;display:flex;align-items:center;justify-content:center;text-align:center;font-family:Arial;font-size:12px;color:${guide};padding:0 40px">BASE — piega e infila la linguetta nella fessura in cima: il cavaliere sta in piedi da solo</div>
      <div style="width:240px;height:${TAB}px;margin:0 auto;background:${t.bg};border:1px solid ${guide};border-top:1.5px dashed ${t.accent};display:flex;align-items:center;justify-content:center;font-family:Arial;font-size:11px;color:${guide}">linguetta</div>
    </div>`
    return page
  })
  await pagesToPdf(pages, 'cavalieri-tavolo.pdf')
}

// ── MENU (per la location, col suo logo) ─────────────────────────────────────
const MENU_ORDER: Array<{ key: string; label: string }> = [
  { key: 'BENVENUTO', label: 'Aperitivo di benvenuto' }, { key: 'ANTIPASTO', label: 'Antipasti' },
  { key: 'PRIMO', label: 'Primi piatti' }, { key: 'SECONDO', label: 'Secondi piatti' },
  { key: 'CONTORNO', label: 'Contorni' }, { key: 'FRUTTA', label: 'Frutta' },
  { key: 'DOLCE', label: 'Dolci' }, { key: 'TORTA', label: 'Taglio torta' },
  { key: 'CAFFE', label: 'Caffè' }, { key: 'BEVANDA', label: 'Bevande' },
]
type MenuItem = { section: string; name: string; description?: string | null }

export async function exportMenu(items: MenuItem[], opts: { styleId?: string; logoUrl?: string | null; venueName?: string | null; coupleNames?: string; dateText?: string }) {
  const valid = (items ?? []).filter((i) => i.name && i.name.trim())
  if (valid.length === 0) throw new Error('Il menu è vuoto')
  const t = getTemplate(opts.styleId ?? 'sereno')
  const logo = await loadLogoPng(opts.logoUrl)
  const head = [opts.coupleNames?.trim(), opts.dateText?.trim()].filter(Boolean).join(' · ')
  const present = MENU_ORDER.map((s) => ({ ...s, dishes: valid.filter((i) => (i.section || '').toUpperCase() === s.key) })).filter((s) => s.dishes.length)

  const sectionsHTML = present.map((s) => `
    <div style="margin-bottom:14px">
      <div style="font-family:${t.bodyFont};color:${t.accent};font-size:12px;letter-spacing:.24em;text-transform:uppercase;margin-bottom:7px">${esc(s.label)}</div>
      ${s.dishes.map((dish) => `
        <div style="margin-bottom:6px">
          <div style="font-family:${t.nameFont};color:${t.nameColor};font-size:18px;line-height:1.2">${esc(dish.name)}</div>
          ${dish.description ? `<div style="font-family:${t.bodyFont};color:${t.guestColor};font-size:12px;line-height:1.35;opacity:.85">${esc(dish.description)}</div>` : ''}
        </div>`).join('')}
    </div>`).join('')

  const cardHTML = `<div style="height:100%;box-sizing:border-box;background:${t.bg};display:flex;flex-direction:column;align-items:center;text-align:center;padding:34px 56px">
    ${logo ? `<img src="${logo}" style="max-height:54px;max-width:200px;object-fit:contain;margin-bottom:10px" />` : opts.venueName ? `<div style="font-family:${t.nameFont};color:${t.nameColor};font-size:22px;margin-bottom:8px">${esc(opts.venueName)}</div>` : ''}
    <div style="font-family:${t.bodyFont};color:${t.accent};font-size:13px;letter-spacing:.5em;text-transform:uppercase;margin-bottom:4px">Menu</div>
    ${head ? `<div style="font-family:${t.nameFont};font-style:italic;color:${t.guestColor};font-size:15px;margin-bottom:14px">${esc(head)}</div>` : '<div style="height:8px"></div>'}
    <div style="width:100%;text-align:center">${sectionsHTML}</div>
  </div>`

  const page = newPage('#ffffff')
  page.innerHTML = `
    <div style="position:absolute;left:0;right:0;top:0;height:50%">${cardHTML}</div>
    <div style="position:absolute;left:30px;right:30px;top:50%;border-top:1px dashed ${t.accent};opacity:.6"></div>
    <div style="position:absolute;left:0;right:0;top:50%;height:50%">${cardHTML}</div>`
  await pagesToPdf([page], 'menu.pdf')
}
