import type { DabOpt, Pt, Tool } from './types'
import { hexToRgb, rgba } from './color'
import { LINE_TOOLS } from './constants'
import { drawStamp, DEFAULT_STAMP } from '@/lib/studioStamps'
import { drawCustomBrush } from '@/lib/studioCustomBrushes'

// ── Engine pennelli (a stamp/linea) ─────────────────────────────────────────
export function stamp(ctx: CanvasRenderingContext2D, tool: Tool, x: number, y: number, r: number, o: DabOpt) {
  if (tool === 'stamp') {
    // pennello IMPORTATO (punta raster) oppure timbro decorativo vettoriale (lib/studioStamps)
    if (o.motif && o.motif.startsWith('custom:')) drawCustomBrush(ctx, o.motif.slice(7), x, y, r, o.color, o.opacity)
    else drawStamp(ctx, o.motif || DEFAULT_STAMP, x, y, r, o.color, o.opacity)
    return
  }
  if (tool === 'watercolor') {
    for (let k = 0; k < 3; k++) {
      const rr = r * (0.7 + Math.random() * 0.6), ox = (Math.random() - 0.5) * r * 0.5, oy = (Math.random() - 0.5) * r * 0.5
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); const a = o.opacity * 0.09
      g.addColorStop(0, rgba(o.color, a)); g.addColorStop(0.7, rgba(o.color, a * 0.6)); g.addColorStop(1, rgba(o.color, 0))
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, rr, 0, 6.283); ctx.fill()
    }
  } else if (tool === 'chalk') {
    const n = Math.max(8, Math.floor(r * r * 0.5)); ctx.fillStyle = o.color
    for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, rad = Math.random() * r * (1 + o.tilt * 1.6); ctx.globalAlpha = o.opacity * (0.12 + Math.random() * 0.25); ctx.fillRect(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 1.2, 1.2) }
    ctx.globalAlpha = 1
  } else if (tool === 'pastel') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(o.color, o.opacity * 0.45)); g.addColorStop(1, rgba(o.color, 0))
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
    const n = Math.floor(r); ctx.fillStyle = o.color
    for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, rad = Math.random() * r; ctx.globalAlpha = o.opacity * 0.12; ctx.fillRect(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 1, 1) }
    ctx.globalAlpha = 1
  } else if (tool === 'floral') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.random() * 6.283); ctx.globalAlpha = o.opacity; ctx.fillStyle = o.color
    const pr = r * 0.6
    for (let p = 0; p < 5; p++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.ellipse(0, -pr * 0.95, pr * 0.5, pr, 0, 0, 6.283); ctx.fill() }
    ctx.fillStyle = rgba('#f2d16b', Math.min(1, o.opacity * 1.1)); ctx.beginPath(); ctx.arc(0, 0, pr * 0.42, 0, 6.283); ctx.fill()
    ctx.restore(); ctx.globalAlpha = 1
  } else if (tool === 'airbrush') {
    ctx.fillStyle = o.color; const n = Math.max(6, Math.floor(r))
    for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, rad = Math.random() * r; ctx.globalAlpha = o.opacity * 0.10; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 1.1, 0, 6.283); ctx.fill() }
    ctx.globalAlpha = 1
  }
}
export function paintSeg(ctx: CanvasRenderingContext2D, tool: Tool, a: Pt, b: Pt, o: DabOpt) {
  // SFUMATURA bordo (pennello/gomma): dab a gradiente radiale — centro pieno, bordo che sfuma.
  const soft = o.softness ?? 0
  if (soft > 0 && (tool === 'eraser' || tool === 'brush')) {
    const r = Math.max(1, o.size * o.press) / 2
    const spacing = Math.max(1, r * 0.35)
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / spacing))
    const inner = Math.max(0, 1 - soft)                 // quota di raggio ancora "piena"
    const erase = tool === 'eraser'
    const [rr, gg, bb] = hexToRgb(o.color); const col = erase ? '0,0,0' : `${rr},${gg},${bb}`
    ctx.save(); if (erase) ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0; const x = a.x + dx * t, y = a.y + dy * t
      const g = ctx.createRadialGradient(x, y, r * inner, x, y, r)
      g.addColorStop(0, `rgba(${col},${o.opacity})`); g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
    }
    ctx.restore()
    return
  }
  if (LINE_TOOLS.has(tool)) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.color
    let w = o.size * o.press
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = o.opacity }
    else if (tool === 'marker') { ctx.globalAlpha = o.opacity * 0.4 }
    else if (tool === 'pencil') { ctx.globalAlpha = o.opacity * 0.9; w = Math.max(0.6, o.size * 0.5 * o.press * (1 + o.tilt * 2.2)) }
    else if (tool === 'ink') { ctx.globalAlpha = o.opacity; w = o.size * (0.45 + 0.55 * o.press) }
    else { ctx.globalAlpha = o.opacity }
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore()
    return
  }
  const r = Math.max(1, o.size * o.press) / 2
  const isCustomBrush = tool === 'stamp' && !!o.motif && o.motif.startsWith('custom:')
  const spacing = tool === 'stamp' ? (isCustomBrush ? Math.max(1.5, r * 0.45) : Math.max(10, r * 2.4)) : tool === 'floral' ? Math.max(6, r * 1.6) : (tool === 'airbrush' ? Math.max(1, r * 0.25) : Math.max(1, r * 0.4))
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / spacing))
  for (let i = 0; i <= steps; i++) { const t = steps ? i / steps : 0; stamp(ctx, tool, a.x + dx * t, a.y + dy * t, r, o) }
}

export function floodFill(ctx: CanvasRenderingContext2D, W: number, H: number, sx: number, sy: number, hex: string) {
  const x = Math.round(sx), y = Math.round(sy); if (x < 0 || y < 0 || x >= W || y >= H) return
  const img = ctx.getImageData(0, 0, W, H); const d = img.data
  const at = (px: number, py: number) => (py * W + px) * 4
  const s = at(x, y); const tr = d[s]!, tg = d[s + 1]!, tb = d[s + 2]!, ta = d[s + 3]!
  const [nr, ng, nb] = hexToRgb(hex); const na = 255
  if (tr === nr && tg === ng && tb === nb && ta === na) return
  const tol = 40
  const match = (i: number) => Math.abs(d[i]! - tr) <= tol && Math.abs(d[i + 1]! - tg) <= tol && Math.abs(d[i + 2]! - tb) <= tol && Math.abs(d[i + 3]! - ta) <= tol
  const stack: Array<[number, number]> = [[x, y]]
  while (stack.length) {
    const [cx, cy] = stack.pop()!; if (!match(at(cx, cy))) continue
    let top = cy; while (top > 0 && match(at(cx, top - 1))) top--
    let bot = cy; while (bot < H - 1 && match(at(cx, bot + 1))) bot++
    for (let yy = top; yy <= bot; yy++) { const j = at(cx, yy); d[j] = nr; d[j + 1] = ng; d[j + 2] = nb; d[j + 3] = na; if (cx > 0 && match(at(cx - 1, yy))) stack.push([cx - 1, yy]); if (cx < W - 1 && match(at(cx + 1, yy))) stack.push([cx + 1, yy]) }
  }
  ctx.putImageData(img, 0, 0)
}
export function drawShape(ctx: CanvasRenderingContext2D, tool: Tool, a: Pt, b: Pt, o: { color: string; size: number; fill: boolean; alpha: number }) {
  ctx.save(); ctx.globalAlpha = o.alpha; ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = o.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (tool === 'line' || tool === 'arrow') {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    if (tool === 'arrow') { const ang = Math.atan2(b.y - a.y, b.x - a.x), h = Math.max(10, o.size * 3); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - h * Math.cos(ang - 0.4), b.y - h * Math.sin(ang - 0.4)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - h * Math.cos(ang + 0.4), b.y - h * Math.sin(ang + 0.4)); ctx.stroke() }
  } else if (tool === 'rect') { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y); if (o.fill) ctx.fillRect(x, y, w, hh); else ctx.strokeRect(x, y, w, hh) }
  else if (tool === 'ellipse') { const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); if (o.fill) ctx.fill(); else ctx.stroke() }
  ctx.restore()
}
