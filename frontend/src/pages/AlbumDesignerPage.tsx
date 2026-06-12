import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Wand2, Save, Plus, Trash2, ChevronLeft, ChevronRight, Heart, Loader2, LayoutGrid, FileImage, FileText, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ALBUM_FORMATS, DEFAULT_FORMAT, getFormat, pageAspect } from '@/lib/albumFormats'
import { MOMENTS, getMoment, ALBUM_MIN_PHOTOS, ALBUM_MAX_PHOTOS } from '@/lib/albumMoments'
import { autoLayout, framesForPage, newPage, templatesFor, capacity, MAX_PER_PAGE, type AlbumPage, type TemplateKey } from '@/lib/albumEngine'
import { exportAlbumPdf, exportAlbumJpgZip, hiResProxyUrl } from '@/lib/albumExport'
import { cellBackground, slotAspectOf, cellToCrop, cropToCell, CROP_ANCHORS, DEFAULT_CELL, MARGIN_MM, type Cell } from '@/lib/albumGeometry'
import { placeInPage, clearSlotInPage, setCell, setPageTemplate, movePages, insertPageAfter, removePage } from '@/lib/albumOps'
import { albumRoleOf, primaryAction, statusLabel } from '@/lib/albumWorkflow'
import { Crop, Maximize, Grid3x3, Frame, Scissors } from 'lucide-react'

type M = {
  id: string; drive_file_id: string; thumbnail_link: string | null
  media_type: 'PHOTO' | 'VIDEO'; guest_tag_name: string | null
  album_choice: 'KEPT' | 'DISCARDED' | null; album_moment: string | null
}

const isDrive = (m: M) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:')
const thumbUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w800` : (m.thumbnail_link ?? ''))
const hiUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

export default function AlbumDesignerPage() {
  const { entryId } = useParams<{ entryId: string }>()
  const { profile } = useAuth()
  const isCouple = profile?.role === 'COUPLE'

  const [media, setMedia] = useState<M[]>([])
  const [format, setFormat] = useState<string>(DEFAULT_FORMAT)
  const [status, setStatus] = useState<string>('DRAFT')
  const [pages, setPages] = useState<AlbumPage[]>([])
  const [title, setTitle] = useState('')
  const [step, setStep] = useState<'select' | 'design'>('select')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activePage, setActivePage] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [bleed, setBleed] = useState(false)            // abbondanza per la stampa
  const [aspects, setAspects] = useState<Record<string, number>>({}) // aspetto naturale per crop
  const [currentPageId, setCurrentPageId] = useState<string | null>(null) // pagina aperta nel canvas grande
  const [gridOn, setGridOn] = useState(false)          // griglia stile Photoshop
  const [marginsOn, setMarginsOn] = useState(true)     // guide margini
  const [cropFor, setCropFor] = useState<number | null>(null) // slot in ritaglio

  const role = albumRoleOf(profile?.role)
  const action = primaryAction(role, status as never)

  const mediaById = useMemo(() => new Map(media.map((m) => [m.id, m])), [media])
  const photos = useMemo(() => media.filter((m) => m.media_type === 'PHOTO'), [media])
  const kept = useMemo(() => photos.filter((m) => m.album_choice === 'KEPT'), [photos])

  const load = useCallback(async () => {
    if (!entryId) return
    setLoading(true)
    const [{ data: proj }, { data: med }, { data: ent }] = await Promise.all([
      (supabase.from as any)('album_projects').select('format_key, status, layout').eq('entry_id', entryId).maybeSingle(),
      (supabase.from as any)('gallery_media').select('id, drive_file_id, thumbnail_link, media_type, guest_tag_name, album_choice, album_moment').eq('entry_id', entryId),
      (supabase.from as any)('calendar_entries').select('title').eq('id', entryId).maybeSingle(),
    ])
    setMedia((med as M[]) ?? [])
    setTitle((ent as { title?: string } | null)?.title ?? 'Album')
    if (proj) {
      setFormat((proj as any).format_key ?? DEFAULT_FORMAT)
      setStatus((proj as any).status ?? 'DRAFT')
      const lay = (proj as any).layout as { pages?: AlbumPage[]; bleed?: boolean } | null
      if (typeof lay?.bleed === 'boolean') setBleed(lay.bleed)
      if (lay?.pages?.length) { setPages(lay.pages); setStep('design') }
    }
    setLoading(false)
  }, [entryId])
  useEffect(() => { void load() }, [load])

  // Misura l'aspetto naturale delle foto KEPT (serve al crop fedele in anteprima).
  useEffect(() => {
    for (const m of kept) {
      if (aspects[m.id]) continue
      const url = m.thumbnail_link && !m.drive_file_id.startsWith('demo-') ? thumbUrl(m) : (m.thumbnail_link ?? thumbUrl(m))
      if (!url) continue
      const img = new Image()
      img.onload = () => setAspects((a) => (a[m.id] ? a : { ...a, [m.id]: img.naturalWidth / Math.max(1, img.naturalHeight) }))
      img.src = url
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kept])

  // Pagina aperta nel canvas grande: default alla prima, sempre valida.
  useEffect(() => {
    if (step !== 'design') return
    if (currentPageId && pages.some((p) => p.id === currentPageId)) return
    setCurrentPageId(pages[0]?.id ?? null)
  }, [step, pages, currentPageId])

  // ── selezione guidata ──────────────────────────────────────────────────────
  async function toggleKeep(m: M) {
    const next = m.album_choice === 'KEPT' ? 'DISCARDED' : 'KEPT'
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_choice: next } : x)))
    await (supabase.rpc as any)('set_album_choice', { p_media: m.id, p_choice: next })
  }
  async function setMoment(m: M, moment: string) {
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_moment: moment || null } : x)))
    await (supabase.rpc as any)('album_set_moments', { p_items: [{ id: m.id, moment }] })
  }

  const perMoment = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of kept) { const k = m.album_moment ?? '_'; map.set(k, (map.get(k) ?? 0) + 1) }
    return map
  }, [kept])
  const missingMin = MOMENTS.filter((mm) => (perMoment.get(mm.key) ?? 0) < mm.min)
  const untagged = kept.filter((m) => !m.album_moment).length
  const total = kept.length
  const okRange = total >= ALBUM_MIN_PHOTOS && total <= ALBUM_MAX_PHOTOS

  function generate() {
    const sel = kept.map((m) => ({ id: m.id, moment: m.album_moment }))
    if (sel.length === 0) { toast.error('Seleziona prima le foto'); return }
    setPages(autoLayout(sel, format).pages)
    setStep('design')
    toast.success('Impaginazione generata — ora puoi rifinirla')
  }

  // ── editor pagine ───────────────────────────────────────────────────────────
  const placedIds = useMemo(() => new Set(pages.flatMap((p) => p.mediaIds)), [pages])
  const trayMedia = kept // mostra tutte le KEPT; le già piazzate appaiono attenuate

  function updatePage(id: string, fn: (p: AlbumPage) => AlbumPage) {
    setPages((arr) => arr.map((p) => (p.id === id ? fn(p) : p)))
  }
  function placeInto(pageId: string, slot: number | null, mediaId: string) { updatePage(pageId, (p) => placeInPage(p, slot, mediaId)) }
  function clearSlot(pageId: string, slot: number) { updatePage(pageId, (p) => clearSlotInPage(p, slot)) }
  function updateCell(pageId: string, slot: number, partial: Partial<Cell>) { updatePage(pageId, (p) => setCell(p, slot, partial)) }
  function setTemplate(pageId: string, t: TemplateKey) { updatePage(pageId, (p) => setPageTemplate(p, t)) }
  function delPage(id: string) { setPages((a) => removePage(a, id)); if (activePage === id) setActivePage(null) }
  function addPageAfter(id: string | null) {
    const np = newPage()
    setPages((a) => insertPageAfter(a, id, () => np))
    setActivePage(np.id)
  }
  function movePage(id: string, dir: -1 | 1) { setPages((a) => movePages(a, id, dir)) }

  async function save(nextStatus?: string) {
    if (!entryId) return
    setBusy(true)
    try {
      const st = nextStatus ?? status
      const { data, error } = await (supabase.rpc as any)('album_project_save', {
        p_entry: entryId, p_gallery: null, p_format: format, p_status: st, p_layout: { pages, bleed },
      })
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message ?? 'errore')
      if (nextStatus) setStatus(nextStatus)
      toast.success('Album salvato')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  const exportRef = useRef<HTMLDivElement>(null)
  async function doExport(kind: 'pdf' | 'spread' | 'jpg') {
    if (pages.length === 0) { toast.error('Nessuna pagina da esportare'); return }
    setExporting(true)
    try {
      // Alta risoluzione: chiediamo un "grant" e tiriamo l'ORIGINALE da Drive via proxy
      // (in app si lavora a bassa qualità; in export si stampa in alta). Fallback ai thumbnail.
      let grant: string | null = null
      try { const { data } = await (supabase.rpc as any)('album_export_grant', { p_entry: entryId }); grant = (data as string) ?? null } catch { grant = null }
      const SB = import.meta.env.VITE_SUPABASE_URL
      const AK = import.meta.env.VITE_SUPABASE_ANON_KEY
      const resolve = (id: string) => {
        const m = mediaById.get(id); if (!m) return ''
        if (grant && isDrive(m)) return hiResProxyUrl(SB, AK, grant, id)
        return hiUrl(m)
      }
      const base = (title || 'album').toLowerCase().replace(/\s+/g, '-')
      // con l'originale Drive possiamo stampare in alta: 300 dpi per le pagine, 220 per JPG/spread
      if (kind === 'jpg') await exportAlbumJpgZip(pages, format, resolve, { filename: `${base}-jpg.zip`, dpi: 220 })
      else await exportAlbumPdf(pages, format, resolve, { mode: kind === 'spread' ? 'spreads' : 'pages', filename: `${base}-${kind === 'spread' ? 'spread' : 'pagine'}.pdf`, bleed: kind === 'pdf' && bleed, dpi: kind === 'spread' ? 150 : 300 })
      toast.success('Export pronto')
    } catch (e) { toast.error('Export non riuscito: ' + (e as Error).message) } finally { setExporting(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  const asp = pageAspect(format)
  const fmt = getFormat(format)
  const currentPage = pages.find((p) => p.id === currentPageId) ?? null

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-sunken))]">
      {/* header */}
      <div className="sticky top-0 z-20 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link to={`/weddings/${entryId}`} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="font-display text-lg truncate">Impaginatore — {title}</h1>
            <p className="text-[11px] text-[rgb(var(--fg-muted))]">{isCouple ? 'Costruisci la tua bozza, poi inviala al fotografo' : 'Bozza album, rifinibile pagina per pagina'} · {status}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5">
              {ALBUM_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <div className="hidden sm:flex rounded-lg border border-[rgb(var(--border))] overflow-hidden">
              <button onClick={() => setStep('select')} className={`px-3 py-1.5 text-xs ${step === 'select' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>1 · Selezione</button>
              <button onClick={() => setStep('design')} className={`px-3 py-1.5 text-xs ${step === 'design' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>2 · Impagina</button>
            </div>
          </div>
        </div>
      </div>

      {step === 'select' ? (
        <div className="max-w-7xl mx-auto px-4 py-5">
          <SelectStep
            photos={photos} kept={kept} total={total} okRange={okRange} untagged={untagged}
            missingMin={missingMin} perMoment={perMoment}
            onToggle={toggleKeep} onMoment={setMoment} onGenerate={generate} thumb={thumbUrl}
          />
        </div>
      ) : (
        <>
          {/* barra strumenti impaginatore */}
          <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
            <Button variant="gold" size="sm" disabled={busy} onClick={() => setPages(autoLayout(kept.map((m) => ({ id: m.id, moment: m.album_moment })), format).pages)}><Wand2 size={14} /> Auto-impagina</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void save()}><Save size={14} /> Salva</Button>
            <div className="h-5 w-px bg-[rgb(var(--border))] mx-0.5" />
            <ToolToggle on={gridOn} onClick={() => setGridOn((v) => !v)} icon={<Grid3x3 size={14} />} label="Griglia" />
            <ToolToggle on={marginsOn} onClick={() => setMarginsOn((v) => !v)} icon={<Frame size={14} />} label="Margini" />
            <ToolToggle on={bleed} onClick={() => setBleed((v) => !v)} icon={<Scissors size={14} />} label="Abbondanza" />
            <div className="h-5 w-px bg-[rgb(var(--border))] mx-0.5" />
            <Button variant="outline" size="sm" disabled={exporting} onClick={() => void doExport('pdf')}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF</Button>
            <Button variant="outline" size="sm" disabled={exporting} onClick={() => void doExport('spread')}><LayoutGrid size={14} /> Spread</Button>
            <Button variant="outline" size="sm" disabled={exporting} onClick={() => void doExport('jpg')}><FileImage size={14} /> JPG</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void save(action.next)}>{action.label}</Button>
            <span className="text-xs text-[rgb(var(--fg-muted))] ml-auto">{pages.length} pag · {fmt.label} · <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-sunken))]">{statusLabel(status)}</span></span>
          </div>

          {/* workspace a 3 colonne + filmstrip */}
          <div className="flex h-[calc(100vh-104px)]">
            {/* foto */}
            <aside className="w-40 shrink-0 border-r border-[rgb(var(--border))] overflow-auto p-2">
              <p className="text-[11px] font-medium mb-1.5 text-[rgb(var(--fg-muted))]">Foto ({kept.length})</p>
              <div className="grid grid-cols-2 gap-1.5">
                {trayMedia.map((m) => (
                  <button key={m.id}
                    draggable onDragStart={(e) => e.dataTransfer.setData('text/media', m.id)}
                    onClick={() => { if (currentPageId) placeInto(currentPageId, activeSlot, m.id) }}
                    title={getMoment(m.album_moment)?.label ?? 'senza momento'}
                    className={`relative aspect-square rounded overflow-hidden border ${placedIds.has(m.id) ? 'opacity-40' : ''} border-[rgb(var(--border))]`}>
                    <img src={thumbUrl(m)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </aside>

            {/* canvas + filmstrip */}
            <main className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 min-h-0 flex items-center justify-center p-5 overflow-auto bg-[rgb(var(--bg-sunken))]">
                {currentPage ? (
                  <PageStage
                    page={currentPage} formatKey={format} bleed={bleed} gridOn={gridOn} marginsOn={marginsOn}
                    aspects={aspects} mediaById={mediaById} thumb={thumbUrl} activeSlot={activeSlot}
                    onSlot={setActiveSlot}
                    onDropMedia={(s, id) => placeInto(currentPage.id, s, id)}
                    onClearSlot={(s) => clearSlot(currentPage.id, s)}
                    onCell={(s, partial) => updateCell(currentPage.id, s, partial)}
                    onCrop={(s) => setCropFor(s)}
                  />
                ) : (
                  <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">
                    Nessuna pagina. Premi <strong>Auto-impagina</strong> o aggiungi una pagina.
                    <div className="mt-3"><Button variant="outline" size="sm" onClick={() => addPageAfter(null)}><Plus size={14} /> Pagina vuota</Button></div>
                  </Card>
                )}
              </div>
              {/* filmstrip pagine */}
              <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 flex items-center gap-2 overflow-x-auto">
                {pages.map((p, idx) => (
                  <PageThumb key={p.id} page={p} index={idx} aspect={asp} active={p.id === currentPageId}
                    mediaById={mediaById} thumb={thumbUrl} formatKey={format} aspects={aspects}
                    onSelect={() => { setCurrentPageId(p.id); setActiveSlot(null) }}
                    onMove={(d) => movePage(p.id, d)} onDelete={() => delPage(p.id)} />
                ))}
                <button onClick={() => addPageAfter(currentPageId)} className="shrink-0 h-16 w-16 rounded-lg border-2 border-dashed border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center" title="Aggiungi pagina"><Plus size={16} /></button>
              </div>
            </main>

            {/* pannello proprietà */}
            <aside className="w-56 shrink-0 border-l border-[rgb(var(--border))] overflow-auto p-3">
              {currentPage && (
                <PropsPanel
                  page={currentPage} activeSlot={activeSlot} mediaById={mediaById} formatKey={format} aspects={aspects}
                  onTemplate={(t) => setTemplate(currentPage.id, t)}
                  onCell={(s, partial) => updateCell(currentPage.id, s, partial)}
                  onClearSlot={(s) => { clearSlot(currentPage.id, s); setActiveSlot(null) }}
                  onCrop={(s) => setCropFor(s)}
                  onAddPage={() => addPageAfter(currentPage.id)} onDelPage={() => delPage(currentPage.id)}
                />
              )}
            </aside>
          </div>

          {/* Strumento RITAGLIO: vedi tutta la foto e scegli il rettangolo */}
          {currentPage && cropFor != null && (() => {
            const fr = framesForPage(currentPage)[cropFor]
            const mid = currentPage.mediaIds[cropFor]
            const m = mid ? mediaById.get(mid) : undefined
            if (!fr || !m) return null
            return (
              <CropModal
                src={hiUrl(m)} imgAspect={aspects[m.id] ?? 1.5} slotAspect={slotAspectOf(fr, fmt.w, fmt.h)}
                cell={currentPage.cells?.[cropFor] ?? DEFAULT_CELL}
                onApply={(c) => { updateCell(currentPage.id, cropFor, c); setCropFor(null) }}
                onClose={() => setCropFor(null)}
              />
            )
          })()}
        </>
      )}
      <div ref={exportRef} className="sr-only" aria-hidden />
    </div>
  )
}

// ── step 1: selezione guidata ────────────────────────────────────────────────
function SelectStep(props: {
  photos: M[]; kept: M[]; total: number; okRange: boolean; untagged: number
  missingMin: typeof MOMENTS; perMoment: Map<string, number>
  onToggle: (m: M) => void; onMoment: (m: M, moment: string) => void; onGenerate: () => void; thumb: (m: M) => string
}) {
  const { photos, total, okRange, untagged, missingMin, perMoment, onToggle, onMoment, onGenerate, thumb } = props
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5">
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((m) => {
            const keptOn = m.album_choice === 'KEPT'
            return (
              <Card key={m.id} className={`overflow-hidden ${keptOn ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`}>
                <button onClick={() => onToggle(m)} className="relative block w-full aspect-square">
                  <img src={thumb(m)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <span className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center ${keptOn ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-black/40 text-white'}`}><Heart size={13} className={keptOn ? 'fill-current' : ''} /></span>
                </button>
                <select value={m.album_moment ?? ''} onChange={(e) => onMoment(m, e.target.value)} disabled={!keptOn}
                  className="w-full text-xs px-2 py-1.5 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] disabled:opacity-50">
                  <option value="">— momento —</option>
                  {MOMENTS.map((mm) => <option key={mm.key} value={mm.key}>{mm.label}</option>)}
                </select>
              </Card>
            )
          })}
        </div>
        {photos.length === 0 && <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessuna foto nella galleria. Caricale dalla scheda Foto.</Card>}
      </div>

      {/* riepilogo selezione */}
      <div className="lg:sticky lg:top-20 self-start space-y-3">
        <Card className="p-4">
          <p className="text-sm font-medium">Selezione album</p>
          <p className={`text-3xl font-display mt-1 ${okRange ? 'text-[rgb(var(--emerald-600))]' : 'text-[rgb(var(--fg))]'}`}>{total}<span className="text-base text-[rgb(var(--fg-muted))]"> / {ALBUM_MIN_PHOTOS}–{ALBUM_MAX_PHOTOS}</span></p>
          <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">{total < ALBUM_MIN_PHOTOS ? `Aggiungi almeno ${ALBUM_MIN_PHOTOS - total} foto` : total > ALBUM_MAX_PHOTOS ? `Togli ${total - ALBUM_MAX_PHOTOS} foto` : 'Numero perfetto ✓'}</p>
          {untagged > 0 && <p className="text-[11px] text-amber-600 mt-1">{untagged} foto senza momento</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium mb-2">Minimi per momento</p>
          <ul className="space-y-1.5">
            {MOMENTS.map((mm) => {
              const n = perMoment.get(mm.key) ?? 0; const ok = n >= mm.min
              return (
                <li key={mm.key} className="flex items-center justify-between text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${mm.color}`}>{mm.label}</span>
                  <span className={ok ? 'text-[rgb(var(--emerald-600))]' : 'text-[rgb(var(--fg-muted))]'}>{n}/{mm.min}</span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Button variant="gold" className="w-full" disabled={total === 0} onClick={onGenerate}><Wand2 size={15} /> Genera impaginazione</Button>
        {!okRange && total > 0 && <p className="text-[11px] text-center text-[rgb(var(--fg-muted))]">Puoi generare comunque: l'ideale è {ALBUM_MIN_PHOTOS}–{ALBUM_MAX_PHOTOS}{missingMin.length ? `, mancano minimi: ${missingMin.map((x) => x.label).join(', ')}` : ''}.</p>}
      </div>
    </div>
  )
}

// ── elementi del workspace ───────────────────────────────────────────────────
const TPL_LABEL: Record<TemplateKey, string> = { '1': '1', '2h': '2 │', '2v': '2 ─', '3l': '3 ◧', '3t': '3 ⊟', '4': '4 ⊞', grid: 'griglia' }
function clampN(v: number) { return Math.min(1, Math.max(0, v)) }

function ToolToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={onClick} title={label}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${on ? 'bg-[rgb(var(--gold-100))] border-[rgb(var(--gold-300))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'}`}>
      {icon} {label}
    </button>
  )
}

// Canvas grande: una pagina, con modifica libera della foto (drag = sposta, rotella/zoom = scala),
// griglia stile Photoshop, guide margini e abbondanza.
function PageStage(props: {
  page: AlbumPage; formatKey: string; bleed: boolean; gridOn: boolean; marginsOn: boolean
  aspects: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string; activeSlot: number | null
  onSlot: (s: number | null) => void; onDropMedia: (s: number, id: string) => void
  onClearSlot: (s: number) => void; onCell: (s: number, partial: Partial<Cell>) => void; onCrop: (s: number) => void
}) {
  const { page, formatKey, bleed, gridOn, marginsOn, aspects, mediaById, thumb, activeSlot, onSlot, onDropMedia, onClearSlot, onCell, onCrop } = props
  const fmt = getFormat(formatKey)
  const aspect = fmt.w / fmt.h
  const frames = framesForPage(page)
  const drag = useRef<{ slot: number; x: number; y: number; cell: Cell } | null>(null)
  const mx = (MARGIN_MM / fmt.w) * 100, my = (MARGIN_MM / fmt.h) * 100

  function startPan(e: React.PointerEvent, i: number, cell: Cell) {
    e.stopPropagation(); drag.current = { slot: i, x: e.clientX, y: e.clientY, cell }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function movePan(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dx = (e.clientX - d.x) / Math.max(1, box.width)
    const dy = (e.clientY - d.y) / Math.max(1, box.height)
    onCell(d.slot, { fx: clampN(d.cell.fx - dx * 0.9), fy: clampN(d.cell.fy - dy * 0.9) })
  }
  function endPan() { drag.current = null }

  return (
    <div className="relative bg-white shadow-[var(--shadow-lift)] h-full max-h-full max-w-full" style={{ aspectRatio: String(aspect) }} onClick={() => onSlot(null)}>
      {frames.map((fr, i) => {
        const id = page.mediaIds[i]; const m = id ? mediaById.get(id) : undefined
        const sel = activeSlot === i
        const cell = page.cells?.[i] ?? DEFAULT_CELL
        const slotAsp = slotAspectOf(fr, fmt.w, fmt.h)
        const imgAsp = (m && aspects[m.id]) ? aspects[m.id]! : 1.5
        const bg = m ? cellBackground(imgAsp, slotAsp, cell) : null
        return (
          <div key={i}
            onClick={(e) => { e.stopPropagation(); onSlot(i) }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const mid = e.dataTransfer.getData('text/media'); if (mid) onDropMedia(i, mid) }}
            onWheel={(e) => { if (!m) return; e.preventDefault(); const nz = Math.min(4, Math.max(1, +(cell.z + (e.deltaY < 0 ? 0.12 : -0.12)).toFixed(2))); onCell(i, { z: nz }) }}
            className={`absolute overflow-hidden ${sel ? 'outline outline-2 outline-[rgb(var(--gold-500))] z-10' : 'outline outline-1 outline-black/5'}`}
            style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%`, padding: '1px' }}>
            {m && bg ? (
              <div className="relative w-full h-full">
                <div onPointerDown={(e) => startPan(e, i, cell)} onPointerMove={movePan} onPointerUp={endPan} onPointerLeave={endPan}
                  className="w-full h-full touch-none cursor-move" style={{ backgroundImage: `url(${thumb(m)})`, ...bg }} />
                {sel && (
                  <>
                    <span className="absolute -top-px -left-px h-2 w-2 border-t-2 border-l-2 border-[rgb(var(--gold-500))]" />
                    <span className="absolute -top-px -right-px h-2 w-2 border-t-2 border-r-2 border-[rgb(var(--gold-500))]" />
                    <span className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2 border-[rgb(var(--gold-500))]" />
                    <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-[rgb(var(--gold-500))]" />
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button title="Ritaglia" onClick={(e) => { e.stopPropagation(); onCrop(i) }} className="h-6 w-6 rounded-full bg-black/55 text-white flex items-center justify-center"><Crop size={12} /></button>
                      <button title="Togli foto" onClick={(e) => { e.stopPropagation(); onClearSlot(i) }} className="h-6 w-6 rounded-full bg-black/55 text-white flex items-center justify-center"><Trash2 size={12} /></button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-[rgb(var(--bg-sunken))] flex items-center justify-center text-[11px] text-[rgb(var(--fg-subtle))]">trascina una foto</div>
            )}
          </div>
        )
      })}

      {/* guide margini */}
      {marginsOn && <div className="absolute border border-dashed border-sky-400/70 pointer-events-none" style={{ left: `${mx}%`, right: `${mx}%`, top: `${my}%`, bottom: `${my}%` }} title="Area di sicurezza (margini)" />}
      {/* abbondanza: bordo di taglio */}
      {bleed && <div className="absolute inset-0 border-2 border-rose-400/70 pointer-events-none" title="Linea di taglio (abbondanza attiva)" />}
      {/* griglia stile Photoshop: terzi + reticolo fine */}
      {gridOn && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.08) 1px, transparent 1px)', backgroundSize: '12.5% 12.5%' }} />
          <div className="absolute top-0 bottom-0 border-l border-[rgba(0,120,255,.5)]" style={{ left: '33.33%' }} />
          <div className="absolute top-0 bottom-0 border-l border-[rgba(0,120,255,.5)]" style={{ left: '66.66%' }} />
          <div className="absolute left-0 right-0 border-t border-[rgba(0,120,255,.5)]" style={{ top: '33.33%' }} />
          <div className="absolute left-0 right-0 border-t border-[rgba(0,120,255,.5)]" style={{ top: '66.66%' }} />
        </div>
      )}
    </div>
  )
}

// Miniatura nella filmstrip in basso.
function PageThumb(props: {
  page: AlbumPage; index: number; aspect: number; active: boolean; formatKey: string
  aspects: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string
  onSelect: () => void; onMove: (d: -1 | 1) => void; onDelete: () => void
}) {
  const { page, index, aspect, active, formatKey, aspects, mediaById, thumb, onSelect, onMove, onDelete } = props
  const fmt = getFormat(formatKey)
  const frames = framesForPage(page)
  return (
    <div className="shrink-0 group relative">
      <button onClick={onSelect} className={`relative block h-16 bg-white border ${active ? 'ring-2 ring-[rgb(var(--gold-500))] border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ aspectRatio: String(aspect) }}>
        {frames.map((fr, i) => {
          const id = page.mediaIds[i]; const m = id ? mediaById.get(id) : undefined
          const cell = page.cells?.[i] ?? DEFAULT_CELL
          const bg = m ? cellBackground((m && aspects[m.id]) ? aspects[m.id]! : 1.5, slotAspectOf(fr, fmt.w, fmt.h), cell) : null
          return <div key={i} className="absolute bg-[rgb(var(--bg-sunken))]" style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%`, ...(bg ? { backgroundImage: `url(${m ? thumb(m) : ''})`, ...bg } : {}) }} />
        })}
      </button>
      <span className="absolute -top-1.5 left-1 text-[9px] bg-black/60 text-white rounded px-1">{index + 1}</span>
      <div className="absolute inset-x-0 -bottom-1 hidden group-hover:flex items-center justify-center gap-0.5">
        <button title="Indietro" className="h-4 w-4 rounded bg-[rgb(var(--bg))] border border-[rgb(var(--border))] flex items-center justify-center" onClick={onMove.bind(null, -1)}><ChevronLeft size={10} /></button>
        <button title="Elimina" className="h-4 w-4 rounded bg-[rgb(var(--bg))] border border-[rgb(var(--border))] flex items-center justify-center text-rose-500" onClick={onDelete}><Trash2 size={9} /></button>
        <button title="Avanti" className="h-4 w-4 rounded bg-[rgb(var(--bg))] border border-[rgb(var(--border))] flex items-center justify-center" onClick={onMove.bind(null, 1)}><ChevronRight size={10} /></button>
      </div>
    </div>
  )
}

// Pannello proprietà a destra: foto selezionata (crop/zoom) + strumenti pagina.
// piccolo diagramma di un layout (precomposizione)
function LayoutDiagram({ t, active }: { t: TemplateKey; active: boolean }) {
  const n = t === 'grid' ? 6 : Math.max(1, capacity(t))
  const fr = framesForPage({ id: 'x', moment: null, template: t, mediaIds: Array.from({ length: n }, (_, i) => `s${i}`) })
  return (
    <div className={`relative h-10 w-12 rounded border ${active ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'} bg-white`}>
      {fr.map((f, i) => <div key={i} className="absolute bg-[rgb(var(--gold-200))]" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`, outline: '1px solid white' }} />)}
    </div>
  )
}

function PropsPanel(props: {
  page: AlbumPage; activeSlot: number | null; mediaById: Map<string, M>; formatKey: string; aspects: Record<string, number>
  onTemplate: (t: TemplateKey) => void; onCell: (s: number, partial: Partial<Cell>) => void
  onClearSlot: (s: number) => void; onCrop: (s: number) => void; onAddPage: () => void; onDelPage: () => void
}) {
  const { page, activeSlot, mediaById, onTemplate, onCell, onClearSlot, onCrop, onAddPage, onDelPage } = props
  const moment = getMoment(page.moment)
  const alts = templatesFor(Math.max(1, page.mediaIds.length))
  const slotMediaId = activeSlot != null ? page.mediaIds[activeSlot] : undefined
  const slotMedia = slotMediaId ? mediaById.get(slotMediaId) : undefined
  const cell = activeSlot != null ? (page.cells?.[activeSlot] ?? DEFAULT_CELL) : DEFAULT_CELL
  const anchorGrid: Array<[string, string]> = [['tl', '↖'], ['tc', '↑'], ['tr', '↗'], ['cl', '←'], ['cc', '•'], ['cr', '→'], ['bl', '↙'], ['bc', '↓'], ['br', '↘']]
  return (
    <div className="space-y-4 text-sm">
      {slotMedia ? (
        <div>
          <p className="font-medium flex items-center gap-1.5 mb-2"><Crop size={14} /> Foto</p>
          <img src={slotMedia.thumbnail_link ?? ''} alt="" className="w-full rounded-lg mb-2 object-cover max-h-28" />
          <Button variant="gold" size="sm" className="w-full mb-2" onClick={() => onCrop(activeSlot!)}><Crop size={14} /> Ritaglia foto</Button>
          <label className="text-xs text-[rgb(var(--fg-muted))]">Zoom <strong>{Math.round(cell.z * 100)}%</strong></label>
          <input type="range" min={100} max={400} value={Math.round(cell.z * 100)} onChange={(e) => onCell(activeSlot!, { z: +e.target.value / 100 })} className="w-full accent-[rgb(var(--gold-600))]" />
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-2 mb-1">Allinea nello slot</p>
          <div className="grid grid-cols-3 gap-1 w-24">
            {anchorGrid.map(([k, sym]) => (
              <button key={k} title="allinea" onClick={() => onCell(activeSlot!, CROP_ANCHORS[k] ?? {})}
                className="h-6 rounded border border-[rgb(var(--border))] text-[11px] hover:bg-[rgb(var(--bg-sunken))]">{sym}</button>
            ))}
          </div>
          <div className="flex gap-1.5 mt-3">
            <Button variant="outline" size="sm" onClick={() => onCell(activeSlot!, { z: 1, fx: 0.5, fy: 0.5 })}><Maximize size={13} /> Riempi</Button>
            <Button variant="outline" size="sm" onClick={() => onClearSlot(activeSlot!)}><Trash2 size={13} /> Togli</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--fg-subtle))]">Seleziona una foto: poi <strong>Ritaglia</strong>, sposta, zooma o allinea.</p>
      )}

      <div className="border-t border-[rgb(var(--border))] pt-3">
        <p className="font-medium mb-2 flex items-center gap-1.5"><LayoutGrid size={14} /> Layout pagina {moment && <span className={`text-[10px] px-1.5 py-0.5 rounded ${moment.color}`}>{moment.label}</span>}</p>
        <p className="text-xs text-[rgb(var(--fg-muted))] mb-1.5">Precomposizioni ({page.mediaIds.length || 1} foto)</p>
        <div className="flex flex-wrap gap-1.5">
          {alts.map((t) => <button key={t} title={TPL_LABEL[t]} onClick={() => onTemplate(t)}><LayoutDiagram t={t} active={page.template === t} /></button>)}
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">{page.mediaIds.length}/{MAX_PER_PAGE} foto in pagina</p>
        <div className="flex gap-1.5 mt-3">
          <Button variant="outline" size="sm" onClick={onAddPage}><Plus size={13} /> Pagina</Button>
          <Button variant="outline" size="sm" className="text-rose-500" onClick={onDelPage}><Trash2 size={13} /> Elimina</Button>
        </div>
      </div>
    </div>
  )
}

// ── Modale RITAGLIO: vedi tutta la foto + rettangolo di crop (sposta/ridimensiona) ──
function CropModal(props: { src: string; imgAspect: number; slotAspect: number; cell: Cell; onApply: (c: Cell) => void; onClose: () => void }) {
  const { src, imgAspect, slotAspect, cell: initial, onApply, onClose } = props
  const [cell, setCell] = useState<Cell>(initial)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; x: number; y: number; cell: Cell } | null>(null)

  // rettangolo immagine renderizzata (object-contain) dentro il box
  function imgRect() {
    const el = boxRef.current; if (!el) return { x: 0, y: 0, w: 1, h: 1 }
    const W = el.clientWidth, H = el.clientHeight
    let w = W, h = W / imgAspect
    if (h > H) { h = H; w = H * imgAspect }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h }
  }

  const crop = cellToCrop(imgAspect, slotAspect, cell) // cx,cy,w,h in frazioni immagine
  const ir = imgRect()
  const boxStyle = {
    left: ir.x + (crop.cx - crop.w / 2) * ir.w, top: ir.y + (crop.cy - crop.h / 2) * ir.h,
    width: crop.w * ir.w, height: crop.h * ir.h,
  }

  function onDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    e.stopPropagation(); dragRef.current = { mode, x: e.clientX, y: e.clientY, cell }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return
    const r = imgRect()
    if (d.mode === 'move') {
      const dfx = (e.clientX - d.x) / Math.max(1, r.w), dfy = (e.clientY - d.y) / Math.max(1, r.h)
      setCell(cropToCell(imgAspect, slotAspect, clampN(d.cell.fx + dfx), clampN(d.cell.fy + dfy), cellToCrop(imgAspect, slotAspect, d.cell).w))
    } else {
      // ridimensiona attorno al centro: nuovo semilato = distanza dal centro
      const cxpx = r.x + d.cell.fx * r.w, cypx = r.y + d.cell.fy * r.h
      const halfW = Math.abs(e.clientX - cxpx), halfH = Math.abs(e.clientY - cypx)
      const wFrac = Math.max((halfW * 2) / r.w, ((halfH * 2) / r.h) * (imgAspect / slotAspect))
      setCell(cropToCell(imgAspect, slotAspect, d.cell.fx, d.cell.fy, wFrac))
    }
  }
  function onUp() { dragRef.current = null }

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium flex items-center gap-2"><Crop size={16} /> Ritaglia</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="!text-white !border-white/30" onClick={() => setCell({ z: 1, fx: 0.5, fy: 0.5 })}>Riempi</Button>
          <Button variant="gold" size="sm" onClick={() => onApply(cell)}>Applica</Button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10"><X size={18} className="text-white" /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div ref={boxRef} className="relative max-w-full max-h-full" style={{ width: '90vw', height: '78vh' }}>
          <img src={src} alt="" className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none opacity-50" />
          {/* finestra di ritaglio: parte luminosa */}
          <div className="absolute overflow-hidden ring-2 ring-white shadow-[0_0_0_9999px_rgba(0,0,0,.5)] cursor-move touch-none"
            style={boxStyle} onPointerDown={(e) => onDown(e, 'move')} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <img src={src} alt="" className="absolute select-none pointer-events-none max-w-none"
              style={{ left: -((boxStyle.left as number) - ir.x), top: -((boxStyle.top as number) - ir.y), width: ir.w, height: ir.h }} />
            {/* terzi */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 bottom-0 left-1/3 border-l border-white/40" />
              <div className="absolute top-0 bottom-0 left-2/3 border-l border-white/40" />
              <div className="absolute left-0 right-0 top-1/3 border-t border-white/40" />
              <div className="absolute left-0 right-0 top-2/3 border-t border-white/40" />
            </div>
            {/* maniglia ridimensiona (basso-destra) */}
            <div className="absolute -bottom-1.5 -right-1.5 h-4 w-4 bg-white rounded-sm border border-black/20 cursor-nwse-resize"
              onPointerDown={(e) => onDown(e, 'resize')} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
          </div>
        </div>
      </div>
      <div className="text-center text-white/70 text-xs pb-3" onClick={(e) => e.stopPropagation()}>Trascina il riquadro per spostarlo · trascina l'angolo per ingrandirlo/rimpicciolirlo</div>
    </div>
  )
}
