import { Helmet } from 'react-helmet-async'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

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
const ARC_OPACITY = 0.11
const CAPOSTIPITI = 5   // appare in 2 punti (nota CTA hero + numerale Accesso): fonte unica

const JOST = "'Jost', sans-serif"
const MONO = "'IBM Plex Mono', monospace"

const RING_PATH = 'M620.0 719.27 C615.3 718.4 615.0 717.51 615.0 704.44 C615.0 697.66 615.41 691.86 615.91 691.55 C616.42 691.24 623.95 690.81 632.66 690.6 C655.16 690.04 672.91 686.09 692.5 677.27 C739.35 656.17 773.17 613.8 784.1 562.5 C788.4 542.32 787.71 511.73 782.5 492.01 C780.76 485.41 781.13 484.88 789.13 482.61 C792.22 481.74 797.09 479.41 799.95 477.44 C803.96 474.68 805.45 474.13 806.5 475.0 C807.89 476.15 812.08 492.4 813.99 504.0 C814.57 507.57 815.32 516.58 815.65 524.0 C817.05 555.24 810.11 586.31 794.98 616.5 C765.6 675.16 707.31 714.25 642.11 719.02 C628.94 719.98 624.18 720.04 620.0 719.27 Z M566.33 707.95 C554.94 704.1 532.31 692.24 521.07 684.22 C510.24 676.5 492.88 660.24 484.43 649.91 C475.93 639.53 466.67 625.0 460.56 612.5 C423.79 537.23 441.53 446.48 504.0 390.26 C565.1 335.27 653.11 325.61 722.25 366.33 C740.31 376.96 765.12 397.71 763.22 400.58 C762.82 401.18 759.65 403.17 756.17 405.01 C752.69 406.85 748.38 410.08 746.58 412.18 C744.78 414.28 742.78 416.0 742.13 416.0 C741.49 416.0 737.28 412.82 732.78 408.93 C711.69 390.7 687.83 378.91 659.66 372.8 C644.93 369.6 615.07 369.6 600.34 372.8 C577.89 377.67 559.7 385.3 541.5 397.46 C504.96 421.88 481.15 458.75 472.35 504.5 C469.74 518.09 469.97 544.08 472.84 558.7 C478.58 587.94 491.98 615.13 511.61 637.35 C522.55 649.73 544.38 667.12 546.98 665.51 C547.66 665.09 548.0 643.31 548.0 601.12 C548.0 530.77 548.35 525.66 554.15 511.05 C562.34 490.39 578.53 473.71 598.63 465.21 C638.63 448.29 682.87 464.66 702.12 503.5 C713.84 527.15 713.83 552.95 702.09 576.5 C693.6 593.55 682.54 604.73 666.5 612.47 C653.92 618.55 646.09 620.3 630.91 620.41 C621.61 620.48 617.89 620.14 616.66 619.13 C615.28 617.98 615.0 615.71 615.0 605.44 C615.0 596.97 615.37 592.89 616.19 592.38 C616.85 591.98 622.01 591.76 627.67 591.9 C639.29 592.19 645.93 590.72 655.2 585.8 C663.21 581.55 672.24 571.8 676.5 562.82 C684.03 546.92 683.87 532.99 675.97 516.42 C672.95 510.1 670.61 506.93 665.18 501.81 C657.1 494.18 650.37 490.6 639.98 488.4 C614.8 483.06 587.63 499.65 579.91 525.08 C577.56 532.81 577.32 543.24 577.12 647.64 C577.03 696.35 576.73 709.89 575.75 710.25 C575.06 710.5 570.82 709.47 566.33 707.95 Z'

export default function PublicHomePage() {
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
        <style>{`
          .pf-landing a { color:${CIPRESSO}; text-decoration:none; transition:color .15s; }
          .pf-landing a:hover { color:${LACCA}; }
          .pf-landing ::selection { background:${CIPRESSO}; color:${CARTA}; }
          .pf-cta-hero { transition:background .15s, color .15s; }
          .pf-cta-hero:hover { background:${INCHIOSTRO} !important; color:${CARTA} !important; }
          .pf-cta-outline { transition:background .15s, color .15s; }
          .pf-cta-outline:hover { background:${CARTA} !important; color:${INCHIOSTRO} !important; }
          html { scroll-behavior:smooth; }
        `}</style>
      </Helmet>

      {/* archi hero, fuori taglio */}
      <svg viewBox="0 0 1200 1200" style={{ position: 'absolute', top: -420, right: -380, width: 1100, height: 1100, pointerEvents: 'none' }} aria-hidden="true">
        <circle cx="600" cy="600" r="520" fill="none" stroke={CIPRESSO} strokeWidth={1.5} opacity={ARC_OPACITY} />
        <circle cx="600" cy="600" r="430" fill="none" stroke={CIPRESSO} strokeWidth={1} opacity={ARC_OPACITY} />
      </svg>

      {/* TESTATA */}
      <header style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24, padding: '28px clamp(20px,5vw,64px) 24px', borderBottom: `1px solid ${INCHIOSTRO}`, position: 'relative' }}>
        <div style={{ fontFamily: JOST, fontWeight: 500, fontSize: 17, letterSpacing: '0.16em' }}>PLANFULLY</div>
        <nav style={{ display: 'flex', gap: 'clamp(16px,3vw,40px)', fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', fontFeatureSettings: "'tnum'" }}>
          <a href="#metodo">METODO</a>
          <a href="#accesso">ACCESSO</a>
        </nav>
      </header>

      {/* HERO */}
      <section style={{ position: 'relative', padding: 'clamp(48px,7vw,110px) clamp(20px,5vw,64px) clamp(56px,7vw,120px)' }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: CIPRESSO, marginBottom: 'clamp(28px,4vw,56px)' }}>IL GESTIONALE DELLA FILIERA WEDDING</div>
        <h1 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(38px,6.2vw,96px)', lineHeight: 1.04, letterSpacing: '-0.01em', margin: 0, maxWidth: '16ch', textWrap: 'pretty' }}>Il lavoro invisibile che rende possibile ogni evento, finalmente in un unico strumento.</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 40, marginTop: 'clamp(40px,5vw,80px)' }}>
          <p style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(17px,1.5vw,21px)', lineHeight: 1.55, maxWidth: '44ch', margin: '0 0 0 clamp(0px,14vw,260px)', color: INCHIOSTRO, textWrap: 'pretty' }}>Cataloghi, calendario condiviso e preventivi che si parlano — il dato entra una volta sola e fluisce dalla filiera al cliente. Niente vetrine, niente sposi: solo il mestiere.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a href="#accesso" className="pf-cta-hero" style={{ display: 'inline-block', background: LACCA, color: CARTA, fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.06em', padding: '18px 40px', textAlign: 'center' }}>Richiedi accesso</a>
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

      {/* ACCESSO */}
      <section id="accesso" style={{ background: INCHIOSTRO, color: CARTA, position: 'relative', overflow: 'hidden', padding: 'clamp(64px,8vw,140px) clamp(20px,5vw,64px)' }}>
        <svg viewBox="0 0 1200 1200" style={{ position: 'absolute', bottom: -560, left: -420, width: 1100, height: 1100, pointerEvents: 'none' }} aria-hidden="true">
          <circle cx="600" cy="600" r="520" fill="none" stroke={BORDO_DARK} strokeWidth={1.5} opacity={0.5} />
          <circle cx="600" cy="600" r="430" fill="none" stroke={BORDO_DARK} strokeWidth={1} opacity={0.35} />
        </svg>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'clamp(32px,6vw,110px)', position: 'relative' }}>
          <div style={{ fontFamily: MONO, fontWeight: 500, fontSize: 'clamp(140px,22vw,340px)', lineHeight: 0.8, color: LACCA, fontFeatureSettings: "'tnum'", flex: '0 0 auto' }}>{CAPOSTIPITI}</div>
          <div style={{ flex: '1 1 300px', maxWidth: '46ch' }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: BORDO_DARK, marginBottom: 20 }}>ACCESSO SU INVITO</div>
            <h2 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(26px,3vw,44px)', lineHeight: 1.15, margin: '0 0 20px', textWrap: 'pretty' }}>Capostipiti fondatori. Chi entra ora definisce lo strumento con noi.</h2>
            <p style={{ fontSize: 'clamp(16px,1.3vw,19px)', lineHeight: 1.6, margin: '0 0 36px', color: CARTA, opacity: 0.85, textWrap: 'pretty' }}>Apriamo la piattaforma a un numero ristretto di location, planner e fornitori che lavorano già insieme. Una filiera vera, non una lista d'attesa.</p>
            <a href="mailto:accesso@planfully.it" className="pf-cta-outline" style={{ display: 'inline-block', border: `1px solid ${CARTA}`, color: CARTA, fontFamily: JOST, fontWeight: 500, fontSize: 16, letterSpacing: '0.06em', padding: '16px 38px' }}>Richiedi accesso</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${INCHIOSTRO}`, padding: '36px clamp(20px,5vw,64px) 44px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg viewBox="391.7 294.1 457.5 457.5" style={{ width: 30, height: 30 }} aria-hidden="true">
            <path d={RING_PATH} fill={INCHIOSTRO} />
            <circle cx="776" cy="442" r="22" fill={LACCA} />
          </svg>
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
