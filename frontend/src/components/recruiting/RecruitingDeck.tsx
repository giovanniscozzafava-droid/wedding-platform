import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'

/**
 * Presentazione a schermo intero che il capostipite mostra al professionista da
 * reclutare. NEUTRA (parla di Planfully, non del singolo capostipite) e
 * PARAMETRIZZATA per specializzazione: spiega in dettaglio cosa fa la
 * piattaforma per quel mestiere. Dati di mercato = proiezioni demografiche
 * future (ISTAT), non dati storici.
 */
export function RecruitingDeck({ subrole, inviteCode, inviteUrl, onClose }: {
  subrole: string; inviteCode: string | null; inviteUrl: string | null; onClose: () => void
}) {
  const [i, setI] = useState(0)
  const slides = buildSlides({ subrole, inviteCode, inviteUrl })
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
          padding: '50px 64px', display: 'flex', flexDirection: 'column', cursor: 'pointer',
          boxShadow: '0 30px 80px rgba(0,0,0,.5)', position: 'relative',
          background: dark ? 'radial-gradient(120% 120% at 80% 0%,#322b23 0%,#141009 70%)' : '#FDFBF6',
          color: dark ? '#F4EDE0' : '#1A1714',
          fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'auto' }}>
          <img src="/brand/planfully-logo-horizontal.svg" alt="Planfully" height={22}
            style={{ height: 22, filter: dark ? 'brightness(0) invert(1)' : 'none' }} />
          <span style={{ fontSize: 11.5, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 700, color: dark ? '#b7a98f' : '#7a7468' }}>
            {slide.tag}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: slide.center ? 'center' : 'flex-start', flex: 1, minHeight: 0 }}>
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

const serif: React.CSSProperties = { fontFamily: 'Georgia,"Times New Roman",serif', fontWeight: 600, letterSpacing: '-.5px' }
const kicker = (dark?: boolean): React.CSSProperties => ({ fontSize: 13, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 800, color: dark ? '#C49A5C' : '#A97F3F', margin: '0 0 16px' })
const h1: React.CSSProperties = { ...serif, fontSize: 54, lineHeight: 1.04, margin: 0 }
const h2: React.CSSProperties = { ...serif, fontSize: 39, lineHeight: 1.08, margin: 0 }
const sub = (dark?: boolean): React.CSSProperties => ({ fontSize: 20, lineHeight: 1.5, color: dark ? '#cdbfa8' : '#7a7468', margin: '18px 0 0', maxWidth: '56ch' })
const tile = (dark?: boolean): React.CSSProperties => ({ background: dark ? 'rgba(255,255,255,.05)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.12)' : '#E7E1D5'}`, borderRadius: 16, padding: '22px 22px' })
const pill = (dark?: boolean): React.CSSProperties => ({ display: 'inline-block', alignSelf: 'flex-start', background: 'rgba(196,154,92,.16)', color: dark ? '#EAD9B6' : '#A97F3F', border: '1px solid rgba(196,154,92,.4)', borderRadius: 999, padding: '9px 17px', fontSize: 14.5, fontWeight: 700, marginTop: 26 })

function Bullet({ items, dark }: { items: { t: string; d?: string }[]; dark?: boolean }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '28px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {items.map((it, k) => (
        <li key={k} style={{ fontSize: 24, lineHeight: 1.2, paddingLeft: 36, position: 'relative', fontWeight: 500 }}>
          <span style={{ position: 'absolute', left: 0, top: '.45em', width: 13, height: 13, borderRadius: '50%', background: '#C49A5C' }} />
          {it.t}
          {it.d && <span style={{ display: 'block', fontSize: 15.5, color: dark ? '#cdbfa8' : '#7a7468', fontWeight: 400, marginTop: 5 }}>{it.d}</span>}
        </li>
      ))}
    </ul>
  )
}

// Proiezione demografica ISTAT: popolazione residente (milioni)
function DemoChart() {
  const data = [{ y: '2023', v: 59.0 }, { y: '2050', v: 54.7 }, { y: '2070', v: 47.6 }]
  const max = 62
  return (
    <div style={{ marginTop: 26, display: 'flex', gap: 30, alignItems: 'flex-end', height: 230 }}>
      {data.map((d, k) => {
        const hgt = (d.v / max) * 185
        return (
          <div key={d.y} style={{ textAlign: 'center', flex: '0 0 96px' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 20, marginBottom: 8, color: k === 0 ? '#1A1714' : '#B05A5A' }}>{d.v.toFixed(1)}M</div>
            <div style={{ height: hgt, background: k === 0 ? 'linear-gradient(180deg,#D9C8A6,#C49A5C)' : 'linear-gradient(180deg,#C77,#B05A5A)', borderRadius: '8px 8px 0 0' }} />
            <div style={{ fontSize: 14, color: '#7a7468', marginTop: 8 }}>{d.y}</div>
          </div>
        )
      })}
      <div style={{ alignSelf: 'center', marginLeft: 10 }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 44, color: '#B05A5A', lineHeight: 1 }}>−11 milioni</div>
        <div style={{ fontSize: 14.5, color: '#7a7468', marginTop: 6, maxWidth: '26ch' }}>di residenti entro il 2070. E i giovani in età da matrimonio calano ancora più in fretta.</div>
      </div>
    </div>
  )
}

// ── Contenuto per specializzazione ──
type Spec = { profilo: string; preventivo: string; disponibilita: string; rete: string; hook: string }
const SPEC: Record<string, Spec> = {
  fotografo: {
    hook: 'La coppia sceglie te per come scatti — non per il prezzo più basso.',
    profilo: 'Una gallery-portfolio che mette in primo piano i tuoi servizi migliori.',
    preventivo: 'Pacchetti a giornata (mezza/intera), album e secondo fotografo già pronti da comporre.',
    disponibilita: 'Una data = un matrimonio: il calendario blocca il giorno, niente doppie prenotazioni.',
    rete: 'Quando un altro fotografo è occupato in quella data, la coppia arriva a te.',
  },
  videomaker: {
    hook: 'Il tuo reel parla prima di te.',
    profilo: 'Profilo con video demo e showreel: la coppia vede il tuo stile in movimento.',
    preventivo: 'Preventivi per pacchetti (trailer, film integrale, drone) voce per voce.',
    disponibilita: 'Un giorno = un evento: il calendario evita sovrapposizioni.',
    rete: 'Se un altro videomaker è già preso, il matrimonio viene proposto a te.',
  },
  musica: {
    hook: 'La coppia ti sente suonare prima ancora di chiamarti.',
    profilo: 'Profilo con demo audio/video e repertorio: mostri davvero come suoni.',
    preventivo: 'Preventivi per formazione e ore di servizio (cerimonia, aperitivo, serata).',
    disponibilita: 'Una sera = un evento: il calendario evita le sovrapposizioni di date.',
    rete: 'Se un’altra band o DJ è già impegnato, la serata viene proposta a te.',
  },
  fioraio: {
    hook: 'Il tuo gusto si vede prima del preventivo.',
    profilo: 'Portfolio di allestimenti per stile e palette, con esecuzioni reali.',
    preventivo: 'Preventivi per addobbi voce per voce: chiesa, sala, bouquet, centrotavola.',
    disponibilita: 'Gestisci più eventi al giorno secondo la tua capacità reale.',
    rete: 'Quando un collega fiorista è pieno, l’allestimento arriva a te.',
  },
  catering: {
    hook: 'La coppia vede cosa porti in tavola, non solo un listino.',
    profilo: 'Menu e gallery dei tuoi servizi, raccontati per bene.',
    preventivo: 'Preventivi a coperto, con il numero di invitati che arriva già dal modulo.',
    disponibilita: 'Capacità giornaliera reale: niente impegni oltre la tua brigata.',
    rete: 'Se un catering è già impegnato in quella data, l’evento passa a te.',
  },
  pasticcere: {
    hook: 'La wedding cake si vende con gli occhi.',
    profilo: 'Gallery di torte e confettate per stile e gusto.',
    preventivo: 'Preventivi per torta, piani e sweet table, voce per voce.',
    disponibilita: 'Agenda per consegne: organizzi le date senza accavallarti.',
    rete: 'Quando un collega è pieno in quella data, la coppia arriva a te.',
  },
  make_up: {
    hook: 'Il tuo lavoro si vede sui volti, non in una lista.',
    profilo: 'Portfolio di look e prove trucco, prima e dopo.',
    preventivo: 'Preventivi per sposa, prova e invitate, già pronti.',
    disponibilita: 'Agenda del mattino: gestisci più spose in date diverse, con ordine.',
    rete: 'Quando una collega è occupata quella mattina, la sposa arriva a te.',
  },
  parrucchiere: {
    hook: 'Acconciature che parlano da sole.',
    profilo: 'Portfolio di acconciature e prove, per stile.',
    preventivo: 'Preventivi per sposa, prova e servizi extra.',
    disponibilita: 'Agenda per orari: più spose, date diverse, zero confusione.',
    rete: 'Quando un collega è pieno, la sposa viene proposta a te.',
  },
  allestimenti: {
    hook: 'Il tuo progetto si capisce a colpo d’occhio.',
    profilo: 'Portfolio di set e scenografie per stile e ambiente.',
    preventivo: 'Preventivi per aree e elementi: cerimonia, sala, lounge.',
    disponibilita: 'Calendario per la tua capacità di montaggio reale.',
    rete: 'Quando un collega wedding designer è pieno, l’evento arriva a te.',
  },
  auto: {
    hook: 'Le tue auto fanno innamorare prima del preventivo.',
    profilo: 'Le tue vetture in gallery: modello, epoca, allestimento.',
    preventivo: 'Preventivi per tratta/ore e numero di mezzi.',
    disponibilita: 'Calendario per ogni mezzo: ogni auto, le sue date.',
    rete: 'Quando un collega è senza disponibilità, il servizio passa a te.',
  },
  bartender: {
    hook: 'Il tuo banco si vede prima di assaggiarlo.',
    profilo: 'Gallery di open bar e signature drink.',
    preventivo: 'Preventivi per ore di servizio, postazioni e numero ospiti.',
    disponibilita: 'Una sera = un evento: niente sovrapposizioni.',
    rete: 'Se un collega è già impegnato, l’evento viene proposto a te.',
  },
  celebrante: {
    hook: 'La coppia sceglie le tue parole.',
    profilo: 'Profilo con il tuo stile di cerimonia e testimonianze.',
    preventivo: 'Preventivi per tipo di rito e personalizzazione.',
    disponibilita: 'Calendario per data e orario: niente impegni doppi.',
    rete: 'Quando un collega è occupato in quella data, la coppia arriva a te.',
  },
  stampe: {
    hook: 'Inviti e tableau che si vedono prima di ordinarli.',
    profilo: 'Portfolio di partecipazioni, tableau e cartoline.',
    preventivo: 'Preventivi per quantità e lavorazioni.',
    disponibilita: 'Agenda di consegna per gestire i tempi di stampa.',
    rete: 'Quando un collega è pieno, il lavoro arriva a te.',
  },
}
function specFor(subrole: string, label: string): Spec {
  return SPEC[subrole] ?? {
    hook: `La coppia sceglie te per il tuo lavoro di ${label.toLowerCase()} — visto, non raccontato.`,
    profilo: `Un profilo-portfolio col tuo nome che mostra il tuo lavoro di ${label.toLowerCase()}.`,
    preventivo: `Preventivi brandizzati con le tue voci, accettati online dalla coppia.`,
    disponibilita: `Calendario e disponibilità sempre aggiornati sulla tua capacità reale.`,
    rete: `Quando un collega ${label.toLowerCase()} è occupato in quella data, l’evento arriva a te.`,
  }
}

function buildSlides({ subrole, inviteCode, inviteUrl }: { subrole: string; inviteCode: string | null; inviteUrl: string | null }) {
  const label = SUPPLIER_SUBROLES.find(s => s.v === subrole)?.l ?? 'Professionista'
  const spec = specFor(subrole, label)
  const tag = `Per: ${label}`
  return [
    // 1 cover
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>La rete dei professionisti del matrimonio</p>
      <h1 style={h1}>Lavora di più.<br />Da solo, di meno.</h1>
      <p style={sub(true)}>Due minuti per capire perché un <b style={{ color: '#fff' }}>{label.toLowerCase()}</b> oggi ha bisogno di una rete — e cosa fa Planfully per te.</p>
    </>) },
    // 2 demografia futura (chart)
    { tag, content: (<>
      <p style={kicker()}>Guardiamo avanti, non indietro</p>
      <h2 style={h2}>Meno italiani, meno coppie, meno matrimoni.</h2>
      <DemoChart />
      <p style={{ fontSize: 11.5, color: '#7a7468', marginTop: 16 }}>Fonte: ISTAT — Previsioni della popolazione residente (base 2024): 59,0M oggi → 54,7M nel 2050 → 47,6M nel 2070.</p>
    </>) },
    // 3 cosa significa
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>Cosa significa per te</p>
      <h1 style={h1}>Il mercato si restringe<br />per i prossimi vent’anni.</h1>
      <p style={sub(true)}>Over-65 dal 24% al <b style={{ color: '#fff' }}>35%</b> entro il 2050; coppie con figli da 3 su 10 a 1 su 5. Meno eventi, ogni anno. Chi non massimizza ogni opportunità, esce dal mercato.</p>
    </>) },
    // 4 portali
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>Il rischio vero</p>
      <h1 style={h1}>I grandi portali ti fanno<br />pagare per esistere.</h1>
      <p style={sub(true)}>Le multinazionali del wedding catturano le coppie e ti vendono come “lead”. Più paghi, più compari. La relazione non è mai tua.</p>
    </>) },
    // 5 la rete
    { tag, content: (<>
      <p style={kicker()}>La risposta</p>
      <h2 style={h2}>Una rete compatta non perde eventi.</h2>
      <Bullet items={[
        { t: 'Chi è pieno passa il cliente a chi è libero.', d: 'L’evento resta nel gruppo, non finisce su un portale.' },
        { t: 'Quando un collega è occupato, l’evento può arrivare a te.', d: 'Stesso settore, stessa zona, in automatico.' },
        { t: 'Si lavora — e si guadagna — insieme.' },
      ]} />
    </>) },
    // 6 cosa fa per TE (spec)
    { tag, content: (<>
      <p style={kicker()}>Cosa fa Planfully per un {label.toLowerCase()}</p>
      <h2 style={h2}>{spec.hook}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 32 }}>
        <div style={tile()}><div style={{ ...serif, fontSize: 20 }}>Il tuo profilo</div><p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#7a7468', lineHeight: 1.45 }}>{spec.profilo}</p></div>
        <div style={tile()}><div style={{ ...serif, fontSize: 20 }}>I tuoi preventivi</div><p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#7a7468', lineHeight: 1.45 }}>{spec.preventivo}</p></div>
        <div style={tile()}><div style={{ ...serif, fontSize: 20 }}>La tua disponibilità</div><p style={{ margin: '8px 0 0', fontSize: 15.5, color: '#7a7468', lineHeight: 1.45 }}>{spec.disponibilita}</p></div>
      </div>
      <span style={pill()}>Tutto in un posto, tutto automatico.</span>
    </>) },
    // 7 quando un collega è pieno (spec)
    { tag, content: (<>
      <p style={kicker()}>Il meccanismo che ti porta lavoro</p>
      <h2 style={h2}>Quando un collega è pieno, tocca a te.</h2>
      <Bullet items={[
        { t: spec.rete },
        { t: 'Ricevi nome, contatto e dettagli dell’evento.', d: 'Niente asta: arrivi tu, diretto alla coppia.' },
        { t: 'Più la rete cresce, più eventi girano.' },
      ]} />
    </>) },
    // 8 gratis
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>L’offerta</p>
      <h1 style={h1}>Gratis fino a dicembre 2026.</h1>
      <p style={sub(true)}>Provi tutto senza spendere. Chi entra adesso è <b style={{ color: '#fff' }}>founding member</b>: condizioni migliori, per sempre.</p>
    </>) },
    // 9 CTA
    { dark: true, center: true, tag, content: (<>
      <p style={kicker(true)}>Facciamolo adesso</p>
      <h1 style={h1}>Entra nella rete.</h1>
      <p style={sub(true)}>Ti aiuto io a creare il tuo account ora. Bastano un’email e una password.</p>
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
