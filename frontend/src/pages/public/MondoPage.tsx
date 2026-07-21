import { Helmet } from 'react-helmet-async'
import { Link, useParams, Navigate } from 'react-router-dom'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/caveat/500.css'
import { MONDI_BY_SLUG, mondoNum } from '@/lib/mondi'

// Pagina di categoria "I Mondi": planfully.it/<slug>. Stesso registro editoriale
// della landing (carta/inchiostro/cipresso + lacca UN solo elemento) col template
// hero 1b dell'handoff, poi il corpo che SPIEGA gli strumenti di quel mestiere e
// come il suo dato si connette a tutto il resto dell'evento (la filiera).
// L'unica eccezione ai due font è il MARCHIO FIRMATO: sotto il wordmark, il nome
// del mondo scritto a mano (Caveat), attaccato al marchio.
const CARTA = '#F4F3EE'
const INCHIOSTRO = '#181F1B'
const CIPRESSO = '#25402F'
const LACCA = '#C03B2A'
const BORDO_DARK = '#3D5C46'

const JOST = "'Jost', sans-serif"
const MONO = "'IBM Plex Mono', monospace"
const CAVEAT = "'Caveat', cursive"

export default function MondoPage() {
  const { slug } = useParams<{ slug: string }>()
  const mondo = slug ? MONDI_BY_SLUG[slug] : undefined
  // Difesa: la rotta arriva solo con slug del set, ma se manca torna a casa.
  if (!mondo) return <Navigate to="/" replace />

  const url = `https://planfully.it/${mondo.slug}`
  // Dati strutturati SEO: la pagina è un servizio del gestionale per quel mestiere.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Planfully ${mondo.nome}`,
    serviceType: `Gestionale per ${mondo.nome.toLowerCase()} di evento`,
    description: mondo.testo,
    areaServed: 'IT',
    url,
    provider: { '@type': 'Organization', name: 'Planfully', url: 'https://planfully.it' },
    audience: { '@type': 'BusinessAudience', name: mondo.nome },
  }

  return (
    <div className="pf-landing" style={{ background: CARTA, color: INCHIOSTRO, minHeight: '100vh', overflow: 'hidden', position: 'relative', fontFamily: JOST, WebkitFontSmoothing: 'antialiased' }}>
      <Helmet>
        <html lang="it" />
        <title>{`Planfully ${mondo.nome} — Il gestionale della filiera wedding`}</title>
        <meta name="description" content={mondo.testo} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={`Planfully ${mondo.nome} — Il gestionale della filiera wedding`} />
        <meta property="og:description" content={mondo.claim} />
        <meta name="theme-color" content={CARTA} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        <style>{`
          .pf-landing a { color:${CIPRESSO}; text-decoration:none; transition:color .15s; }
          .pf-landing a:hover { color:${LACCA}; }
          .pf-landing ::selection { background:${CIPRESSO}; color:${CARTA}; }
          .pf-cta-hero { transition:background .15s, color .15s; }
          .pf-cta-hero:hover { background:${INCHIOSTRO} !important; color:${CARTA} !important; }
          .pf-cta-outline { transition:background .15s, color .15s; }
          .pf-cta-outline:hover { background:${CARTA} !important; color:${INCHIOSTRO} !important; }
          .pf-dark-link { color:${CARTA} !important; }
          .pf-dark-link:hover { color:#8FAF9A !important; }
        `}</style>
      </Helmet>

      {/* archi hero, fuori taglio — pattern dal set */}
      <img src="/assets/svg/pattern/archi-carta.svg" alt="" aria-hidden="true"
        style={{ position: 'absolute', top: -460, right: -400, width: 1000, height: 1000, pointerEvents: 'none' }} />

      {/* TESTATA — marchio firmato del mondo */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, padding: '24px clamp(20px,5vw,64px)', borderBottom: `1px solid ${INCHIOSTRO}`, position: 'relative' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'flex-start', gap: 14, color: INCHIOSTRO }}>
          <img src="/assets/svg/marchio/planfully-symbol-cipresso.svg" width={34} height={34} alt="" aria-hidden="true" style={{ marginTop: 1 }} />
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.16em' }}>PLANFULLY</span>
            <span style={{ fontFamily: CAVEAT, fontWeight: 500, fontSize: 23, lineHeight: 1, color: CIPRESSO, margin: '3px 0 0 24px', transform: 'rotate(-3deg)', transformOrigin: 'left center' }}>{mondo.firma}</span>
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: 'clamp(16px,3vw,36px)', fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', fontFeatureSettings: "'tnum'" }}>
          <a href="/#metodo">METODO</a>
          <a href="/#accesso">ACCESSO</a>
          <Link to="/login">ACCEDI</Link>
        </nav>
      </header>

      {/* HERO del mondo */}
      <section style={{ position: 'relative', padding: 'clamp(48px,7vw,110px) clamp(20px,5vw,64px) clamp(56px,7vw,120px)' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: CIPRESSO, marginBottom: 'clamp(28px,4vw,56px)' }}>{mondo.kicker}</div>
        <h1 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(38px,6.2vw,90px)', lineHeight: 1.06, letterSpacing: '-0.01em', margin: 0, maxWidth: '18ch', textWrap: 'pretty' }}>{mondo.claim}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40, marginTop: 'clamp(40px,5vw,80px)' }}>
          <p style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(17px,1.5vw,21px)', lineHeight: 1.55, maxWidth: '46ch', margin: '0 0 0 clamp(0px,12vw,220px)', color: INCHIOSTRO, textWrap: 'pretty' }}>{mondo.testo}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Link to={`/richiedi-accesso?mondo=${mondo.slug}`} className="pf-cta-hero" style={{ display: 'inline-block', background: LACCA, color: CARTA, fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.06em', padding: '18px 40px', textAlign: 'center' }}>Richiedi accesso</Link>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: CIPRESSO, fontFeatureSettings: "'tnum'" }}>Su invito · planfully.it/{mondo.slug}</div>
          </div>
        </div>
      </section>

      {/* FILO META */}
      <div style={{ borderTop: `1px solid ${INCHIOSTRO}`, borderBottom: `1px solid ${INCHIOSTRO}`, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, padding: '14px clamp(20px,5vw,64px)', fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', color: CIPRESSO, fontFeatureSettings: "'tnum'" }}>
        <span>PLANFULLY.IT/{mondo.slug.toUpperCase()}</span>
        <span>UNA RETE, TANTI MESTIERI</span>
        <Link to="/">← TUTTI I MONDI</Link>
      </div>

      {/* STRUMENTI — cosa fa lo strumento per QUESTO mestiere */}
      <section id="strumenti" style={{ position: 'relative', padding: 'clamp(56px,7vw,110px) clamp(20px,5vw,64px)' }}>
        <div style={{ maxWidth: '62ch', marginBottom: 'clamp(36px,5vw,72px)' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: CIPRESSO, marginBottom: 20 }}>GLI STRUMENTI</div>
          <h2 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(28px,3.4vw,48px)', lineHeight: 1.12, margin: 0, textWrap: 'pretty' }}>Tutto quello che ti serve per lavorare, in un posto solo.</h2>
        </div>
        <div>
          {mondo.strumenti.map((s, i) => (
            <article key={s.nome} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 'clamp(20px,4vw,64px)', padding: 'clamp(28px,3.5vw,44px) 0', borderTop: `1px solid ${INCHIOSTRO}`, borderBottom: i === mondo.strumenti.length - 1 ? `1px solid ${INCHIOSTRO}` : undefined }}>
              <div style={{ fontFamily: MONO, fontWeight: 400, fontSize: 'clamp(28px,3vw,44px)', lineHeight: 1, color: CIPRESSO, fontFeatureSettings: "'tnum'", flex: '0 0 auto', minWidth: '2.5ch' }}>{mondoNum(i)}</div>
              <h3 style={{ fontFamily: JOST, fontWeight: 500, fontSize: 'clamp(19px,1.7vw,24px)', lineHeight: 1.2, margin: 0, flex: '0 0 clamp(220px,22vw,320px)' }}>{s.nome}</h3>
              <p style={{ fontSize: 'clamp(16px,1.3vw,19px)', lineHeight: 1.6, margin: 0, color: INCHIOSTRO, flex: '1 1 320px', maxWidth: '52ch', textWrap: 'pretty' }}>{s.p}</p>
            </article>
          ))}
        </div>
      </section>

      {/* CONNESSO — l'innesto nella filiera (dark, nessun elemento Lacca) */}
      <section style={{ background: INCHIOSTRO, color: CARTA, position: 'relative', overflow: 'hidden', padding: 'clamp(64px,8vw,130px) clamp(20px,5vw,64px)' }}>
        <img src="/assets/svg/pattern/archi-inchiostro.svg" alt="" aria-hidden="true"
          style={{ position: 'absolute', bottom: -560, left: -420, width: 1100, height: 1100, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: '58ch' }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: BORDO_DARK, marginBottom: 20 }}>NON UN’ISOLA</div>
          <h2 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(26px,3vw,44px)', lineHeight: 1.15, margin: '0 0 24px', textWrap: 'pretty' }}>Connesso a tutto il resto dell’evento.</h2>
          <p style={{ fontSize: 'clamp(16px,1.35vw,20px)', lineHeight: 1.6, margin: '0 0 36px', opacity: 0.9, textWrap: 'pretty' }}>{mondo.filiera}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 28 }}>
            <Link to={`/richiedi-accesso?mondo=${mondo.slug}`} className="pf-cta-outline" style={{ display: 'inline-block', border: `1px solid ${CARTA}`, color: CARTA, fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.06em', padding: '16px 38px' }}>Richiedi accesso</Link>
            <Link to="/#rete" className="pf-dark-link" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em' }}>VEDI LA RETE DEI MONDI →</Link>
          </div>
        </div>
      </section>

      {/* FOOTER — identico all'index */}
      <footer style={{ borderTop: `1px solid ${INCHIOSTRO}`, padding: '36px clamp(20px,5vw,64px) 44px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
