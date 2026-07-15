import { useEffect, useRef, useState } from 'react'
import { motion, useSpring } from 'framer-motion'
import { UserPlus, Pencil, Trash2, ZoomIn, ZoomOut, Maximize, RotateCw } from 'lucide-react'
import { tableFootprint } from '@/lib/seatingStandards'

// Piantina grafica del tableau mariage: tavoli disegnati nella loro forma, trascinabili,
// con assegnazione invitati (clic o drag-and-drop). pos_x/pos_y = frazione 0..1 della sala.
export type PlanTable = {
  id: string; table_no: number; label: string | null; seats: number; shape: string
  pos_x: number | null; pos_y: number | null; rotation?: number | null; is_staff?: boolean | null
}
export type PlanGuest = { id: string; full_name: string; table_id: string | null; party_size?: number; rsvp?: string; age_group?: string }
export type Zone = { id: string; kind: string; label: string; points: Array<{ x: number; y: number }>; color: string }

// Aree (poligono) e Punti d'interesse (POI, 1 punto). I POI ingresso/uscita/bagni/rampa
// servono per la mobilità ridotta: si vedono sulla mappa per avvicinare i tavoli giusti.
export const ZONE_KINDS: Record<string, { label: string; color: string; emoji: string; area: boolean }> = {
  band:     { label: 'Band / DJ',      color: '#7c5cc4', emoji: '🎵', area: true },
  pista:    { label: 'Pista da ballo', color: '#c79a2e', emoji: '🕺', area: true },
  bar:      { label: 'Bar',            color: '#1f9e8f', emoji: '🍸', area: true },
  buffet:   { label: 'Buffet',         color: '#5f9a4f', emoji: '🍽️', area: true },
  torta:    { label: 'Tavolo torta',   color: '#d56a9c', emoji: '🎂', area: true },
  area:     { label: 'Area',           color: '#8a8a8a', emoji: '▦', area: true },
  ingresso: { label: 'Ingresso',       color: '#2e9e57', emoji: '🚪', area: false },
  uscita:   { label: 'Uscita',         color: '#e11d48', emoji: '🏃', area: false },
  bagni:    { label: 'Bagni',          color: '#3b82f6', emoji: '🚻', area: false },
  rampa:    { label: 'Rampa / Scala',  color: '#6366f1', emoji: '♿', area: false },
}
function zoneCentroid(pts: Array<{ x: number; y: number }>) {
  const n = Math.max(1, pts.length)
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n }
}
function newId() { try { return crypto.randomUUID() } catch { return 'z' + Date.now() + Math.round(Math.random() * 1e6) } }

// dimensione del tavolo in frazione della larghezza sala (poi convertita in px)
function tableSize(t: PlanTable): { w: number; h: number; round: boolean; u: boolean; oneSide: boolean } {
  const s = Math.max(2, t.seats ?? 8)
  if (t.shape === 'ROUND' || t.shape === 'SQUARE') { const d = Math.min(0.16, Math.max(0.075, 0.05 + s * 0.0075)); return { w: d, h: d, round: t.shape === 'ROUND', u: false, oneSide: false } }
  if (t.shape === 'HEAD') { return { w: Math.min(0.34, Math.max(0.14, 0.07 + s * 0.012)), h: 0.05, round: false, u: false, oneSide: true } }
  if (t.shape === 'FERRO_CAVALLO') { return { w: Math.min(0.34, Math.max(0.16, 0.09 + s * 0.011)), h: 0.18, round: false, u: true, oneSide: false } }
  // RECT / IMPERIALE
  return { w: Math.min(0.40, Math.max(0.13, 0.08 + s * 0.011)), h: 0.055, round: false, u: false, oneSide: false }
}

// Posizione di ogni sedia nel riquadro del tavolo (0..1) + direzione "verso l'esterno"
// (ox, oy). Serve a scrivere il nome dell'invitato FUORI dal tavolo, in corrispondenza
// della sediolina, sempre leggibile (testo dritto, ancorato verso l'esterno).
function seatLayout(shape: string, seats: number): Array<{ x: number; y: number; ox: number; oy: number }> {
  const pts: Array<{ x: number; y: number; ox: number; oy: number }> = []
  const n = Math.max(1, seats)
  if (shape === 'ROUND' || shape === 'SQUARE') {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pts.push({ x: 0.5 + 0.5 * Math.cos(a), y: 0.5 + 0.5 * Math.sin(a), ox: Math.cos(a), oy: Math.sin(a) }) }
  } else if (shape === 'HEAD') {
    for (let i = 0; i < n; i++) pts.push({ x: (i + 0.5) / n, y: 0, ox: 0, oy: -1 }) // un solo lato, verso la sala
  } else if (shape === 'FERRO_CAVALLO') {
    for (let i = 0; i < n; i++) { const f = i / n; if (f < 1 / 3) pts.push({ x: 0, y: f * 3, ox: -1, oy: 0 }); else if (f < 2 / 3) pts.push({ x: (f - 1 / 3) * 3, y: 1, ox: 0, oy: 1 }); else pts.push({ x: 1, y: 1 - (f - 2 / 3) * 3, ox: 1, oy: 0 }) }
  } else { // RECT / IMPERIALE: metà sopra, metà sotto
    const half = Math.ceil(n / 2)
    for (let i = 0; i < n; i++) { const top = i < half; const k = top ? i : i - half; const m = top ? half : n - half; pts.push({ x: (k + 0.5) / Math.max(1, m), y: top ? 0 : 1, ox: 0, oy: top ? -1 : 1 }) }
  }
  return pts
}

const label = (t: PlanTable) => t.label ?? `Tavolo ${t.table_no}`

export function TableauPlan({
  tables, guests, room, roomDims, floorPlanUrl, floorPlanRatio, zones, onZonesChange, onMove, onAssignGuest, onOpenAssign, onEditTable, onDeleteTable, onRotate,
}: {
  tables: PlanTable[]; guests: PlanGuest[]
  room?: { shape: string; ratio: number }
  roomDims?: { width_m: number; length_m: number } | null  // metratura reale → planimetria IN SCALA
  floorPlanUrl?: string | null    // piantina reale della location, proiettata come sfondo
  floorPlanRatio?: number | null
  zones?: Zone[]
  onZonesChange?: (zones: Zone[]) => void
  onMove: (id: string, pos_x: number, pos_y: number) => void
  onAssignGuest: (guestId: string, tableId: string) => void
  onOpenAssign: (t: PlanTable) => void
  onEditTable: (t: PlanTable) => void
  onDeleteTable: (t: PlanTable) => void
  onRotate?: (t: PlanTable, rotation: number) => void
}) {
  const planRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [livePos, setLivePos] = useState<{ id: string; x: number; y: number } | null>(null) // posizione fluida durante il drag
  const [overTable, setOverTable] = useState<string | null>(null)
  const [overUnseat, setOverUnseat] = useState(false)
  // Zone/POI (mirror locale per feedback immediato, persistito via onZonesChange)
  const [localZones, setLocalZones] = useState<Zone[]>(zones ?? [])
  const [drawKind, setDrawKind] = useState<string | null>(null)
  const [pending, setPending] = useState<Array<{ x: number; y: number }>>([])
  const poiDrag = useRef<string | null>(null)
  // Sync dalla prop SOLO quando non stai disegnando/trascinando: altrimenti un refetch
  // (re-render) sovrascriveva lo stato locale e "cancellava tutto" mentre creavi una zona.
  useEffect(() => { if (!drawKind && !poiDrag.current) setLocalZones(zones ?? []) }, [zones, drawKind])

  function persistZones(next: Zone[]) { setLocalZones(next); onZonesChange?.(next) }
  function ptFromEvent(e: { clientX: number; clientY: number }) {
    const r = planRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  function onPlanDrawClick(e: React.MouseEvent) {
    if (!drawKind) return
    const cfg = ZONE_KINDS[drawKind]!; const pt = ptFromEvent(e)
    if (cfg.area) setPending((p) => [...p, pt])
    else { persistZones([...localZones, { id: newId(), kind: drawKind, label: cfg.label, color: cfg.color, points: [pt] }]); setDrawKind(null) }
  }
  function finishArea() {
    if (!drawKind || pending.length < 3) return
    const cfg = ZONE_KINDS[drawKind]!
    persistZones([...localZones, { id: newId(), kind: drawKind, label: cfg.label, color: cfg.color, points: pending }])
    setDrawKind(null); setPending([])
  }
  function removeZone(id: string) { persistZones(localZones.filter((z) => z.id !== id)) }

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

  // AMPIEZZA SALA ∝ INVITATI: con tanti tavoli la planimetria si proietta più grande (canvas
  // scrollabile/zoomabile) così TUTTI i nomi entrano leggibili. Identità: il canvas cresce di
  // `roomScale` e la frazione dei tavoli si riduce di `roomScale` → ogni tavolo resta della STESSA
  // dimensione in px (nomi leggibili) ma su una sala più ampia, quindi senza accavallarsi. Sotto la
  // capienza base (≈120 invitati) la sala resta identica a prima.
  const BASE_CAP = 12 // tavoli che entrano comodi al 100% (≈10 posti l'uno ≈ 120 invitati)
  const roomScale = Math.max(1, Math.sqrt(Math.max(1, tables.length) / BASE_CAP))

  // SCALA REALE: se conosco la metratura della sala (m), disegno tutto in scala — i tavoli alla
  // loro misura fisica standard (footprint), niente più tavoli "elastici". px_per_metro = larghezza
  // canvas / larghezza sala. In questa modalità non serve la crescita artificiale `roomScale`.
  const scaleMode = !!(roomDims && roomDims.width_m > 0 && roomDims.length_m > 0)
  const effRoomScale = scaleMode ? 1 : roomScale
  const pxPerM = scaleMode && box.w ? box.w / roomDims!.width_m : 0

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

  // ── DRAG INVITATO stile "The Sims": prendi un nominativo e lo porti al tavolo; mentre lo
  //    trascini penzola dal cursore (molla). Pointer-based (mouse + touch), robusto, con hit-test
  //    via elementFromPoint su [data-seat-target] (tavoli) e [data-unseat-target] (elenco).
  const gdrag = useRef<{ id: string; name: string; lastX: number } | null>(null)
  const [gdragUi, setGdragUi] = useState<{ id: string; name: string; x: number; y: number; vx: number } | null>(null)
  function hitTargets(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null
    return {
      tableId: el?.closest('[data-seat-target]')?.getAttribute('data-table-id') ?? null,
      unseat: !!el?.closest('[data-unseat-target]'),
    }
  }
  function onGuestPointerMove(e: PointerEvent) {
    const st = gdrag.current; if (!st) return
    const vx = e.clientX - st.lastX; st.lastX = e.clientX
    const { tableId, unseat } = hitTargets(e.clientX, e.clientY)
    setOverTable(tableId); setOverUnseat(unseat)
    setGdragUi({ id: st.id, name: st.name, x: e.clientX, y: e.clientY, vx })
  }
  function onGuestPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onGuestPointerMove)
    const st = gdrag.current; gdrag.current = null
    if (st) {
      const { tableId, unseat } = hitTargets(e.clientX, e.clientY)
      // I tavoli sono bersagli piccoli in una sala grande: rilasciare ESATTAMENTE sopra
      // il cerchio è difficile → l'hit-test falliva e "non me lo fa mettere". Se il puntatore
      // non è finito sopra un tavolo (né sull'elenco per togliere), aggancia comunque al tavolo
      // più VICINO al punto di rilascio (entro una soglia), così basta avvicinarsi.
      let target = tableId
      if (!target && !unseat) target = nearestTableId(e.clientX, e.clientY)
      if (target) onAssignGuest(st.id, target)
      else if (unseat) onAssignGuest(st.id, null as any)
    }
    setGdragUi(null); setOverTable(null); setOverUnseat(false)
  }
  // Tavolo il cui centro è più vicino al punto (clientX,clientY), entro ~90px. null se troppo lontano.
  function nearestTableId(clientX: number, clientY: number): string | null {
    const rect = planRef.current?.getBoundingClientRect(); if (!rect || !rect.width || !rect.height) return null
    let best: string | null = null, bestD = Infinity
    for (const { t, x, y } of withPos) {
      const cx = rect.left + x * rect.width, cy = rect.top + y * rect.height
      const d = Math.hypot(clientX - cx, clientY - cy)
      if (d < bestD) { bestD = d; best = t.id }
    }
    return bestD <= 90 ? best : null
  }
  function startGuestDrag(e: React.PointerEvent, g: PlanGuest) {
    e.preventDefault(); e.stopPropagation() // niente drag nativo, niente drag-tavolo
    gdrag.current = { id: g.id, name: g.full_name, lastX: e.clientX }
    setGdragUi({ id: g.id, name: g.full_name, x: e.clientX, y: e.clientY, vx: 0 })
    window.addEventListener('pointermove', onGuestPointerMove)
    window.addEventListener('pointerup', onGuestPointerUp, { once: true })
  }

  return (
    <div className="flex gap-3">
      {/* SALA / piantina */}
      <div className="flex-1 min-w-0">
        {/* Controlli zoom */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[11px] text-[rgb(var(--fg-muted))] mr-1">Zoom</span>
          <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))} title="Riduci"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]"><ZoomOut size={14} /></button>
          <span className="text-[11px] tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.2).toFixed(2)))} title="Ingrandisci"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]"><ZoomIn size={14} /></button>
          <button onClick={() => setZoom(1)} title="Adatta" disabled={zoom === 1}
            className="h-7 px-2 inline-flex items-center gap-1 rounded-md border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-40 text-[11px]"><Maximize size={13} /> Adatta</button>
          {zoom > 1 && <span className="text-[10px] text-[rgb(var(--fg-subtle))]">scorri per spostarti · ingrandisci per leggere i nomi alle sedie</span>}
          {scaleMode && <span className="text-[10px] text-[rgb(var(--gold-700))]">In scala · sala {roomDims!.width_m}×{roomDims!.length_m} m — ingrandisci per leggere i nomi alle sedie</span>}
          {!scaleMode && roomScale > 1.01 && <span className="text-[10px] text-[rgb(var(--gold-700))]">Sala proiettata in grande per {tables.length} tavoli — scorri per esplorarla, i nomi restano leggibili</span>}
        </div>

        {/* Zone & punti: aree (poligono) + POI (1 clic). Entrate/uscite/bagni utili per la mobilità ridotta. */}
        {onZonesChange && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span className="text-[11px] text-[rgb(var(--fg-muted))] mr-0.5">Zone:</span>
            {(['band', 'pista', 'bar', 'buffet', 'torta'] as const).map((k) => (
              <button key={k} onClick={() => { setDrawKind(k); setPending([]) }}
                className={`text-[11px] px-2 py-1 rounded-md border ${drawKind === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                {ZONE_KINDS[k]!.emoji} {ZONE_KINDS[k]!.label}
              </button>
            ))}
            <span className="text-[11px] text-[rgb(var(--fg-muted))] mx-0.5">Punti:</span>
            {(['ingresso', 'uscita', 'bagni', 'rampa'] as const).map((k) => (
              <button key={k} onClick={() => { setDrawKind(k); setPending([]) }}
                className={`text-[11px] px-2 py-1 rounded-md border ${drawKind === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                {ZONE_KINDS[k]!.emoji} {ZONE_KINDS[k]!.label}
              </button>
            ))}
            {drawKind && (
              <span className="inline-flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-md bg-[rgb(var(--gold-100))]">
                <span className="text-[11px] text-[rgb(var(--gold-700))]">
                  {ZONE_KINDS[drawKind]!.area ? `Clicca i vertici di "${ZONE_KINDS[drawKind]!.label}" (min 3), poi Fine` : `Clicca dove mettere "${ZONE_KINDS[drawKind]!.label}"`}
                </span>
                {ZONE_KINDS[drawKind]!.area && <button onClick={finishArea} disabled={pending.length < 3} className="text-[11px] px-1.5 py-0.5 rounded bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] disabled:opacity-40">Fine</button>}
                <button onClick={() => { setDrawKind(null); setPending([]) }} className="text-[11px] px-1.5 py-0.5 rounded border border-[rgb(var(--border))]">Annulla</button>
              </span>
            )}
          </div>
        )}

        {/* Contenitore scrollabile per lo zoom */}
        <div className="w-full overflow-auto rounded-xl border border-[rgb(var(--border))]" style={{ maxHeight: '70vh' }}>
        <div ref={planRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
          className="relative overflow-hidden select-none"
          style={{
            width: `${(zoom * effRoomScale * 100).toFixed(1)}%`,
            aspectRatio: String(scaleMode ? (roomDims!.width_m / roomDims!.length_m) : floorPlanUrl ? (floorPlanRatio || room?.ratio || 1.6) : (room?.ratio ?? 1.6)),
            background: floorPlanUrl
              ? `#ffffff url("${floorPlanUrl}") center / contain no-repeat`
              : 'repeating-linear-gradient(45deg, rgb(var(--bg-sunken)) 0 12px, rgb(var(--bg)) 12px 24px)',
          }}>
          {/* Nessuna zona "pista" forzata: le zone (pista/band/bar/buffet/torta) le sceglie e posiziona
              chi costruisce il tableau dalla barra "Zone" qui sopra. */}
          {/* forma a L: angolo in alto a destra fuori sala, evidenziato */}
          {!floorPlanUrl && room?.shape === 'elle' && (
            <div className="absolute top-0 right-0 w-[38%] h-[42%] z-[6] pointer-events-none flex items-center justify-center"
              style={{ background: 'repeating-linear-gradient(45deg, rgb(225 29 72 / 0.10) 0 8px, transparent 8px 16px)', borderLeft: '2px dashed rgb(225 29 72 / 0.5)', borderBottom: '2px dashed rgb(225 29 72 / 0.5)' }}>
              <span className="text-[9px] tracking-widest font-semibold text-[rgb(225_29_72_/_0.7)] rotate-[-12deg]">FUORI SALA</span>
            </div>
          )}

          {/* AREE (poligono) — sotto i tavoli */}
          {localZones.filter((z) => ZONE_KINDS[z.kind]?.area).map((z) => {
            const c = ZONE_KINDS[z.kind] ?? ZONE_KINDS.area!
            const cen = zoneCentroid(z.points)
            return (
              <div key={z.id}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ zIndex: 4, pointerEvents: 'none' }}>
                  <polygon points={z.points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} fill={c.color} fillOpacity={0.14} stroke={c.color} strokeOpacity={0.75} strokeWidth={0.5} />
                </svg>
                <div className="absolute group" style={{ left: `${cen.x * 100}%`, top: `${cen.y * 100}%`, transform: 'translate(-50%,-50%)', zIndex: 5 }}>
                  <span className="inline-flex items-center gap-1 text-[9px] px-1 py-0.5 rounded whitespace-nowrap" style={{ background: 'rgb(var(--bg-elev))', border: `1px solid ${c.color}`, color: c.color }}>
                    {c.emoji} {z.label}
                    {onZonesChange && <button onClick={() => removeZone(z.id)} title="Elimina zona" className="ml-0.5 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]">×</button>}
                  </span>
                </div>
              </div>
            )
          })}

          {/* PUNTI (POI): ingresso/uscita/bagni/rampa — trascinabili */}
          {localZones.filter((z) => !ZONE_KINDS[z.kind]?.area).map((z) => {
            const c = ZONE_KINDS[z.kind] ?? ZONE_KINDS.area!
            const p = z.points[0] ?? { x: 0.5, y: 0.5 }
            return (
              <div key={z.id}
                onPointerDown={onZonesChange ? (e) => { e.stopPropagation(); poiDrag.current = z.id; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) } : undefined}
                onPointerMove={onZonesChange ? (e) => { if (poiDrag.current === z.id) { const pt = ptFromEvent(e); setLocalZones((zs) => zs.map((x) => (x.id === z.id ? { ...x, points: [pt] } : x))) } } : undefined}
                onPointerUp={onZonesChange ? () => { if (poiDrag.current === z.id) { poiDrag.current = null; onZonesChange?.(localZones) } } : undefined}
                className="absolute group" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: 'translate(-50%,-50%)', zIndex: 6, cursor: onZonesChange ? 'grab' : 'default', touchAction: 'none' }}>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-[9px] shadow whitespace-nowrap" style={{ background: c.color }}>
                  <span>{c.emoji}</span><span className="font-semibold">{z.label}</span>
                </div>
                {onZonesChange && <button onPointerDown={(e) => e.stopPropagation()} onClick={() => removeZone(z.id)} title="Elimina punto" className="absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full bg-black/60 text-white text-[9px] leading-none hidden group-hover:flex items-center justify-center">×</button>}
              </div>
            )
          })}

          {withPos.map(({ t, x: bx, y: by }) => {
            const x = livePos && livePos.id === t.id ? livePos.x : bx
            const y = livePos && livePos.id === t.id ? livePos.y : by
            const sz = tableSize(t)
            let wpx: number, hpx: number
            if (scaleMode) {
              const fp = tableFootprint(t.shape, t.seats ?? 8)
              wpx = Math.max(24, fp.w * pxPerM)
              hpx = fp.round ? wpx : Math.max(16, fp.l * pxPerM)
            } else {
              wpx = Math.max(28, (sz.w / roomScale) * box.w)
              hpx = sz.round ? wpx : Math.max(18, (sz.h / roomScale) * box.h)
            }
            const seated = seatedAt(t.id)
            const over = (t.seats ?? 0) - seated.length
            const isOver = overTable === t.id
            const realHpx = (!scaleMode && sz.u) ? wpx * 0.7 : hpx
            const showSeatNames = !t.is_staff && wpx >= 44 && seated.length > 0
            return (
              <div key={t.id}
                data-seat-target data-table-id={t.id}
                onPointerDown={(e) => onTablePointerDown(e, t.id, x, y)}
                onDoubleClick={() => onOpenAssign(t)}
                onDragOver={(e) => { if (e.dataTransfer.types.includes('text/guest')) { e.preventDefault(); setOverTable(t.id) } }}
                onDragLeave={() => setOverTable((v) => (v === t.id ? null : v))}
                onDrop={(e) => { const gid = e.dataTransfer.getData('text/guest'); setOverTable(null); if (gid) { e.preventDefault(); onAssignGuest(gid, t.id) } }}
                className={`group absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-center text-center transition-shadow ${dragId === t.id ? 'z-30 shadow-xl' : 'z-10 hover:z-20'}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: wpx, height: realHpx, transform: `translate(-50%,-50%) rotate(${t.rotation ?? 0}deg)` }}
                title={`${label(t)} — ${seated.length}/${t.seats} posti`}>
                {/* nomi alle sedie (esterni, in corrispondenza dei posti) */}
                {showSeatNames && <SeatNames shape={t.shape} seats={t.seats ?? 0} seated={seated} wpx={wpx} hpx={realHpx} onGuestDown={startGuestDrag} />}
                <TableShape shape={t.shape} wpx={wpx} hpx={realHpx} seats={t.seats ?? 0} filled={seated.length}
                  staff={!!t.is_staff} crown={/spos/i.test(label(t))} over={over < 0} highlight={isOver} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1 overflow-hidden">
                  <span className="text-[10px] font-semibold leading-tight text-[rgb(var(--fg))] drop-shadow-sm truncate max-w-full">{label(t)}</span>
                  <span className={`text-[9px] leading-tight ${over < 0 ? 'text-[rgb(var(--rose-600))] font-semibold' : 'text-[rgb(var(--fg-muted))]'}`}>{seated.length}/{t.seats}</span>
                </div>
                {/* azioni tavolo: ruota / modifica / elimina (compaiono su hover) */}
                <div className="absolute -top-2 -right-2 z-40 hidden group-hover:flex items-center gap-0.5" style={{ transform: `rotate(${-(t.rotation ?? 0)}deg)` }}>
                  {onRotate && t.shape !== 'ROUND' && (
                    <button title="Ruota di 45°" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRotate(t, Math.round(((t.rotation ?? 0) + 45) % 360)) }} className="h-5 w-5 rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><RotateCw size={10} /></button>
                  )}
                  <button title="Modifica tavolo" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEditTable(t) }} className="h-5 w-5 rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><Pencil size={10} /></button>
                  <button title="Elimina tavolo" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDeleteTable(t) }} className="h-5 w-5 rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow flex items-center justify-center text-[rgb(var(--rose-500))] hover:bg-[rgb(var(--bg-sunken))]"><Trash2 size={10} /></button>
                </div>
              </div>
            )
          })}
          {tables.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-[rgb(var(--fg-subtle))]">Aggiungi tavoli, poi trascinali nella sala</div>}

          {/* Overlay di disegno zona/POI: cattura i clic mentre disegni */}
          {drawKind && <div className="absolute inset-0" style={{ zIndex: 34, cursor: 'crosshair' }} onClick={onPlanDrawClick} />}
          {drawKind && ZONE_KINDS[drawKind]?.area && pending.length > 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" style={{ zIndex: 35, pointerEvents: 'none' }}>
              <polyline points={pending.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')} fill={ZONE_KINDS[drawKind]!.color} fillOpacity={0.12} stroke={ZONE_KINDS[drawKind]!.color} strokeWidth={0.6} />
              {pending.map((p, i) => <circle key={i} cx={p.x * 100} cy={p.y * 100} r={1.1} fill={ZONE_KINDS[drawKind]!.color} />)}
            </svg>
          )}
        </div>
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1.5">Trascina i tavoli per posizionarli · doppio clic per assegnare invitati · trascina un invitato dall'elenco a destra sul tavolo · ingrandisci per leggere i nomi alle sedie.</p>
      </div>

      {/* ELENCO non seduti (drag verso i tavoli) + drop-zone per TOGLIERE dal tavolo */}
      <div data-unseat-target
        onDragOver={(e) => { if (e.dataTransfer.types.includes('text/guest')) { e.preventDefault(); setOverUnseat(true) } }}
        onDragLeave={() => setOverUnseat(false)}
        onDrop={(e) => { const gid = e.dataTransfer.getData('text/guest'); setOverUnseat(false); if (gid) { e.preventDefault(); onAssignGuest(gid, null as any) } }}
        className={`w-44 shrink-0 border rounded-xl p-2 flex flex-col max-h-[70vh] transition-colors ${overUnseat ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]/40' : 'border-[rgb(var(--border))]'}`}>
        <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><UserPlus size={12} /> Da sedere ({unseated.length})</p>
        <p className="text-[10px] text-[rgb(var(--fg-subtle))] mb-1.5">{overUnseat ? 'Rilascia qui per togliere dal tavolo' : 'Prendi un nominativo e trascinalo sul tavolo'}</p>
        <div className="flex-1 overflow-y-auto space-y-1">
          {unseated.length === 0 && <p className="text-[11px] text-[rgb(var(--fg-subtle))] italic">Tutti seduti</p>}
          {unseated.map((g) => (
            <div key={g.id}
              onPointerDown={(e) => startGuestDrag(e, g)}
              className={`text-[11px] px-2 py-1 rounded-md bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))] cursor-grab active:cursor-grabbing truncate select-none ${gdragUi?.id === g.id ? 'opacity-30' : ''}`}
              style={{ touchAction: 'none' }}
              title={`${g.full_name} — trascina su un tavolo`}>
              {g.full_name}{(g.party_size ?? 1) > 1 && <span className="text-[rgb(var(--fg-subtle))]"> ×{g.party_size}</span>}
            </div>
          ))}
        </div>
      </div>
      {gdragUi && <GuestDangle x={gdragUi.x} y={gdragUi.y} vx={gdragUi.vx} name={gdragUi.name} />}
    </div>
  )
}

// Omino "The Sims" che penzola dal cursore mentre trascini un invitato: oscilla in base alla
// velocità orizzontale (molla) e si placa quando ti fermi. Solo visuale (pointerEvents none).
function GuestDangle({ x, y, vx, name }: { x: number; y: number; vx: number; name: string }) {
  const angle = useSpring(0, { stiffness: 140, damping: 7, mass: 0.9 })
  useEffect(() => {
    angle.set(Math.max(-34, Math.min(34, -vx * 1.5)))
    const t = setTimeout(() => angle.set(0), 90) // fermo → torna dritto oscillando (penzola)
    return () => clearTimeout(t)
  }, [x, vx, angle])
  return (
    <div style={{ position: 'fixed', left: x, top: y, zIndex: 200, pointerEvents: 'none', transform: 'translateX(-50%)' }}>
      <motion.div style={{ transformOrigin: 'top center', rotate: angle }}>
        <Omino name={name} />
      </motion.div>
    </div>
  )
}

function Omino({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] ?? name
  return (
    <div className="flex flex-col items-center" style={{ filter: 'drop-shadow(0 6px 6px rgba(0,0,0,.25))' }}>
      {/* punto di presa (mano che afferra) */}
      <div style={{ width: 6, height: 6, borderRadius: 999, background: 'rgb(var(--gold-500))', marginBottom: -1 }} />
      <svg width="34" height="46" viewBox="0 0 34 46">
        {/* testa */}
        <circle cx="17" cy="9" r="7" fill="rgb(var(--gold-500))" stroke="white" strokeWidth="1.5" />
        {/* corpo */}
        <rect x="11" y="15" width="12" height="16" rx="5" fill="rgb(var(--gold-500))" />
        {/* braccia a penzoloni */}
        <line x1="11" y1="19" x2="6" y2="30" stroke="rgb(var(--gold-500))" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="23" y1="19" x2="28" y2="30" stroke="rgb(var(--gold-500))" strokeWidth="3.2" strokeLinecap="round" />
        {/* gambe a penzoloni */}
        <line x1="14" y1="31" x2="12" y2="43" stroke="rgb(var(--gold-500))" strokeWidth="3.6" strokeLinecap="round" />
        <line x1="20" y1="31" x2="22" y2="43" stroke="rgb(var(--gold-500))" strokeWidth="3.6" strokeLinecap="round" />
      </svg>
      <span className="mt-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap"
        style={{ background: 'rgb(var(--fg))', color: 'rgb(var(--bg-elev))' }}>{first}</span>
    </div>
  )
}

// Nomi degli invitati seduti, scritti FUORI dal tavolo in corrispondenza della sediolina.
// Testo sempre dritto (leggibile), ancorato verso l'esterno del tavolo.
function SeatNames({ shape, seats, seated, wpx, hpx, onGuestDown }: {
  shape: string; seats: number; seated: PlanGuest[]; wpx: number; hpx: number
  onGuestDown?: (e: React.PointerEvent, g: PlanGuest) => void
}) {
  const pts = seatLayout(shape, seats)
  const fs = Math.max(5.5, Math.min(10, wpx * 0.12))
  const PAD = Math.max(3, wpx * 0.05)
  // primo nome di ogni invitato (nome breve), per non affollare
  const short = (full: string) => { const p = full.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1]![0]}.` : p[0] }
  return (
    <div className="absolute inset-0" style={{ zIndex: 25, pointerEvents: 'none' }}>
      {seated.slice(0, pts.length).map((g, i) => {
        const p = pts[i]!
        const lx = p.x * wpx + p.ox * PAD
        const ly = p.y * hpx + p.oy * PAD
        const tx = p.ox <= -0.3 ? '-100%' : p.ox >= 0.3 ? '0' : '-50%'
        const ty = p.oy <= -0.3 ? '-100%' : p.oy >= 0.3 ? '0' : '-50%'
        return (
          <span key={g.id}
            onPointerDown={(e) => onGuestDown?.(e, g)}
            style={{
              position: 'absolute', left: lx, top: ly, transform: `translate(${tx}, ${ty})`,
              fontSize: fs, lineHeight: 1, whiteSpace: 'nowrap', fontWeight: 500, cursor: 'grab', pointerEvents: 'auto', touchAction: 'none',
              color: 'rgb(var(--fg))', textShadow: '0 1px 2px rgb(var(--bg)), 0 0 2px rgb(var(--bg))',
            }} title={`${g.full_name} — trascina su un altro tavolo o nell'elenco per togliere`}>{short(g.full_name)}</span>
        )
      })}
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
