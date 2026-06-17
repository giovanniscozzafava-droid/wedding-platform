import { useEffect, useRef, useState } from 'react'
import { UserPlus, Pencil, Trash2 } from 'lucide-react'

// Piantina grafica del tableau mariage: tavoli disegnati nella loro forma, trascinabili,
// con assegnazione invitati (clic o drag-and-drop). pos_x/pos_y = frazione 0..1 della sala.
export type PlanTable = {
  id: string; table_no: number; label: string | null; seats: number; shape: string
  pos_x: number | null; pos_y: number | null; rotation?: number | null; is_staff?: boolean | null
}
export type PlanGuest = { id: string; full_name: string; table_id: string | null; party_size?: number; rsvp?: string; age_group?: string }

// dimensione del tavolo in frazione della larghezza sala (poi convertita in px)
function tableSize(t: PlanTable): { w: number; h: number; round: boolean; u: boolean; oneSide: boolean } {
  const s = Math.max(2, t.seats ?? 8)
  if (t.shape === 'ROUND' || t.shape === 'SQUARE') { const d = Math.min(0.16, Math.max(0.075, 0.05 + s * 0.0075)); return { w: d, h: d, round: t.shape === 'ROUND', u: false, oneSide: false } }
  if (t.shape === 'HEAD') { return { w: Math.min(0.34, Math.max(0.14, 0.07 + s * 0.012)), h: 0.05, round: false, u: false, oneSide: true } }
  if (t.shape === 'FERRO_CAVALLO') { return { w: Math.min(0.34, Math.max(0.16, 0.09 + s * 0.011)), h: 0.18, round: false, u: true, oneSide: false } }
  // RECT / IMPERIALE
  return { w: Math.min(0.40, Math.max(0.13, 0.08 + s * 0.011)), h: 0.055, round: false, u: false, oneSide: false }
}

const label = (t: PlanTable) => t.label ?? `Tavolo ${t.table_no}`

export function TableauPlan({
  tables, guests, room, onMove, onAssignGuest, onOpenAssign, onEditTable, onDeleteTable,
}: {
  tables: PlanTable[]; guests: PlanGuest[]
  room?: { shape: string; ratio: number }
  onMove: (id: string, pos_x: number, pos_y: number) => void
  onAssignGuest: (guestId: string, tableId: string) => void
  onOpenAssign: (t: PlanTable) => void
  onEditTable: (t: PlanTable) => void
  onDeleteTable: (t: PlanTable) => void
}) {
  const planRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [livePos, setLivePos] = useState<{ id: string; x: number; y: number } | null>(null) // posizione fluida durante il drag
  const [overTable, setOverTable] = useState<string | null>(null)

  useEffect(() => {
    const el = planRef.current; if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const seatedAt = (id: string) => guests.filter((g) => g.table_id === id)
  const unseated = guests.filter((g) => !g.table_id && (g.rsvp ?? 'PENDING') !== 'NO' && g.age_group !== 'INFANT')

  // posizione di default (griglia) per i tavoli senza pos
  const withPos = tables.map((t, i) => {
    if (t.pos_x != null && t.pos_y != null) return { t, x: t.pos_x, y: t.pos_y }
    const cols = Math.ceil(Math.sqrt(Math.max(1, tables.length)))
    const r = Math.floor(i / cols), c = i % cols
    const rows = Math.ceil(tables.length / cols)
    return { t, x: (c + 1) / (cols + 1), y: rows > 0 ? (r + 1) / (rows + 1) : 0.5 }
  })

  function onTablePointerDown(e: React.PointerEvent, id: string, x: number, y: number) {
    e.stopPropagation()
    const r = planRef.current!.getBoundingClientRect()
    drag.current = { id, dx: (e.clientX - r.left) / r.width - x, dy: (e.clientY - r.top) / r.height - y }
    setDragId(id)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const r = planRef.current!.getBoundingClientRect()
    const x = Math.min(0.98, Math.max(0.02, (e.clientX - r.left) / r.width - d.dx))
    const y = Math.min(0.98, Math.max(0.02, (e.clientY - r.top) / r.height - d.dy))
    setLivePos({ id: d.id, x, y }) // solo locale: fluido, niente scrittura DB a ogni frame
  }
  function onPointerUp() {
    const d = drag.current; const lp = livePos
    if (d && lp && lp.id === d.id) onMove(d.id, lp.x, lp.y) // commit finale al DB
    drag.current = null; setDragId(null); setLivePos(null)
  }

  return (
    <div className="flex gap-3">
      {/* SALA / piantina */}
      <div className="flex-1 min-w-0">
        <div ref={planRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          className="relative w-full rounded-xl border border-[rgb(var(--border))] overflow-hidden select-none"
          style={{ aspectRatio: String(room?.ratio ?? 1.6), background: 'repeating-linear-gradient(45deg, rgb(var(--bg-sunken)) 0 12px, rgb(var(--bg)) 12px 24px)' }}>
          {/* forma a L: ritaglio l'angolo in alto a destra con il colore di sfondo */}
          {room?.shape === 'elle' && <div className="absolute top-0 right-0 w-[38%] h-[42%] bg-[rgb(var(--bg))] border-l border-b border-dashed border-[rgb(var(--border))] pointer-events-none z-[5]" />}
          {/* indicazione "fronte sala / pista" in basso */}
          <div className="absolute inset-x-0 bottom-0 h-7 bg-[rgb(var(--gold-100))]/60 border-t border-dashed border-[rgb(var(--gold-400))] flex items-center justify-center text-[10px] tracking-widest text-[rgb(var(--gold-700))] pointer-events-none">PISTA / FRONTE SALA</div>

          {withPos.map(({ t, x: bx, y: by }) => {
            const x = livePos && livePos.id === t.id ? livePos.x : bx
            const y = livePos && livePos.id === t.id ? livePos.y : by
            const sz = tableSize(t)
            const wpx = Math.max(28, sz.w * box.w), hpx = sz.round ? wpx : Math.max(18, sz.h * box.h)
            const seated = seatedAt(t.id)
            const over = (t.seats ?? 0) - seated.length
            const isOver = overTable === t.id
            return (
              <div key={t.id}
                onPointerDown={(e) => onTablePointerDown(e, t.id, x, y)}
                onDoubleClick={() => onOpenAssign(t)}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('text/guest')) { e.preventDefault(); setOverTable(t.id) } }}
                onDragLeave={() => setOverTable((v) => (v === t.id ? null : v))}
                onDrop={(e) => { const gid = e.dataTransfer.getData('text/guest'); setOverTable(null); if (gid) { e.preventDefault(); onAssignGuest(gid, t.id) } }}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center text-center transition-shadow ${dragId === t.id ? 'z-30 shadow-xl' : 'z-10 hover:z-20'}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: wpx, height: sz.u ? wpx * 0.7 : hpx, transform: `translate(-50%,-50%) rotate(${t.rotation ?? 0}deg)` }}
                title={`${label(t)} — ${seated.length}/${t.seats} posti`}>
                <TableShape shape={t.shape} wpx={wpx} hpx={sz.u ? wpx * 0.7 : hpx} seats={t.seats ?? 0} filled={seated.length}
                  staff={!!t.is_staff} crown={/spos/i.test(label(t))} over={over < 0} highlight={isOver} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1 overflow-hidden">
                  <span className="text-[10px] font-semibold leading-tight text-[rgb(var(--fg))] drop-shadow-sm truncate max-w-full">{label(t)}</span>
                  <span className={`text-[9px] leading-tight ${over < 0 ? 'text-[rgb(var(--rose-600))] font-semibold' : 'text-[rgb(var(--fg-muted))]'}`}>{seated.length}/{t.seats}</span>
                  {wpx >= 64 && seated.length > 0 && (
                    <div className="mt-0.5 leading-[1.15] text-center max-w-full">
                      {seated.slice(0, 6).map((g) => <div key={g.id} className="text-[7.5px] text-[rgb(var(--fg-muted))] truncate max-w-full">{g.full_name}</div>)}
                      {seated.length > 6 && <div className="text-[7.5px] text-[rgb(var(--fg-subtle))]">+{seated.length - 6}</div>}
                    </div>
                  )}
                </div>
                {/* azioni tavolo: modifica / elimina (compaiono su hover) */}
                <div className="absolute -top-2 -right-2 z-40 hidden group-hover:flex items-center gap-0.5" style={{ transform: `rotate(${-(t.rotation ?? 0)}deg)` }}>
                  <button title="Modifica tavolo" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEditTable(t) }} className="h-5 w-5 rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><Pencil size={10} /></button>
                  <button title="Elimina tavolo" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDeleteTable(t) }} className="h-5 w-5 rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow flex items-center justify-center text-[rgb(var(--rose-500))] hover:bg-[rgb(var(--bg-sunken))]"><Trash2 size={10} /></button>
                </div>
              </div>
            )
          })}
          {tables.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-[rgb(var(--fg-subtle))]">Aggiungi tavoli, poi trascinali nella sala</div>}
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1.5">Trascina i tavoli per posizionarli · doppio clic per assegnare invitati · trascina un invitato dall'elenco a destra sul tavolo.</p>
      </div>

      {/* ELENCO non seduti (drag verso i tavoli) */}
      <div className="w-44 shrink-0 border border-[rgb(var(--border))] rounded-xl p-2 flex flex-col max-h-[60vh]">
        <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><UserPlus size={12} /> Da sedere ({unseated.length})</p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {unseated.length === 0 && <p className="text-[11px] text-[rgb(var(--fg-subtle))] italic">Tutti seduti 🎉</p>}
          {unseated.map((g) => (
            <div key={g.id} draggable
              onDragStart={(e) => { e.dataTransfer.setData('text/guest', g.id); e.dataTransfer.effectAllowed = 'move' }}
              className="text-[11px] px-2 py-1 rounded-md bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))] cursor-grab active:cursor-grabbing truncate"
              title={g.full_name}>
              {g.full_name}{(g.party_size ?? 1) > 1 && <span className="text-[rgb(var(--fg-subtle))]"> ×{g.party_size}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Disegno del tavolo (SVG) per forma, con i posti come puntini (pieni = occupati).
function TableShape({ shape, wpx, hpx, seats, filled, staff, crown, over, highlight }: {
  shape: string; wpx: number; hpx: number; seats: number; filled: number; staff: boolean; crown?: boolean; over: boolean; highlight: boolean
}) {
  const stroke = highlight ? 'rgb(184,146,63)' : over ? 'rgb(225,29,72)' : staff ? 'rgb(120,90,200)' : 'rgb(150,150,150)'
  const fill = staff ? 'rgba(120,90,200,.10)' : highlight ? 'rgba(184,146,63,.18)' : 'rgba(0,0,0,.04)'
  const seatDot = (i: number) => (i < filled ? 'rgb(120,90,200)' : 'rgba(120,120,120,.45)')
  const dots: Array<{ x: number; y: number }> = []
  const W = 100, H = 100 * (hpx / Math.max(1, wpx))
  if (shape === 'ROUND') {
    for (let i = 0; i < seats; i++) { const a = (i / seats) * Math.PI * 2 - Math.PI / 2; dots.push({ x: 50 + 46 * Math.cos(a), y: H / 2 + (H / 2 - 4) * Math.sin(a) }) }
  } else if (shape === 'HEAD') {
    for (let i = 0; i < seats; i++) dots.push({ x: ((i + 0.5) / seats) * W, y: 6 }) // un solo lato (verso la sala)
  } else if (shape === 'FERRO_CAVALLO') {
    // posti sul perimetro esterno della U
    const per = Math.max(1, seats)
    for (let i = 0; i < per; i++) { const f = i / per; let x = 6, y = 6; if (f < 0.33) { x = 6; y = 6 + (f / 0.33) * (H - 12) } else if (f < 0.66) { x = 6 + ((f - 0.33) / 0.33) * (W - 12); y = H - 6 } else { x = W - 6; y = H - 6 - ((f - 0.66) / 0.34) * (H - 12) } dots.push({ x, y }) }
  } else {
    const half = Math.ceil(seats / 2)
    for (let i = 0; i < seats; i++) { const top = i < half; const k = top ? i : i - half; const n = top ? half : seats - half; dots.push({ x: ((k + 0.5) / Math.max(1, n)) * W, y: top ? 5 : H - 5 }) }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={wpx} height={hpx} className="overflow-visible">
      {shape === 'ROUND' ? <circle cx={50} cy={H / 2} r={42} fill={fill} stroke={stroke} strokeWidth={2.5} />
        : shape === 'FERRO_CAVALLO' ? <path d={`M14 ${H} L14 14 L${W - 14} 14 L${W - 14} ${H}`} fill="none" stroke={stroke} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
        : <rect x={6} y={H * 0.18} width={W - 12} height={H * 0.64} rx={shape === 'SQUARE' ? 6 : 10} fill={fill} stroke={stroke} strokeWidth={2.5} />}
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={3.2} fill={seatDot(i)} />)}
      {crown && <g transform={`translate(${W / 2}, ${H / 2})`}><text textAnchor="middle" dominantBaseline="central" fontSize="11">👑</text></g>}
    </svg>
  )
}

