import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Shapes, Ruler, Layers, Type, Package, Link2 as LinkIcon, Copy, X } from 'lucide-react'
import { AlbumFlipbook } from '@/components/album/AlbumFlipbook'
import {
  CATEGORIES, baseModelsByCategory, baseDesignOf, baseDesignKey, materialsForModel, paletteFor, modelByKey, modelLabel,
  firstAvailableSizeKey, sizeByKey, isSizeAvailableForModel,
  coverPrice, euro, isWoodModel,
  type Cover, type ColorDef, type Format,
} from '@/components/album/albumCatalog'
import { sendAlbumToPrint, shareAlbumCommission } from '@/hooks/useAlbumLab'
import { AlbumStage } from '@/components/album/configurator/AlbumStage'
import { ModelCard } from '@/components/album/configurator/ModelCard'
import { StepNav, type StepDef } from '@/components/album/configurator/StepNav'
import { FormatPicker } from '@/components/album/configurator/FormatPicker'
import { MaterialPicker } from '@/components/album/configurator/MaterialPicker'
import { PersonalizePanel } from '@/components/album/configurator/PersonalizePanel'
import { PackagingPanel } from '@/components/album/configurator/PackagingPanel'
import { PriceBar } from '@/components/album/configurator/PriceBar'
import { Chip } from '@/components/album/configurator/ui'

// Configuratore copertina premium, mobile-first, a divulgazione progressiva:
// STAGE 3D eroe (sticky) + WIZARD a step (un focus alla volta) + PRICE BAR sticky.
// Catalogo/pricing/flusso stampa invariati: la Cover (model/fabric/colorKey/box/...)
// arriva a FotoLab via sendAlbumToPrint.

function ensureColor(materialKey: string, currentKey?: string): { color: string; colorKey: string } {
  const pal = paletteFor(materialKey)
  const found = pal.find((c) => c.key === currentKey) || pal[0]
  if (!found) return { color: '#e8d8c4', colorKey: '' }
  return { color: found.hex, colorKey: found.key }
}

const STEPS: StepDef[] = [
  { key: 'style', label: 'Stile', icon: Shapes },
  { key: 'format', label: 'Formato', icon: Ruler },
  { key: 'material', label: 'Materiale', icon: Layers },
  { key: 'personalize', label: 'Personalizza', icon: Type },
  { key: 'packaging', label: 'Confezione', icon: Package },
]

export default function CoverConfigurator() {
  const { entryId = '' } = useParams()
  const navigate = useNavigate()
  const [category, setCategory] = useState<string>('all')
  const [step, setStep] = useState(0)
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

  const models = baseModelsByCategory(category)
  const allowedMaterials = materialsForModel(cover.model)
  const palette = paletteFor(cover.fabric)
  const price = coverPrice(cover, copies)

  // --- handlers (logica invariata rispetto alla pagina precedente) ---
  function pickCategory(cat: string) {
    setCategory(cat)
    const first = baseModelsByCategory(cat)[0]
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

  // COPIA COMMISSIONE: link pubblico da dare a una stampa esterna (no login, no wetransfer/email).
  const [commOpen, setCommOpen] = useState(false)
  const [commNotes, setCommNotes] = useState('')
  const [commFileLink, setCommFileLink] = useState('')
  const [commLink, setCommLink] = useState<string | null>(null)
  const [commBusy, setCommBusy] = useState(false)
  async function genCommission() {
    setCommBusy(true)
    try {
      const url = await shareAlbumCommission(entryId, cover, copies, commNotes.trim() || null, commFileLink.trim() || null)
      setCommLink(url)
      try { await navigator.clipboard.writeText(url); toast.success('Link commissione copiato negli appunti') }
      catch { toast.success('Link commissione generato') }
    } catch (e) { toast.error(`Link non generato: ${(e as Error).message}`) }
    finally { setCommBusy(false) }
  }

  return (
    <div className="min-h-full flex flex-col">
      {flipOpen && <AlbumFlipbook cover={cover} photos={demoPhotos} onClose={() => setFlipOpen(false)} />}

      {/* COPIA COMMISSIONE: genera il link pubblico da dare alla stampa */}
      {commOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCommOpen(false)}>
          <div className="bg-[rgb(var(--bg))] w-full max-w-md rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-[rgb(var(--border))]">
              <h3 className="font-display text-lg">Link per la stampa</h3>
              <button onClick={() => setCommOpen(false)} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-[rgb(var(--fg-muted))]">Genera un link con la <strong>copia commissione</strong> (formato, pagine, copertina, box, copie — presi dall'album). La stampa lo apre senza account: niente WeTransfer né email.</p>
              <div className="rounded-lg bg-[rgb(var(--bg-sunken))] p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-[rgb(var(--fg-muted))]">Copie</span><span className="font-medium">{copies}</span></div>
                <div className="flex justify-between"><span className="text-[rgb(var(--fg-muted))]">Copertina</span><span className="font-medium truncate max-w-[60%] text-right">{cover.model ? modelLabel(cover.model) : '—'}</span></div>
                <p className="text-[11px] text-[rgb(var(--fg-subtle))] pt-1">Formato, pagine e selezione clienti sono importati dall'impaginato. Controllali nella pagina generata.</p>
              </div>
              <label className="block text-sm">
                <span className="text-[rgb(var(--fg-muted))]">Link ai file (facoltativo)</span>
                <input value={commFileLink} onChange={(e) => setCommFileLink(e.target.value)} placeholder="Drive / WeTransfer / galleria…" className="mt-1 w-full h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 text-sm" />
              </label>
              <label className="block text-sm">
                <span className="text-[rgb(var(--fg-muted))]">Note per la stampa (facoltativo)</span>
                <textarea value={commNotes} onChange={(e) => setCommNotes(e.target.value)} rows={2} placeholder="Es. finitura opaca, consegna entro…" className="mt-1 w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5 text-sm" />
              </label>

              {commLink ? (
                <div className="rounded-lg border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] p-3 space-y-2">
                  <p className="text-xs text-[rgb(var(--fg-muted))]">Link pronto (copiato negli appunti):</p>
                  <div className="flex items-center gap-2">
                    <input readOnly value={commLink} className="flex-1 h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 text-xs" onFocus={(e) => e.currentTarget.select()} />
                    <button onClick={() => { void navigator.clipboard.writeText(commLink); toast.success('Copiato') }} className="h-9 px-2.5 rounded-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg))]" title="Copia"><Copy size={14} /></button>
                    <a href={commLink} target="_blank" rel="noopener noreferrer" className="h-9 grid place-items-center px-2.5 rounded-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg))]" title="Apri"><LinkIcon size={14} /></a>
                  </div>
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Se aggiorni l'album, rigenera per allineare le specifiche (il link resta lo stesso).</p>
                </div>
              ) : (
                <button onClick={() => void genCommission()} disabled={commBusy}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-sm px-4 py-2.5 rounded-xl bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] hover:opacity-90 disabled:opacity-50">
                  <LinkIcon size={15} /> {commBusy ? 'Genero…' : 'Genera link commissione'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 pt-6 pb-4">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))] transition-colors">
          <ChevronLeft size={16} /> Indietro
        </button>
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl text-[rgb(var(--fg))]">Componi la tua copertina</h1>
            <p className="text-[rgb(var(--fg-muted))] mt-1">Scegli stile, materiale e dettagli. L'album 3D si aggiorna in tempo reale.</p>
          </div>
          <button onClick={() => { setCommLink(null); setCommOpen(true) }}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] transition-colors">
            <LinkIcon size={15} /> Link per la stampa
          </button>
        </div>

        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 lg:gap-10 items-start">
          {/* STAGE EROE — sticky su desktop, in alto su mobile */}
          <div className="lg:sticky lg:top-6">
            <AlbumStage cover={cover} onFlip={() => setFlipOpen(true)} />
          </div>

          {/* WIZARD */}
          <div className="space-y-5">
            <StepNav steps={STEPS} current={step} onJump={setStep} />

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {step === 0 && (
                  <div className="space-y-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--fg-subtle))] mb-2.5 font-medium">Categoria</p>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((c) => (
                          <Chip key={c.key} active={category === c.key} onClick={() => pickCategory(c.key)}>{c.label}</Chip>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--fg-subtle))] mb-2.5 font-medium">
                        Modello <span className="normal-case tracking-normal text-[rgb(var(--fg-muted))]">· {models.length} disponibili</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] lg:max-h-none overflow-y-auto no-scrollbar pr-0.5">
                        {models.map((m) => (
                          <ModelCard key={m.key} model={m} active={baseDesignOf(cover.model) === baseDesignKey(m)} onClick={() => pickModel(m.key)} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {step === 1 && <FormatPicker cover={cover} onPickFormat={pickFormat} onPickSize={pickSize} />}
                {step === 2 && <MaterialPicker materials={allowedMaterials} palette={palette} cover={cover} onPickMaterial={pickMaterial} onPickColor={pickColor} />}
                {step === 3 && <PersonalizePanel cover={cover} set={set} onPhoto={onPhoto} />}
                {step === 4 && <PackagingPanel cover={cover} set={set} copies={copies} setCopies={setCopies} />}
              </motion.div>
            </AnimatePresence>

            {/* nav avanti/indietro */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                className="inline-flex items-center gap-1 text-sm px-4 py-2.5 rounded-xl border border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] disabled:opacity-40 hover:text-[rgb(var(--fg))] transition-colors">
                <ChevronLeft size={16} /> Indietro
              </button>
              {step < STEPS.length - 1 ? (
                <button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  className="inline-flex items-center gap-1 text-sm px-5 py-2.5 rounded-xl bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] hover:opacity-90 active:scale-[.98] transition-all">
                  Continua <ChevronRight size={16} />
                </button>
              ) : (
                <span className="text-xs text-[rgb(var(--fg-subtle))]">Tutto pronto · controlla il totale sotto</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PREZZO STICKY — sempre visibile */}
      <PriceBar price={price} busy={busy} onSend={send} />
    </div>
  )
}
