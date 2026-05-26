import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileSignature, FileDown, X, Copy, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

type ContractRow = {
  id: string
  title: string | null
  client_name: string | null
  client_email: string | null
  client_fiscal_code?: string | null
  event_date: string | null
  total_amount: number | null
  status: string | null
  signed_at: string | null
  pdf_url: string | null
  access_token?: string | null
  sections?: Array<{ heading?: string; body?: string }> | null
  signature_data?: Record<string, unknown> | null
  created_at: string
}

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ContractRow | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from('contracts' as any) as any)
        .select('id, title, client_name, client_email, client_fiscal_code, event_date, total_amount, status, signed_at, pdf_url, access_token, sections, signature_data, created_at')
        .order('created_at', { ascending: false })
      setRows((data ?? []) as ContractRow[])
      setLoading(false)
    })()
  }, [])

  const [generatingPdf, setGeneratingPdf] = useState(false)

  function copyClientLink(token: string | null | undefined) {
    if (!token) { toast.error('Nessun link cliente disponibile'); return }
    const url = `${window.location.origin}/p/contract/${token}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copiato negli appunti')).catch(() => toast.error('Impossibile copiare'))
  }

  async function generatePdf(contractId: string) {
    setGeneratingPdf(true)
    try {
      const { data, error } = await supabase.functions.invoke('contract-generate-pdf', {
        body: { contract_id: contractId },
      })
      if (error) throw error
      const url = (data as { pdf_url?: string })?.pdf_url
      if (!url) throw new Error('PDF non generato')
      toast.success('PDF contratto generato')
      // Aggiorna riga in stato locale + apre PDF
      setRows((rs) => rs.map((r) => r.id === contractId ? { ...r, pdf_url: url } : r))
      setSelected((s) => s && s.id === contractId ? { ...s, pdf_url: url } : s)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore generazione PDF')
    } finally {
      setGeneratingPdf(false)
    }
  }

  const fmtEUR = (n: number | null) => n == null ? '—' : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div>
      <PageHeader title="Contratti" description="Documenti firmati e in attesa di firma" />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-40" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card className="p-12 text-center">
          <FileSignature size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <h3 className="font-display text-lg">Ancora nessun contratto</h3>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
            I contratti vengono generati dal preventivo accettato. Apri un preventivo nello stato ACCETTATO e converti in contratto.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}>
              <button
                type="button"
                onClick={() => setSelected(c)}
                className="block w-full text-left"
                data-testid={`contract-card-${c.id}`}
              >
                <Card className="p-5 cursor-pointer hover:shadow-[var(--shadow-lift)] hover:border-[rgb(var(--gold-500))] transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <FileSignature size={18} className="text-[rgb(var(--gold-600))]" />
                    <Badge status={c.status ?? 'BOZZA'} />
                  </div>
                  <h3 className="font-display text-lg leading-tight mb-1">{c.title ?? 'Contratto'}</h3>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{c.client_name ?? '—'}{c.client_email ? ` · ${c.client_email}` : ''}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Importo</p>
                      <p className="font-medium tabular-nums">{fmtEUR(c.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Evento</p>
                      <p className="font-medium">{fmtDate(c.event_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs">
                    <span className="text-[rgb(var(--fg-subtle))]">
                      {c.signed_at ? `Firmato ${fmtDate(c.signed_at)}` : `Creato ${fmtDate(c.created_at)}`}
                    </span>
                    {c.pdf_url && <FileDown size={11} className="text-[rgb(var(--gold-600))]" />}
                  </div>
                </Card>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setSelected(null)}>
          <div className="surface surface-elev max-w-3xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-xl truncate">{selected.title ?? 'Contratto'}</h2>
                  <Badge status={selected.status ?? 'BOZZA'} />
                </div>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                  {selected.client_name ?? '—'}
                  {selected.client_email && ` · ${selected.client_email}`}
                  {selected.client_fiscal_code && ` · CF ${selected.client_fiscal_code}`}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelected(null)} aria-label="Chiudi"><X size={18} /></Button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Importo totale</p>
                  <p className="font-display text-xl tabular-nums">{fmtEUR(selected.total_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Data evento</p>
                  <p className="font-medium">{fmtDate(selected.event_date)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Stato firma</p>
                  <p className="font-medium">
                    {selected.signed_at ? `Firmato ${fmtDate(selected.signed_at)}` : 'In attesa'}
                  </p>
                </div>
              </div>

              {selected.status === 'FIRMATO' && selected.signature_data && (
                <Card className="p-4" style={{ background: 'rgb(var(--sage-100) / 0.4)' }}>
                  <p className="text-sm font-medium flex items-center gap-2"><FileSignature size={14} /> Atto firmato — readonly</p>
                  <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                    Il contratto è stato firmato dal cliente. Non può più essere modificato per garantire l'integrità legale (CAD art. 20).
                  </p>
                </Card>
              )}

              {Array.isArray(selected.sections) && selected.sections.length > 0 ? (
                <div className="space-y-4">
                  <h3 className="font-display text-base">Clausole</h3>
                  {selected.sections.map((s, i) => (
                    <section key={i} className="border-l-2 pl-4" style={{ borderColor: 'rgb(var(--gold-500))' }}>
                      <h4 className="font-medium text-sm">{i + 1}. {s.heading ?? 'Sezione'}</h4>
                      {s.body && <p className="text-sm text-[rgb(var(--fg-muted))] mt-1 whitespace-pre-line leading-relaxed">{s.body}</p>}
                    </section>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[rgb(var(--fg-subtle))] italic">Nessuna sezione inserita. Apri il contratto dalla scheda matrimonio per editarlo.</p>
              )}
            </div>

            <div className="border-t p-4 flex flex-wrap items-center justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="outline" size="sm" onClick={() => generatePdf(selected.id)} disabled={generatingPdf}>
                <FileDown size={14} /> {generatingPdf ? 'Generazione…' : selected.pdf_url ? 'Rigenera PDF' : 'Genera PDF contratto'}
              </Button>
              {selected.access_token && selected.status !== 'FIRMATO' && (
                <Button variant="outline" size="sm" onClick={() => copyClientLink(selected.access_token)}>
                  <Copy size={14} /> Copia link firma cliente
                </Button>
              )}
              {selected.client_email && (
                <a href={`mailto:${selected.client_email}?subject=${encodeURIComponent(selected.title ?? 'Contratto')}${selected.pdf_url ? `&body=${encodeURIComponent('In allegato il contratto. Puoi anche scaricarlo qui: ' + selected.pdf_url)}` : ''}`}
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium border hover:bg-[rgb(var(--bg-sunken))]"
                  style={{ borderColor: 'rgb(var(--border-strong))' }}>
                  <Mail size={14} /> Email cliente
                </a>
              )}
              {selected.pdf_url && (
                <a href={selected.pdf_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-xs font-medium"
                  style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
                  <FileDown size={14} /> Apri PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
