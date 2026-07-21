import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { MONDI, mondoNum } from '@/lib/mondi'

// Landing pubblica B2B — "il gestionale della filiera wedding".
// Ricostruzione fedele dell'handoff di design (registro Olivetti/Pineider): palette
// 60/30/10 carta/inchiostro/cipresso + lacca UN solo elemento per vista; Jost + IBM Plex
// Mono; simbolo ad anello + archi. Stili inline come nella spec per il pixel-perfect;
// hover/selection in un <style> scoped a .pf-landing.
const CARTA = '#F4F3EE'
const INCHIOSTRO = '#181F1B'
const CIPRESSO = '#25402F'
const LACCA = '#C03B2A'
const BORDO_DARK = '#3D5C46'
const CAPOSTIPITI = 5   // appare in 2 punti (nota CTA hero + numerale Accesso): fonte unica

const JOST = "'Jost', sans-serif"
const MONO = "'IBM Plex Mono', monospace"

export default function PublicHomePage() {
  // Dati strutturati SEO: chi è Planfully + l'indice dei 24 mondi (una pagina per mestiere).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Planfully',
        url: 'https://planfully.it',
        description: 'Il gestionale della filiera wedding: cataloghi, calendario condiviso e preventivi collegati per location, wedding planner e fornitori di evento. Un dato entra una volta e fluisce lungo la filiera fino al cliente.',
      },
      { '@type': 'WebSite', name: 'Planfully', url: 'https://planfully.it' },
      {
        '@type': 'ItemList',
        name: 'I Mondi di Planfully',
        description: 'Una pagina di categoria per ogni mestiere della filiera dell\'evento.',
        itemListElement: MONDI.map((m, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: `Planfully ${m.nome}`,
          url: `https://planfully.it/${m.slug}`,
        })),
      },
    ],
  }

  const articoli = [
    { n: '01', reverse: false, offset: false, t: 'Il dato entra una volta.', p: 'Inserito nel catalogo, il dato fluisce da solo in preventivi e calendario. Nessuna ricopiatura, nessuna versione divergente: la fonte è una.' },
    { n: '02', reverse: true, offset: true, t: 'Mai una data promessa due volte.', p: 'Il calendario è condiviso lungo la filiera: la disponibilità è una sola, visibile a chi deve vederla. La doppia prenotazione smette di esistere.' },
    { n: '03', reverse: false, offset: false, t: 'Margini ricalcolati a ogni variazione di costo.', p: 'Quando un fornitore aggiorna un listino, ogni preventivo collegato ricalcola il margine. Sai sempre quanto stai guadagnando — prima di firmare.' },
  ]

  return (
    <div className="pf-landing" style={{ background: CARTA, color: INCHIOSTRO, minHeight: '100vh', overflow: 'hidden', position: 'relative', fontFamily: JOST, WebkitFontSmoothing: 'antialiased' }}>
      <Helmet>
        <html lang="it" />
        <title>Planfully — Il gestionale della filiera wedding</title>
        <meta name="description" content="Cataloghi, calendario condiviso e preventivi che si parlano: il dato entra una volta sola e fluisce dalla filiera al cliente. Niente vetrine, niente sposi: solo il mestiere." />
        <meta property="og:title" content="Planfully — Il gestionale della filiera wedding" />
        <meta property="og:description" content="Il lavoro invisibile che rende possibile ogni evento, finalmente in un unico strumento. B2B, su invito." />
        <meta name="theme-color" content={CARTA} />
        <link rel="canonical" href="https://planfully.it/" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <style>{`
          .pf-landing a { color:${CIPRESSO}; text-decoration:none; transition:color .15s; }
          .pf-landing a:hover { color:${LACCA}; }
          .pf-landing ::selection { background:${CIPRESSO}; color:${CARTA}; }
          .pf-cta-hero { transition:background .15s, color .15s; }
          .pf-cta-hero:hover { background:${INCHIOSTRO} !important; color:${CARTA} !important; }
          .pf-cta-outline { transition:background .15s, color .15s; }
          .pf-cta-outline:hover { background:${CARTA} !important; color:${INCHIOSTRO} !important; }
          .pf-landing .pf-rete-row { color:${CARTA}; transition:background .15s; }
          .pf-landing .pf-rete-row:hover { color:${CARTA}; background:rgba(61,92,70,0.18); }
          html { scroll-behavior:smooth; }
        `}</style>
      </Helmet>

      {/* archi hero, fuori taglio — pattern dal set (assets/svg/pattern) */}
      <img src="/assets/svg/pattern/archi-carta.svg" alt="" aria-hidden="true"
        style={{ position: 'absolute', top: -420, right: -380, width: 1100, height: 1100, pointerEvents: 'none' }} />

      {/* TESTATA */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '24px clamp(20px,5vw,64px)', borderBottom: `1px solid ${INCHIOSTRO}`, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/assets/svg/marchio/planfully-symbol-cipresso.svg" width={28} height={28} alt="" aria-hidden="true" />
          <span style={{ fontFamily: JOST, fontWeight: 500, fontSize: 17, letterSpacing: '0.16em' }}>PLANFULLY</span>
        </div>
        <nav style={{ display: 'flex', gap: 'clamp(16px,3vw,40px)', fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', fontFeatureSettings: "'tnum'" }}>
          <a href="#metodo">METODO</a>
          <a href="#accesso">ACCESSO</a>
          <Link to="/login">ACCEDI</Link>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ position: 'relative', padding: 'clamp(48px,7vw,110px) clamp(20px,5vw,64px) clamp(56px,7vw,120px)' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: CIPRESSO, marginBottom: 'clamp(28px,4vw,56px)' }}>IL GESTIONALE DELLA FILIERA WEDDING</div>
        <h1 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(38px,6.2vw,96px)', lineHeight: 1.04, letterSpacing: '-0.01em', margin: 0, maxWidth: '16ch', textWrap: 'pretty' }}>Il lavoro invisibile che rende possibile ogni evento, finalmente in un unico strumento.</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40, marginTop: 'clamp(40px,5vw,80px)' }}>
          <p style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(17px,1.5vw,21px)', lineHeight: 1.55, maxWidth: '46ch', margin: '0 0 0 clamp(0px,14vw,260px)', color: INCHIOSTRO, textWrap: 'pretty' }}>Cataloghi, calendario condiviso e preventivi che si parlano, per ogni mestiere dell'evento — dalla location al fotografo, dal fiorista al catering. Il dato entra una volta sola e fluisce lungo la filiera. Niente vetrine, niente sposi: solo il mestiere.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link to="/richiedi-accesso" className="pf-cta-hero" style={{ display: 'inline-block', background: LACCA, color: CARTA, fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.06em', padding: '18px 40px', textAlign: 'center' }}>Richiedi accesso</Link>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: CIPRESSO, fontFeatureSettings: "'tnum'" }}>Su invito · {CAPOSTIPITI} capostipiti fondatori</div>
          </div>
        </div>
      </section>

      {/* FILO META */}
      <div style={{ borderTop: `1px solid ${INCHIOSTRO}`, borderBottom: `1px solid ${INCHIOSTRO}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, padding: '14px clamp(20px,5vw,64px)', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: CIPRESSO, fontFeatureSettings: "'tnum'" }}>
        <span>PLANFULLY.IT</span>
        <span>LOCATION · PLANNER · FORNITORI</span>
        <span>B2B — 2026</span>
      </div>

      {/* METODO */}
      <section id="metodo" style={{ position: 'relative', padding: '0 clamp(20px,5vw,64px)' }}>
        {articoli.map((a, i) => (
          <article key={a.n} style={{ display: 'flex', flexWrap: 'wrap', flexDirection: a.reverse ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 'clamp(24px,4vw,72px)', padding: 'clamp(48px,6vw,96px) 0', borderBottom: i < 2 ? `1px solid ${INCHIOSTRO}` : undefined }}>
            <div style={{ fontFamily: MONO, fontWeight: 400, fontSize: 'clamp(96px,14vw,220px)', lineHeight: 0.85, color: CIPRESSO, fontFeatureSettings: "'tnum'", flex: '0 0 auto' }}>{a.n}</div>
            <div style={{ flex: '1 1 320px', maxWidth: '52ch', paddingTop: 'clamp(8px,1.5vw,24px)', marginLeft: a.offset ? 'clamp(0px,8vw,160px)' : undefined }}>
              <h2 style={{ fontFamily: JOST, fontWeight: 500, fontSize: 'clamp(24px,2.4vw,34px)', lineHeight: 1.2, margin: '0 0 16px' }}>{a.t}</h2>
              <p style={{ fontSize: 'clamp(16px,1.3vw,19px)', lineHeight: 1.6, margin: 0, color: INCHIOSTRO, textWrap: 'pretty' }}>{a.p}</p>
            </div>
          </article>
        ))}
      </section>

      {/* LA RETE — indice dei 24 mondi (sezione scura, nessun elemento Lacca) */}
      <section id="rete" style={{ background: INCHIOSTRO, color: CARTA, position: 'relative', overflow: 'hidden', padding: 'clamp(64px,8vw,120px) clamp(20px,5vw,64px)' }}>
        <img src="/assets/svg/pattern/archi-inchiostro.svg" alt="" aria-hidden="true"
          style={{ position: 'absolute', bottom: -620, left: -460, width: 1100, height: 1100, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'clamp(40px,7vw,100px)', position: 'relative' }}>
          <div style={{ flex: '0 0 380px', maxWidth: '100%' }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: BORDO_DARK, marginBottom: 24 }}>DI COSA TI OCCUPI NEGLI EVENTI?</div>
            <h2 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(28px,3vw,40px)', lineHeight: 1.12, margin: '0 0 24px', textWrap: 'pretty' }}>Ogni mestiere ha il suo mondo. Tutti parlano la stessa lingua.</h2>
            <p style={{ fontSize: 'clamp(16px,1.3vw,17px)', lineHeight: 1.6, margin: 0, opacity: 0.85, textWrap: 'pretty' }}>Location, planner e ogni fornitore dell'evento: scegli il tuo mestiere e vedi gli strumenti che ti riguardano. Il catalogo del fiorista alimenta il preventivo della location, il calendario del fotografo blocca la data per tutti. Un dato, una filiera.</p>
          </div>
          <div style={{ flex: '1 1 420px' }}>
            {MONDI.map((m, i) => (
              <Link key={m.slug} to={`/${m.slug}`} className="pf-rete-row" style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 24, alignItems: 'baseline', padding: '17px 0', borderBottom: `1px solid ${BORDO_DARK}` }}>
                <span style={{ fontFamily: MONO, fontSize: 13, color: BORDO_DARK, fontFeatureSettings: "'tnum'" }}>{mondoNum(i)}</span>
                <span style={{ fontSize: 'clamp(17px,1.4vw,19px)', letterSpacing: '0.06em' }}>{m.nome}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: BORDO_DARK, fontFeatureSettings: "'tnum'" }}>/{m.slug}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ACCESSO */}
      <section id="accesso" style={{ background: INCHIOSTRO, color: CARTA, position: 'relative', overflow: 'hidden', padding: 'clamp(64px,8vw,140px) clamp(20px,5vw,64px)' }}>
        <img src="/assets/svg/pattern/archi-inchiostro.svg" alt="" aria-hidden="true"
          style={{ position: 'absolute', bottom: -560, left: -420, width: 1100, height: 1100, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(32px,6vw,110px)', position: 'relative' }}>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 'clamp(140px,22vw,340px)', lineHeight: 0.8, color: LACCA, fontFeatureSettings: "'tnum'", flex: '0 0 auto' }}>{CAPOSTIPITI}</div>
          <div style={{ flex: '1 1 300px', maxWidth: '46ch' }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: BORDO_DARK, marginBottom: 20 }}>ACCESSO SU INVITO</div>
            <h2 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(26px,3vw,44px)', lineHeight: 1.15, margin: '0 0 20px', textWrap: 'pretty' }}>Capostipiti fondatori. Chi entra ora definisce lo strumento con noi.</h2>
            <p style={{ fontSize: 'clamp(16px,1.3vw,19px)', lineHeight: 1.6, margin: '0 0 36px', color: CARTA, opacity: 0.85, textWrap: 'pretty' }}>Apriamo la piattaforma a un numero ristretto di location, planner e fornitori che lavorano già insieme. Una filiera vera, non una lista d'attesa.</p>
            <Link to="/richiedi-accesso" className="pf-cta-outline" style={{ display: 'inline-block', border: `1px solid ${CARTA}`, color: CARTA, fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.06em', padding: '16px 38px' }}>Richiedi accesso</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${INCHIOSTRO}`, padding: '36px clamp(20px,5vw,64px) 44px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* marchio dal file del set (non SVG inline), come da handoff §Assets */}
          <img src="/assets/svg/marchio/planfully-symbol-cipresso.svg" width={30} height={30} alt="" aria-hidden="true" />
          <span style={{ fontFamily: JOST, fontWeight: 500, fontSize: 14, letterSpacing: '0.16em' }}>PLANFULLY</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(16px,3vw,36px)', fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: CIPRESSO, fontFeatureSettings: "'tnum'" }}>
          <span>© 2026 Fuyue Srl</span>
          <a href="/privacy">Privacy</a>
          <a href="/termini">Termini</a>
          <a href="/cookie">Cookie</a>
        </div>
      </footer>
    </div>
  )
}
