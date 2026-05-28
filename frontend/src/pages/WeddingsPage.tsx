import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight, CalendarHeart, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { useWeddings } from '@/hooks/useWedding'
import { supabase } from '@/lib/supabase'

export default function WeddingsPage() {
  const { data, isLoading } = useWeddings()
  const qc = useQueryClient()

  async function deleteWedding(id: string, title: string) {
    const confirmMsg = `Elimini definitivamente "${title}"?

Verranno cancellati per sempre TUTTI i dati associati a questo matrimonio:
• Dati anagrafici e contatti della coppia
• Preventivo, voci e firme digitali
• Contratti generati
• Lista invitati, alloggi, trasporti
• Menu, tavoli, mood board, playlist, budget, checklist
• Documenti caricati e PDF
• Gadget / bomboniere

L'azione è IRREVERSIBILE e conforme al GDPR 196/2003 (diritto all'oblio).
Procedere?`
    if (!confirm(confirmMsg)) return
    try {
      const { data: paths, error } = await (supabase as any).rpc('delete_wedding_cascade', { p_entry_id: id })
      if (error) throw error
      // Storage cleanup (best-effort)
      const byBucket = new Map<string, string[]>()
      for (const r of (paths as Array<{ bucket: string; path: string }>) ?? []) {
        if (!r.bucket || !r.path) continue
        const arr = byBucket.get(r.bucket) ?? []
        arr.push(r.path)
        byBucket.set(r.bucket, arr)
      }
      for (const [bucket, files] of byBucket.entries()) {
        try { await supabase.storage.from(bucket).remove(files) } catch { /* ignore */ }
      }
      toast.success('Matrimonio eliminato. Dati della coppia rimossi (GDPR).')
      qc.invalidateQueries({ queryKey: ['weddings'] })
      qc.invalidateQueries({ queryKey: ['calendar'] })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Hub eventi"
          title="I tuoi matrimoni"
          description="Ogni evento ha la sua dashboard: scaletta, tavoli, invitati, budget, checklist, mood, playlist, contratti, documenti."
        />

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
          </div>
        )}

        {!isLoading && (data ?? []).length === 0 && (
          <Card className="p-12 text-center max-w-xl mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <CalendarHeart size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Nessun matrimonio attivo</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Quando un preventivo verra` accettato, l&apos;evento associato comparira` qui pronto da gestire.
            </p>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map((w, idx) => (
            <motion.div key={w.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}>
              <Card className="hover:shadow-[var(--shadow-lift)] transition-shadow overflow-hidden">
                <div className="p-6 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/weddings/${w.id}`} className="min-w-0 flex-1">
                      <h3 className="font-display text-xl truncate">{w.title}</h3>
                      <p className="text-sm text-[rgb(var(--fg-muted))]">
                        {w.client_name ?? '—'} ·{' '}
                        {new Date(w.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Badge status={w.status} />
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Elimina matrimonio + dati coppia (GDPR)"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void deleteWedding(w.id, w.title) }}
                        className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                  <Link to={`/weddings/${w.id}`}>
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t text-xs" style={{ borderColor: 'rgb(var(--border))' }}>
                      <Stat label="Valore" value={`€ ${Number(w.value_amount ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} />
                      <Stat label="Preventivo" value={w.quote?.status ?? '—'} />
                      <Stat label="Revision" value={`v${w.quote?.revision ?? 1}`} />
                    </div>
                    <div className="flex items-center justify-end gap-1 text-sm text-[rgb(var(--fg-muted))] mt-2">
                      Apri dashboard <ArrowUpRight size={14} />
                    </div>
                  </Link>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}
