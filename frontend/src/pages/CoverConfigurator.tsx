import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronLeft, Send, ImagePlus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlbumMockup3D } from '@/components/album/AlbumMockup3D'
import {
  CATEGORIES, BOXES, COLORS, FORMATS,
  modelsByCategory, materialsForModel, paletteFor, modelByKey,
  sizesForFormat, defaultSizeKey, sizeByKey,
  type Cover, type ColorDef, type Format,
} from '@/components/album/albumCatalog'
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
  const [category, setCategory] = useState<string>('base')
  const [cover, setCover] = useState<Cover>(() => {
    const c = ensureColor('alcantara', 'alcantara:crema')
    return { model: 'rimboccato', fabric: 'alcantara', color: c.color, colorKey: c.colorKey, box: 'nessuno', format: 'portrait', sizeKey: 'portrait:30x40', photo_url: null, title: 'Marco & Anna' }
  })
  const [copies, setCopies] = useState(1)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<Cover>) => setCover((c) => ({ ...c, ...patch }))

  const models = modelsByCategory(category)
  const allowedMaterials = materialsForModel(cover.model)
  const palette = paletteFor(cover.fabric)

  function pickCategory(cat: string) {
    setCategory(cat)
    const first = modelsByCategory(cat)[0]
    if (first) pickModel(first.key)
  }
  function pickModel(modelKey: string) {
    const allowed = materialsForModel(modelKey)
    let fabric = cover.fabric || 'alcantara'
    if (!allowed.find((m) => m.key === fabric)) fabric = allowed[0]?.key ?? 'alcantara'
    const c = ensureColor(fabric, cover.colorKey)
    set({ model: modelKey, fabric, color: c.color, colorKey: c.colorKey })
  }
  function pickMaterial(materialKey: string) {
    const c = ensureColor(materialKey, cover.colorKey)
    set({ fabric: materialKey, color: c.color, colorKey: c.colorKey })
  }
  function pickColor(c: ColorDef) { set({ color: c.hex, colorKey: c.key }) }
  function pickFormat(f: Format) { set({ format: f, sizeKey: defaultSizeKey(f) }) }
  function pickSize(key: string) { set({ sizeKey: key, format: sizeByKey(key)?.key.split(':')[0] as Format }) }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    set({ photo_url: URL.createObjectURL(f) })
  }
  async function send() {
    setBusy(true)
    try { await sendAlbumToPrint(entryId, cover, copies); toast.success('Album inviato in stampa! Lo trovi nella coda della stamperia.') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const chip = 'px-3 py-1.5 rounded-lg text-sm border transition'
  const on = 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]'
  const off = 'border-[rgb(var(--border))] hover:border-[rgb(var(--fg-subtle))]'

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4"><ChevronLeft size={16} /> Indietro</button>
        <h1 className="font-display text-3xl mb-1">Copertina & stampa</h1>
        <p className="text-[rgb(var(--fg-muted))] mb-6">Scegli categoria, modello, materiale e colore. Guarda il mockup 3D (trascina per girarlo) e invia in stampa.</p>

        <div className="grid md:grid-cols-[1fr_380px] gap-8 items-start">
          <Card className="p-4 grid place-items-center bg-gradient-to-br from-[rgb(var(--bg-sunken))] to-transparent md:sticky md:top-6">
            <AlbumMockup3D cover={cover} width={400} />
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2 text-center">{modelByKey(cover.model)?.blurb} · trascina per ruotare</p>
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
                {sizesForFormat(cover.format).map((s) => (
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
                    className={`w-9 h-9 rounded-full border-2 transition ${cover.colorKey === c.key ? 'border-[rgb(var(--gold-600))] scale-110' : 'border-white shadow'}`}
                    style={{ background: c.hex }} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Box / contenitore</p>
              <div className="flex flex-wrap gap-2">
                {BOXES.map((b) => (
                  <button key={b.key} onClick={() => set({ box: b.key })} title={b.blurb} className={`${chip} ${cover.box === b.key ? on : off}`}>{b.label}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-xs text-[rgb(var(--fg-muted))]">Personalizzato<input type="color" value={cover.color} onChange={(e) => set({ color: e.target.value, colorKey: undefined })} className="block mt-1 h-9 w-16 rounded border border-[rgb(var(--border))]" /></label>
              <label className="text-xs text-[rgb(var(--fg-muted))] flex-1">Titolo in copertina<Input value={cover.title ?? ''} onChange={(e) => set({ title: e.target.value })} className="mt-1" /></label>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Foto in copertina</p>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-[rgb(var(--border))] cursor-pointer"><ImagePlus size={15} /> Carica<input type="file" accept="image/*" className="hidden" onChange={onPhoto} /></label>
                {cover.photo_url && <button onClick={() => set({ photo_url: null })} className="text-xs text-[rgb(var(--rose-600))]">togli</button>}
              </div>
            </div>

            <label className="text-xs text-[rgb(var(--fg-muted))] block">Copie<Input type="number" min={1} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-24" /></label>
            <Button className="w-full" disabled={busy} onClick={send}><Send size={16} /> {busy ? 'Invio…' : 'Invia in stampa'}</Button>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Per la stampa la stamperia usa la selezione album e il layout; qui definisci la copertina, il box e le copie.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
