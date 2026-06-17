import { forwardRef } from 'react'
import type { PosterTemplate } from '@/lib/tableauPosters'

export type PosterData = {
  coupleNames: string
  dateText: string
  location?: string
  eyebrow?: string
  tables: Array<{ id: string; name: string; guests: string[] }>
}

// Poster del tableau renderizzato come DOM (catturato da html2canvas per il PDF).
// Decori = acquarelli AI veri (PNG trasparenti in /public/tableau). Sereno/Déco restano
// geometrici puliti. Sempre: cornice margini di stampa + logo capostipite in fondo.
export const TableauPoster = forwardRef<HTMLDivElement, {
  template: PosterTemplate; data: PosterData; width: number; ratio: number
  accent?: string | null; logoUrl?: string | null; logoName?: string | null
}>(function TableauPoster({ template: t, data, width, ratio, accent, logoUrl, logoName }, ref) {
  const H = width * ratio
  const u = width / 460   // costanti tarate su una tavola da 460px
  const A = accent || t.accent
  const n = data.tables.length
  const cols = n <= 8 ? 2 : n <= 18 ? 3 : 4
  // densità: rimpicciolisce coi tanti tavoli MA con un pavimento di leggibilità
  const dv = n > 30 ? 0.82 : n > 20 ? 0.88 : n > 12 ? 0.94 : 1
  const eyebrow = data.eyebrow ?? t.eyebrow
  const hasLogo = !!(logoUrl || logoName)

  return (
    <div ref={ref} style={{
      width, height: H, position: 'relative', overflow: 'hidden',
      background: t.bg, color: t.ink, boxSizing: 'border-box',
      fontFamily: t.bodyFont, padding: `${30 * u}px ${28 * u}px ${hasLogo ? 18 * u : 26 * u}px`,
    }}>
      {/* CORNICE margini di stampa (safe area) */}
      {!t.dark && <div style={{ position: 'absolute', inset: 12 * u, border: `1px solid ${t.soft}`, opacity: 0.5, zIndex: 1, pointerEvents: 'none' }} />}

      {/* DÉCO: cornice oro doppia + motivo geometrico (niente floreali) */}
      {t.decor === 'deco' && (<>
        <div style={{ position: 'absolute', inset: 12 * u, border: `${1.5 * u}px solid ${A}`, zIndex: 1, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 17 * u, border: `${0.6 * u}px solid ${A}66`, zIndex: 1, pointerEvents: 'none' }} />
        <svg width={width} height={H} style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
          <g stroke={A} strokeWidth={1.4 * u} fill="none" transform={`translate(${width / 2}, ${30 * u})`}>
            <line x1={0} y1={-15 * u} x2={0} y2={15 * u} /><line x1={-18 * u} y1={-11 * u} x2={-18 * u} y2={11 * u} /><line x1={18 * u} y1={-11 * u} x2={18 * u} y2={11 * u} />
            <line x1={-34 * u} y1={-6 * u} x2={-34 * u} y2={6 * u} /><line x1={34 * u} y1={-6 * u} x2={34 * u} y2={6 * u} />
            <circle cx={0} cy={0} r={4 * u} fill={A} />
          </g>
        </svg>
      </>)}

      {/* ACQUERELLI AI agli angoli (trasparenti) — esterni, dietro al testo, mai sopra i nomi */}
      {t.corner && (<>
        <img src={`/tableau/${t.corner}`} alt="" crossOrigin="anonymous" style={{ position: 'absolute', top: 0, left: 0, width: 150 * u, zIndex: 1, pointerEvents: 'none' }} />
        <img src={`/tableau/${t.corner}`} alt="" crossOrigin="anonymous" style={{ position: 'absolute', bottom: (hasLogo ? 30 : 0) * u, right: 0, width: 150 * u, transform: 'rotate(180deg)', zIndex: 1, pointerEvents: 'none' }} />
      </>)}

      {/* Intestazione */}
      <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginTop: (t.decor === 'deco' ? 30 : 20) * u }}>
        <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 12 * u, letterSpacing: 5 * u, textTransform: 'uppercase', color: A, fontWeight: 400 }}>{eyebrow}</div>
        <div style={{
          fontFamily: t.nameFont, fontSize: t.nameSize * u * (n > 18 ? 0.9 : 1), lineHeight: 1.04, marginTop: 12 * u,
          color: t.nameColor, fontWeight: t.nameFont.includes('Cormorant') ? 500 : 400,
          fontStyle: t.nameItalic ? 'italic' : 'normal', textTransform: t.nameUpper ? 'uppercase' : 'none',
          letterSpacing: t.nameUpper ? 3 * u : 0,
        }}>{data.coupleNames || 'Gli Sposi'}</div>
        <div style={{
          marginTop: 10 * u, color: A,
          fontFamily: t.dateItalic ? t.bodyFont : 'Jost, sans-serif', fontStyle: t.dateItalic ? 'italic' : 'normal',
          fontSize: (t.dateItalic ? 17 : 13) * u, letterSpacing: t.dateUpper ? 4 * u : 1 * u, textTransform: t.dateUpper ? 'uppercase' : 'none',
        }}>{data.dateText}{data.location ? ` · ${data.location}` : ''}</div>
        {t.divider
          ? <img src={`/tableau/${t.divider}`} alt="" crossOrigin="anonymous" style={{ display: 'block', width: 220 * u, margin: `${4 * u}px auto 0` }} />
          : <div style={{ width: 48 * u, height: 1, background: t.soft, margin: `${18 * u}px auto 0` }} />}
      </div>

      {/* Griglia tavoli */}
      <div style={{
        position: 'relative', zIndex: 2, flex: 1, marginTop: 22 * u,
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
        columnGap: t.decor === 'sereno' ? 0 : 20 * u, rowGap: 22 * u * dv, alignContent: 'start',
      }}>
        {data.tables.map((tb, i) => {
          const sereno = t.decor === 'sereno'
          const borderR = sereno && (i % cols) < cols - 1
          return (
            <div key={tb.id} style={{ textAlign: 'center', padding: sereno ? `0 ${18 * u}px` : 0, borderRight: borderR ? `1px solid ${t.soft}55` : undefined }}>
              <div style={{
                fontFamily: t.tableFont, color: t.tableColor,
                fontSize: (t.tableFont.includes('Great Vibes') ? 30 : 22) * u * dv,
                fontStyle: t.tableItalic ? 'italic' : 'normal', textTransform: t.tableUpper ? 'uppercase' : 'none',
                letterSpacing: t.tableUpper ? 2 * u : 0, fontWeight: t.tableFont.includes('Cormorant') ? 600 : 400, marginBottom: 3 * u,
              }}>{tb.name}</div>
              {t.tableRule && <div style={{ width: 22 * u, height: 1, background: A, margin: `${4 * u}px auto ${7 * u}px` }} />}
              <div style={{ marginTop: t.tableRule ? 0 : 4 * u }}>
                {tb.guests.length === 0
                  ? <span style={{ fontSize: 14 * u, color: t.soft, fontStyle: 'italic' }}>—</span>
                  : tb.guests.map((g, k) => (
                    <div key={k} style={{ fontFamily: t.bodyFont, fontSize: (t.bodyFont.includes('Jost') ? 12.5 : 16) * u * dv, lineHeight: 1.55, color: t.guestColor }}>{g}</div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* LOGO del capostipite in fondo */}
      {hasLogo && (
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', marginTop: 6 * u }}>
          <div style={{ fontFamily: 'Jost, sans-serif', fontSize: 9 * u, letterSpacing: 2 * u, textTransform: 'uppercase', color: t.soft }}>a cura di</div>
          {logoUrl
            ? <img src={logoUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: 36 * u, maxWidth: 180 * u, margin: `${2 * u}px auto 0`, objectFit: 'contain', display: 'block' }} />
            : <div style={{ fontFamily: t.bodyFont, fontSize: 19 * u, color: A, letterSpacing: 0.5 * u, marginTop: 1 * u }}>{logoName}</div>}
        </div>
      )}
    </div>
  )
})
