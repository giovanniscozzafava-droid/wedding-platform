import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Check, X, ExternalLink, Home, LogIn, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { publicQuoteByToken } from '@/hooks/useQuotes'
import { QuoteAuthGate } from '@/components/QuoteAuthGate'
import { trackQuoteOpen } from '@/lib/trackQuoteOpen'
import { eventLabel } from '@/lib/eventKind'

const CONSENT_CLAUSES = [
  { key: 'registration', text: 'Mi registro su Planfully per visualizzare il prezzo del preventivo.' },
  { key: 'data_fuyue', text: 'Acconsento al trattamento dei miei dati personali da parte di Fuyue Srl, titolare del marchio Planfully, che ne diventa titolare.' },
  { key: 'commercial_third_parties', text: 'Acconsento all’utilizzo dei miei dati anche per finalità commerciali e alla loro eventuale cessione a terzi da parte di Fuyue Srl.' },
  { key: 'privacy_policy', text: 'Dichiaro di aver letto e compreso l’informativa privacy.' },
]

export default function QuotePreviewPage() {
  const { token } = useParams<{ token: string }>()
  // Traccia l'apertura SUBITO, FUORI dal gate: conta anche se il cliente si ferma
  // al muro di login (prima il track era dentro il gate → non contava mai).
  useEffect(() => { trackQuoteOpen(token) }, [token])
  return <QuoteAuthGate><QuotePreviewPageInner /></QuoteAuthGate>
}

function QuotePreviewPageInner() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Awaited<ReturnType<typeof publicQuoteByToken>> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [unlocked, setUnlocked] = useState(false)
  const [opt, setOpt] = useState<{ allowed: boolean; days: number; optioned: boolean } | null>(null)
  const [optBusy, setOptBusy] = useState(false)

  // Il pro ha abilitato l'opzione? Il cliente può tenere la data senza firmare.
  useEffect(() => {
    if (!token) return
    void (async () => {
      try {
        const { data: s } = await (supabase.rpc as any)('quote_option_status', { p_token: token })
        if (s) setOpt({ allowed: !!s.option_allowed, days: Number(s.option_days ?? 15), optioned: !!s.optioned })
      } catch { /* ignora */ }
    })()
  }, [token])

  async function requestOption() {
    if (!token) return
    setOptBusy(true)
    try {
      const { data: r, error } = await (supabase.rpc as any)('richiedi_opzione_da_preventivo', { p_token: token })
      if (error) throw new Error(error.message)
      const res = r as { ok?: boolean; error?: string; scade?: string; contesa?: boolean }
      const map: Record<string, string> = {
        non_abilitato: 'Opzione non disponibile su questo preventivo.', gia_opzionata: 'La data è già opzionata per te.',
        no_date: 'Manca la data dell’evento.',
      }
      if (res?.error) throw new Error(map[res.error] ?? res.error)
      setOpt((o) => o ? { ...o, optioned: true } : o)
      toast.success(res?.contesa
        ? `Data tenuta per te${res?.scade ? ` fino al ${new Date(res.scade).toLocaleDateString('it-IT')}` : ''}. Attenzione: altri l’hanno già richiesta — chi firma per primo la prende.`
        : `Data tenuta per te${res?.scade ? ` fino al ${new Date(res.scade).toLocaleDateString('it-IT')}` : ''} — senza impegno.`)
    } catch (e) { toast.error((e as Error).message) }
    finally { setOptBusy(false) }
  }

  const load = async () => {
    if (!token) return
    try { const d = await publicQuoteByToken(token); setData(d); if (d && (d as { price_locked?: boolean }).price_locked === false) setUnlocked(true) }
    catch (e) { setErr((e as Error)?.message ?? 'Errore') }
    finally { setLoading(false) }
  }
  useEffect(() => { setLoading(true); void load() }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
        <p className="text-[rgb(var(--fg-subtle))]">Carico il preventivo…</p>
      </div>
    )
  }
  if (err || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'rgb(var(--bg))' }}>
        <div className="text-center max-w-md">
          <h1 className="font-display text-2xl">Preventivo non disponibile</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">{err ?? 'Il link potrebbe essere scaduto o errato.'}</p>
        </div>
      </div>
    )
  }

  const primary = data.owner?.brand_primary_color ?? '#1A2E4F'
  // Se il preventivo è già stato accettato/firmato, il prezzo NON è più segreto:
  // il cliente si è già registrato e ha firmato. Niente gate di registrazione.
  const alreadyDecided = data.status === 'ACCETTATO' || data.status === 'CONVERTITO_IN_CONTRATTO'
  const showPrice = unlocked || alreadyDecided

  return (
    <div className="min-h-screen py-8 sm:py-14 px-4 relative" style={{ background: 'rgb(var(--bg))' }}>
      <div className="absolute top-0 left-0 right-0 h-72 overflow-hidden">
        <img src="/hero/preview.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(14,17,22,0.35) 0%, rgb(var(--bg)) 100%)' }} />
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto relative">
        <div className="surface surface-lift overflow-hidden">
          <div className="h-2" style={{ background: primary }} />
          <header className="px-6 sm:px-10 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            {/* Il preventivo è del PROFESSIONISTA: logo suo in testa; Planfully solo in piccolo a piè pagina. */}
            {data.owner?.brand_logo_url ? (
              <img src={data.owner.brand_logo_url} alt={data.owner.business_name ?? 'Logo'}
                className="h-14 sm:h-16 w-auto max-w-[240px] object-contain mb-3" />
            ) : null}
            <div className="flex items-center gap-2 mb-2">
              {!data.owner?.brand_logo_url && (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                  <Sparkles size={14} strokeWidth={2.2} />
                </span>
              )}
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Preventivo riservato</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight" style={{ color: primary }}>
              {data.title}
            </h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
              Da <strong>{data.owner?.business_name ?? data.owner?.full_name ?? '—'}</strong>
              {' · '}
              <Badge status={data.status} />
            </p>
            {opt?.allowed && data.status !== 'ACCETTATO' && data.status !== 'CONVERTITO_IN_CONTRATTO' && (
              <div className="mt-4 rounded-xl border p-3" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
                {opt.optioned ? (
                  <p className="text-sm text-[rgb(var(--fg))]">Ti stiamo tenendo la data <strong>senza impegno</strong>. Confermala firmando quando sei pronto.</p>
                ) : (
                  <>
                    <p className="text-sm text-[rgb(var(--fg))] mb-2">Non sei ancora pronto a firmare? Puoi <strong>tenere la data senza impegno</strong> per {opt.days} giorni.</p>
                    <Button size="sm" variant="outline" disabled={optBusy} onClick={() => void requestOption()}>
                      {optBusy ? 'Attendere…' : 'Richiedi opzione sulla data'}
                    </Button>
                  </>
                )}
              </div>
            )}
          </header>

          <div className="px-6 sm:px-10 py-6 space-y-2 text-sm">
            {data.client_name && (
              <p className="text-[rgb(var(--fg-muted))]">Per: <strong className="text-[rgb(var(--fg))]">{data.client_name}</strong></p>
            )}
            {data.event_date && (
              <p className="text-[rgb(var(--fg-muted))]">Data evento: <strong className="text-[rgb(var(--fg))]">
                {new Date(data.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </strong></p>
            )}
          </div>

          <div className="px-6 sm:px-10">
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }} data-testid="public-items">
              {data.items.map((it, i) => (
                <li key={i} className="py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{it.name_snapshot}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">Quantità: {Number(it.quantity)}</p>
                  </div>
                  <p className="font-display text-lg tabular-nums shrink-0">
                    {showPrice ? `€ ${Number(it.line_client).toLocaleString('it-IT')}` : <Lock size={15} className="text-[rgb(var(--fg-subtle))]" />}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {showPrice ? (
            <>
              <div className="px-6 sm:px-10 py-6 mt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Totale</span>
                  <span className="font-display text-3xl sm:text-4xl tabular-nums" style={{ color: primary }}>
                    € {Number(data.total_client).toLocaleString('it-IT')}
                  </span>
                </div>
              </div>
              {data.pdf_url && (
                <div className="px-6 sm:px-10 pb-4">
                  <a href={data.pdf_url} target="_blank" rel="noreferrer" data-testid="public-pdf-link"
                    className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline">
                    Scarica versione PDF <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </>
          ) : (
            <PriceConsentGate token={token!} clientName={data.client_name ?? null}
              clientEmail={(data as { client_email?: string | null }).client_email ?? null}
              primary={primary} onUnlocked={() => { void load() }} />
          )}

          {data.status === 'INVIATO' && (
            <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="gold" className="flex-1">
                <Link to={`/p/accept/${token}`} data-testid="accept-btn">
                  <Check /> Accetto il preventivo
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/p/reject/${token}`} data-testid="reject-btn">
                  <X /> Rifiuto
                </Link>
              </Button>
            </div>
          )}

          {data.status === 'ACCETTATO' && (
            <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="gold" className="flex-1">
                <Link to={`/login?next=${encodeURIComponent('/couple?tab=preventivo')}`} data-testid="couple-portal-btn">
                  <LogIn /> Vai al portale {eventLabel((data as any).event_kind)}
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/" data-testid="back-home-btn">
                  <Home /> Torna alla home
                </Link>
              </Button>
            </div>
          )}

          {(data.status === 'RIFIUTATO' || data.status === 'SCADUTO') && (
            <div className="px-6 sm:px-10 pb-8 flex">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/" data-testid="back-home-btn">
                  <Home /> Torna alla home
                </Link>
              </Button>
            </div>
          )}

          <div className="h-2" style={{ background: data.owner?.brand_primary_color ? primary : 'rgb(var(--gold-500))' }} />
        </div>

        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-6">
          Powered by Planfully &middot; Documento riservato, condividere solo con persone autorizzate.
        </p>
      </motion.div>
    </div>
  )
}

function PriceConsentGate({ token, clientName, clientEmail, primary, onUnlocked }: {
  token: string; clientName: string | null; clientEmail: string | null; primary: string; onUnlocked: () => void
}) {
  const [email, setEmail] = useState(clientEmail ?? '')
  const [name, setName] = useState(clientName ?? '')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [sending, setSending] = useState(false)
  const allChecked = CONSENT_CLAUSES.every((c) => checks[c.key])

  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { toast.error('Email non valida'); return }
    if (!allChecked) { toast.error('Devi accettare tutte le voci'); return }
    setSending(true)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('register_quote_view', { p_token: token, p_email: email.trim(), p_name: name.trim() || null, p_consents: checks })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string }
      if (r.error) throw new Error(r.error === 'consents_required' ? 'Devi accettare tutte le voci' : r.error)
      onUnlocked()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore')
    } finally { setSending(false) }
  }

  return (
    <div className="px-6 sm:px-10 py-6 mt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="rounded-xl border p-4" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} style={{ color: primary }} />
          <p className="font-medium text-sm">Registrati per vedere il prezzo</p>
        </div>
        <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
          Per visualizzare il totale del preventivo, registrati e accetta le condizioni qui sotto.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="La tua email" />
        </div>
        <div className="space-y-2 mb-3">
          {CONSENT_CLAUSES.map((c) => (
            <label key={c.key} className="flex items-start gap-2 text-xs text-[rgb(var(--fg-muted))] cursor-pointer">
              <input type="checkbox" checked={!!checks[c.key]} onChange={(e) => setChecks((s) => ({ ...s, [c.key]: e.target.checked }))}
                className="mt-0.5 shrink-0" />
              <span>{c.text}</span>
            </label>
          ))}
        </div>
        <Button onClick={() => void submit()} disabled={sending || !allChecked}
          style={{ background: primary, color: '#fff' }} className="w-full">
          {sending ? 'Attendere…' : 'Registrati e vedi il prezzo'}
        </Button>
      </div>
    </div>
  )
}
