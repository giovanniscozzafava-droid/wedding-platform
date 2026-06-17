import { forwardRef } from 'react'
import type { PosterTemplate, Palette } from '@/lib/tableauPosters'
import { tintOrnament, type OrnamentName } from '@/lib/tableauOrnaments'

export type PosterData = {
  coupleNames: string        // "Marco & Anna"
  dateText: string           // "12 settembre 2026"
  location?: string
  eyebrow?: string           // "Tableau de mariage"
  tables: Array<{ id: string; name: string; guests: string[] }>
}

// Ornamento vero (SVG di pubblico dominio) inline, ricolorato, posizionato/dimensionato.
function Orn({ raw, color, style, flipX }: { raw: string; color: string; style: React.CSSProperties; flipX?: boolean }) {
  if (!raw) return null
  return <div style={{ position: 'absolute', lineHeight: 0, transform: flipX ? 'scaleX(-1)' : undefined, ...style }} dangerouslySetInnerHTML={{ __html: tintOrnament(raw, color) }} />
}

// Poster del tableau renderizzato come DOM (catturato da html2canvas per il PDF).
// width = larghezza di render in px; l'altezza segue il rapporto del formato (ritratto).
export const TableauPoster = forwardRef<HTMLDivElement, {
  template: PosterTemplate; palette: Palette; data: PosterData; width: number; ratio: number
  ornaments: Record<OrnamentName, string>
}>(function TableauPoster({ template, palette, data, width, ratio, ornaments }, ref) {
  const H = width * ratio
  const u = width / 800
  const n = data.tables.length
  const cols = n <= 6 ? 2 : n <= 12 ? 3 : n <= 24 ? 4 : 5
  const dv = n > 28 ? 0.74 : n > 18 ? 0.84 : n > 12 ? 0.92 : 1 // densità: rimpicciolisce coi tanti tavoli
  const isDark = template.decor === 'night'
  const orn = palette.accent

  return (
    <div ref={ref} style={{
      width, height: H, position: 'relative', overflow: 'hidden',
      background: palette.bg, color: palette.ink, boxSizing: 'border-box',
      fontFamily: template.bodyFont, padding: `${54 * u}px ${48 * u}px ${40 * u}px`,
    }}>
      {/* washes acquarello morbidi negli angoli (atmosfera) */}
      <svg width={width} height={H} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Wash cx={width * 0.04} cy={H * 0.03} r={170 * u} color={palette.soft} op={isDark ? 0.18 : 0.32} />
        <Wash cx={width * 0.98} cy={H * 0.99} r={190 * u} color={palette.soft} op={isDark ? 0.18 : 0.32} />
      </svg>
      {template.id === 'oro' && <div style={{ position: 'absolute', inset: `${22 * u}px`, border: `${1.5 * u}px solid ${palette.accent}`, pointerEvents: 'none', zIndex: 1 }} />}

      {/* ornamenti VERI: testata in alto, fregio sotto la data, tralci agli angoli bassi */}
      <Orn raw={ornaments.headpiece} color={orn} style={{ top: 18 * u, left: '50%', width: 360 * u, height: 52 * u, transform: 'translateX(-50%)', zIndex: 1, opacity: 0.92 }} />
      <Orn raw={ornaments.sprig} color={orn} style={{ bottom: 24 * u, left: 26 * u, width: 130 * u, height: 104 * u, zIndex: 1, opacity: 0.8 }} />
      <Orn raw={ornaments.sprig} color={orn} flipX style={{ bottom: 24 * u, right: 26 * u, width: 130 * u, height: 104 * u, zIndex: 1, opacity: 0.8 }} />

      {/* Intestazione */}
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2, marginTop: 44 * u }}>
        <div style={{ fontSize: 15 * u, letterSpacing: 5 * u, textTransform: 'uppercase', color: palette.accent, marginBottom: 12 * u, fontFamily: template.bodyFont }}>
          {data.eyebrow ?? 'Tableau de mariage'}
        </div>
        <div style={{
          fontFamily: template.titleFont, fontSize: 60 * u, lineHeight: 1.05,
          fontStyle: template.titleItalic ? 'italic' : 'normal',
          textTransform: template.titleUpper ? 'uppercase' : 'none',
          letterSpacing: template.titleUpper ? 3 * u : 0, fontWeight: 500,
        }}>
          {data.coupleNames || 'Gli Sposi'}
        </div>
        <div style={{ fontSize: 17 * u, letterSpacing: 2 * u, color: palette.accent, marginTop: 10 * u }}>{data.dateText}{data.location ? ` · ${data.location}` : ''}</div>
        {/* fregio fleuron come separatore */}
        <div style={{ position: 'relative', height: 40 * u, marginTop: 8 * u }}>
          <Orn raw={ornaments.fleuron} color={orn} style={{ top: 0, left: '50%', width: 220 * u, height: 40 * u, transform: 'translateX(-50%)', opacity: 0.85 }} />
        </div>
      </div>

      {/* Griglia tavoli */}
      <div style={{
        position: 'relative', zIndex: 2, marginTop: 22 * u,
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${20 * u * dv}px ${18 * u}px`,
      }}>
        {data.tables.map((t) => (
          <div key={t.id} style={{
            background: palette.card, border: `${1 * u}px solid ${palette.cardLine}`,
            borderRadius: 10 * u, padding: `${15 * u * dv}px ${12 * u}px`, textAlign: 'center',
            breakInside: 'avoid', boxShadow: isDark ? 'none' : `0 ${2 * u}px ${10 * u}px rgba(0,0,0,.04)`,
          }}>
            <div style={{ fontFamily: template.titleFont, fontSize: 22 * u * dv, fontStyle: template.titleItalic ? 'italic' : 'normal', color: palette.ink, marginBottom: 4 * u, fontWeight: 600 }}>
              {t.name}
            </div>
            <div style={{ width: 34 * u, height: 1.5 * u, background: palette.accent, margin: `0 auto ${9 * u * dv}px` }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 * u * dv }}>
              {t.guests.length === 0
                ? <span style={{ fontSize: 14 * u * dv, color: palette.soft, fontStyle: 'italic' }}>—</span>
                : t.guests.map((g, i) => <span key={i} style={{ fontSize: 15 * u * dv, lineHeight: 1.25, color: palette.ink }}>{g}</span>)}
            </div>
          </div>
        ))}
      </div>

      {/* Chiusura */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18 * u, textAlign: 'center', zIndex: 2, color: palette.accent }}>
        <span style={{ fontFamily: template.titleFont, fontStyle: 'italic', fontSize: 18 * u }}>Trovate il vostro posto e accomodatevi ♥</span>
      </div>
    </div>
  )
})

function Wash({ cx, cy, r, color, op }: { cx: number; cy: number; r: number; color: string; op: number }) {
  const id = `w${Math.round(cx)}${Math.round(cy)}${Math.round(r)}`
  return (
    <g>
      <defs><radialGradient id={id}><stop offset="0%" stopColor={color} stopOpacity={op} /><stop offset="65%" stopColor={color} stopOpacity={op * 0.45} /><stop offset="100%" stopColor={color} stopOpacity={0} /></radialGradient></defs>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
    </g>
  )
}
