import { forwardRef } from 'react'
import type { PosterTemplate, Palette, DecorKey } from '@/lib/tableauPosters'

export type PosterData = {
  coupleNames: string        // "Marco & Anna"
  dateText: string           // "12 settembre 2026"
  location?: string
  eyebrow?: string           // "Tableau de mariage"
  tables: Array<{ id: string; name: string; guests: string[] }>
}

// Poster del tableau renderizzato come DOM (catturato da html2canvas per il PDF).
// width = larghezza di render in px; l'altezza segue il rapporto del formato (ritratto).
export const TableauPoster = forwardRef<HTMLDivElement, {
  template: PosterTemplate; palette: Palette; data: PosterData; width: number; ratio: number // h/w
}>(function TableauPoster({ template, palette, data, width, ratio }, ref) {
  const H = width * ratio
  const u = width / 800 // unità di scala (design pensato a 800px di larghezza)
  const cols = data.tables.length <= 6 ? 2 : data.tables.length <= 12 ? 3 : data.tables.length <= 24 ? 4 : 5
  const isDark = template.decor === 'night'

  return (
    <div ref={ref} style={{
      width, height: H, position: 'relative', overflow: 'hidden',
      background: palette.bg, color: palette.ink, boxSizing: 'border-box',
      fontFamily: template.bodyFont, padding: `${56 * u}px ${48 * u}px`,
    }}>
      <Decor decor={template.decor} palette={palette} u={u} W={width} H={H} />
      {template.id === 'oro' && <div style={{ position: 'absolute', inset: `${22 * u}px`, border: `${1.5 * u}px solid ${palette.accent}`, pointerEvents: 'none' }} />}

      {/* Intestazione */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2 }}>
        <div style={{ fontSize: 15 * u, letterSpacing: 5 * u, textTransform: 'uppercase', color: palette.accent, marginBottom: 14 * u, fontFamily: template.bodyFont }}>
          {data.eyebrow ?? 'Tableau de mariage'}
        </div>
        <div style={{
          fontFamily: template.titleFont, fontSize: 58 * u, lineHeight: 1.05,
          fontStyle: template.titleItalic ? 'italic' : 'normal',
          textTransform: template.titleUpper ? 'uppercase' : 'none',
          letterSpacing: template.titleUpper ? 3 * u : 0, fontWeight: 500,
        }}>
          {data.coupleNames || 'Gli Sposi'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 * u, marginTop: 16 * u, color: palette.accent }}>
          <span style={{ height: 1, width: 60 * u, background: palette.soft }} />
          <span style={{ fontSize: 17 * u, letterSpacing: 2 * u }}>{data.dateText}{data.location ? ` · ${data.location}` : ''}</span>
          <span style={{ height: 1, width: 60 * u, background: palette.soft }} />
        </div>
      </div>

      {/* Griglia tavoli */}
      <div style={{
        position: 'relative', zIndex: 2, marginTop: 40 * u,
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${22 * u}px ${20 * u}px`,
      }}>
        {data.tables.map((t) => (
          <div key={t.id} style={{
            background: palette.card, border: `${1 * u}px solid ${palette.cardLine}`,
            borderRadius: 10 * u, padding: `${16 * u}px ${12 * u}px`, textAlign: 'center',
            breakInside: 'avoid', boxShadow: isDark ? 'none' : `0 ${2 * u}px ${10 * u}px rgba(0,0,0,.04)`,
          }}>
            <div style={{ fontFamily: template.titleFont, fontSize: 22 * u, fontStyle: template.titleItalic ? 'italic' : 'normal', color: palette.ink, marginBottom: 4 * u, fontWeight: 600 }}>
              {t.name}
            </div>
            <div style={{ width: 34 * u, height: 1.5 * u, background: palette.accent, margin: `0 auto ${10 * u}px` }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 * u }}>
              {t.guests.length === 0
                ? <span style={{ fontSize: 14 * u, color: palette.soft, fontStyle: 'italic' }}>—</span>
                : t.guests.map((g, i) => <span key={i} style={{ fontSize: 15 * u, lineHeight: 1.25, color: palette.ink }}>{g}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Chiusura */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 30 * u, textAlign: 'center', zIndex: 2, color: palette.accent }}>
        <span style={{ fontFamily: template.titleFont, fontStyle: 'italic', fontSize: 18 * u }}>Trovate il vostro posto e accomodatevi ♥</span>
      </div>
    </div>
  )
})

// ── Decori (acquarello / sketch) per template ───────────────────────────────
function Decor({ decor, palette, u, W, H }: { decor: DecorKey; palette: Palette; u: number; W: number; H: number }) {
  const a = palette.accent, s = palette.soft
  if (decor === 'eucalyptus') {
    return (
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <Wash cx={W * 0.08} cy={H * 0.06} r={150 * u} color={s} />
        <Wash cx={W * 0.94} cy={H * 0.97} r={170 * u} color={s} />
        <Branch x={30 * u} y={H - 40 * u} scale={u * 1.4} color={a} rot={-35} />
        <Branch x={W - 30 * u} y={70 * u} scale={u * 1.4} color={a} rot={150} />
      </svg>
    )
  }
  if (decor === 'blush') {
    return (
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <Wash cx={W * 0.06} cy={H * 0.05} r={160 * u} color={s} />
        <Wash cx={W * 0.97} cy={H * 0.04} r={120 * u} color={a} op={0.25} />
        <Wash cx={W * 0.5} cy={H * 1.0} r={220 * u} color={s} />
      </svg>
    )
  }
  if (decor === 'gold') {
    return (
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <Branch x={W / 2} y={H - 56 * u} scale={u * 1.1} color={a} rot={0} thin />
      </svg>
    )
  }
  if (decor === 'boho') {
    return (
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        <Wash cx={W * 0.1} cy={H * 0.95} r={180 * u} color={s} />
        <Wash cx={W * 0.92} cy={H * 0.08} r={150 * u} color={a} op={0.2} />
        {[0, 1, 2, 3].map((i) => <Pampas key={i} x={40 * u + i * 26 * u} y={H - 30 * u} scale={u} color={a} />)}
      </svg>
    )
  }
  if (decor === 'night') {
    const stars = Array.from({ length: 60 }, (_, i) => ({ x: ((i * 137) % 100) / 100 * W, y: ((i * 89) % 100) / 100 * H, r: ((i % 3) + 1) * 0.7 * u }))
    return (
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
        {stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill={palette.accent} opacity={0.5} />)}
      </svg>
    )
  }
  // lemon
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <Wash cx={W * 0.07} cy={H * 0.05} r={150 * u} color={s} />
      <Wash cx={W * 0.95} cy={H * 0.96} r={160 * u} color={s} />
      {[[40, 70], [W - 60, H - 70], [W - 80, 60]].map(([x, y], i) => <Lemon key={i} x={x as number} y={y as number} u={u} color={palette.accent} leaf={palette.soft} />)}
    </svg>
  )
}

function Wash({ cx, cy, r, color, op = 0.35 }: { cx: number; cy: number; r: number; color: string; op?: number }) {
  const id = `w${Math.round(cx)}${Math.round(cy)}${Math.round(r)}`
  return (
    <g>
      <defs><radialGradient id={id}><stop offset="0%" stopColor={color} stopOpacity={op} /><stop offset="70%" stopColor={color} stopOpacity={op * 0.5} /><stop offset="100%" stopColor={color} stopOpacity={0} /></radialGradient></defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </g>
  )
}
function Branch({ x, y, scale, color, rot, thin }: { x: number; y: number; scale: number; color: string; rot: number; thin?: boolean }) {
  const leaves = Array.from({ length: 7 }, (_, i) => i)
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${scale})`} opacity={0.85}>
      <path d="M0 0 C 20 -20, 40 -30, 70 -36" fill="none" stroke={color} strokeWidth={thin ? 1 : 1.6} strokeLinecap="round" />
      {leaves.map((i) => {
        const t = i / 7, px = t * 70, py = -t * 36 - Math.sin(t * 3) * 4
        const side = i % 2 === 0 ? 1 : -1
        return <ellipse key={i} cx={px} cy={py} rx={9} ry={4.2} transform={`rotate(${30 * side} ${px} ${py})`} fill={color} opacity={0.7} />
      })}
    </g>
  )
}
function Pampas({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`} opacity={0.55}>
      <path d="M0 0 C -2 -40, 2 -70, 0 -95" stroke={color} strokeWidth={1.2} fill="none" />
      {Array.from({ length: 12 }, (_, i) => i).map((i) => { const yy = -i * 7 - 8; const w = 8 - i * 0.3; return <g key={i}><line x1={0} y1={yy} x2={-w} y2={yy - 5} stroke={color} strokeWidth={0.8} /><line x1={0} y1={yy} x2={w} y2={yy - 5} stroke={color} strokeWidth={0.8} /></g> })}
    </g>
  )
}
function Lemon({ x, y, u, color, leaf }: { x: number; y: number; u: number; color: string; leaf: string }) {
  return (
    <g transform={`translate(${x},${y}) scale(${u})`} opacity={0.8}>
      <ellipse cx={0} cy={0} rx={16} ry={12} fill={color} opacity={0.85} />
      <ellipse cx={0} cy={0} rx={16} ry={12} fill="none" stroke="#caa12f" strokeWidth={1} />
      <path d="M10 -10 q 18 -6 26 4 q -16 2 -26 -4" fill={leaf} opacity={0.9} />
    </g>
  )
}
