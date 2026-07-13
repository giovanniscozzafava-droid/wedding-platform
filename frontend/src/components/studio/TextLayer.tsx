import { useRef, useEffect } from 'react'
import type { TextObj } from './engine'

// Box di testo editabile sovrapposto al canvas (stile Photoshop): spostabile, allargabile,
// ri-modificabile, eliminabile. Interattivo solo col tool Testo; altrimenti mostra solo il testo.
export function TextBox({ t, zoom, pan, editable, active, snapX, snapY, onSelect, onChange, onDelete, onCommitEmpty }: {
  t: TextObj; zoom: number; pan: { x: number; y: number }; editable: boolean; active: boolean; snapX?: number[]; snapY?: number[]
  onSelect: () => void; onChange: (patch: Partial<TextObj>) => void; onDelete: () => void; onCommitEmpty: () => void
}) {
  const snap = (val: number, targets?: number[]) => { const th = 8 / zoom; if (targets) for (const g of targets) if (Math.abs(val - g) < th) return g; return val }
  const taRef = useRef<HTMLTextAreaElement>(null)
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number } | null>(null)
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [t.text, t.size, t.w, t.font, zoom])
  useEffect(() => { if (!active) return; const el = taRef.current; if (!el) return; const id = requestAnimationFrame(() => { try { el.focus({ preventScroll: true }) } catch { el.focus() } }); return () => cancelAnimationFrame(id) }, [active])

  const down = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* */ }
    drag.current = { mode, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, ow: t.w }; onSelect()
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const dx = (e.clientX - d.sx) / zoom, dy = (e.clientY - d.sy) / zoom
    if (d.mode === 'move') onChange({ x: Math.round(snap(d.ox + dx, snapX)), y: Math.round(snap(d.oy + dy, snapY)) })
    else { const right = snap(d.ox + Math.max(40, d.ow + dx), snapX); onChange({ w: Math.max(40, Math.round(right - d.ox)) }) }
  }
  const up = (e: React.PointerEvent) => { drag.current = null; try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ } }

  const left = pan.x + t.x * zoom, top = pan.y + t.y * zoom, width = t.w * zoom
  return (
    <div className="absolute" style={{ left, top, width, pointerEvents: editable ? 'auto' : 'none' }}>
      {editable && active && (
        <>
          <div onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} title="Trascina per spostare"
            className="absolute -top-4 left-0 right-0 h-4 rounded-t cursor-move flex items-center justify-center touch-none" style={{ background: 'rgba(197,160,80,0.85)' }}>
            <div className="w-6 h-0.5 bg-white/80 rounded" />
          </div>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete() }} title="Elimina testo"
            className="absolute -top-4 -right-5 h-5 w-5 grid place-items-center rounded-full bg-black/60 text-white text-[11px] leading-none">×</button>
          <div onPointerDown={down('resize')} onPointerMove={move} onPointerUp={up} title="Trascina per allargare il box"
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 border border-white rounded-sm cursor-nwse-resize touch-none" style={{ background: 'rgb(197,160,80)' }} />
        </>
      )}
      <textarea ref={taRef} value={t.text} readOnly={!editable} spellCheck={false} rows={1} placeholder={editable ? 'Scrivi…' : ''}
        onChange={(e) => onChange({ text: e.target.value })}
        onPointerDown={(e) => { if (editable) { e.stopPropagation(); onSelect() } }}
        onFocus={onSelect}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur() }}
        onBlur={onCommitEmpty}
        className={`block w-full bg-transparent outline-none resize-none overflow-hidden ${editable && active ? 'ring-1 ring-[rgb(var(--gold-400))]' : ''}`}
        style={{ color: t.color, fontFamily: `"${t.font}"`, fontSize: t.size * zoom, lineHeight: 1.25, textAlign: t.align, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: editable ? 'text' : 'none', WebkitUserSelect: editable ? 'text' : 'none', touchAction: editable ? 'auto' : 'none', caretColor: t.color, cursor: editable ? 'text' : 'default' }} />
    </div>
  )
}
