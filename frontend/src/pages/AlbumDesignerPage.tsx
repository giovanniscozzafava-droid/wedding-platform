import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Wand2, Save, Plus, Trash2, ChevronLeft, ChevronRight, Heart, Loader2, LayoutGrid, FileImage, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ALBUM_FORMATS, DEFAULT_FORMAT, getFormat, pageAspect } from '@/lib/albumFormats'
import { MOMENTS, getMoment, ALBUM_MIN_PHOTOS, ALBUM_MAX_PHOTOS } from '@/lib/albumMoments'
import { autoLayout, framesForPage, newPage, templatesFor, type AlbumPage, type TemplateKey } from '@/lib/albumEngine'
import { exportAlbumPdf, exportAlbumJpgZip } from '@/lib/albumExport'

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
      const lay = (proj as any).layout as { pages?: AlbumPage[] } | null
      if (lay?.pages?.length) { setPages(lay.pages); setStep('design') }
    }
    setLoading(false)
  }, [entryId])
  useEffect(() => { void load() }, [load])

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
  function placeInto(pageId: string, slot: number | null, mediaId: string) {
    updatePage(pageId, (p) => {
      const ids = [...p.mediaIds]
      if (slot != null && slot < framesForPage(p).length) ids[slot] = mediaId
      else { const empty = ids.findIndex((x) => !x); if (empty >= 0) ids[empty] = mediaId; else if (ids.length < 4) ids.push(mediaId); else return p }
      return { ...p, mediaIds: ids }
    })
  }
  function clearSlot(pageId: string, slot: number) {
    updatePage(pageId, (p) => { const ids = [...p.mediaIds]; ids.splice(slot, 1); return { ...p, mediaIds: ids } })
  }
  function setTemplate(pageId: string, t: TemplateKey) { updatePage(pageId, (p) => ({ ...p, template: t })) }
  function delPage(id: string) { setPages((a) => a.filter((p) => p.id !== id)); if (activePage === id) setActivePage(null) }
  function addPageAfter(id: string | null) {
    const np = newPage()
    setPages((a) => { if (!id) return [...a, np]; const i = a.findIndex((p) => p.id === id); const c = [...a]; c.splice(i + 1, 0, np); return c })
    setActivePage(np.id)
  }
  function movePage(id: string, dir: -1 | 1) {
    setPages((a) => { const i = a.findIndex((p) => p.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= a.length) return a; const c = [...a]; const t = c[i]!; c[i] = c[j]!; c[j] = t; return c })
  }

  async function save(nextStatus?: string) {
    if (!entryId) return
    setBusy(true)
    try {
      const st = nextStatus ?? status
      const { data, error } = await (supabase.rpc as any)('album_project_save', {
        p_entry: entryId, p_gallery: null, p_format: format, p_status: st, p_layout: { pages },
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
      const resolve = (id: string) => { const m = mediaById.get(id); return m ? hiUrl(m) : '' }
      const base = (title || 'album').toLowerCase().replace(/\s+/g, '-')
      if (kind === 'jpg') await exportAlbumJpgZip(pages, format, resolve, { filename: `${base}-jpg.zip` })
      else await exportAlbumPdf(pages, format, resolve, { mode: kind === 'spread' ? 'spreads' : 'pages', filename: `${base}-${kind === 'spread' ? 'spread' : 'pagine'}.pdf` })
      toast.success('Export pronto')
    } catch (e) { toast.error('Export non riuscito: ' + (e as Error).message) } finally { setExporting(false) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  const asp = pageAspect(format)
  const fmt = getFormat(format)

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

      <div className="max-w-7xl mx-auto px-4 py-5">
        {step === 'select' ? (
          <SelectStep
            photos={photos} kept={kept} total={total} okRange={okRange} untagged={untagged}
            missingMin={missingMin} perMoment={perMoment}
            onToggle={toggleKeep} onMoment={setMoment} onGenerate={generate} thumb={thumbUrl}
          />
        ) : (
          <div className="grid lg:grid-cols-[1fr_280px] gap-5">
            {/* canvas pagine */}
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Button variant="gold" size="sm" disabled={busy} onClick={() => setPages(autoLayout(kept.map((m) => ({ id: m.id, moment: m.album_moment })), format).pages)}><Wand2 size={14} /> Auto-impagina</Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void save()}><Save size={14} /> Salva</Button>
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => void doExport('pdf')}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF pagine</Button>
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => void doExport('spread')}><LayoutGrid size={14} /> PDF spread</Button>
                <Button variant="outline" size="sm" disabled={exporting} onClick={() => void doExport('jpg')}><FileImage size={14} /> JPG (ZIP)</Button>
                {isCouple
                  ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void save('PHOTOGRAPHER_EDIT')}>Invia al fotografo</Button>
                  : <Button variant="outline" size="sm" disabled={busy} onClick={() => void save('FINAL')}>Segna come finale</Button>}
                <span className="text-xs text-[rgb(var(--fg-muted))]">{pages.length} pagine · {fmt.label}</span>
              </div>

              {pages.length === 0 ? (
                <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">
                  Nessuna pagina. Premi <strong>Auto-impagina</strong> per generare dalla selezione, oppure aggiungi una pagina.
                  <div className="mt-3"><Button variant="outline" size="sm" onClick={() => addPageAfter(null)}><Plus size={14} /> Pagina vuota</Button></div>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {pages.map((p, idx) => (
                    <PageCard
                      key={p.id} page={p} index={idx} aspect={asp}
                      active={activePage === p.id} activeSlot={activePage === p.id ? activeSlot : null}
                      mediaById={mediaById} thumb={thumbUrl}
                      onActivate={() => { setActivePage(p.id); setActiveSlot(null) }}
                      onSlot={(s) => { setActivePage(p.id); setActiveSlot(s) }}
                      onDropMedia={(s, id) => placeInto(p.id, s, id)}
                      onClearSlot={(s) => clearSlot(p.id, s)}
                      onTemplate={(t) => setTemplate(p.id, t)}
                      onDelete={() => delPage(p.id)} onAdd={() => addPageAfter(p.id)}
                      onMove={(d) => movePage(p.id, d)}
                    />
                  ))}
                  <button onClick={() => addPageAfter(null)} className="rounded-xl border-2 border-dashed border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg))] flex items-center justify-center min-h-[140px]"><Plus size={18} className="mr-1" /> Pagina</button>
                </div>
              )}
            </div>

            {/* tray foto */}
            <div className="lg:sticky lg:top-20 self-start">
              <Card className="p-3">
                <p className="text-xs font-medium mb-2">Foto selezionate ({kept.length})</p>
                <p className="text-[11px] text-[rgb(var(--fg-subtle))] mb-2">Trascina su uno slot, o seleziona uno slot e clicca una foto.</p>
                <div className="grid grid-cols-3 gap-1.5 max-h-[70vh] overflow-auto">
                  {trayMedia.map((m) => (
                    <button key={m.id}
                      draggable onDragStart={(e) => e.dataTransfer.setData('text/media', m.id)}
                      onClick={() => { if (activePage) placeInto(activePage, activeSlot, m.id) }}
                      title={getMoment(m.album_moment)?.label ?? 'senza momento'}
                      className={`relative aspect-square rounded overflow-hidden border ${placedIds.has(m.id) ? 'opacity-40' : ''} border-[rgb(var(--border))]`}>
                      <img src={thumbUrl(m)} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
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

// ── card pagina con slot droppabili ──────────────────────────────────────────
function PageCard(props: {
  page: AlbumPage; index: number; aspect: number; active: boolean; activeSlot: number | null
  mediaById: Map<string, M>; thumb: (m: M) => string
  onActivate: () => void; onSlot: (s: number) => void; onDropMedia: (s: number | null, id: string) => void
  onClearSlot: (s: number) => void; onTemplate: (t: TemplateKey) => void
  onDelete: () => void; onAdd: () => void; onMove: (d: -1 | 1) => void
}) {
  const { page, index, aspect, active, activeSlot, mediaById, thumb, onActivate, onSlot, onDropMedia, onClearSlot, onTemplate, onDelete, onAdd, onMove } = props
  const frames = framesForPage(page)
  const moment = getMoment(page.moment)
  const alts = templatesFor(Math.max(1, page.mediaIds.length))
  return (
    <Card className={`p-2 ${active ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`} onClick={onActivate}>
      <div className="flex items-center justify-between mb-1.5 text-[11px]">
        <span className="text-[rgb(var(--fg-muted))]">Pag. {index + 1}{moment ? <span className={`ml-1 px-1.5 py-0.5 rounded ${moment.color}`}>{moment.label}</span> : ''}</span>
        <div className="flex items-center gap-0.5">
          <button title="Sposta indietro" className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={(e) => { e.stopPropagation(); onMove(-1) }}><ChevronLeft size={13} /></button>
          <button title="Sposta avanti" className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={(e) => { e.stopPropagation(); onMove(1) }}><ChevronRight size={13} /></button>
          <button title="Aggiungi pagina dopo" className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={(e) => { e.stopPropagation(); onAdd() }}><Plus size={13} /></button>
          <button title="Elimina pagina" className="p-1 rounded hover:bg-rose-50 text-rose-500" onClick={(e) => { e.stopPropagation(); onDelete() }}><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="relative w-full bg-white border border-[rgb(var(--border))]" style={{ aspectRatio: String(aspect) }}>
        {frames.map((fr, i) => {
          const id = page.mediaIds[i]; const m = id ? mediaById.get(id) : undefined
          const sel = activeSlot === i
          return (
            <div key={i}
              onClick={(e) => { e.stopPropagation(); onSlot(i) }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const mid = e.dataTransfer.getData('text/media'); if (mid) onDropMedia(i, mid) }}
              className={`absolute overflow-hidden ${sel ? 'outline outline-2 outline-[rgb(var(--gold-500))]' : ''}`}
              style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%`, padding: '2px' }}>
              {m ? (
                <div className="relative w-full h-full">
                  <img src={thumb(m)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <button onClick={(e) => { e.stopPropagation(); onClearSlot(i) }} className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center"><Trash2 size={11} /></button>
                </div>
              ) : (
                <div className="w-full h-full bg-[rgb(var(--bg-sunken))] flex items-center justify-center text-[10px] text-[rgb(var(--fg-subtle))]">vuoto</div>
              )}
            </div>
          )
        })}
      </div>
      {alts.length > 1 && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="text-[10px] text-[rgb(var(--fg-subtle))]">Layout:</span>
          {alts.map((t) => <button key={t} onClick={(e) => { e.stopPropagation(); onTemplate(t) }} className={`text-[10px] px-1.5 py-0.5 rounded border ${page.template === t ? 'bg-[rgb(var(--gold-100))] border-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'}`}>{t}</button>)}
        </div>
      )}
    </Card>
  )
}
