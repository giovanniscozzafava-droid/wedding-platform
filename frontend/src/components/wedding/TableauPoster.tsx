import { forwardRef } from 'react'
import type { PosterTemplate, DecorKey } from '@/lib/tableauPosters'

export type PosterData = {
  coupleNames: string
  dateText: string
  location?: string
  eyebrow?: string
  tables: Array<{ id: string; name: string; guests: string[] }>
}

// Poster del tableau renderizzato come DOM (catturato da html2canvas per il PDF).
// width = larghezza di render in px; l'altezza segue il rapporto del formato (ritratto).
export const TableauPoster = forwardRef<HTMLDivElement, {
  template: PosterTemplate; data: PosterData; width: number; ratio: number; accent?: string | null
}>(function TableauPoster({ template: t, data, width, ratio, accent }, ref) {
  const H = width * ratio
  const u = width / 460   // le costanti di stile sono tarate su una tavola da 460px
  const A = accent || t.accent
  const n = data.tables.length
  const cols = n <= 8 ? 2 : n <= 18 ? 3 : 4
  const dv = n > 28 ? 0.72 : n > 18 ? 0.82 : n > 12 ? 0.9 : 1

  const eyebrow = data.eyebrow ?? t.eyebrow

  return (
    <div ref={ref} style={{
      width, height: H, position: 'relative', overflow: 'hidden',
      background: t.bg, color: t.ink, boxSizing: 'border-box',
      fontFamily: t.bodyFont, padding: `${52 * u}px ${44 * u}px ${40 * u}px`,
    }}>
      <Decor decor={t.decor} accent={A} soft={t.soft} u={u} W={width} H={H} />
      {t.decor === 'deco' && (<>
        <div style={{ position: 'absolute', inset: 20 * u, border: `${1.5 * u}px solid ${A}`, zIndex: 1 }} />
        <div style={{ position: 'absolute', inset: 26 * u, border: `${0.6 * u}px solid ${A}66`, zIndex: 1 }} />
      </>)}

      {/* Intestazione */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginTop: t.decor === 'deco' ? 44 * u : 0 }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12 * u, letterSpacing: 5 * u, textTransform: 'uppercase', color: A, fontWeight: 400 }}>{eyebrow}</div>
        <div style={{
          fontFamily: t.nameFont, fontSize: t.nameSize * u * (n > 18 ? 0.9 : 1), lineHeight: 1.04, marginTop: 14 * u,
          color: t.nameColor, fontWeight: t.nameFont.includes('Cormorant') ? 500 : 400,
          fontStyle: t.nameItalic ? 'italic' : 'normal', textTransform: t.nameUpper ? 'uppercase' : 'none',
          letterSpacing: t.nameUpper ? 3 * u : 0,
        }}>{data.coupleNames || 'Gli Sposi'}</div>
        <div style={{
          marginTop: 12 * u, color: A,
          fontFamily: t.dateItalic ? t.bodyFont : 'Jost, sans-serif',
          fontStyle: t.dateItalic ? 'italic' : 'normal',
          fontSize: (t.dateItalic ? 17 : 13) * u, letterSpacing: t.dateUpper ? 4 * u : 1 * u,
          textTransform: t.dateUpper ? 'uppercase' : 'none',
        }}>{data.dateText}{data.location ? ` · ${data.location}` : ''}</div>
        <div style={{ width: 48 * u, height: 1, background: t.soft, margin: `${20 * u}px auto 0` }} />
      </div>

      {/* Griglia tavoli */}
      <div style={{
        position: 'relative', zIndex: 2, flex: 1, marginTop: 34 * u,
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
        columnGap: t.decor === 'sereno' ? 0 : 22 * u, rowGap: 24 * u * dv, alignContent: 'start',
      }}>
        {data.tables.map((tb, i) => {
          const sereno = t.decor === 'sereno'
          const borderR = sereno && (i % cols) < cols - 1
          return (
            <div key={tb.id} style={{ textAlign: 'center', padding: sereno ? `0 ${20 * u}px` : 0, borderRight: borderR ? `1px solid ${t.soft}55` : undefined }}>
              <div style={{
                fontFamily: t.tableFont, color: t.tableColor,
                fontSize: (t.tableFont.includes('Great Vibes') ? 30 : 22) * u * dv,
                fontStyle: t.tableItalic ? 'italic' : 'normal', textTransform: t.tableUpper ? 'uppercase' : 'none',
                letterSpacing: t.tableUpper ? 2 * u : 0, fontWeight: t.tableFont.includes('Cormorant') ? 600 : 400,
                marginBottom: 3 * u,
              }}>{tb.name}</div>
              {t.tableRule && <div style={{ width: 22 * u, height: 1, background: A, margin: `${4 * u}px auto ${7 * u}px` }} />}
              <div style={{ marginTop: t.tableRule ? 0 : 4 * u }}>
                {tb.guests.length === 0
                  ? <span style={{ fontSize: 14 * u, color: t.soft, fontStyle: 'italic' }}>—</span>
                  : tb.guests.map((g, k) => (
                    <div key={k} style={{ fontFamily: t.bodyFont, fontSize: (t.bodyFont.includes('Jost') ? 12 : 15.5) * u * dv, lineHeight: 1.55, color: t.guestColor }}>{g}</div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>

      {t.closing && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 22 * u, textAlign: 'center', zIndex: 2, color: A, fontFamily: t.nameFont, fontStyle: 'italic', fontSize: 18 * u }}>{t.closing}</div>}
    </div>
  )
})

// ── Decori per stile (inline SVG) ───────────────────────────────────────────
function Decor({ decor, accent, soft, u, W, H }: { decor: DecorKey; accent: string; soft: string; u: number; W: number; H: number }) {
  if (decor === 'sereno') return null
  return (
    <svg width={W} height={H} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {decor === 'giardino' && <>
        <Wash cx={W * 0.1} cy={H * 0.06} r={200 * u} color={soft} op={0.5} />
        <Wash cx={W * 0.92} cy={H * 0.98} r={230 * u} color={soft} op={0.5} />
        <Eucalyptus cx={W / 2} cy={132 * u} w={170 * u} stroke={accent} leaf={soft} />
      </>}
      {decor === 'cipria' && <>
        <Wash cx={W * 0.08} cy={H * 0.05} r={210 * u} color={soft} op={0.55} />
        <Wash cx={W * 0.95} cy={H * 0.97} r={230 * u} color={soft} op={0.55} />
      </>}
      {decor === 'deco' && (
        <g stroke={accent} strokeWidth={1.4 * u} fill="none" transform={`translate(${W / 2}, ${42 * u})`}>
          <line x1={0} y1={-16 * u} x2={0} y2={16 * u} /><line x1={-20 * u} y1={-12 * u} x2={-20 * u} y2={12 * u} /><line x1={20 * u} y1={-12 * u} x2={20 * u} y2={12 * u} />
          <line x1={-38 * u} y1={-6 * u} x2={-38 * u} y2={6 * u} /><line x1={38 * u} y1={-6 * u} x2={38 * u} y2={6 * u} />
          <circle cx={0} cy={0} r={4 * u} fill={accent} />
        </g>
      )}
      {decor === 'riviera' && <>
        <Lemon cx={70 * u} cy={H - 90 * u} u={u} stem={soft} fruit={accent} rot={0} />
        <Lemon cx={W - 64 * u} cy={92 * u} u={u} stem={soft} fruit={accent} rot={180} />
      </>}
      {decor === 'terra' && <>
        <path d={`M ${W * 0.26} ${66 * u} a ${W * 0.24} ${W * 0.24} 0 0 1 ${W * 0.48} 0 v ${56 * u} h ${-W * 0.48} z`} fill={soft} opacity={0.45} />
        <Wash cx={W * 0.92} cy={H * 0.95} r={210 * u} color={accent} op={0.22} />
      </>}
    </svg>
  )
}

function Wash({ cx, cy, r, color, op }: { cx: number; cy: number; r: number; color: string; op: number }) {
  const id = `w${Math.round(cx)}_${Math.round(cy)}_${Math.round(r)}`
  return (<g>
    <defs><radialGradient id={id}><stop offset="0%" stopColor={color} stopOpacity={op} /><stop offset="65%" stopColor={color} stopOpacity={op * 0.4} /><stop offset="100%" stopColor={color} stopOpacity={0} /></radialGradient></defs>
    <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
  </g>)
}
function Eucalyptus({ cx, cy, w, stroke, leaf }: { cx: number; cy: number; w: number; stroke: string; leaf: string }) {
  const half = w / 2
  const leaves = Array.from({ length: 9 }, (_, i) => i)
  return (
    <g transform={`translate(${cx}, ${cy})`} opacity={0.9}>
      <path d={`M${-half} 6 Q0 -12 ${half} 6`} stroke={stroke} strokeWidth={1.3} fill="none" />
      {leaves.map((i) => { const tt = i / 8; const x = -half + tt * w; const y = 6 - Math.sin(tt * Math.PI) * 16; const s = i % 2 ? 1 : -1; return <ellipse key={i} cx={x} cy={y} rx={9} ry={4} transform={`rotate(${30 * s} ${x} ${y})`} fill={leaf} /> })}
    </g>
  )
}
function Lemon({ cx, cy, u, stem, fruit, rot }: { cx: number; cy: number; u: number; stem: string; fruit: string; rot: number }) {
  return (
    <g transform={`translate(${cx}, ${cy}) rotate(${rot}) scale(${u})`} opacity={0.92}>
      <path d="M0 0 Q-6 -52 6 -100" stroke={stem} strokeWidth={1.3} fill="none" />
      <ellipse cx={-9} cy={-32} rx={12} ry={9} fill={fruit} stroke="#caa033" strokeWidth={1} />
      <ellipse cx={12} cy={-74} rx={11} ry={8} fill={fruit} stroke="#caa033" strokeWidth={1} />
      <path d="M-2 -52 q24 -9 36 5 q-22 4 -36 -5" fill={stem} />
    </g>
  )
}
