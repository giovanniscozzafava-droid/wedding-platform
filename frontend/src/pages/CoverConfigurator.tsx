import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Send, ImagePlus, BookOpen, Type, Sparkles, Palette, Square } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlbumMockup3D } from '@/components/album/AlbumMockup3D'
import { AlbumCover2DPreview } from '@/components/album/AlbumCover2DPreview'
import { AlbumFlipbook } from '@/components/album/AlbumFlipbook'
import {
  CATEGORIES, BOXES, COLORS, FORMATS,
  modelsByCategory, materialsForModel, paletteFor, modelByKey,
  sizesForFormat, firstAvailableSizeKey, sizeByKey, isSizeAvailableForModel,
  coverPrice, euro, isWoodModel, FINISHES,
  type Cover, type ColorDef, type Format,
} from '@/components/album/albumCatalog'
import {
  COVER_BORDERS, COVER_DECORATIONS, COVER_FONTS, COVER_INK_SWATCHES, COVER_TEXT_LAYOUTS,
} from '@/components/album/albumCoverPersonalization'
import { sendAlbumToPrint } from '@/hooks/useAlbumLab'

// Configuratore copertina con mockup 3D reale. Catalogo commerciale DesignAlbum:
// categoria → modello (forma+decoro), materiale (texture reale), colore (palette del
// materiale), box. La Cover (model/fabric/colorKey/box) arriva a FotoLab per la stampa.

function ensureColor(materialKey: string, currentKey?: string): { color: string; colorKey: string } {
  const pal = paletteFor(materialKey)
  const found = pal.find((c) => c.key === currentKey) || pal[0]
  if (!found) return { color: '#e8d8c4', colorKey: '' }
  return { color: found.hex, colorKey: found.key }
}

export default function CoverConfigurator() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<string>('all')
  const [cover, setCover] = useState<Cover>(() => {
    const c = ensureColor('alcantara', 'alcantara:crema')
    return {
      model: 'personalizzato-rimboccato-2-loghi', fabric: 'alcantara', color: c.color, colorKey: c.colorKey,
      box: 'nessuno', format: 'portrait', sizeKey: 'portrait:30x40', photo_url: null,
      title: 'Marco & Anna', subtitle: '23 giugno 2026', monogram: 'MA',
      fontKey: 'fraunces', textLayout: 'model', decorationKey: 'none', borderKey: 'none',
    }
  })
  const [copies, setCopies] = useState(1)
  const [busy, setBusy] = useState(false)
  const [flipOpen, setFlipOpen] = useState(false)
  const set = (patch: Partial<Cover>) => setCover((c) => ({ ...c, ...patch }))

  // foto demo per lo sfoglio (in futuro: impaginazione reale). La copertina della coppia apre la sequenza.
  const demoPhotos = [
    ...(cover.photo_url ? [cover.photo_url] : []),
    '/textures/demo/p1.jpg', '/textures/demo/p2.jpg', '/textures/demo/p3.jpg', '/textures/demo/p4.jpg',
    '/textures/demo/p5.jpg', '/textures/demo/p6.jpg', '/textures/demo/p7.jpg', '/textures/demo/p8.jpg',
  ]

  const models = modelsByCategory(category)
  const allowedMaterials = materialsForModel(cover.model)
  const palette = paletteFor(cover.fabric)
  const price = coverPrice(cover, copies)
  const toggleFinish = (k: string) => {
    const cur = cover.finishes ?? []
    set({ finishes: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] })
  }
  const pickInk = (text?: string, accent?: string) => set({ textColor: text, accentColor: accent })

  function pickCategory(cat: string) {
    setCategory(cat)
    const first = modelsByCategory(cat)[0]
    if (first) pickModel(first.key)
  }
  function pickModel(modelKey: string) {
    const allowed = materialsForModel(modelKey)
    let fabric = cover.fabric || 'alcantara'
    if (isWoodModel(modelKey)) fabric = 'wood'   // Wood Collection / Ottone → legno di default
    if (!allowed.find((m) => m.key === fabric)) fabric = allowed[0]?.key ?? 'alcantara'
    const c = ensureColor(fabric, cover.colorKey)
    const fmt = cover.format || modelByKey(modelKey)?.format || 'portrait'
    const sizeKey = isSizeAvailableForModel(modelKey, cover.sizeKey) ? cover.sizeKey : firstAvailableSizeKey(fmt, modelKey)
    set({ model: modelKey, fabric, color: c.color, colorKey: c.colorKey, sizeKey })
  }
  function pickMaterial(materialKey: string) {
    const c = ensureColor(materialKey, cover.colorKey)
    set({ fabric: materialKey, color: c.color, colorKey: c.colorKey })
  }
  function pickColor(c: ColorDef) { set({ color: c.hex, colorKey: c.key }) }
  function pickFormat(f: Format) { set({ format: f, sizeKey: firstAvailableSizeKey(f, cover.model) }) }
  function pickSize(key: string) { set({ sizeKey: key, format: sizeByKey(key)?.key.split(':')[0] as Format }) }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    set({ photo_url: URL.createObjectURL(f) })
  }
  async function send() {
    setBusy(true)
    try { await sendAlbumToPrint(entryId, cover, copies); toast.success(`Album inviato in stampa! Totale ${euro(price.total)} · in coda alla stamperia.`) }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const chip = 'px-3 py-1.5 rounded-lg text-sm border transition'
  const on = 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]'
  const off = 'border-[rgb(var(--border))] hover:border-[rgb(var(--fg-subtle))]'

  return (
    <div className="min-h-full">
      {flipOpen && <AlbumFlipbook cover={cover} photos={demoPhotos} onClose={() => setFlipOpen(false)} />}
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4"><ChevronLeft size={16} /> Indietro</button>
        <h1 className="font-display text-3xl mb-1">Copertina & stampa</h1>
        <p className="text-[rgb(var(--fg-muted))] mb-6">Scegli categoria, modello, materiale e colore. Guarda il mockup 3D (trascina per girarlo) e invia in stampa.</p>

        <div className="grid lg:grid-cols-[440px_1fr] gap-8 items-start">
          <Card className="p-4 bg-gradient-to-br from-[rgb(var(--bg-sunken))] to-transparent lg:sticky lg:top-6">
            <div className="grid gap-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Tavola 2D</p>
                  <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{sizeByKey(cover.sizeKey)?.label}</span>
                </div>
                <AlbumCover2DPreview cover={cover} width={300} />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Mockup 3D</p>
                  <span className="text-[10px] text-[rgb(var(--fg-subtle))]">drag</span>
                </div>
                <AlbumMockup3D cover={cover} width={360} />
              </div>
            </div>
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2 text-center">{modelByKey(cover.model)?.blurb}</p>
            <div className="flex flex-wrap gap-2 mt-3 justify-center">
              <Button variant="outline" onClick={() => setFlipOpen(true)}><BookOpen size={16} /> Sfoglia l'album</Button>
            </div>
          </Card>

          <div className="space-y-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Formato</p>
              <div className="grid grid-cols-3 gap-2">
                {FORMATS.map((f) => {
                  const active = cover.format === f.key
                  const ar = f.key === 'portrait' ? '3 / 4' : f.key === 'landscape' ? '4 / 3' : '1 / 1'
                  return (
                    <button key={f.key} onClick={() => pickFormat(f.key)}
                      className={`rounded-xl border p-3 flex flex-col items-center gap-2 transition ${active ? on : off}`}>
                      <span className="bg-[rgb(var(--fg-subtle))] rounded-sm" style={{ aspectRatio: ar, width: f.key === 'landscape' ? 38 : 28 }} />
                      <span className="text-sm font-medium">{f.label}</span>
                      <span className="text-[10px] text-[rgb(var(--fg-subtle))] text-center leading-tight">{f.hint}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {sizesForFormat(cover.format, cover.model).map((s) => (
                  <button key={s.key} onClick={() => pickSize(s.key)}
                    className={`px-2.5 py-1 rounded-md text-xs border transition ${cover.sizeKey === s.key ? on : off}`}>{s.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Categoria</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c.key} onClick={() => pickCategory(c.key)} className={`${chip} ${category === c.key ? on : off}`}>{c.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Modello</p>
              <div className="flex flex-wrap gap-2">
                {models.map((m) => (
                  <button key={m.key} onClick={() => pickModel(m.key)} title={m.blurb} className={`${chip} ${cover.model === m.key ? on : off}`}>{m.label}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Materiale</p>
              <div className="flex flex-wrap gap-2">
                {allowedMaterials.map((m) => (
                  <button key={m.key} onClick={() => pickMaterial(m.key)} className={`${chip} inline-flex items-center gap-2 ${cover.fabric === m.key ? on : off}`}>
                    <span className="w-3.5 h-3.5 rounded-full border border-black/15" style={{ background: m.swatch }} />{m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Colore <span className="normal-case text-[rgb(var(--fg-muted))]">· {(cover.colorKey && COLORS[cover.colorKey]?.label) || 'personalizzato'}</span></p>
              <div className="flex flex-wrap gap-2">
                {palette.map((c) => (
                  <button key={c.key} onClick={() => pickColor(c)} title={c.label}
                    className={`w-10 h-10 rounded-full border-2 transition bg-cover bg-center ${cover.colorKey === c.key ? 'border-[rgb(var(--gold-600))] scale-110 ring-2 ring-[rgb(var(--gold-300))]' : 'border-white shadow'}`}
                    style={{ backgroundColor: c.hex, backgroundImage: `url(/textures/swatches/colors/${c.key.replace(':', '__')}.jpg)` }} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Campioni reali del tessuto <span className="normal-case text-[rgb(var(--fg-muted))]">· foto vere, per non sbagliare</span></p>
              <img key={cover.fabric} src={`/textures/swatches/${cover.fabric || 'alcantara'}.jpg`} alt={`Campioni reali ${cover.fabric}`}
                loading="lazy" className="w-full max-h-72 object-contain rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))]" />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Box / contenitore</p>
              <div className="flex flex-wrap gap-2">
                {BOXES.map((b) => (
                  <button key={b.key} onClick={() => set({ box: b.key })} title={b.blurb} className={`${chip} ${cover.box === b.key ? on : off}`}>{b.label}</button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[rgb(var(--border))] p-3 space-y-3 bg-[rgb(var(--bg))]">
              <div className="flex items-center gap-2">
                <Type size={15} className="text-[rgb(var(--gold-600))]" />
                <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Personalizzazione grafica</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="text-xs text-[rgb(var(--fg-muted))] sm:col-span-2">Nomi in copertina
                  <Input value={cover.title ?? ''} onChange={(e) => set({ title: e.target.value })} className="mt-1" />
                </label>
                <label className="text-xs text-[rgb(var(--fg-muted))]">Monogramma
                  <Input value={cover.monogram ?? ''} maxLength={4} onChange={(e) => set({ monogram: e.target.value.toUpperCase() })} className="mt-1" />
                </label>
                <label className="text-xs text-[rgb(var(--fg-muted))] sm:col-span-2">Data / frase breve
                  <Input value={cover.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} placeholder="23 giugno 2026" className="mt-1" />
                </label>
                <label className="text-xs text-[rgb(var(--fg-muted))]">Colore cover libero
                  <input type="color" value={cover.color} onChange={(e) => set({ color: e.target.value, colorKey: undefined })} className="block mt-1 h-9 w-full rounded border border-[rgb(var(--border))]" />
                </label>
              </div>

              <div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1"><Type size={12} /> Font</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {COVER_FONTS.map((f) => (
                    <button key={f.key} onClick={() => set({ fontKey: f.key })}
                      className={`rounded-lg border px-2 py-2 text-left transition ${cover.fontKey === f.key ? on : off}`}>
                      <span className="block text-sm leading-tight" style={{ fontFamily: f.css }}>{f.label}</span>
                      <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{f.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Posizione testo</p>
                <div className="flex flex-wrap gap-1.5">
                  {COVER_TEXT_LAYOUTS.map((l) => (
                    <button key={l.key} onClick={() => set({ textLayout: l.key })}
                      className={`${chip} ${cover.textLayout === l.key || (!cover.textLayout && l.key === 'model') ? on : off}`}>
                      {l.label} <span className="opacity-60">{l.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1"><Sparkles size={12} /> Ghirigori</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {COVER_DECORATIONS.map((d) => (
                    <button key={d.key} onClick={() => set({ decorationKey: d.key })}
                      className={`rounded-lg border px-2 py-2 text-left transition ${cover.decorationKey === d.key || (!cover.decorationKey && d.key === 'none') ? on : off}`}>
                      <span className="block text-xs font-medium">{d.label}</span>
                      <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{d.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1"><Square size={12} /> Greche e cornici</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {COVER_BORDERS.map((b) => (
                    <button key={b.key} onClick={() => set({ borderKey: b.key })}
                      className={`rounded-lg border px-2 py-2 text-left transition ${cover.borderKey === b.key || (!cover.borderKey && b.key === 'none') ? on : off}`}>
                      <span className="block text-xs font-medium">{b.label}</span>
                      <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{b.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1"><Palette size={12} /> Colore testo / decoro</p>
                <div className="flex flex-wrap gap-1.5">
                  {COVER_INK_SWATCHES.map((s) => {
                    const active = s.text ? cover.textColor === s.text && cover.accentColor === s.accent : !cover.textColor && !cover.accentColor
                    return (
                      <button key={s.key} onClick={() => pickInk(s.text, s.accent)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs border inline-flex items-center gap-1.5 ${active ? on : off}`}>
                        <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: s.accent ?? 'linear-gradient(135deg,#fff,#222)' }} />
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Foto in copertina</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[rgb(var(--border))] cursor-pointer"><ImagePlus size={15} /> Carica<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
                {cover.photo_url && <button onClick={() => set({ photo_url: null })} className="text-xs text-[rgb(var(--rose-600))]">togli</button>}
              </div>
            </div>

            <label className="text-xs text-[rgb(var(--fg-muted))] block">Copie<Input type="number" min={1} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-24" /></label>
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Pagine & finiture</p>
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <label className="text-xs text-[rgb(var(--fg-muted))]">Interni (fogli)
                  <Input type="number" min={10} max={80} step={5} value={cover.pages ?? 40}
                    onChange={(e) => set({ pages: Math.max(10, Math.min(80, Number(e.target.value) || 40)) })} className="mt-1 w-20" /></label>
                <div className="flex gap-1 self-end">
                  <button onClick={() => set({ blockType: 'photo' })} className={`${chip} ${(cover.blockType ?? 'photo') === 'photo' ? on : off}`}>Stampa foto</button>
                  <button onClick={() => set({ blockType: 'bookflat' })} className={`${chip} ${cover.blockType === 'bookflat' ? on : off}`}>Book flat</button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input type="checkbox" checked={!!cover.parents} onChange={(e) => set({ parents: e.target.checked })} /> Album genitori (2 mini)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FINISHES.map((f) => (
                  <button key={f.key} onClick={() => toggleFinish(f.key)} title={`+ ${euro(f.amount)}`}
                    className={`${chip} ${(cover.finishes ?? []).includes(f.key) ? on : off}`}>{f.label} <span className="opacity-60">+{f.amount}</span></button>
                ))}
              </div>
            </div>

            <Card className="p-3 bg-[rgb(var(--bg-sunken))]">
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Prezzo finale</p>
              <div className="space-y-1">
                {price.lines.map((l, i) => (
                  <div key={i} className="flex justify-between text-sm gap-3">
                    <span className="text-[rgb(var(--fg-muted))]">{l.label}</span>
                    <span className="whitespace-nowrap">{euro(l.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-[rgb(var(--border))]">
                <span className="text-sm font-medium">Totale{price.copies > 1 ? ` · ${price.copies} copie` : ''}</span>
                <span className="font-display text-2xl">{euro(price.total)}</span>
              </div>
              <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">Prezzi indicativi · IVA inclusa</p>
            </Card>
            <Button className="w-full" disabled={busy} onClick={send}><Send size={16} /> {busy ? 'Invio…' : `Invia in stampa · ${euro(price.total)}`}</Button>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Per la stampa la stamperia usa la selezione album e il layout; qui definisci la copertina, il box e le copie.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
