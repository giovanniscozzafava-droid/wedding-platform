import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'
import { supabase } from '@/lib/supabase'

// Query Pexels (in inglese: risultati migliori) per specializzazione.
const PEXELS_QUERY: Record<string, string> = {
  fotografo: 'wedding photographer', videomaker: 'wedding videographer', musica: 'wedding band live music',
  fioraio: 'wedding flowers bouquet', allestimenti: 'wedding decoration', catering: 'wedding catering food',
  chef: 'chef plating dish', food_truck: 'food truck event', pasticcere: 'wedding cake', sweet_table: 'dessert table',
  bartender: 'cocktail bar wedding', sommelier: 'wine tasting', make_up: 'bridal makeup', parrucchiere: 'bridal hairstyle',
  estetista: 'manicure spa', luci: 'event lighting', fuochista: 'fireworks wedding', auto: 'wedding vintage car',
  celebrante: 'wedding ceremony', stampe: 'wedding invitation', abiti: 'wedding dress atelier', bomboniere: 'wedding favors',
  magia: 'magician show', animazione: 'kids party', photobooth: 'photo booth party', maitre: 'elegant table setting',
}
// Qualificatore richiesto: persone caucasiche.
const pexelsQuery = (subrole: string) => `${PEXELS_QUERY[subrole] ?? 'wedding celebration'} caucasian`

/**
 * Presentazione a schermo intero, NEUTRA (parla di Planfully) e PARAMETRIZZATA
 * per specializzazione. Struttura a pilastri: spiega in modo chiaro ed
 * entusiasmante TUTTI gli strumenti, con mockup dell'app. Dati = proiezioni
 * demografiche future (ISTAT).
 */
export function RecruitingDeck({ subrole, inviteCode, inviteUrl, onClose }: {
  subrole: string; inviteCode: string | null; inviteUrl: string | null; onClose: () => void
}) {
  const [i, setI] = useState(0)
  const [photos, setPhotos] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const { data } = await supabase.functions.invoke('pexels-search', { body: { query: pexelsQuery(subrole), per_page: 10, orientation: 'landscape' } })
        const ph = (data as { photos?: { src?: { large?: string; medium?: string } }[] } | null)?.photos ?? []
        if (alive) setPhotos(ph.map(p => p.src?.large || p.src?.medium || '').filter(Boolean))
      } catch { /* niente immagini: restano i fallback */ }
    })()
    return () => { alive = false }
  }, [subrole])
  const slides = buildSlides({ subrole, inviteCode, inviteUrl, photos })
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
      <button onClick={onClose} aria-label="Chiudi"
        style={{ position: 'absolute', top: 16, right: 16, zIndex: 3, background: 'rgba(255,255,255,.1)', color: '#e7dcc8', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, width: 38, height: 34, cursor: 'pointer' }}>
        <X size={16} style={{ margin: '0 auto', display: 'block' }} />
      </button>
      <button onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Schermo intero"
        style={{ position: 'absolute', top: 16, right: 62, zIndex: 3, background: 'rgba(255,255,255,.1)', color: '#e7dcc8', border: '1px solid rgba(255,255,255,.16)', borderRadius: 8, width: 38, height: 34, cursor: 'pointer' }}>
        <Maximize2 size={15} style={{ margin: '0 auto', display: 'block' }} />
      </button>

      <div onClick={(e) => { (e.clientX / window.innerWidth > 0.5 ? next : prev)() }}
        style={{
          width: 'min(95vw,1180px)', height: 'min(92vh,680px)', borderRadius: 18, overflow: 'hidden',
          padding: '46px 60px', display: 'flex', flexDirection: 'column', cursor: 'pointer',
          boxShadow: '0 30px 80px rgba(0,0,0,.5)', position: 'relative',
          background: dark ? 'radial-gradient(120% 120% at 80% 0%,#322b23 0%,#141009 70%)' : '#FDFBF6',
          color: dark ? '#F4EDE0' : '#1A1714',
          fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
        }}>
        {slide.bg && (
          <>
            <img src={slide.bg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(15,11,6,.92) 0%, rgba(15,11,6,.78) 45%, rgba(15,11,6,.42) 100%)' }} />
          </>
        )}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
          <img src="/brand/planfully-logo-horizontal.svg" alt="Planfully" height={22}
            style={{ height: 22, filter: dark ? 'brightness(0) invert(1)' : 'none' }} />
          <span style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: dark ? '#b7a98f' : '#7a7468' }}>
            {slide.tag}
          </span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: slide.center ? 'center' : 'flex-start', flex: 1, minHeight: 0 }}>
          {slide.content}
        </div>
      </div>

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

// ── stili ──
const serif: React.CSSProperties = { fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 600, letterSpacing: '-.5px' }
const kicker = (dark?: boolean): React.CSSProperties => ({ fontSize: 12.5, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: dark ? '#C49A5C' : '#A97F3F', margin: '0 0 14px' })
const h1: React.CSSProperties = { ...serif, fontSize: 52, lineHeight: 1.04, margin: 0 }
const h2: React.CSSProperties = { ...serif, fontSize: 36, lineHeight: 1.1, margin: 0 }
const sub = (dark?: boolean): React.CSSProperties => ({ fontSize: 19, lineHeight: 1.5, color: dark ? '#cdbfa8' : '#7a7468', margin: '16px 0 0', maxWidth: '52ch' })
const pill = (dark?: boolean): React.CSSProperties => ({ display: 'inline-block', alignSelf: 'flex-start', background: 'rgba(196,154,92,.16)', color: dark ? '#EAD9B6' : '#A97F3F', border: '1px solid rgba(196,154,92,.4)', borderRadius: 999, padding: '8px 16px', fontSize: 14, fontWeight: 700, marginTop: 22 })

function Feat({ items }: { items: { t: string; d: string }[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '24px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((it, k) => (
        <li key={k} style={{ paddingLeft: 30, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 0, top: 7, width: 12, height: 12, borderRadius: '50%', background: '#C49A5C' }} />
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>{it.t}</div>
          <div style={{ fontSize: 15.5, color: '#7a7468', marginTop: 3, lineHeight: 1.45 }}>{it.d}</div>
        </li>
      ))}
    </ul>
  )
}

function Split({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.04fr .96fr', gap: 44, alignItems: 'center', flex: 1, minHeight: 0 }}>
      <div>{left}</div>
      <div>{right}</div>
    </div>
  )
}

// ── mockup app ──
function Device({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E7E1D5', borderRadius: 16, overflow: 'hidden', boxShadow: '0 18px 40px rgba(40,30,15,.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 14px', background: '#F2ECE0', borderBottom: '1px solid #E7E1D5' }}>
        {[0, 1, 2].map(k => <span key={k} style={{ width: 10, height: 10, borderRadius: '50%', background: '#d8cdb8' }} />)}
        <span style={{ marginLeft: 8, fontSize: 11, color: '#9a907f', background: '#fff', border: '1px solid #E7E1D5', borderRadius: 6, padding: '4px 10px', flex: 1 }}>{url}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}
function ProfileMock({ label, photos }: { label: string; photos: string[] }) {
  const fallback = ['#D9C8A6', '#cdbfa8', '#e3d6bb', '#c9b48a', '#ddd0b6', '#d2c09a']
  return (
    <Device url="planfully.it/tuo-profilo">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginBottom: 12 }}>
        {fallback.map((c, k) => (
          <div key={k} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: `linear-gradient(135deg,${c},#bfa06f)` }}>
            {photos[k] && <img src={photos[k]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
          </div>
        ))}
      </div>
      <div style={{ ...serif, fontSize: 16 }}>Il tuo studio · <span style={{ color: '#A97F3F' }}>{label}</span></div>
      <div style={{ display: 'flex', gap: 6, margin: '8px 0 12px' }}>
        {['Elegante', 'Su misura', 'Top rated'].map(c => <span key={c} style={{ fontSize: 11, border: '1px solid #E7E1D5', borderRadius: 999, padding: '4px 10px', color: '#7d7567' }}>{c}</span>)}
      </div>
      <div style={{ background: '#C49A5C', color: '#fff', textAlign: 'center', borderRadius: 9, padding: 11, fontSize: 13.5, fontWeight: 700 }}>Richiedi preventivo</div>
    </Device>
  )
}
function QuoteMock() {
  const rows = [['Servizio · giornata intera', '2.800 €'], ['Extra concordati', '600 €'], ['Trasferta', '200 €']]
  return (
    <Device url="Preventivo · Sara & Luca">
      {rows.map((r, k) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '9px 0', borderTop: k ? '1px solid #E7E1D5' : 'none', color: '#4a443a' }}>
          <span>{r[0]}</span><span>{r[1]}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 8, paddingTop: 10, borderTop: '2px solid #1A1714' }}><span>Totale</span><span>3.600 €</span></div>
      <div style={{ marginTop: 12, border: '2px solid #3F7A56', color: '#3F7A56', borderRadius: 9, textAlign: 'center', padding: 8, fontWeight: 800, fontSize: 12.5, letterSpacing: '.06em', textTransform: 'uppercase', transform: 'rotate(-2deg)' }}>✓ Accettato online</div>
    </Device>
  )
}
function CalMock() {
  const cells: ('' | 'ok' | 'busy')[] = ['', 'ok', '', 'busy', 'ok', '', 'busy']
  return (
    <Device url="Disponibilità · Settembre">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5, marginBottom: 12 }}>
        {cells.map((c, k) => (
          <div key={k} style={{
            aspectRatio: '1', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: c ? 700 : 400,
            background: c === 'busy' ? 'rgba(176,90,90,.16)' : c === 'ok' ? 'rgba(63,122,86,.14)' : '#fff',
            border: `1px solid ${c === 'busy' ? 'rgba(176,90,90,.4)' : c === 'ok' ? 'rgba(63,122,86,.4)' : '#E7E1D5'}`,
            color: c === 'busy' ? '#B05A5A' : c === 'ok' ? '#3F7A56' : '#8c8474',
          }}>{8 + k}</div>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: '#7a7468' }}>Accetti un evento → la data si <b style={{ color: '#1A1714' }}>blocca da sola</b>. Niente sovrapposizioni.</div>
    </Device>
  )
}
function NetworkMock({ rete }: { rete: string }) {
  return (
    <Device url="Un collega è occupato…">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#F2ECE0', color: '#3a352d', borderRadius: 13, borderBottomLeftRadius: 4, padding: '9px 12px', fontSize: 12.5 }}>Sei libero il 12 settembre? Una coppia ti sta cercando.</div>
        <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: '#C49A5C', color: '#fff', borderRadius: 13, borderBottomRightRadius: 4, padding: '9px 12px', fontSize: 12.5 }}>Sì! Mandami pure i dettagli ✋</div>
        <div style={{ fontSize: 11.5, color: '#a89e8c', marginTop: 2 }}>{rete}</div>
      </div>
    </Device>
  )
}

function CapostipiteMock() {
  return (
    <Device url="La rete di un capostipite">
      <div style={{ background: 'linear-gradient(135deg,#322b23,#14110e)', color: '#F4EDE0', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#C49A5C', fontWeight: 700 }}>Wedding Planner / Location</div>
        <div style={{ ...serif, fontSize: 18, marginTop: 4 }}>Porta gli eventi</div>
      </div>
      <div style={{ textAlign: 'center', color: '#C49A5C', fontSize: 18, margin: '4px 0' }}>↓</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Fotografo', 'Fioraio', 'Tu', 'Band'].map((r, k) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: '1px solid #E7E1D5', background: k === 2 ? 'rgba(196,154,92,.14)' : '#fff', fontSize: 13, fontWeight: k === 2 ? 700 : 400 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg,#d9c8a6,#bfa06f)' }} />
            {r}{k === 2 && <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A97F3F', fontWeight: 700 }}>in pancia ✓</span>}
          </div>
        ))}
      </div>
    </Device>
  )
}

function RentMock() {
  const items: [string, string, string][] = [
    ['📷', 'Reflex + obiettivo', '45€/g'],
    ['💄', 'Postazione make-up', '60€/g'],
    ['🕯️', 'Candelabri (set)', '20€/g'],
    ['🌸', 'Porta-fiori / vasi', '15€/g'],
    ['🔊', 'Casse + luci', '80€/g'],
  ]
  return (
    <Device url="Noleggio · tra colleghi">
      {items.map((it, k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: k ? '1px solid #E7E1D5' : 'none', fontSize: 13.5 }}>
          <span style={{ fontSize: 18 }}>{it[0]}</span>
          <span style={{ color: '#4a443a' }}>{it[1]}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#A97F3F' }}>{it[2]}</span>
        </div>
      ))}
      <div style={{ marginTop: 12, background: '#C49A5C', color: '#fff', textAlign: 'center', borderRadius: 9, padding: 10, fontSize: 13, fontWeight: 700 }}>Incassi anche senza eventi</div>
    </Device>
  )
}

function Node({ label, sub, gold }: { label: string; sub?: string; gold?: boolean }) {
  return (
    <div style={{ border: `1px solid ${gold ? '#C49A5C' : '#E7E1D5'}`, background: gold ? 'rgba(196,154,92,.12)' : '#fff', borderRadius: 11, padding: '11px 12px', textAlign: 'center' }}>
      <div style={{ ...serif, fontSize: 15.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#7a7468', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
function Arrow({ t }: { t: string }) {
  return <div style={{ textAlign: 'center', color: '#C49A5C', fontSize: 16, margin: '7px 0', fontWeight: 700 }}>{t}</div>
}
function NetworkSchema() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 44, marginTop: 22 }}>
      <div>
        <div style={{ ...kicker(), marginBottom: 12 }}>Via 1 · Il referente evento porta lavoro</div>
        <Node label="Coppia / Cliente" sub="cerca e compila il form" />
        <Arrow t="↓" />
        <Node label="Referente evento" sub="Wedding Planner / Location" gold />
        <Arrow t="↓ porta gli eventi" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Node label="Fornitore" /><Node label="Tu" gold /><Node label="Fornitore" />
        </div>
      </div>
      <div>
        <div style={{ ...kicker(), marginBottom: 12 }}>Via 2 · Scambio tra colleghi</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}><Node label="Collega" sub="è pieno quel giorno" /></div>
          <div style={{ color: '#C49A5C', fontSize: 22, fontWeight: 700 }}>→</div>
          <div style={{ flex: 1 }}><Node label="Tu" sub="sei libero" gold /></div>
        </div>
        <Arrow t="↑  pegno (credito)  ↑" />
        <Node label="Si salda" sub="in denaro, o reciproco (gli rendi il favore)" />
        <div style={{ fontSize: 13, color: '#7a7468', marginTop: 14, textAlign: 'center', lineHeight: 1.45 }}>
          Chi riceve il lavoro riconosce un <b style={{ color: '#1A1714' }}>pegno</b> a chi gliel’ha passato.
        </div>
      </div>
    </div>
  )
}

// ── proiezione matrimoni 2025→2027 (trend ISTAT) + eventi in crescita ──
function DemoChart() {
  const data = [{ y: '2025', v: 175 }, { y: '2026', v: 170 }, { y: '2027', v: 166 }]
  const max = 195
  return (
    <div style={{ marginTop: 20, display: 'flex', gap: 26, alignItems: 'flex-end', height: 195 }}>
      {data.map((d) => (
        <div key={d.y} style={{ textAlign: 'center', flex: '0 0 88px' }}>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: 19, marginBottom: 8, color: '#B05A5A' }}>{d.v}k</div>
          <div style={{ height: (d.v / max) * 155, background: 'linear-gradient(180deg,#C77,#B05A5A)', borderRadius: '8px 8px 0 0' }} />
          <div style={{ fontSize: 13.5, color: '#7a7468', marginTop: 7 }}>{d.y}<span style={{ fontSize: 10, display: 'block', color: '#a89e8c' }}>proiezione</span></div>
        </div>
      ))}
      <div style={{ alignSelf: 'center', marginLeft: 14, borderLeft: '1px solid #E7E1D5', paddingLeft: 22 }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 34, color: '#3F7A56', lineHeight: 1 }}>▲ Eventi</div>
        <div style={{ fontSize: 14, color: '#7a7468', marginTop: 8, maxWidth: '24ch' }}>Battesimi, lauree, 18°, aziendali: <b style={{ color: '#1A1714' }}>in crescita</b>. Il lavoro si sposta lì — e tu ci sei.</div>
      </div>
    </div>
  )
}

// ── contenuto per specializzazione ──
type Spec = { hook: string; profilo: string; preventivo: string; disponibilita: string; rete: string }
const SPEC: Record<string, Spec> = {
  fotografo: { hook: 'La coppia sceglie te per come scatti.', profilo: 'Gallery-portfolio coi tuoi servizi migliori in primo piano.', preventivo: 'Pacchetti a giornata, album e secondo fotografo già pronti.', disponibilita: 'Una data = un matrimonio: nessuna doppia prenotazione.', rete: 'Un fotografo occupato in quella data → la coppia arriva a te.' },
  videomaker: { hook: 'Il tuo reel parla prima di te.', profilo: 'Video demo e showreel nel profilo.', preventivo: 'Pacchetti trailer, film integrale, drone — voce per voce.', disponibilita: 'Un giorno = un evento, senza sovrapposizioni.', rete: 'Un videomaker già preso → il matrimonio arriva a te.' },
  musica: { hook: 'La coppia ti sente suonare prima di chiamarti.', profilo: 'Demo audio/video e repertorio nel profilo.', preventivo: 'Preventivi per formazione e ore (cerimonia, aperitivo, serata).', disponibilita: 'Una sera = un evento: niente date accavallate.', rete: 'Un’altra band/DJ già impegnato → la serata arriva a te.' },
  fioraio: { hook: 'Il tuo gusto si vede prima del preventivo.', profilo: 'Portfolio di allestimenti per stile e palette.', preventivo: 'Preventivi per chiesa, sala, bouquet, centrotavola.', disponibilita: 'Più eventi al giorno secondo la tua capacità reale.', rete: 'Un fiorista pieno → l’allestimento arriva a te.' },
  catering: { hook: 'La coppia vede cosa porti in tavola.', profilo: 'Menu e gallery dei tuoi servizi.', preventivo: 'Preventivi a coperto, col numero invitati già dal modulo.', disponibilita: 'Capacità giornaliera reale: niente impegni oltre la brigata.', rete: 'Un catering già impegnato → l’evento passa a te.' },
  pasticcere: { hook: 'La wedding cake si vende con gli occhi.', profilo: 'Gallery di torte e confettate.', preventivo: 'Preventivi per torta, piani e sweet table.', disponibilita: 'Agenda consegne senza accavallamenti.', rete: 'Un collega pieno → la coppia arriva a te.' },
  make_up: { hook: 'Il tuo lavoro si vede sui volti.', profilo: 'Portfolio di look e prove trucco.', preventivo: 'Preventivi per sposa, prova e invitate.', disponibilita: 'Agenda del mattino: più spose, date diverse.', rete: 'Una collega occupata quella mattina → la sposa arriva a te.' },
  parrucchiere: { hook: 'Acconciature che parlano da sole.', profilo: 'Portfolio di acconciature e prove.', preventivo: 'Preventivi per sposa, prova e servizi extra.', disponibilita: 'Agenda per orari, senza confusione.', rete: 'Un collega pieno → la sposa arriva a te.' },
  allestimenti: { hook: 'Il tuo progetto si capisce a colpo d’occhio.', profilo: 'Portfolio di set e scenografie.', preventivo: 'Preventivi per aree: cerimonia, sala, lounge.', disponibilita: 'Calendario sulla tua capacità di montaggio.', rete: 'Un wedding designer pieno → l’evento arriva a te.' },
  auto: { hook: 'Le tue auto fanno innamorare.', profilo: 'Le tue vetture in gallery: modello, epoca, allestimento.', preventivo: 'Preventivi per tratta/ore e numero di mezzi.', disponibilita: 'Calendario per ogni mezzo: ogni auto, le sue date.', rete: 'Un collega senza disponibilità → il servizio passa a te.' },
  bartender: { hook: 'Il tuo banco si vede prima di assaggiarlo.', profilo: 'Gallery di open bar e signature drink.', preventivo: 'Preventivi per ore, postazioni e ospiti.', disponibilita: 'Una sera = un evento.', rete: 'Un collega impegnato → l’evento arriva a te.' },
  celebrante: { hook: 'La coppia sceglie le tue parole.', profilo: 'Il tuo stile di cerimonia e le testimonianze.', preventivo: 'Preventivi per tipo di rito e personalizzazione.', disponibilita: 'Calendario per data e orario.', rete: 'Un collega occupato → la coppia arriva a te.' },
  stampe: { hook: 'Inviti e tableau che si vedono prima di ordinarli.', profilo: 'Portfolio di partecipazioni, tableau, cartoline.', preventivo: 'Preventivi per quantità e lavorazioni.', disponibilita: 'Agenda di consegna per i tempi di stampa.', rete: 'Un collega pieno → il lavoro arriva a te.' },
}
function specFor(subrole: string, label: string): Spec {
  const l = label.toLowerCase()
  return SPEC[subrole] ?? {
    hook: `La coppia sceglie te per il tuo lavoro di ${l} — visto, non raccontato.`,
    profilo: `Un profilo-portfolio col tuo nome che mostra il tuo lavoro di ${l}.`,
    preventivo: `Preventivi brandizzati con le tue voci, accettati online dalla coppia.`,
    disponibilita: `Calendario e disponibilità sempre aggiornati sulla tua capacità reale.`,
    rete: `Un collega ${l} occupato in quella data → l’evento arriva a te.`,
  }
}

function buildSlides({ subrole, inviteCode, inviteUrl, photos }: { subrole: string; inviteCode: string | null; inviteUrl: string | null; photos: string[] }) {
  const label = SUPPLIER_SUBROLES.find(s => s.v === subrole)?.l ?? 'Professionista'
  const spec = specFor(subrole, label)
  const tag = `Per: ${label}`
  return [
    // 1 — cover
    { dark: true, center: true, tag, bg: photos[0], content: (<>
      <p style={kicker(true)}>La rete dei professionisti degli eventi</p>
      <h1 style={h1}>Tutto il tuo lavoro,<br />in un posto solo.</h1>
      <p style={sub(true)}>Ti mostro in cinque minuti cosa fa Planfully per un <b style={{ color: '#fff' }}>{label.toLowerCase()}</b>: come ti trovano, come chiudi, come la rete ti porta lavoro.</p>
    </>) },
    // 2 — demografia (perché)
    { tag, content: (<>
      <p style={kicker()}>Prima il perché</p>
      <h2 style={h2}>I matrimoni calano. Gli eventi salgono.</h2>
      <DemoChart />
      <div style={{ display: 'flex', gap: 28, marginTop: 14, flexWrap: 'wrap' }}>
        {[['~170.000', 'matrimoni nel 2026 (proiez.)'], ['~166.000', 'nel 2027 (proiez.)'], ['−2,5%', 'all’anno, di media']].map(([n, l]) => (
          <span key={l} style={{ fontSize: 13.5, color: '#7a7468' }}><b style={{ color: '#B05A5A', fontFamily: 'Georgia,serif', fontSize: 19, marginRight: 6 }}>{n}</b>{l}</span>
        ))}
      </div>
      <p style={{ fontSize: 11.5, color: '#7a7468', marginTop: 11 }}>Proiezione su trend ISTAT (matrimoni: 189.140 nel 2022 → 184.207 nel 2023, −2,6%). Mentre i matrimoni scendono, gli altri eventi crescono.</p>
    </>) },
    // 3 — tutti gli eventi (la buona notizia)
    { tag, content: (<>
      <p style={kicker()}>Ma ecco la buona notizia</p>
      <h2 style={h2}>Qui non si lavora solo coi matrimoni. Tutti gli eventi.</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
        {['Matrimoni', 'Battesimi', 'Comunioni', 'Cresime', 'Lauree', '18°', 'Anniversari', 'Compleanni', 'Eventi aziendali', 'Feste private'].map(e => (
          <span key={e} style={{ fontSize: 15, border: '1px solid #E7E1D5', borderRadius: 999, padding: '8px 16px', background: '#fff' }}>{e}</span>
        ))}
      </div>
      <p style={sub()}>I matrimoni calano, ma gli eventi no — e qui lavori su <b style={{ color: '#1A1714' }}>tutti</b>. Per questo <b style={{ color: '#1A1714' }}>tutto parte dalle Location</b>: ospitano ogni tipo di festa, quindi sono il punto di partenza della rete.</p>
    </>) },
    // 3 — il rischio + serve un sistema
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>Due nemici</p>
      <h1 style={h1}>Meno eventi.<br />E i portali che te li rubano.</h1>
      <p style={sub(true)}>Le multinazionali del wedding ti vendono come “lead” e ti fanno pagare per comparire. La risposta è avere <b style={{ color: '#fff' }}>un sistema tuo</b> e <b style={{ color: '#fff' }}>una rete</b> che lavora con te.</p>
    </>) },
    // 4 — la logica in una frase
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>La logica, una sola</p>
      <h1 style={h1}>Il lavoro non si perde.<br />Circola nella rete.</h1>
      <p style={sub(true)}>E ogni passaggio lascia un valore: o ti porta lavoro un <b style={{ color: '#fff' }}>capostipite</b> (e lo riconosci con una %), o te lo scambi coi <b style={{ color: '#fff' }}>colleghi</b> (e lo riconosci con un pegno). Il cliente resta nella rete — non finisce a un portale.</p>
    </>) },
    // 5 — chi è chi
    { tag, content: (<>
      <p style={kicker()}>Facciamo chiarezza</p>
      <h2 style={h2}>Nella rete ci sono due tipi di professionisti.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 26 }}>
        <div style={{ background: '#fff', border: '1px solid #E7E1D5', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: '#A97F3F', fontWeight: 800 }}>I capostipiti</div>
          <div style={{ ...serif, fontSize: 23, marginTop: 8 }}>Location &amp; Wedding Planner</div>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, color: '#7a7468', lineHeight: 1.5 }}><b style={{ color: '#1A1714' }}>Organizzano e ospitano gli eventi</b> — non solo matrimoni. Le <b style={{ color: '#1A1714' }}>Location</b>, che accolgono ogni festa, sono il punto di partenza della rete: portano il lavoro. Per loro è <b style={{ color: '#1A1714' }}>gratis, sempre</b>.</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E7E1D5', borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: '#A97F3F', fontWeight: 800 }}>I fornitori</div>
          <div style={{ ...serif, fontSize: 23, marginTop: 8 }}>Foto, musica, fiori, catering… (tu)</div>
          <p style={{ margin: '10px 0 0', fontSize: 15.5, color: '#7a7468', lineHeight: 1.5 }}><b style={{ color: '#1A1714' }}>Realizzano i servizi</b> del matrimonio. Si fanno trovare e ricevono lavoro: <b style={{ color: '#1A1714' }}>dai capostipiti</b> o <b style={{ color: '#1A1714' }}>dai colleghi</b>.</p>
        </div>
      </div>
    </>) },
    // 6 — schema della rete
    { tag, content: (<>
      <p style={kicker()}>Come gira il lavoro</p>
      <h2 style={h2}>Lo schema della rete.</h2>
      <NetworkSchema />
    </>) },
    // 6 — via 1: in pancia ai capostipiti
    { tag, content: (
      <Split
        left={<>
          <p style={kicker()}>Via 1 · Verticale</p>
          <h2 style={{ ...h2, fontSize: 33 }}>Entra in pancia a un capostipite.</h2>
          <Feat items={[
            { t: 'Loro generano la domanda', d: 'Wedding planner e location organizzano i matrimoni: gli eventi nascono da lì.' },
            { t: 'Ti portano lavoro', d: 'Entri nella loro rete col codice invito e ricevi gli incarichi.' },
            { t: 'Interessi allineati', d: 'Il capostipite guadagna una % se cresci: è il primo a volerti dare clienti.' },
          ]} />
        </>}
        right={<CapostipiteMock />}
      />
    ) },
    // 7 — via 2: tra colleghi col pegno
    { tag, content: (
      <Split
        left={<>
          <p style={kicker()}>Via 2 · Orizzontale</p>
          <h2 style={{ ...h2, fontSize: 33 }}>Scambia lavoro coi colleghi, col pegno.</h2>
          <Feat items={[
            { t: 'Un collega pieno passa a te', d: spec.rete },
            { t: 'Nessuno regala niente', d: 'Chi riceve riconosce un pegno: un credito a chi gli ha dato il lavoro.' },
            { t: 'Saldi come vuoi', d: 'In denaro, o reciproco — restituendo una segnalazione la volta dopo.' },
          ]} />
        </>}
        right={<NetworkMock rete={spec.rete} />}
      />
    ) },
    // 8 — il funnel
    { tag, content: (<>
      <p style={kicker()}>Come il contatto diventa contratto</p>
      <h2 style={h2}>Il funnel, dall’inizio alla firma.</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 34 }}>
        {[
          ['La tua pagina', 'Il cliente compila il form'],
          ['Lead', 'Arriva già qualificato'],
          ['Preventivo', 'Brandizzato, accettato online'],
          ['Contratto', 'Nasce da sé, firmato'],
          ['Data bloccata', 'Il calendario si aggiorna'],
        ].map((s, k, arr) => (
          <div key={k} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ flex: 1, background: '#fff', border: '1px solid #E7E1D5', borderRadius: 12, padding: '16px 10px', textAlign: 'center' }}>
              <div style={{ ...serif, fontSize: 15.5 }}>{s[0]}</div>
              <div style={{ fontSize: 12, color: '#7a7468', marginTop: 5, lineHeight: 1.35 }}>{s[1]}</div>
            </div>
            {k < arr.length - 1 && <div style={{ color: '#C49A5C', fontSize: 20, padding: '0 5px' }}>→</div>}
          </div>
        ))}
      </div>
      <span style={pill()}>E un’automazione email nutre i lead finché non sono pronti a firmare.</span>
    </>) },
    // 5 — pilastro 1: ti trovano
    { tag, content: (
      <Split
        left={<>
          <p style={kicker()}>Ti trovano</p>
          <h2 style={{ ...h2, fontSize: 33 }}>Una pagina tua, che porta clienti.</h2>
          <Feat items={[
            { t: 'Profilo-portfolio col tuo nome', d: spec.profilo },
            { t: 'Un link da mandare ovunque', d: 'In bio, nelle mail, su WhatsApp: la coppia compila e ti arriva tutto in ordine.' },
            { t: 'Lead già qualificati', d: 'Data, budget, stile, invitati: apri e sei pronto a proporre.' },
          ]} />
        </>}
        right={<ProfileMock label={label} photos={photos.slice(1, 7)} />}
      />
    ) },
    // 6 — pilastro 2: chiudi
    { tag, content: (
      <Split
        left={<>
          <p style={kicker()}>Chiudi senza fatica</p>
          <h2 style={{ ...h2, fontSize: 33 }}>Dalla richiesta alla firma, in un filo.</h2>
          <Feat items={[
            { t: 'Preventivo col tuo brand', d: spec.preventivo },
            { t: 'La coppia accetta online', d: 'Un clic e il preventivo è accettato — niente rincorse.' },
            { t: 'Il contratto nasce da sé', d: 'Quello che accetti diventa contratto firmabile. Zero doppio lavoro.' },
          ]} />
        </>}
        right={<QuoteMock />}
      />
    ) },
    // 7 — pilastro 3: organizzi
    { tag, content: (
      <Split
        left={<>
          <p style={kicker()}>Organizzi tutto</p>
          <h2 style={{ ...h2, fontSize: 33 }}>Mai più “quella data era libera?”.</h2>
          <Feat items={[
            { t: 'Calendario & disponibilità', d: spec.disponibilita },
            { t: 'Catalogo dei tuoi servizi', d: 'Pacchetti e voci pronti: componi un preventivo in pochi clic.' },
            { t: 'Calcolatore prezzi', d: 'Numeri giusti, margini sotto controllo, sempre.' },
          ]} />
        </>}
        right={<CalMock />}
      />
    ) },
    // — Scopri + Noleggio: guadagni anche da fermo
    { tag, content: (
      <Split
        left={<>
          <p style={kicker()}>Anche da fermo</p>
          <h2 style={{ ...h2, fontSize: 32 }}>Sei in “Scopri”. E guadagni anche quando non lavori.</h2>
          <Feat items={[
            { t: 'Entri in Scopri', d: 'Referenti evento e colleghi ti trovano per settore e zona, anche senza conoscerti.' },
            { t: 'Noleggi quello che hai', d: 'Metti a noleggio attrezzi e servizi: la macchina fotografica, un porta-fiori, un candelabro, una postazione make-up, casse e luci…' },
            { t: 'Reddito passivo', d: 'Chi non ha quello strumento lo prende da te. Incassi anche nei giorni senza eventi.' },
          ]} />
        </>}
        right={<RentMock />}
      />
    ) },
    // 9 — pilastro 5: cresci
    { tag, content: (<>
      <p style={kicker()}>Cresci</p>
      <h2 style={h2}>Il tuo brand. La tua community.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 30 }}>
        <div style={{ background: '#fff', border: '1px solid #E7E1D5', borderRadius: 16, padding: 24 }}>
          <div style={{ ...serif, fontSize: 22 }}>Tutto col tuo logo</div>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: '#7a7468', lineHeight: 1.5 }}>Profilo, preventivi e contratti coi tuoi colori. La coppia vede te, non noi.</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E7E1D5', borderRadius: 16, padding: 24 }}>
          <div style={{ ...serif, fontSize: 22 }}>Una community di colleghi</div>
          <p style={{ margin: '8px 0 0', fontSize: 16, color: '#7a7468', lineHeight: 1.5 }}>Feed, idee e contatti reali. Non sei più solo: sei in una squadra.</p>
        </div>
      </div>
      <span style={pill()}>Più la rete cresce, più lavoro gira — anche per te.</span>
    </>) },
    // — proteggiamo il tuo business (rendite passive e automatiche)
    { dark: true, tag, content: (<>
      <p style={kicker(true)}>La promessa</p>
      <h2 style={h2}>Mentre il mercato si stringe, tu costruisci entrate che arrivano da sole.</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 28 }}>
        {[
          ['In pancia ai capostipiti', 'Il lavoro ti arriva in automatico: sono loro a portartelo.'],
          ['Crediti tra colleghi', 'Le segnalazioni ti rendono — un pegno per ogni evento passato.'],
          ['Noleggio', 'Incassi anche nei giorni senza eventi: reddito passivo.'],
        ].map(([t, d]) => (
          <div key={t} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 14, padding: '20px 18px' }}>
            <div style={{ ...serif, fontSize: 19, color: '#EAD9B6' }}>{t}</div>
            <div style={{ fontSize: 14.5, color: '#cdbfa8', marginTop: 8, lineHeight: 1.45 }}>{d}</div>
          </div>
        ))}
      </div>
      <span style={pill(true)}>È la logica dei capostipiti: la rete protegge il tuo business con rendite passive e automatiche.</span>
    </>) },
    // 10 — gratis
    { dark: true, center: true, tag, bg: photos[3] || undefined, content: (<>
      <p style={kicker(true)}>L’offerta</p>
      <h1 style={h1}>Gratis fino a dicembre 2026.</h1>
      <p style={sub(true)}>Provi tutto senza spendere. Chi entra adesso è <b style={{ color: '#fff' }}>founding member</b>: condizioni migliori, per sempre.</p>
    </>) },
    // 11 — CTA
    { dark: true, center: true, tag, bg: photos[2] || photos[0], content: (<>
      <p style={kicker(true)}>Facciamolo adesso</p>
      <h1 style={h1}>Entra nella rete.</h1>
      <p style={sub(true)}>Ti aiuto io a creare il tuo account ora. Bastano un’email e una password.</p>
      {inviteCode && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginTop: 24, flexWrap: 'wrap' }}>
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
