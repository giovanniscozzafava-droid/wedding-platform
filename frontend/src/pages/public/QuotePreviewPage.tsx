import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, X, ExternalLink, Home, LogIn, Lock } from '@/components/icons/lucide'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { publicQuoteByToken } from '@/hooks/useQuotes'
import { QuoteAuthGate } from '@/components/QuoteAuthGate'
import { trackQuoteOpen } from '@/lib/trackQuoteOpen'
import { eventLabel } from '@/lib/eventKind'
import { hasPartialSelection, shownTotal, itemIncluded } from '@/lib/quoteSelection'

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
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())
  // REGOLA: il preventivo si compone dalle singole voci accettate. Senza selezione
  // non si va avanti. Qui il cliente sceglie DAL LINK PUBBLICO, senza account.
  const [picking, setPicking] = useState(false)
  // Tap su una voce = la apre (mostra il dettaglio) e segna al pro che il cliente l'ha guardata.
  function toggleItem(itemId: string) {
    if (!itemId) return
    setOpenItems((s) => { const n = new Set(s); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n })
    void (supabase.rpc as any)('track_quote_item_click', { p_token: token, p_item_id: itemId })
  }

  // Spunta (o toglie) una o TUTTE le voci. Una sola RPC per entrambi i casi.
  async function decideItems(ids: string[], decision: 'ACCETTATO' | 'IN_ATTESA') {
    if (!token || ids.length === 0 || picking) return
    setPicking(true)
    try {
      const { data: r, error } = await (supabase.rpc as any)('quote_items_decide_by_token',
        { p_token: token, p_item_ids: ids, p_decision: decision })
      // supabase-js NON lancia sugli errori Postgres: senza questo check la spunta
      // sembrerebbe riuscita mentre il totale resta quello di prima.
      if (error) throw error
      if (r?.error) throw new Error(r.error)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Non sono riuscito a salvare la scelta. Riprova.')
    } finally {
      setPicking(false)
    }
  }

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
  // Il prezzo si vede SEMPRE una volta passato il login (QuoteAuthGate, email
  // dell'invito): quello è il vero controllo di accesso. Prima si chiedeva un
  // consenso extra solo per vedere il prezzo, ma quel consenso non sbloccava
  // più nulla (quote_get_by_token non torna più `price_locked`) — il cliente
  // restava bloccato per sempre. Il consenso resta, ma solo per SCEGLIERE le
  // voci e accettare, non per guardare il preventivo.
  const showPrice = true
  // Regola R1: se il cliente ha accettato solo alcune voci, mostra SOLO il totale
  // di quelle. Le voci non incluse restano visibili ma marcate "Non incluso".
  const hasSel = hasPartialSelection(data.total_client_selected)
  const shown = shownTotal(data.total_client, data.total_client_selected)
  // Si sceglie solo su un preventivo ancora INVIATO; `unlocked` qui significa
  // "ha confermato i dati per procedere" (ex "vede il prezzo").
  const canChoose = data.status === 'INVIATO'
  const consented = unlocked
  const allIds = data.items.map((it) => (it as { id?: string }).id ?? '').filter(Boolean)
  const pickedIds = data.items
    .filter((it) => (it as { client_decision?: string | null }).client_decision === 'ACCETTATO')
    .map((it) => (it as { id?: string }).id ?? '').filter(Boolean)
  const nPicked = pickedIds.length
  const allPicked = allIds.length > 0 && nPicked === allIds.length

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
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-[rgb(var(--gold-600))] mb-2">Preventivo riservato</p>
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

          {canChoose && consented && (
            <div className="px-6 sm:px-10 pt-2 pb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[rgb(var(--fg-muted))]">
                Scegli le voci che vuoi: <strong className="text-[rgb(var(--fg))]">{nPicked} di {allIds.length}</strong> selezionate.
              </p>
              <Button type="button" variant="outline" size="sm" disabled={picking}
                data-testid="pick-all-btn"
                onClick={() => void decideItems(allPicked ? allIds : allIds.filter((id) => !pickedIds.includes(id)), allPicked ? 'IN_ATTESA' : 'ACCETTATO')}>
                {allPicked ? 'Togli tutte' : 'Opziona tutte le voci'}
              </Button>
            </div>
          )}
          {canChoose && !consented && (
            <div className="px-6 sm:px-10 pt-2">
              <ProceedConsentGate token={token!} clientName={data.client_name ?? null}
                clientEmail={(data as { client_email?: string | null }).client_email ?? null}
                primary={primary} onUnlocked={() => setUnlocked(true)} />
            </div>
          )}

          <div className="px-6 sm:px-10" data-testid="public-items">
            {(() => {
              // Raggruppa le voci per CATEGORIA (Fotografia, Catering, Fiori…), nell'ordine di prima
              // comparsa: così il cliente legge tutto ordinato invece di una lista piatta.
              const groups: { cat: string; items: typeof data.items }[] = []
              const gidx = new Map<string, number>()
              for (const it of data.items) {
                const cat = (((it as { category?: string }).category ?? '').trim()) || 'Altri servizi'
                if (!gidx.has(cat)) { gidx.set(cat, groups.length); groups.push({ cat, items: [] }) }
                groups[gidx.get(cat)!]!.items.push(it)
              }
              const single = groups.length <= 1
              return groups.map((g, gi) => (
                <div key={g.cat}>
                  {!single && (
                    <p className="pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: primary }}>{g.cat}</p>
                  )}
                  <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                    {g.items.map((it, i) => {
                      const itemId = (it as { id?: string }).id ?? ''
                      const desc = (it as { description_snapshot?: string | null }).description_snapshot
                      const isOpen = openItems.has(itemId)
                      // Con selezione parziale, le voci non accettate restano visibili ma
                      // marcate "Non incluso" e non concorrono al totale mostrato.
                      const included = itemIncluded((it as { client_decision?: string | null }).client_decision as never, hasSel)
                      const picked = (it as { client_decision?: string | null }).client_decision === 'ACCETTATO'
                      // Mentre sceglie: non spuntata = solo sbiadita (niente barratura,
                      // che significherebbe "esclusa" invece di "non ancora scelta").
                      const dim = (canChoose && consented) ? !picked : !included
                      const strike = !canChoose && !included
                      return (
                        <li key={itemId || `${gi}-${i}`} className="py-4" style={dim ? { opacity: 0.55 } : undefined}>
                    <div className="flex items-start gap-3">
                    {canChoose && consented && (
                      <input type="checkbox" aria-label={`Includi ${it.name_snapshot}`} data-testid="pick-item"
                        checked={picked} disabled={picking || !itemId}
                        onChange={(e) => void decideItems([itemId], e.target.checked ? 'ACCETTATO' : 'IN_ATTESA')}
                        className="mt-1.5 size-4 shrink-0 accent-[rgb(var(--gold-500))] cursor-pointer" />
                    )}
                    <button type="button" onClick={() => toggleItem(itemId)} className="flex-1 min-w-0 flex items-start justify-between gap-4 text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium" style={strike ? { textDecoration: 'line-through' } : undefined}>{it.name_snapshot}</p>
                        <p className="text-xs text-[rgb(var(--fg-subtle))]">
                          Quantità: {Number(it.quantity)}{desc ? ' · tocca per i dettagli' : ''}
                          {strike && <span className="ml-1.5 font-semibold uppercase tracking-wide" style={{ color: 'rgb(var(--fg-muted))' }}>· Non incluso</span>}
                        </p>
                      </div>
                      <p className="font-display text-lg tabular-nums shrink-0" style={strike ? { textDecoration: 'line-through', color: 'rgb(var(--fg-subtle))' } : undefined}>
                        {showPrice ? `€ ${Number(it.line_client).toLocaleString('it-IT')}` : <Lock size={15} className="text-[rgb(var(--fg-subtle))]" />}
                      </p>
                    </button>
                    </div>
                    {(() => {
                      const sup = (it as { supplier?: { name?: string; slug?: string | null; subrole?: string | null } | null }).supplier
                      if (!sup?.name) return null   // voce blind → nessun fornitore mostrato
                      return (
                        <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">
                          A cura di {sup.slug
                            ? <a href={`/w/${sup.slug}`} target="_blank" rel="noreferrer" className="underline" style={{ color: primary }}>{sup.name}</a>
                            : <span className="font-medium">{sup.name}</span>}
                          {sup.subrole ? <span className="text-[rgb(var(--fg-subtle))] capitalize"> · {sup.subrole}</span> : null}
                        </p>
                      )
                    })()}
                    {isOpen && desc && <p className="mt-2 text-sm text-[rgb(var(--fg-muted))] whitespace-pre-wrap">{desc}</p>}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            })()}
          </div>

          <div className="px-6 sm:px-10 py-6 mt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">{hasSel ? 'Totale selezionato' : 'Totale'}</span>
              <span className="font-display text-3xl sm:text-4xl tabular-nums" style={{ color: primary }}>
                € {Number(shown).toLocaleString('it-IT')}
              </span>
            </div>
            {hasSel && (
              <p className="mt-1 text-xs text-[rgb(var(--fg-muted))] text-right">
                Solo le voci che hai scelto. Le altre restano disponibili se le vuoi aggiungere.
              </p>
            )}
          </div>
          {data.pdf_url && (
            <div className="px-6 sm:px-10 pb-4">
              <a href={data.pdf_url} target="_blank" rel="noreferrer" data-testid="public-pdf-link"
                className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline">
                Scarica versione PDF <ExternalLink size={12} />
              </a>
            </div>
          )}

          {data.status === 'INVIATO' && (
            <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row gap-3">
              {/* Senza almeno una voce scelta il preventivo NON va avanti: il totale
                  firmato dev'essere la somma di ciò che il cliente ha davvero preso.
                  E senza consenso confermato (form qui sopra) non si accetta alla cieca. */}
              {!consented ? (
                <div className="flex-1">
                  <Button variant="gold" className="w-full" disabled data-testid="accept-btn-disabled">
                    <Check /> Accetto il preventivo
                  </Button>
                  <p className="mt-2 text-xs text-center text-[rgb(var(--fg-muted))]">
                    Conferma i tuoi dati qui sopra per scegliere le voci e proseguire.
                  </p>
                </div>
              ) : canChoose && allIds.length > 0 && nPicked === 0 ? (
                <div className="flex-1">
                  <Button variant="gold" className="w-full" disabled data-testid="accept-btn-disabled">
                    <Check /> Accetto il preventivo
                  </Button>
                  <p className="mt-2 text-xs text-center text-[rgb(var(--fg-muted))]">
                    Scegli almeno una voce per proseguire — oppure tocca «Opziona tutte le voci».
                  </p>
                </div>
              ) : (
              <Button asChild variant="gold" className="flex-1">
                <Link to={`/p/accept/${token}`} data-testid="accept-btn">
                  <Check /> Accetto il preventivo
                </Link>
              </Button>
              )}
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

        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-6 flex items-center justify-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <img src="/brand/planfully-symbol.svg" alt="" className="h-3.5 w-3.5" style={{ color: 'rgb(var(--fg))' }} />
            Realizzato con Planfully
          </span>
          <span>&middot; Documento riservato, condividere solo con persone autorizzate.</span>
        </p>
      </motion.div>
    </div>
  )
}

function ProceedConsentGate({ token, clientName, clientEmail, primary, onUnlocked }: {
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
          <p className="font-medium text-sm">Conferma i tuoi dati per procedere</p>
        </div>
        <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
          Per scegliere le voci e accettare il preventivo, conferma questi dati e le condizioni qui sotto.
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
          {sending ? 'Attendere…' : 'Conferma e continua'}
        </Button>
      </div>
    </div>
  )
}
