import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { FileSignature, FileDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

type ContractRow = {
  id: string
  title: string | null
  client_name: string | null
  client_email: string | null
  event_date: string | null
  total_amount: number | null
  status: string | null
  signed_at: string | null
  pdf_url: string | null
  created_at: string
}

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from('contracts' as any) as any)
        .select('id, title, client_name, client_email, event_date, total_amount, status, signed_at, pdf_url, created_at')
        .order('created_at', { ascending: false })
      setRows((data ?? []) as ContractRow[])
      setLoading(false)
    })()
  }, [])

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
              <Card className="p-5 hover:shadow-[var(--shadow-lift)] transition-shadow">
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
                  <div className="flex items-center gap-2">
                    {c.pdf_url && (
                      <a href={c.pdf_url} target="_blank" rel="noreferrer" className="text-[rgb(var(--gold-600))] hover:underline inline-flex items-center gap-1">
                        <FileDown size={11} /> PDF
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
