// Editor libero della moodboard: una tela con immagini, testi, forme, icone e
// ghirigori. Si parte da uno stile automatico e poi ci si mette mano (trascina,
// ridimensiona, ruota). Persistenza condivisa su mood_boards (coppia + organizzatore + admin).
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Heart, Star, Leaf, Flower2, Sparkles, Sun, Moon, Music, Camera, Gem, Wine,
  Cake, Bird, Cloud, MapPin, Crown, Type, Image as ImageIcon, Shapes, Smile,
  Trash2, Copy, ArrowUp, ArrowDown, Plus, Wand2, X, Loader2, Save, RotateCw, Link2, Download, FileDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  emptyBoard, addImage, addText, addShape, addIcon, moveEl, resizeEl, snapMove, snapAngle,
  updateEl, removeEl, bringFront, sendBack, duplicateEl, FLOURISHES, SHAPES, MOOD_PALETTE,
  MOOD_FONTS, PRESETS, LAYOUT_STYLES, type MoodBoard, type MoodEl, type Corner,
} from '@/lib/moodBoard'

const ICONS: Record<string, any> = { Heart, Star, Leaf, Flower2, Sparkles, Sun, Moon, Music, Camera, Gem, Wine, Cake, Bird, Cloud, MapPin, Crown }
const ICON_NAMES = Object.keys(ICONS)

// Render di una forma/ghirigoro su un box w×h.
function ShapeView({ name, fill }: { name: string; fill: string }) {
  const fl = FLOURISHES.find((f) => f.name === name)
  if (fl) return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet"><path d={fl.path} fill="none" stroke={fill} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (name === 'circle') return <svg viewBox="0 0 100 100" className="w-full h-full"><circle cx="50" cy="50" r="48" fill={fill} /></svg>
  if (name === 'rounded') return <div className="w-full h-full rounded-2xl" style={{ background: fill }} />
  if (name === 'line') return <div className="w-full h-full" style={{ background: fill }} />
  if (name === 'heart') return <svg viewBox="0 0 100 100" className="w-full h-full"><path d="M50 86 C 10 56, 16 20, 50 36 C 84 20, 90 56, 50 86 Z" fill={fill} /></svg>
  if (name === 'arch') return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none"><path d="M5 100 L5 45 C5 15 30 2 50 2 C70 2 95 15 95 45 L95 100 Z" fill={fill} /></svg>
  return <div className="w-full h-full rounded" style={{ background: fill }} /> // rect
}

function ElView({ el }: { el: MoodEl }) {
  if (el.kind === 'image') {
    const img = <div className="w-full h-full bg-center bg-cover bg-[rgb(var(--bg-sunken))]" style={{ backgroundImage: el.src ? `url(${el.src})` : undefined }} />
    if (el.frame === 'polaroid') return <div className="w-full h-full bg-white shadow-md rounded-[2px] p-[7%] pb-[16%]">{img}</div>
    return img
  }
  if (el.kind === 'text') return (
    <div className="w-full h-full flex items-center px-1 overflow-hidden [container-type:size]" style={{ justifyContent: el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center' }}>
      <span style={{ color: el.color, fontFamily: el.font, fontWeight: el.weight ?? 600, fontStyle: el.italic ? 'italic' : undefined, textAlign: el.align, fontSize: '70cqh', lineHeight: 1.05, width: '100%', whiteSpace: 'nowrap' }}>{el.text || 'Testo'}</span>
    </div>
  )
  if (el.kind === 'icon') { const I = ICONS[el.name ?? 'Heart'] ?? Heart; return <I className="w-full h-full" style={{ color: el.fill }} strokeWidth={1.6} /> }
  return <ShapeView name={el.name ?? 'rect'} fill={el.fill ?? '#ccc'} />
}

export function MoodBoardEditor({ entryId, pins, readOnly, title, dateText, location, brandName, brandEmail }: {
  entryId: string; pins: string[]; readOnly?: boolean
  title?: string | null; dateText?: string | null; location?: string | null; brandName?: string | null; brandEmail?: string | null
}) {
  const [board, setBoard] = useState<MoodBoard>(emptyBoard())
  const [sel, setSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [open, setOpen] = useState(false)         // editor a tutta larghezza
  const [tab, setTab] = useState<'preset' | 'img' | 'text' | 'shape' | 'icon'>('preset')
  const [imgUrl, setImgUrl] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const drag = useRef<{ kind: 'move' | 'resize' | 'rotate'; id: string; corner?: Corner; sx: number; sy: number; el: MoodEl } | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase.from as any)('mood_boards').select('data').eq('entry_id', entryId).maybeSingle()
    const d = (data as { data?: MoodBoard } | null)?.data
    if (d && Array.isArray(d.els)) setBoard({ bg: d.bg ?? '#faf6ef', els: d.els })
    setLoading(false); loadedRef.current = true
  }, [entryId])
  useEffect(() => { void load() }, [load])

  const persist = useCallback(async (b: MoodBoard, silent = true) => {
    setSaving(true)
    const { error } = await (supabase.from as any)('mood_boards').upsert({ entry_id: entryId, data: b }, { onConflict: 'entry_id' })
    setSaving(false)
    if (error && !silent) toast.error('Salvataggio non riuscito: ' + error.message)
    else if (!silent) toast.success('Moodboard salvato')
  }, [entryId])

  // autosave debounce
  useEffect(() => {
    if (!loadedRef.current || readOnly) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void persist(board) }, 1200)
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  }, [board, persist, readOnly])

  const els = [...board.els].sort((a, b) => a.z - b.z)
  const selEl = board.els.find((e) => e.id === sel) ?? null
  function setEls(fn: (els: MoodEl[]) => MoodEl[]) { setBoard((b) => ({ ...b, els: fn(b.els) })) }

  function frac(e: React.PointerEvent) { const r = boxRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) } }
  function down(e: React.PointerEvent, kind: 'move' | 'resize' | 'rotate', el: MoodEl, corner?: Corner) {
    if (readOnly) return
    e.stopPropagation(); setSel(el.id); const f = frac(e); drag.current = { kind, id: el.id, corner, sx: f.x, sy: f.y, el }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return; const f = frac(e)
    if (d.kind === 'move') {
      const moved = moveEl(d.el, d.el.x + (f.x - d.sx), d.el.y + (f.y - d.sy))
      const s = snapMove(moved, board.els.filter((x) => x.id !== d.id))
      setEls((arr) => updateEl(arr, d.id, { x: s.x, y: s.y })); setGuides({ v: s.vGuides, h: s.hGuides })
    } else if (d.kind === 'resize' && d.corner) { const r = resizeEl(d.el, d.corner, f.x, f.y); setEls((arr) => updateEl(arr, d.id, { x: r.x, y: r.y, w: r.w, h: r.h })) }
    else if (d.kind === 'rotate') { const cx = d.el.x + d.el.w / 2, cy = d.el.y + d.el.h / 2; const deg = (Math.atan2(f.y - cy, f.x - cx) * 180) / Math.PI + 90; setEls((arr) => updateEl(arr, d.id, { rot: snapAngle(deg) })) }
  }
  function up() { drag.current = null; setGuides({ v: [], h: [] }) }

  function applyPreset(i: number) { setBoard(PRESETS[i]!.build(pins.length ? pins : ['', '', ''])); setSel(null); setTab('img') }
  // stili d'impaginazione dinamici: dispongono TUTTE le foto del mood (ritagli/polaroid/moda)
  function applyStyle(key: string) {
    const st = LAYOUT_STYLES.find((s) => s.key === key); if (!st) return
    const imgs = pins.filter(Boolean)
    if (imgs.length === 0) { toast.error('Aggiungi prima qualche foto'); return }
    setBoard(st.build(imgs)); setSel(null)
  }
  async function exportPng() {
    if (!boxRef.current || board.els.length === 0) { toast.error('Aggiungi qualcosa prima'); return }
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas-pro')).default
      const canvas = await html2canvas(boxRef.current, { useCORS: true, backgroundColor: board.bg, scale: 2 })
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'moodboard.png'; a.click()
      toast.success('Moodboard scaricato')
    } catch { toast.error('Export non riuscito (alcune immagini bloccano il salvataggio: CORS).') }
    finally { setExporting(false) }
  }
  // PDF editoriale dalle foto del board (in ordine di lettura alto→basso, sinistra→destra)
  async function exportPdf() {
    const imgs = board.els.filter((e) => e.kind === 'image' && e.src).sort((a, b) => (a.y - b.y) || (a.x - b.x)).map((e) => ({ url: e.src as string }))
    if (!imgs.length) { toast.error('Aggiungi qualche foto'); return }
    setExporting(true)
    try {
      const { buildMoodboardPdf } = await import('@/lib/moodboardPdf')
      await buildMoodboardPdf({ images: imgs, coupleNames: title ?? null, dateText: dateText ?? null, location: location ?? null, brandName: brandName ?? null, brandEmail: brandEmail ?? null, palette: [] })
      toast.success('PDF editoriale pronto')
    } catch (e) { toast.error('PDF non riuscito: ' + ((e as Error).message || 'errore')) }
    finally { setExporting(false) }
  }
  function patchSel(p: Partial<MoodEl>) { if (sel) setEls((arr) => updateEl(arr, sel, p)) }

  if (loading) return <div className="rounded-2xl border border-[rgb(var(--border))] p-8 flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] overflow-hidden bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgb(var(--border))]">
        <div>
          <p className="font-medium flex items-center gap-2"><Wand2 size={16} className="text-[rgb(var(--gold-600))]" /> Il vostro moodboard</p>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Scegli uno stile (ritagli, polaroid, moda, tableau): si impagina da solo e poi ci metti mano.</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[11px] text-[rgb(var(--fg-muted))] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> salvo…</span>}
          {board.els.length > 0 && <Button size="sm" variant="outline" onClick={() => void exportPdf()} disabled={exporting}><FileDown size={14} /> PDF</Button>}
          {board.els.length > 0 && <Button size="sm" variant="outline" onClick={() => void exportPng()} disabled={exporting}><Download size={14} /> PNG</Button>}
          {!readOnly && <Button size="sm" variant="outline" onClick={() => void persist(board, false)}><Save size={14} /> Salva</Button>}
          <Button size="sm" variant={open ? 'gold' : 'outline'} onClick={() => setOpen((v) => !v)}>{open ? 'Chiudi' : 'Apri e modifica'}</Button>
        </div>
      </div>

      {/* anteprima cliccabile da chiuso: clicchi sul moodboard e si apre l'editor (tipo Canva) */}
      {!open && els.length > 0 && (
        <button onClick={() => setOpen(true)} className="group block w-full p-4 bg-[rgb(var(--bg-sunken))]">
          <div className="relative mx-auto w-full max-w-[420px] shadow-[var(--shadow-lift)]" style={{ aspectRatio: '4 / 5', background: board.bg }}>
            {els.map((el) => (
              <div key={el.id} className="absolute" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, zIndex: el.z }}>
                <ElView el={el} />
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/15 transition">
              <span className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1 rounded-full bg-white/90 text-[rgb(var(--fg))] text-xs font-medium px-3 py-1.5"><Wand2 size={13} /> Apri e modifica a mano</span>
            </div>
          </div>
        </button>
      )}

      {open && (
        <div className="lg:flex">
          {/* strumenti */}
          {!readOnly && (
            <div className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[rgb(var(--border))] p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {([['preset', 'Stili', Wand2], ['img', 'Foto', ImageIcon], ['text', 'Testo', Type], ['shape', 'Forme', Shapes], ['icon', 'Icone', Smile]] as const).map(([k, l, I]) => (
                  <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${tab === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'border border-[rgb(var(--border))]'}`}><I size={12} /> {l}</button>
                ))}
              </div>

              {tab === 'preset' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Stili d'impaginazione — dispongono tutte le foto</p>
                    <div className="grid grid-cols-2 gap-2">{LAYOUT_STYLES.map((s) => <button key={s.key} onClick={() => applyStyle(s.key)} className="rounded-lg border border-[rgb(var(--border))] p-2 text-[11px] hover:bg-[rgb(var(--bg-sunken))] hover:border-[rgb(var(--gold-500))]">{s.label}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Temi pronti</p>
                    <div className="grid grid-cols-3 gap-2">{PRESETS.map((p, i) => <button key={p.label} onClick={() => applyPreset(i)} className="rounded-lg border border-[rgb(var(--border))] p-2 text-[11px] hover:bg-[rgb(var(--bg-sunken))]">{p.label}</button>)}</div>
                  </div>
                </div>
              )}

              {tab === 'img' && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="Incolla URL immagine" className="flex-1 text-xs rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5" />
                    <Button size="sm" variant="outline" onClick={() => { if (/^https?:\/\//i.test(imgUrl)) { setBoard((b) => addImage(b, imgUrl.trim())); setImgUrl('') } else toast.error('URL non valido') }}><Link2 size={13} /></Button>
                  </div>
                  {pins.length > 0 && <div className="grid grid-cols-3 gap-1.5">{pins.map((u, i) => <button key={i} onClick={() => setBoard((b) => addImage(b, u))} className="aspect-square rounded-md overflow-hidden border border-[rgb(var(--border))]"><img src={u} alt="" className="w-full h-full object-cover" /></button>)}</div>}
                  {pins.length === 0 && <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Aggiungi ispirazioni dalla sezione qui sotto o incolla un URL.</p>}
                </div>
              )}

              {tab === 'text' && (
                <div className="space-y-2">
                  <Button size="sm" variant="gold" className="w-full" onClick={() => setBoard((b) => addText(b))}><Plus size={13} /> Aggiungi scritta</Button>
                  <div className="grid grid-cols-2 gap-1">{MOOD_FONTS.map((f) => <button key={f.label} onClick={() => setBoard((b) => addText({ ...b }, 'Il vostro mood'))} style={{ fontFamily: f.css }} className="rounded-lg border border-[rgb(var(--border))] py-1.5 text-xs">{f.label}</button>)}</div>
                </div>
              )}

              {tab === 'shape' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[rgb(var(--fg-muted))]">Forme</p>
                  <div className="grid grid-cols-3 gap-1.5">{SHAPES.map((s) => <button key={s} onClick={() => setBoard((b) => addShape(b, s))} className="aspect-square rounded-lg border border-[rgb(var(--border))] p-2 hover:bg-[rgb(var(--bg-sunken))]"><ShapeView name={s} fill="#b8923f" /></button>)}</div>
                  <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1">Ghirigori</p>
                  <div className="grid grid-cols-4 gap-1.5">{FLOURISHES.map((f) => <button key={f.name} title={f.name} onClick={() => setBoard((b) => addShape(b, f.name, '#b8923f'))} className="aspect-square rounded-lg border border-[rgb(var(--border))] p-1 hover:bg-[rgb(var(--bg-sunken))]"><ShapeView name={f.name} fill="#b8923f" /></button>)}</div>
                </div>
              )}

              {tab === 'icon' && <div className="grid grid-cols-5 gap-1.5">{ICON_NAMES.map((n) => { const I = ICONS[n]; return <button key={n} title={n} onClick={() => setBoard((b) => addIcon(b, n))} className="aspect-square rounded-lg border border-[rgb(var(--border))] flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><I size={18} className="text-[rgb(var(--gold-600))]" /></button> })}</div>}

              <div className="border-t border-[rgb(var(--border))] pt-2">
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Sfondo</p>
                <div className="flex flex-wrap gap-1">{MOOD_PALETTE.map((c) => <button key={c} onClick={() => setBoard((b) => ({ ...b, bg: c }))} className={`h-5 w-5 rounded-full border ${board.bg === c ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />)}</div>
              </div>
            </div>
          )}

          {/* tela */}
          <div className="flex-1 min-w-0 p-4 flex items-start justify-center bg-[rgb(var(--bg-sunken))]">
            <div ref={boxRef} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onClick={(e) => { if (e.target === e.currentTarget) setSel(null) }}
              className="relative shadow-[var(--shadow-lift)] w-full max-w-[520px]" style={{ aspectRatio: '4 / 5', background: board.bg }}>
              {els.map((el) => {
                const isSel = sel === el.id
                return (
                  <div key={el.id} className="absolute" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, zIndex: el.z }}>
                    <div onPointerDown={(e) => down(e, 'move', el)} className={`w-full h-full ${readOnly ? '' : 'cursor-move'} ${isSel ? 'outline outline-2 outline-[rgb(var(--gold-500))]' : ''}`}><ElView el={el} /></div>
                    {isSel && !readOnly && (
                      <>
                        {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => <div key={c} onPointerDown={(e) => down(e, 'resize', el, c)} className="absolute h-3 w-3 bg-white border border-[rgb(var(--gold-500))] rounded-sm" style={{ left: c.includes('w') ? -6 : undefined, right: c.includes('e') ? -6 : undefined, top: c.includes('n') ? -6 : undefined, bottom: c.includes('s') ? -6 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />)}
                        <div onPointerDown={(e) => down(e, 'rotate', el)} className="absolute left-1/2 -top-6 -translate-x-1/2 h-4 w-4 bg-white border border-[rgb(var(--gold-500))] rounded-full flex items-center justify-center cursor-grab"><RotateCw size={9} /></div>
                      </>
                    )}
                  </div>
                )
              })}
              {guides.v.map((g, i) => <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none" style={{ left: `${g * 100}%` }} />)}
              {guides.h.map((g, i) => <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-rose-500 pointer-events-none" style={{ top: `${g * 100}%` }} />)}
              {els.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-[rgb(var(--fg-subtle))] px-6 text-center">Parti da un <strong className="mx-1">preset</strong> o aggiungi foto, scritte e decori.</div>}
            </div>
          </div>

          {/* pannello elemento selezionato */}
          {selEl && !readOnly && (
            <div className="lg:w-56 shrink-0 border-t lg:border-t-0 lg:border-l border-[rgb(var(--border))] p-3 space-y-3 text-sm">
              <div className="flex items-center justify-between"><p className="font-medium capitalize">{selEl.kind === 'image' ? 'Foto' : selEl.kind === 'text' ? 'Scritta' : selEl.kind === 'icon' ? 'Icona' : 'Forma'}</p><button onClick={() => setSel(null)}><X size={15} /></button></div>
              {selEl.kind === 'text' && (
                <>
                  <textarea value={selEl.text ?? ''} onChange={(e) => patchSel({ text: e.target.value })} rows={2} className="w-full text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5" />
                  <div className="grid grid-cols-2 gap-1">{MOOD_FONTS.map((f) => <button key={f.label} onClick={() => patchSel({ font: f.css })} style={{ fontFamily: f.css }} className={`rounded-lg border py-1 text-xs ${selEl.font === f.css ? 'border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>{f.label}</button>)}</div>
                  <div className="flex gap-1">{(['left', 'center', 'right'] as const).map((a) => <button key={a} onClick={() => patchSel({ align: a })} className={`flex-1 rounded border py-1 text-xs ${selEl.align === a ? 'border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>{a === 'left' ? '⬅' : a === 'center' ? '⬌' : '➡'}</button>)}</div>
                </>
              )}
              {(selEl.kind === 'text' || selEl.kind === 'shape' || selEl.kind === 'icon') && (
                <div>
                  <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Colore</p>
                  <div className="flex flex-wrap gap-1">{MOOD_PALETTE.map((c) => <button key={c} onClick={() => patchSel(selEl.kind === 'text' ? { color: c } : { fill: c })} className="h-5 w-5 rounded-full border border-[rgb(var(--border))]" style={{ background: c }} />)}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-1 border-t border-[rgb(var(--border))] pt-2">
                <Button size="sm" variant="outline" onClick={() => setEls((arr) => bringFront(arr, selEl.id))}><ArrowUp size={13} /> Su</Button>
                <Button size="sm" variant="outline" onClick={() => setEls((arr) => sendBack(arr, selEl.id))}><ArrowDown size={13} /> Giù</Button>
                <Button size="sm" variant="outline" onClick={() => { const r = duplicateEl(board.els, selEl.id); setBoard((b) => ({ ...b, els: r.els })); setSel(r.newId) }}><Copy size={13} /></Button>
                <Button size="sm" variant="outline" className="text-rose-500" onClick={() => { setEls((arr) => removeEl(arr, selEl.id)); setSel(null) }}><Trash2 size={13} /></Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
