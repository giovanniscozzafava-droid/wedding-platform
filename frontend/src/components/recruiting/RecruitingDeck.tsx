import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'

/**
 * Presentazione a schermo intero che il capostipite (es. Elisa) mostra al
 * professionista che sta reclutando. Personalizzata col suo studio e codice
 * invito. Dati di mercato reali (ISTAT 2023). Navigazione con frecce.
 */
export function RecruitingDeck({ studio, inviteCode, inviteUrl, onClose }: {
  studio: string; inviteCode: string | null; inviteUrl: string | null; onClose: () => void
}) {
  const [i, setI] = useState(0)
  const slides = buildSlides({ studio, inviteCode, inviteUrl })
  const n = slides.length
  const next = useCallback(() => setI(v => Math.min(n - 1, v + 1)), [n])
  const prev = useCallback(() => setI(v => Math.max(0, v - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev() }
      else if (e.key === 'Escape') onClose()
      else if (e.key.toLowerCase() === 'f') document.documentElement.requestFullscreen?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onClose])

  const slide = slides[i]!
  const dark = slide.dark

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#211d19', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* controlli */}
      <button onClick={onClose} aria-label="Chiudi"
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 3, background: 'rgba(255,255,255,.1)', color: '#e7dcc8', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, width: 38, height: 34, cursor: 'pointer' }}>
        <X size={16} style={{ margin: '0 auto', display: 'block' }} />
      </button>
      <button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Schermo intero"
        style={{ position: 'absolute', top: 16, right: 62, zIndex: 3, background: 'rgba(255,255,255,.1)', color: '#e7dcc8', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, width: 38, height: 34, cursor: 'pointer' }}>
        <Maximize2 size={15} style={{ margin: '0 auto', display: 'block' }} />
      </button>

      {/* slide */}
      <div onClick={(e) => { (e.clientX / window.innerWidth > 0.5 ? next : prev)() }}
        style={{
          width: 'min(95vw,1180px)', height: 'min(92vh,680px)', borderRadius: 18, overflow: 'hidden',
          padding: '52px 64px', display: 'flex', flexDirection: 'column', cursor: 'pointer',
          boxShadow: '0 30px 80px rgba(0,0,0,.5)', position: 'relative',
          background: dark ? 'radial-gradient(120% 120% at 80% 0%,#322b23 0%,#141009 70%)' : '#FDFBF6',
          color: dark ? '#F4EDE0' : '#1A1714',
          fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
        }}>
        {/* topbar logo */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'auto' }}>
          <img src="/brand/planfully-logo-horizontal.svg" alt="Planfully" height={22}
            style={{ height: 22, filter: dark ? 'brightness(0) invert(1)' : 'none' }} />
          <span style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: dark ? '#b7a98f' : '#7a7468' }}>
            {studio}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: slide.center ? 'center' : 'flex-start', flex: 1, minHeight: 0 }}>
          {slide.content}
        </div>
      </div>

      {/* progress + nav */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,.08)' }}>
        <div style={{ height: '100%', width: `${(i + 1) / n * 100}%`, background: '#C49A5C', transition: 'width .3s' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', gap: 8 }}>
        <NavBtn onClick={(e) => { e.stopPropagation(); prev() }}><ChevronLeft size={16} /></NavBtn>
        <NavBtn onClick={(e) => { e.stopPropagation(); next() }}><ChevronRight size={16} /></NavBtn>
      </div>
      <div style={{ position: 'absolute', bottom: 14, right: 16, color: '#cdbfa8', fontSize: 12, letterSpacing: '.08em' }}>{i + 1} / {n}</div>
    </div>
  )
}

function NavBtn({ children, onClick }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void }) {
  return <button onClick={onClick} style={{ background: 'rgba(255,255,255,.1)', color: '#e7dcc8', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, width: 34, height: 30, cursor: 'pointer' }}>{children}</button>
}

// ── stili condivisi ──
const serif: React.CSSProperties = { fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 600, letterSpacing: '-.5px' }
const kicker = (dark?: boolean): React.CSSProperties => ({ fontSize: 13, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: dark ? '#C49A5C' : '#A97F3F', margin: '0 0 16px' })
const h1: React.CSSProperties = { ...serif, fontSize: 56, lineHeight: 1.04, margin: 0 }
const h2: React.CSSProperties = { ...serif, fontSize: 40, lineHeight: 1.08, margin: 0 }
const sub = (dark?: boolean): React.CSSProperties => ({ fontSize: 20, lineHeight: 1.5, color: dark ? '#cdbfa8' : '#7a7468', margin: '18px 0 0', maxWidth: '56ch' })
const tile = (dark?: boolean): React.CSSProperties => ({ background: dark ? 'rgba(255,255,255,.05)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : '#E7E1D5'}`, borderRadius: 16, padding: '22px 22px' })
const pill = (dark?: boolean): React.CSSProperties => ({ display: 'inline-block', alignSelf: 'flex-start', background: 'rgba(196,154,92,.16)', color: dark ? '#EAD9B6' : '#A97F3F', border: '1px solid rgba(196,154,92,.4)', borderRadius: 999, padding: '9px 17px', fontSize: 14.5, fontWeight: 700, marginTop: 26 })

function Bullet({ items, dark }: { items: { t: string; d?: string }[]; dark?: boolean }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '30px 0 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {items.map((it, k) => (
        <li key={k} style={{ fontSize: 25, lineHeight: 1.2, paddingLeft: 36, position: 'relative', fontWeight: 500 }}>
          <span style={{ position: 'absolute', left: 0, top: '.45em', width: 13, height: 13, borderRadius: '50%', background: '#C49A5C' }} />
          {it.t}
          {it.d && <span style={{ display: 'block', fontSize: 15.5, color: dark ? '#cdbfa8' : '#7a7468', fontWeight: 400, marginTop: 5 }}>{it.d}</span>}
        </li>
      ))}
    </ul>
  )
}

// Mini bar-chart matrimoni (dati ISTAT)
function MarriagesChart() {
  const data = [
    { y: '2021', v: 180416 }, { y: '2022', v: 189140 }, { y: '2023', v: 184207 },
  ]
  const max = 200000
  return (
    <div style={{ marginTop: 30, display: 'flex', gap: 26, alignItems: 'flex-end', height: 210 }}>
      {data.map((d, k) => {
        const h = (d.v / max) * 180
        const last = k === data.length - 1
        return (
          <div key={d.y} style={{ textAlign: 'center', flex: '0 0 90px' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 18, marginBottom: 8, color: last ? '#B05A5A' : '#1A1714' }}>{(d.v / 1000).toFixed(0)}k</div>
            <div style={{ height: h, background: last ? 'linear-gradient(180deg,#C77,#B05A5A)' : 'linear-gradient(180deg,#D9C8A6,#C49A5C)', borderRadius: '8px 8px 0 0' }} />
            <div style={{ fontSize: 14, color: '#7a7468', marginTop: 8 }}>{d.y}</div>
          </div>
        )
      })}
      <div style={{ alignSelf: 'center', marginLeft: 8 }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 46, color: '#B05A5A', lineHeight: 1 }}>−2,6%</div>
        <div style={{ fontSize: 14, color: '#7a7468', marginTop: 6, maxWidth: '22ch' }}>in un solo anno. I primi matrimoni −4,3%.</div>
      </div>
    </div>
  )
}

function buildSlides({ studio, inviteCode, inviteUrl }: { studio: string; inviteCode: string | null; inviteUrl: string | null }) {
  const S = studio || 'la mia rete'
  return [
    // 1 cover
    { dark: true, center: true, content: (<>
      <p style={kicker(true)}>Un invito a fare squadra</p>
      <h1 style={h1}>Entra nella rete.<br />Lavora di più, da solo di meno.</h1>
      <p style={sub(true)}>Ti spiego in due minuti perché ho scelto Planfully per <b style={{ color: '#fff' }}>{S}</b> — e perché conviene anche a te.</p>
    </>) },
    // 2 mercato (chart)
    { content: (<>
      <p style={kicker()}>Partiamo dai numeri</p>
      <h2 style={h2}>Ci si sposa sempre meno.</h2>
      <MarriagesChart />
      <p style={{ fontSize: 11.5, color: '#7a7468', marginTop: 18 }}>Fonte: ISTAT — Matrimoni 2023 (184.207, −2,6%); nascite ai minimi storici.</p>
    </>) },
    // 3 piattaforme
    { dark: true, center: true, content: (<>
      <p style={kicker(true)}>Il rischio vero</p>
      <h1 style={h1}>I grandi portali ti fanno<br />pagare per esistere.</h1>
      <p style={sub(true)}>Le multinazionali del wedding catturano le coppie e ti vendono come “lead”. Più paghi, più compari. La relazione non è mai tua.</p>
    </>) },
    // 4 la rete
    { content: (<>
      <p style={kicker()}>La risposta</p>
      <h2 style={h2}>Una rete compatta non perde eventi.</h2>
      <Bullet items={[
        { t: 'Chi è pieno passa il cliente a chi è libero.', d: "L'evento resta nel gruppo, non finisce su un portale." },
        { t: 'Quando un collega è occupato, l’evento può arrivare a te.', d: 'Stesso settore, stessa zona, in automatico.' },
        { t: 'Si lavora — e si guadagna — insieme.' },
      ]} />
    </>) },
    // 5 cosa ottieni
    { content: (<>
      <p style={kicker()}>Cosa ottieni tu</p>
      <h2 style={h2}>Più matrimoni, meno fatica.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 36 }}>
        <div style={tile()}><div style={{ ...serif, fontSize: 22 }}>Più lavoro</div><p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#7a7468' }}>Vieni suggerito quando i colleghi sono pieni.</p></div>
        <div style={tile()}><div style={{ ...serif, fontSize: 22 }}>Strumenti pronti</div><p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#7a7468' }}>Profilo portfolio, preventivi, calendario.</p></div>
        <div style={tile()}><div style={{ ...serif, fontSize: 22 }}>Zero portali</div><p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#7a7468' }}>Niente aste al ribasso per un contatto.</p></div>
      </div>
      <span style={pill()}>I clienti restano nella rete, non vanno a un portale.</span>
    </>) },
    // 6 strumenti
    { content: (<>
      <p style={kicker()}>I tuoi strumenti</p>
      <h2 style={h2}>Tutto in un posto, tutto automatico.</h2>
      <Bullet items={[
        { t: 'Una pagina-portfolio col tuo nome da mandare ai clienti.' },
        { t: 'Preventivi brandizzati che il cliente accetta online.' },
        { t: 'Calendario e disponibilità sempre aggiornati.' },
      ]} />
    </>) },
    // 7 gratis
    { dark: true, center: true, content: (<>
      <p style={kicker(true)}>L’offerta</p>
      <h1 style={h1}>Gratis fino a dicembre 2026.</h1>
      <p style={sub(true)}>Provi tutto senza spendere. Chi entra adesso è <b style={{ color: '#fff' }}>founding member</b>: condizioni migliori, per sempre.</p>
    </>) },
    // 8 CTA
    { dark: true, center: true, content: (<>
      <p style={kicker(true)}>Facciamolo insieme</p>
      <h1 style={h1}>Entra nella rete di {S}.</h1>
      <p style={sub(true)}>Ti aiuto io a creare il tuo account adesso. Bastano un’email e una password.</p>
      {inviteCode && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 26, flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(196,154,92,.18)', border: '1px solid rgba(196,154,92,.5)', borderRadius: 14, padding: '14px 22px' }}>
            <div style={{ fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: '#EAD9B6', fontWeight: 700 }}>Codice invito</div>
            <div style={{ ...serif, fontSize: 34, letterSpacing: '4px', color: '#fff' }}>{inviteCode}</div>
          </div>
          {inviteUrl && <div style={{ fontSize: 15, color: '#cdbfa8' }}>oppure<br /><span style={{ color: '#EAD9B6' }}>{inviteUrl.replace('https://', '')}</span></div>}
        </div>
      )}
    </>) },
  ]
}
