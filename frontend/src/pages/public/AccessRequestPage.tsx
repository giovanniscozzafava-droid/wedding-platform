import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { type Provincia, loadProvince } from '@/lib/maestranze'
import { MONDI_BY_SLUG } from '@/lib/mondi'
import '@fontsource/jost/400.css'
import '@fontsource/jost/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

const CARTA = '#F4F3EE'
const INCHIOSTRO = '#181F1B'
const CIPRESSO = '#25402F'
const LACCA = '#C03B2A'
const JOST = "'Jost', sans-serif"
const MONO = "'IBM Plex Mono', monospace"

const RUOLI = [
  { v: 'LOCATION', l: 'Location' },
  { v: 'WEDDING_PLANNER', l: 'Wedding planner' },
  { v: 'FORNITORE', l: 'Fornitore' },
  { v: 'ALTRO', l: 'Altro' },
]

export default function AccessRequestPage() {
  const [params] = useSearchParams()
  // Provenienza: se si arriva da planfully.it/<slug> via ?mondo=<slug>, sappiamo il mestiere.
  const mondo = MONDI_BY_SLUG[(params.get('mondo') || '').toLowerCase()]
  const [province, setProvince] = useState<Provincia[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [attivita, setAttivita] = useState('')
  const [ruolo, setRuolo] = useState('')
  const [ruoloAltro, setRuoloAltro] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [provincia, setProvincia] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [website, setWebsite] = useState('') // honeypot

  useEffect(() => { void loadProvince().then(setProvince).catch(() => {}) }, [])

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  const canSubmit = useMemo(() =>
    nome.trim().length >= 3 && attivita.trim().length >= 2 && !!ruolo && emailOk
    && (ruolo !== 'ALTRO' || ruoloAltro.trim().length > 0),
    [nome, attivita, ruolo, ruoloAltro, emailOk])

  async function submit() {
    setErr(null); setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('access-request-signup', {
        body: { nome, attivita, ruolo, ruolo_altro: ruoloAltro, email, telefono, provincia, messaggio, source: mondo ? 'mondo' : 'landing', mondo: mondo?.slug ?? '', website },
      })
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        setErr(body?.error ?? 'Non siamo riusciti a inviare la richiesta. Riprova.'); return
      }
      const out = data as { ok?: boolean; error?: string }
      if (out?.error) { setErr(out.error); return }
      setDone(true)
    } catch { setErr('Connessione fallita. Riprova.') } finally { setBusy(false) }
  }

  const label = 'text-[11px] uppercase tracking-wider block mb-1.5'
  const field = 'w-full h-12 px-3.5 border text-base bg-transparent'
  const fieldStyle = { borderColor: INCHIOSTRO, color: INCHIOSTRO, fontFamily: JOST }

  return (
    <div style={{ background: CARTA, color: INCHIOSTRO, minHeight: '100vh', fontFamily: JOST }}>
      <Helmet>
        <html lang="it" />
        <title>Richiedi accesso — Planfully</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px clamp(20px,5vw,64px)', borderBottom: `1px solid ${INCHIOSTRO}` }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, color: INCHIOSTRO, textDecoration: 'none' }}>
          <img src="/assets/svg/marchio/planfully-symbol-cipresso.svg" width={28} height={28} alt="" aria-hidden="true" />
          <span style={{ fontWeight: 500, fontSize: 17, letterSpacing: '0.16em' }}>PLANFULLY</span>
        </Link>
        <Link to="/" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.08em', color: CIPRESSO, textDecoration: 'none' }}>← TORNA</Link>
      </header>

      <div className="max-w-lg mx-auto px-5 py-12">
        {done ? (
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: CIPRESSO, marginBottom: 20 }}>RICHIESTA INVIATA</div>
            <h1 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.1, margin: '0 0 20px' }}>Grazie. Ti ricontattiamo di persona.</h1>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: INCHIOSTRO }}>
              Guardiamo la tua richiesta e ti scriviamo noi. Entra chi costruisce lo strumento con noi, non una lista d’attesa.
            </p>
            <Link to="/" style={{ display: 'inline-block', marginTop: 32, borderBottom: `1px solid ${LACCA}`, color: LACCA, fontFamily: MONO, fontSize: 13, letterSpacing: '0.06em', paddingBottom: 2 }}>Torna alla home</Link>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.18em', color: CIPRESSO, marginBottom: 20 }}>ACCESSO SU INVITO</div>
            <h1 style={{ fontFamily: JOST, fontWeight: 400, fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.1, margin: '0 0 16px' }}>Richiedi accesso.</h1>
            <p style={{ fontSize: 16, lineHeight: 1.55, color: CIPRESSO, marginBottom: mondo ? 20 : 32 }}>
              Apriamo la piattaforma a location, planner e fornitori che lavorano già insieme. Raccontaci chi sei: ti ricontattiamo noi.
            </p>
            {mondo && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, fontFamily: MONO, fontSize: 12, letterSpacing: '0.06em', color: CIPRESSO, border: `1px solid ${CIPRESSO}`, padding: '7px 12px' }}>
                <img src="/assets/svg/marchio/planfully-symbol-cipresso.svg" width={16} height={16} alt="" aria-hidden="true" />
                DAL MONDO · {mondo.nome.toUpperCase()}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className={label} style={{ color: CIPRESSO }}>Nome e cognome</label>
                <input className={field} style={fieldStyle} value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <label className={label} style={{ color: CIPRESSO }}>La tua attività</label>
                <input className={field} style={fieldStyle} value={attivita} onChange={(e) => setAttivita(e.target.value)} placeholder="Nome della location, dello studio, dell’azienda" />
              </div>
              <div>
                <label className={label} style={{ color: CIPRESSO }}>Cosa fai nella filiera</label>
                <div className="grid grid-cols-2 gap-2">
                  {RUOLI.map((r) => {
                    const active = ruolo === r.v
                    return (
                      <button key={r.v} onClick={() => setRuolo(r.v)} className="h-12 border text-sm"
                        style={active ? { background: CIPRESSO, color: CARTA, borderColor: CIPRESSO } : { borderColor: INCHIOSTRO, color: INCHIOSTRO }}>
                        {r.l}
                      </button>
                    )
                  })}
                </div>
                {ruolo === 'ALTRO' && (
                  <input className={`${field} mt-2`} style={fieldStyle} value={ruoloAltro} onChange={(e) => setRuoloAltro(e.target.value.slice(0, 80))} placeholder="Specifica" />
                )}
              </div>
              <div>
                <label className={label} style={{ color: CIPRESSO }}>Email</label>
                <input className={field} style={fieldStyle} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={label} style={{ color: CIPRESSO }}>Telefono <span className="normal-case tracking-normal">(facoltativo)</span></label>
                  <input className={field} style={fieldStyle} type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
                </div>
                <div>
                  <label className={label} style={{ color: CIPRESSO }}>Provincia <span className="normal-case tracking-normal">(facoltativo)</span></label>
                  <select className={field} style={fieldStyle} value={provincia} onChange={(e) => setProvincia(e.target.value)}>
                    <option value="">—</option>
                    {province.map((p) => <option key={p.provincia} value={p.provincia}>{p.nome} ({p.provincia})</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={label} style={{ color: CIPRESSO }}>Due righe su di te <span className="normal-case tracking-normal">(facoltativo)</span></label>
                <textarea value={messaggio} onChange={(e) => setMessaggio(e.target.value.slice(0, 1000))} rows={3}
                  className="w-full px-3.5 py-2.5 border text-base bg-transparent" style={fieldStyle} placeholder="Con chi lavori, che eventi fai, perché Planfully." />
              </div>

              <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: -9999, opacity: 0, height: 0, width: 0 }} />

              {err && <p className="text-sm p-3" role="alert" style={{ background: 'rgba(192,59,42,0.1)', color: LACCA }}>{err}</p>}

              <button disabled={!canSubmit || busy} onClick={() => void submit()}
                className="w-full h-13 py-4 text-base disabled:opacity-40"
                style={{ background: LACCA, color: CARTA, fontFamily: JOST, fontWeight: 500, letterSpacing: '0.06em' }}>
                {busy ? 'Invio…' : 'Invia la richiesta'}
              </button>
              <p className="text-center" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.06em', color: CIPRESSO }}>
                Ti ricontattiamo noi · nessuna lista d’attesa
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
