import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText, FileSignature, Calendar, MapPin, Package, CheckCircle2, Clock,
  CalendarClock, ListMusic, ExternalLink, Sparkles, CreditCard,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { subroleLabel } from '@/lib/supplierQuestions'

// ============================================================================
// Vista "per professionista" del cliente: preventivi, contratti e brief di ogni
// fornitore, anche quelli NON connessi alla rete del wedding planner. Riusata
// sia nell'area cliente standalone (/area-cliente) sia come tab dentro la home
// della coppia (/couple → "I miei fornitori"), così il cliente ha UNA sola casa.
// ============================================================================

type Brief = {
  delivery_label: string | null
  delivery_date: string | null
  headline: string | null
  items: { label?: string; value?: string }[] | null
  note: string | null
} | null

type QuoteItem = {
  id: string; name: string; qty: number; unit: string; line_client: number
  supplier: string | null; client_decision: 'IN_ATTESA' | 'ACCETTATO' | 'RIFIUTATO'
  decline_reason: string | null
}
type Quote = {
  id: string; title: string; status: string; event_kind: string | null
  event_date: string | null; event_location: string | null; total_client: number
  access_token: string | null; revision: number; pdf_url: string | null; brief: Brief
  closed_at: string | null; items: QuoteItem[]
}
type Contract = {
  id: string; title: string; status: string; access_token: string | null
  signed_at: string | null; pdf_url: string | null
}
type Suggested = { suggested_id: string; name: string | null; subrole: string | null; slug: string | null; suggested_by: string | null }
type Professional = {
  owner_id: string; business_name: string | null; role: string; subrole: string | null
  brand_logo_url: string | null; brand_primary_color: string | null; city: string | null
  quotes: Quote[]; contracts: Contract[]
}

const QUOTE_STATUS: Record<string, { l: string; c: string }> = {
  BOZZA: { l: 'In preparazione', c: '#94a3b8' },
  INVIATO: { l: 'Da firmare', c: '#d97706' },
  ACCETTATO: { l: 'Accettato', c: '#16a34a' },
  RIFIUTATO: { l: 'Rifiutato', c: '#dc2626' },
  CONVERTITO_IN_CONTRATTO: { l: 'In contratto', c: '#16a34a' },
}
const CONTRACT_STATUS: Record<string, { l: string; c: string }> = {
  BOZZA: { l: 'In preparazione', c: '#94a3b8' },
  INVIATO: { l: 'Da firmare', c: '#d97706' },
  FIRMATO: { l: 'Firmato', c: '#16a34a' },
  ANNULLATO: { l: 'Annullato', c: '#dc2626' },
}

function fmtDate(d: string | null) {
  if (!d) return null
  try { return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return d }
}
function fmtEuro(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
}

export function ClientProfessionalsView({ emptyEmail }: { emptyEmail?: string | null }) {
  const [pros, setPros] = useState<Professional[]>([])
  const [suggested, setSuggested] = useState<Suggested[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  async function loadOverview() {
    const { data, error } = await (supabase as unknown as { rpc: (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
      .rpc('client_portal_overview')
    if (error) throw error
    const r = data as { ok?: boolean; error?: string; professionals?: Professional[] }
    if (r.error) throw new Error(r.error)
    setPros(r.professionals ?? [])
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadOverview()
        const sug = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: unknown }> }).rpc('client_suggested_suppliers')
        setSuggested(((sug.data as { suppliers?: Suggested[] })?.suppliers) ?? [])
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Errore di caricamento')
      } finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
  if (err) return <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">{err}</Card>
  if (pros.length === 0) return (
    <Card className="p-10 text-center">
      <Package size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
      <p className="text-sm text-[rgb(var(--fg-muted))]">
        Non ci sono ancora preventivi o contratti collegati{emptyEmail ? <> a <strong>{emptyEmail}</strong></> : null}.<br />
        Quando un professionista ti invierà una proposta, comparirà qui.
      </p>
    </Card>
  )

  return (
    <div className="space-y-6">
      {suggested.length > 0 && (
        <Card className="p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--gold-600))] mb-2">Fornitori consigliati per te</p>
          <div className="space-y-2">
            {suggested.map((s) => {
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-[rgb(var(--fg-muted))]">
                      {s.subrole ? subroleLabel(s.subrole) : 'Fornitore'}{s.suggested_by ? ` · consigliato da ${s.suggested_by}` : ''}
                    </p>
                  </div>
                  {s.slug && <span className="text-xs text-[rgb(var(--gold-600))] shrink-0">Vedi →</span>}
                </>
              )
              return s.slug ? (
                <a key={s.suggested_id} href={`/p/fornitore/${s.slug}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[rgb(var(--bg-sunken))]">{inner}</a>
              ) : (
                <div key={s.suggested_id} className="flex items-center gap-3 p-2">{inner}</div>
              )
            })}
          </div>
        </Card>
      )}
      {(() => {
        // Raggruppa i professionisti per CATEGORIA (subrole del fornitore, o ruolo per WP/Location),
        // così la coppia vede i preventivi distinti per settore. Ordine di prima comparsa.
        const groups: { label: string; items: Professional[] }[] = []
        for (const p of pros) {
          const label = p.subrole ? subroleLabel(p.subrole) : roleLabel(p.role)
          let g = groups.find((x) => x.label === label)
          if (!g) { g = { label, items: [] }; groups.push(g) }
          g.items.push(p)
        }
        return groups.map((g) => (
          <div key={g.label} className="space-y-3">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-[rgb(var(--gold-700))] px-1 pt-1">{g.label}</h3>
            {g.items.map((p) => <ProfessionalBlock key={p.owner_id} pro={p} onChanged={() => void loadOverview()} />)}
          </div>
        ))
      })()}
    </div>
  )
}

function ProfessionalBlock({ pro, onChanged }: { pro: Professional; onChanged: () => void }) {
  const accent = pro.brand_primary_color || 'rgb(var(--gold-500))'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
          {pro.brand_logo_url
            ? <img src={pro.brand_logo_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
            : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold" style={{ background: accent }}>
                {(pro.business_name || '?').slice(0, 1).toUpperCase()}
              </div>}
          <div className="min-w-0">
            <p className="font-medium truncate">{pro.business_name || 'Professionista'}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              {pro.subrole ? subroleLabel(pro.subrole) : roleLabel(pro.role)}{pro.city ? ` · ${pro.city}` : ''}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <Section icon={<FileText size={15} />} title="Preventivi">
            {pro.quotes.length === 0
              ? <Empty>Nessun preventivo.</Empty>
              : pro.quotes.map((q) => <QuoteCard key={q.id} q={q} accent={accent} onChanged={onChanged} />)}
          </Section>

          <Section icon={<FileSignature size={15} />} title="Contratti">
            {pro.contracts.length === 0
              ? <Empty>Nessun contratto.</Empty>
              : pro.contracts.map((c) => <ContractCard key={c.id} c={c} />)}
          </Section>
        </div>
      </Card>
    </motion.div>
  )
}

function QuoteCard({ q, accent, onChanged }: { q: Quote; accent: string; onChanged: () => void }) {
  const st = QUOTE_STATUS[q.status] ?? { l: q.status, c: '#94a3b8' }
  const brief = q.brief
  const [busyId, setBusyId] = useState<string | null>(null)

  const isLive = !q.closed_at && (q.status === 'ACCETTATO' || q.status === 'CONVERTITO_IN_CONTRATTO')
  const items = q.items ?? []
  const pending = items.filter((it) => it.client_decision === 'IN_ATTESA')
  const acceptedTotal = items.filter((it) => it.client_decision === 'ACCETTATO').reduce((s, it) => s + Number(it.line_client || 0), 0)

  async function decide(it: QuoteItem, decision: 'ACCETTATO' | 'RIFIUTATO') {
    let reason: string | null = null
    if (decision === 'RIFIUTATO') {
      reason = window.prompt(`Vuoi aggiungere un motivo per "${it.name}"? (facoltativo)`) || null
    }
    setBusyId(it.id)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('client_decide_quote_item', { p_item_id: it.id, p_decision: decision, p_reason: reason })
      if (error) throw error
      const r = data as { error?: string }
      if (r?.error) throw new Error(r.error)
      onChanged()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Errore')
    } finally { setBusyId(null) }
  }

  const [payBusy, setPayBusy] = useState(false)
  // Pagamento del preventivo (acconto/saldo) → checkout Stripe sul conto del professionista.
  // L'importo lo calcola il server dal totale (la coppia non lo controlla).
  async function payQuote(kind: 'QUOTE_DEPOSIT' | 'QUOTE_BALANCE') {
    setPayBusy(true)
    try {
      const { data, error } = await (supabase as unknown as { functions: { invoke: (f: string, o: { body: unknown }) => Promise<{ data: unknown; error: Error | null }> } })
        .functions.invoke('payment-create', { body: { ref_type: 'quote', ref_id: q.id, kind } })
      if (error) throw new Error(error.message)
      const r = (data ?? {}) as { url?: string; error?: string }
      const msg: Record<string, string> = {
        stripe_not_configured: 'Pagamenti online non ancora attivi.',
        payee_not_onboarded: 'Il professionista non ha ancora attivato gli incassi online.',
        payee_onboarding_incomplete: 'Il professionista sta completando l’attivazione degli incassi.',
        deposit_already_paid: 'L’acconto risulta già pagato.',
        already_paid: 'Questo preventivo risulta già saldato.',
        forbidden: 'Non risulti intestatario di questo preventivo.',
        quote_not_found: 'Preventivo non trovato.',
      }
      if (r.error) throw new Error(msg[r.error] ?? ('Pagamento non avviato: ' + r.error))
      if (r.url) { window.location.href = r.url; return }
    } catch (e) { window.alert(e instanceof Error ? e.message : 'Errore') }
    finally { setPayBusy(false) }
  }

  return (
    <div className="rounded-xl border p-3.5 mb-2 last:mb-0" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{q.title}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[rgb(var(--fg-muted))]">
            {q.event_date && <span className="inline-flex items-center gap-1"><Calendar size={12} /> {fmtDate(q.event_date)}</span>}
            {q.event_location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {q.event_location}</span>}
            <span className="font-medium text-[rgb(var(--fg))]">{fmtEuro(q.total_client)}</span>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}1a` }}>{st.l}</span>
      </div>

      {isLive && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button disabled={payBusy} onClick={() => void payQuote('QUOTE_DEPOSIT')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: accent }}>
            <CreditCard size={13} /> Paga acconto
          </button>
          <button disabled={payBusy} onClick={() => void payQuote('QUOTE_BALANCE')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg))' }}>
            Paga intero importo
          </button>
        </div>
      )}

      {isLive && items.length > 0 && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold inline-flex items-center gap-1.5" style={{ color: accent }}>
              <Sparkles size={13} /> Le voci del preventivo
            </p>
            {pending.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#d97706', background: '#d977061a' }}>
                {pending.length} {pending.length === 1 ? 'nuova proposta' : 'nuove proposte'}
              </span>
            )}
          </div>
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    {it.name}
                    {it.qty > 1 && <span className="text-[rgb(var(--fg-subtle))]"> ×{it.qty}</span>}
                    {it.supplier && <span className="text-[rgb(var(--fg-subtle))]"> · {it.supplier}</span>}
                  </p>
                  {it.client_decision === 'RIFIUTATO' && it.decline_reason && (
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] italic truncate">Motivo: {it.decline_reason}</p>
                  )}
                </div>
                <span className="shrink-0 tabular-nums text-[rgb(var(--fg-muted))]">{fmtEuro(it.line_client)}</span>
                {it.client_decision === 'IN_ATTESA' ? (
                  <div className="flex gap-1 shrink-0">
                    <button disabled={busyId === it.id} onClick={() => void decide(it, 'ACCETTATO')}
                      className="px-2 py-1 rounded-md text-white text-[11px] font-medium disabled:opacity-50" style={{ background: '#16a34a' }}>Accetta</button>
                    <button disabled={busyId === it.id} onClick={() => void decide(it, 'RIFIUTATO')}
                      className="px-2 py-1 rounded-md text-[11px] font-medium border disabled:opacity-50" style={{ borderColor: 'rgb(var(--border))' }}>Rifiuta</button>
                  </div>
                ) : (
                  <button disabled={busyId === it.id}
                    onClick={() => void decide(it, it.client_decision === 'ACCETTATO' ? 'RIFIUTATO' : 'ACCETTATO')}
                    className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full disabled:opacity-50"
                    style={it.client_decision === 'ACCETTATO'
                      ? { color: '#16a34a', background: '#16a34a1a' }
                      : { color: '#dc2626', background: '#dc26261a' }}>
                    {it.client_decision === 'ACCETTATO' ? '✓ Accettata' : '✕ Rifiutata'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'rgb(var(--border))' }}>
            <span className="text-[rgb(var(--fg-muted))]">Totale confermato finora</span>
            <span className="font-semibold tabular-nums" style={{ color: accent }}>{fmtEuro(acceptedTotal)}</span>
          </div>
        </div>
      )}

      {/* Preventivo INVIATO ma non ancora accettato: mostro TUTTE le voci (read-only) così il
          cliente vede l'offerta completa — con più voci di più fornitori — nella dashboard. */}
      {!isLive && q.status === 'INVIATO' && items.length > 0 && (
        <div className="mt-3 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="text-xs font-semibold inline-flex items-center gap-1.5 mb-2" style={{ color: accent }}>
            <Sparkles size={13} /> L'offerta
          </p>
          <div className="space-y-1.5">
            {items.map((it) => (
              <div key={it.id} className="flex items-center gap-2 text-xs">
                <p className="min-w-0 flex-1 truncate">
                  {it.name}
                  {it.qty > 1 && <span className="text-[rgb(var(--fg-subtle))]"> ×{it.qty}</span>}
                  {it.supplier && <span className="text-[rgb(var(--fg-subtle))]"> · {it.supplier}</span>}
                </p>
                <span className="shrink-0 tabular-nums text-[rgb(var(--fg-muted))]">{fmtEuro(it.line_client)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2.5 border-t flex items-center justify-between text-xs" style={{ borderColor: 'rgb(var(--border))' }}>
            <span className="text-[rgb(var(--fg-muted))]">Totale offerta</span>
            <span className="font-semibold tabular-nums" style={{ color: accent }}>{fmtEuro(q.total_client)}</span>
          </div>
        </div>
      )}

      {brief && (brief.headline || brief.delivery_date || (brief.items && brief.items.length) || brief.note) && (
        <div className="mt-3 rounded-lg p-3 text-xs" style={{ background: 'rgb(var(--bg-sunken))' }}>
          {brief.headline && <p className="font-medium text-[rgb(var(--fg))] mb-1.5">{brief.headline}</p>}
          {brief.delivery_date && (
            <p className="inline-flex items-center gap-1.5 mb-1.5" style={{ color: accent }}>
              <CalendarClock size={13} /> <strong>{brief.delivery_label || 'Consegna'}:</strong> {fmtDate(brief.delivery_date)}
            </p>
          )}
          {brief.items && brief.items.length > 0 && (
            <ul className="space-y-0.5 mb-1.5">
              {brief.items.filter((it) => it.label || it.value).map((it, i) => (
                <li key={i} className="flex gap-1.5">
                  <ListMusic size={12} className="mt-0.5 shrink-0 text-[rgb(var(--fg-subtle))]" />
                  <span>{it.label ? <strong>{it.label}: </strong> : null}{it.value}</span>
                </li>
              ))}
            </ul>
          )}
          {brief.note && <p className="text-[rgb(var(--fg-muted))] whitespace-pre-line">{brief.note}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {q.access_token && (q.status === 'INVIATO') && (
          <a href={`/p/accept/${q.access_token}`} className="text-xs font-medium px-3 py-1.5 rounded-lg text-white inline-flex items-center gap-1" style={{ background: accent }}>
            <CheckCircle2 size={13} /> Visualizza e firma
          </a>
        )}
        {q.access_token && q.status !== 'INVIATO' && (
          <a href={`/p/preview/${q.access_token}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border inline-flex items-center gap-1" style={{ borderColor: 'rgb(var(--border))' }}>
            <ExternalLink size={13} /> Apri preventivo
          </a>
        )}
        {q.pdf_url && (
          <a href={q.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-medium px-3 py-1.5 rounded-lg border inline-flex items-center gap-1" style={{ borderColor: 'rgb(var(--border))' }}>
            <FileText size={13} /> PDF
          </a>
        )}
      </div>
    </div>
  )
}

function ContractCard({ c }: { c: Contract }) {
  const st = CONTRACT_STATUS[c.status] ?? { l: c.status, c: '#94a3b8' }
  return (
    <div className="rounded-xl border p-3.5 mb-2 last:mb-0 flex items-center gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm truncate">{c.title}</p>
        <p className="text-xs text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mt-0.5">
          {c.signed_at ? <><CheckCircle2 size={12} /> Firmato il {fmtDate(c.signed_at)}</> : <><Clock size={12} /> {st.l}</>}
        </p>
      </div>
      <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.c, background: `${st.c}1a` }}>{st.l}</span>
      <div className="flex gap-2 shrink-0">
        {c.access_token && c.status === 'INVIATO' && (
          <a href={`/p/contract/${c.access_token}`} className="text-xs font-medium px-3 py-1.5 rounded-lg border inline-flex items-center gap-1" style={{ borderColor: 'rgb(var(--border))' }}>
            Firma
          </a>
        )}
        {c.pdf_url && (
          <a href={c.pdf_url} target="_blank" rel="noreferrer" className="text-xs font-medium px-3 py-1.5 rounded-lg border inline-flex items-center gap-1" style={{ borderColor: 'rgb(var(--border))' }}>
            PDF
          </a>
        )}
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[rgb(var(--fg-muted))] mb-2 inline-flex items-center gap-1.5">{icon} {title}</p>
      {children}
    </div>
  )
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-[rgb(var(--fg-subtle))] italic">{children}</p>
}
function roleLabel(r: string) {
  return r === 'WEDDING_PLANNER' ? 'Wedding Planner' : r === 'LOCATION' ? 'Location' : r === 'FORNITORE' ? 'Fornitore' : r
}
