import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Inbox, Calendar, MapPin, Users, ArrowRight, Filter, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'

// ============================================================================
// Richieste dirette al fornitore (pipeline supplier_leads): NEW→…→WON/LOST.
// Conversione lead → preventivo diretto con create_quote_from_supplier_lead.
// ============================================================================

type Lead = {
  id: string; status: string; event_kind: string | null; event_date_from: string | null
  event_location: string | null; estimated_guests: number | null; estimated_budget: string | null
  message: string | null; source: string | null; created_at: string; converted_quote_id: string | null
  supplier_client_id: string | null
}

const STATUS_FLOW = ['NEW', 'CONTACTED', 'QUALIFIED', 'QUOTE_CREATED', 'QUOTE_SENT', 'WON', 'LOST', 'ARCHIVED']
const STATUS_LABEL: Record<string, string> = {
  NEW: 'Nuovo', CONTACTED: 'Contattato', QUALIFIED: 'Qualificato', QUOTE_CREATED: 'Preventivo creato',
  QUOTE_SENT: 'Preventivo inviato', WON: 'Vinto', LOST: 'Perso', ARCHIVED: 'Archiviato',
}
const STATUS_COLOR: Record<string, string> = {
  NEW: '#6366f1', CONTACTED: '#0ea5e9', QUALIFIED: '#8b5cf6', QUOTE_CREATED: '#d97706',
  QUOTE_SENT: '#d97706', WON: '#16a34a', LOST: '#dc2626', ARCHIVED: '#94a3b8',
}

const db = () => supabase as unknown as { from: (t: string) => any; rpc: (f: string, a?: any) => Promise<{ data: unknown; error: Error | null }> }

export default function SupplierLeadsPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('ALL')

  async function load() {
    if (!profile?.id) return
    const { data } = await db().from('supplier_leads').select('*').eq('supplier_id', profile.id).order('created_at', { ascending: false })
    setLeads((data as Lead[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [profile?.id])

  async function setStatus(lead: Lead, status: string) {
    await db().from('supplier_leads').update({ status }).eq('id', lead.id)
    await load()
  }

  async function del(lead: Lead) {
    if (!window.confirm('Eliminare questa richiesta? L\'azione non è reversibile.')) return
    const { error } = await db().from('supplier_leads').delete().eq('id', lead.id)
    if (error) { toast.error('Errore eliminazione'); return }
    toast.success('Richiesta eliminata')
    await load()
  }

  async function convert(lead: Lead) {
    if (lead.converted_quote_id) { nav(`/quotes/${lead.converted_quote_id}`); return }
    const { data, error } = await db().rpc('create_quote_from_supplier_lead', { p_lead_id: lead.id })
    const r = data as { ok?: boolean; quote_id?: string; error?: string }
    if (error || r?.error) { toast.error(r?.error || 'Errore conversione'); return }
    toast.success('Preventivo creato')
    if (r.quote_id) nav(`/quotes/${r.quote_id}`)
  }

  const shown = filter === 'ALL' ? leads : leads.filter((l) => l.status === filter)

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Pipeline" title="Richieste dirette"
          description="Le richieste arrivate dalla tua landing o dal form sul tuo sito. Trasformale in preventivi." />

        <div className="flex items-center gap-2 mb-5 flex-wrap">
          <Filter size={15} className="text-[rgb(var(--fg-subtle))]" />
          {['ALL', ...STATUS_FLOW].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className="text-xs px-2.5 py-1 rounded-full border"
              style={filter === s ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' } : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
              {s === 'ALL' ? 'Tutte' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : shown.length === 0 ? (
          <Card className="p-10 text-center">
            <Inbox size={26} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna richiesta. Condividi la tua landing o il form integrato nel sito.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {shown.map((l) => (
              <Card key={l.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: STATUS_COLOR[l.status], background: `${STATUS_COLOR[l.status]}1a` }}>
                        {STATUS_LABEL[l.status] ?? l.status}
                      </span>
                      <span className="text-sm font-medium capitalize">{l.event_kind ?? 'evento'}</span>
                      {l.source && <span className="text-[11px] text-[rgb(var(--fg-subtle))]">· {l.source}</span>}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[rgb(var(--fg-muted))]">
                      {l.event_date_from && <span className="inline-flex items-center gap-1"><Calendar size={12} /> {new Date(l.event_date_from).toLocaleDateString('it-IT')}</span>}
                      {l.event_location && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {l.event_location}</span>}
                      {l.estimated_guests != null && <span className="inline-flex items-center gap-1"><Users size={12} /> {l.estimated_guests}</span>}
                      {l.estimated_budget && <span>budget {l.estimated_budget}</span>}
                    </div>
                    {l.message && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1.5">{l.message}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <select value={l.status} onChange={(e) => void setStatus(l, e.target.value)}
                    className="text-xs border rounded-lg px-2 py-1.5 bg-transparent" style={{ borderColor: 'rgb(var(--border))' }}>
                    {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                  <Button variant="gold" onClick={() => void convert(l)}>
                    {l.converted_quote_id ? 'Apri preventivo' : 'Crea preventivo'} <ArrowRight size={14} className="ml-1" />
                  </Button>
                  <button onClick={() => void del(l)} title="Elimina richiesta"
                    className="ml-auto inline-flex items-center gap-1 text-xs text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))] px-2 py-1.5 rounded-lg">
                    <Trash2 size={14} /> Elimina
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
