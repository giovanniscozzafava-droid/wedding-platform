import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText, FileSignature, Calendar, MapPin, Package, CheckCircle2, Clock,
  CalendarClock, ListMusic, LogOut, ExternalLink, Sparkles,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { subroleLabel } from '@/lib/supplierQuestions'

// ============================================================================
// Area cliente: il cliente diretto vede, raggruppato e DISTINTO per ogni
// professionista (anche fornitori non connessi tra loro), i propri preventivi,
// contratti e le informazioni di competenza condivise dal singolo fornitore
// (data consegna, scaletta/setlist, brani, note). Sempre preventivi+contratti.
// ============================================================================

type Brief = {
  delivery_label: string | null
  delivery_date: string | null
  headline: string | null
  items: { label?: string; value?: string }[] | null
  note: string | null
} | null

type Quote = {
  id: string; title: string; status: string; event_kind: string | null
  event_date: string | null; event_location: string | null; total_client: number
  access_token: string | null; revision: number; pdf_url: string | null; brief: Brief
}
type Contract = {
  id: string; title: string; status: string; access_token: string | null
  signed_at: string | null; pdf_url: string | null
}
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

export default function ClientPortalPage() {
  const { user, signOut } = useAuth()
  const [pros, setPros] = useState<Professional[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('client_portal_overview')
        if (error) throw error
        const r = data as { ok?: boolean; error?: string; professionals?: Professional[] }
        if (r.error) throw new Error(r.error)
        setPros(r.professionals ?? [])
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Errore di caricamento')
      } finally { setLoading(false) }
    })()
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg))' }}>
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <Sparkles size={18} className="text-[rgb(var(--gold-500))]" />
          <span className="font-display text-lg">La mia area</span>
          <span className="ml-auto text-xs text-[rgb(var(--fg-muted))] hidden sm:block">{user?.email}</span>
          <Link to="/faq" className="text-xs text-[rgb(var(--fg-muted))] hover:underline">FAQ</Link>
          <button onClick={() => void signOut()} className="text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] inline-flex items-center gap-1">
            <LogOut size={13} /> Esci
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="font-display text-2xl mb-1">I tuoi professionisti</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mb-6">
          Tutti i preventivi, i contratti e le informazioni che hai ricevuto, ordinati per professionista.
        </p>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : err ? (
          <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">{err}</Card>
        ) : pros.length === 0 ? (
          <Card className="p-10 text-center">
            <Package size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Non ci sono ancora preventivi o contratti collegati a <strong>{user?.email}</strong>.<br />
              Quando un professionista ti invierà una proposta, comparirà qui.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {pros.map((p) => <ProfessionalBlock key={p.owner_id} pro={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function ProfessionalBlock({ pro }: { pro: Professional }) {
  const accent = pro.brand_primary_color || 'rgb(var(--gold-500))'
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden">
        {/* Intestazione professionista */}
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
          {/* Preventivi (sempre presenti) */}
          <Section icon={<FileText size={15} />} title="Preventivi">
            {pro.quotes.length === 0
              ? <Empty>Nessun preventivo.</Empty>
              : pro.quotes.map((q) => <QuoteCard key={q.id} q={q} accent={accent} />)}
          </Section>

          {/* Contratti (sempre presenti) */}
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

function QuoteCard({ q, accent }: { q: Quote; accent: string }) {
  const st = QUOTE_STATUS[q.status] ?? { l: q.status, c: '#94a3b8' }
  const brief = q.brief
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

      {/* Brief di competenza (ciò che il fornitore comunica) */}
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

      {/* Azioni */}
      <div className="flex gap-2 mt-3">
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
