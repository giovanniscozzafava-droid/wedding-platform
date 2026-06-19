import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, Square, RectangleVertical, Smartphone, Shuffle, Download, Trash2, Sparkles, Type } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// MOOD BOARD STUDIO — un mini-software stile Canva (derivato dalla logica di
// impaginazione dell'album): le foto del mood vengono auto-disposte in layout
// editoriali CURATI che vengono sempre bene, anche senza competenze di design.
// L'utente sceglie un preset + un formato, rimescola, trascina per scambiare e
// scarica un'immagine pronta da condividere. Slot in frazione 0..1 del canvas.
// ─────────────────────────────────────────────────────────────────────────────

export type MoodImg = { id: string; url: string; caption?: string | null; tag?: string | null; source?: string | null }
type Slot = { x: number; y: number; w: number; h: number; rot?: number }

const FORMATS = [
  { key: 'square', label: 'Quadrato', icon: Square, ratio: 1 },
  { key: 'portrait', label: 'Verticale', icon: RectangleVertical, ratio: 3 / 4 },
  { key: 'story', label: 'Storia', icon: Smartphone, ratio: 9 / 16 },
] as const
const PRESETS = [
  { key: 'editoriale', label: 'Editoriale' },
  { key: 'griglia', label: 'Griglia magazine' },
  { key: 'polaroid', label: 'Polaroid' },
] as const

// righe consigliate per N immagini in un rettangolo di un certo rapporto visivo
const rowsFor = (n: number, visualRatio: number) => Math.max(1, Math.min(n, Math.round(Math.sqrt(n / Math.max(0.4, visualRatio)))))
const distribute = (n: number, R: number) => { const base = Math.floor(n / R), ex = n % R; return Array.from({ length: R }, (_, r) => base + (r < ex ? 1 : 0)) }

// "Justified": distribuisce n foto in righe dentro un rettangolo, riempiendo la larghezza.
function justifiedInRect(n: number, rect: { x: number; y: number; w: number; h: number }, aspect: number, g: number): Slot[] {
  const out: Slot[] = []; if (n <= 0) return out
  const vr = aspect * (rect.w / Math.max(0.001, rect.h))
  const R = rowsFor(n, vr)
  const counts = distribute(n, R)
  const rowH = (rect.h - g * (R + 1)) / R
  for (let r = 0; r < R; r++) {
    const c = Math.max(1, counts[r] ?? 1)
    const cellW = (rect.w - g * (c + 1)) / c
    const y = rect.y + g + r * (rowH + g)
    for (let i = 0; i < c; i++) out.push({ x: rect.x + g + i * (cellW + g), y, w: cellW, h: rowH })
  }
  return out
}

function buildLayout(preset: string, n: number, aspect: number): Slot[] {
  const g = 0.014
  if (n <= 0) return []
  if (preset === 'polaroid') {
    const base = justifiedInRect(n, { x: 0.03, y: 0.03, w: 0.94, h: 0.94 }, aspect, 0.035)
    return base.map((s, i) => ({ ...s, rot: ((i * 41) % 7) - 3 })) // -3..+3°, deterministico
  }
  if (preset === 'editoriale' && n > 1) {
    const heroW = n >= 4 ? 0.56 : 0.62
    const hero = { x: g, y: g, w: heroW, h: 1 - 2 * g }
    const right = { x: g + heroW + g, y: g, w: 1 - (g + heroW + g) - g, h: 1 - 2 * g }
    return [hero, ...justifiedInRect(n - 1, right, aspect, g)]
  }
  // griglia magazine (e fallback editoriale con 1 sola foto)
  return justifiedInRect(n, { x: 0, y: 0, w: 1, h: 1 }, aspect, g)
}

export function MoodBoardStudio({ entryId, images, title, dateText, onRemove }: {
  entryId: string
  images: MoodImg[]
  title?: string | null
  dateText?: string | null
  onRemove?: (id: string) => void
}) {
  const [preset, setPreset] = useState<string>('editoriale')
  const [fmt, setFmt] = useState<typeof FORMATS[number]['key']>('portrait')
  const [showHeader, setShowHeader] = useState(true)
  const [orderIds, setOrderIds] = useState<string[]>([])
  const [palette, setPalette] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const dragId = useRef<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  // palette dell'evento (couple_preferences.preferred_palette)
  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from('couple_preferences') as any).select('preferred_palette').eq('entry_id', entryId).maybeSingle()
      setPalette(((data?.preferred_palette as string[] | null) ?? []).filter(Boolean).slice(0, 6))
    })()
  }, [entryId])

  // riconcilia l'ordine quando cambiano le immagini (aggiunte in coda, rimosse sfilate)
  useEffect(() => {
    const ids = images.map((m) => m.id)
    setOrderIds((prev) => { const kept = prev.filter((id) => ids.includes(id)); const added = ids.filter((id) => !kept.includes(id)); return [...kept, ...added] })
  }, [images])

  const byId = useMemo(() => new Map(images.map((m) => [m.id, m])), [images])
  const ordered = useMemo(() => orderIds.map((id) => byId.get(id)).filter(Boolean) as MoodImg[], [orderIds, byId])

  const ratio = FORMATS.find((f) => f.key === fmt)!.ratio // w/h
  const headerH = showHeader ? 0.12 : 0
  const slots = useMemo(() => {
    const area = buildLayout(preset, ordered.length, ratio / Math.max(0.001, 1 - headerH))
    // comprime i layout nell'area sotto l'intestazione
    return area.map((s) => ({ ...s, y: headerH + s.y * (1 - headerH), h: s.h * (1 - headerH) }))
  }, [preset, ordered.length, ratio, headerH])

  function shuffle() {
    setOrderIds((prev) => { const a = [...prev]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j]!, a[i]!] } return a })
  }
  function swap(targetId: string) {
    const from = dragId.current; dragId.current = null
    if (!from || from === targetId) return
    setOrderIds((prev) => { const a = [...prev]; const i = a.indexOf(from), j = a.indexOf(targetId); if (i < 0 || j < 0) return prev;[a[i], a[j]] = [a[j]!, a[i]!]; return a })
  }

  async function exportPng() {
    if (!boardRef.current || ordered.length === 0) { toast.error('Aggiungi almeno una foto'); return }
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(boardRef.current, { useCORS: true, backgroundColor: '#ffffff', scale: 2 })
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'moodboard.png'; a.click()
      toast.success('Moodboard scaricato')
    } catch { toast.error('Export non riuscito (alcune immagini bloccano il salvataggio per via del CORS). Usa "Esporta PDF editoriale".') }
    finally { setExporting(false) }
  }

  const Toolbar = (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-xs font-medium text-[rgb(var(--fg-muted))] inline-flex items-center gap-1"><Sparkles size={13} /> Stile:</span>
      {PRESETS.map((p) => (
        <button key={p.key} onClick={() => setPreset(p.key)}
          className={`text-xs px-2.5 py-1 rounded-full border ${preset === p.key ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>{p.label}</button>
      ))}
      <div className="h-5 w-px bg-[rgb(var(--border))] mx-1" />
      {FORMATS.map((f) => { const Icon = f.icon; return (
        <button key={f.key} onClick={() => setFmt(f.key)} title={f.label}
          className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${fmt === f.key ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}><Icon size={12} /> {f.label}</button>
      ) })}
      <div className="h-5 w-px bg-[rgb(var(--border))] mx-1" />
      <button onClick={() => setShowHeader((v) => !v)} title="Intestazione con titolo e palette"
        className={`text-xs px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${showHeader ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}><Type size={12} /> Intestazione</button>
      <button onClick={shuffle} className="text-xs px-2.5 py-1 rounded-full border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] inline-flex items-center gap-1"><Shuffle size={12} /> Rimescola</button>
      <button onClick={() => void exportPng()} disabled={exporting} className="text-xs px-2.5 py-1 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] inline-flex items-center gap-1 disabled:opacity-50"><Download size={12} /> {exporting ? 'Esporto…' : 'Scarica PNG'}</button>
    </div>
  )

  if (ordered.length === 0) {
    return (
      <div className="mb-6">
        {Toolbar}
        <div className="rounded-xl border border-dashed border-[rgb(var(--border))] p-10 text-center text-[rgb(var(--fg-muted))]">
          <LayoutGrid size={28} className="mx-auto opacity-40" />
          <p className="mt-2 text-sm">Aggiungi qualche foto qui sotto: lo studio le impagina da solo in un moodboard elegante.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {Toolbar}
      <div className="flex justify-center">
        {/* CANVAS: rapporto fisso del formato scelto; le foto sono in frazione 0..1 */}
        <div ref={boardRef} className="relative bg-white shadow-[var(--shadow-lift)] overflow-hidden"
          style={{ width: 'min(100%, 560px)', aspectRatio: String(ratio) }}>
          {/* intestazione editoriale */}
          {showHeader && (
            <div className="absolute inset-x-0 top-0 flex flex-col items-center justify-center text-center px-4" style={{ height: `${headerH * 100}%` }}>
              <p className="font-display leading-tight text-[rgb(var(--fg))]" style={{ fontSize: 'clamp(12px, 3.4vw, 22px)' }}>{title || 'Mood board'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {dateText && <span className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--fg-subtle))]">{dateText}</span>}
                {palette.length > 0 && <span className="inline-flex gap-1">{palette.map((c, i) => <span key={i} className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: c }} />)}</span>}
              </div>
            </div>
          )}
          {/* foto */}
          {ordered.map((m, i) => {
            const s = slots[i]; if (!s) return null
            const polaroid = preset === 'polaroid'
            return (
              <div key={m.id} draggable
                onDragStart={() => { dragId.current = m.id }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => swap(m.id)}
                className="absolute group cursor-grab active:cursor-grabbing"
                style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.w * 100}%`, height: `${s.h * 100}%`, transform: s.rot ? `rotate(${s.rot}deg)` : undefined }}>
                <div className={`relative w-full h-full overflow-hidden ${polaroid ? 'bg-white p-[6%] pb-[14%] shadow-md rounded-[2px]' : 'rounded-[3px] shadow-sm'}`}>
                  <img src={m.url} alt={m.caption ?? ''} crossOrigin="anonymous" draggable={false}
                    className={`w-full object-cover ${polaroid ? 'h-full' : 'h-full'}`} style={polaroid ? { height: '100%' } : undefined} />
                  {polaroid && m.caption && <span className="absolute inset-x-0 bottom-[3%] text-center text-[9px] text-[rgb(var(--fg-muted))] truncate px-1" style={{ fontFamily: 'Georgia, serif' }}>{m.caption}</span>}
                </div>
                {onRemove && (
                  <button onClick={() => onRemove(m.id)} title="Togli dal moodboard"
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/65 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"><Trash2 size={10} /></button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-center text-[11px] text-[rgb(var(--fg-subtle))] mt-2">Trascina una foto su un'altra per scambiarle · cambia stile/formato · "Scarica PNG" per condividerlo</p>
    </div>
  )
}
