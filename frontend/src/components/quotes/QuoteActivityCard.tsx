import { Eye, Send, CheckCircle2, XCircle, UserCheck, Smartphone, Monitor, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useQuoteActivity } from '@/hooks/useWedding'
import { relTime, deviceFromUa } from '@/lib/quoteActivityFmt'

// Pannello METRICHE preventivo (lato professionista): quando e quante volte il cliente l'ha visto,
// con la timeline di OGNI singola apertura. Sola lettura, owner-only (RLS lato quote_activity).
const STAGE: Record<string, { label: string; cls: string }> = {
  BOZZA: { label: 'Bozza', cls: 'bg-gray-100 text-gray-600' },
  INVIATO: { label: 'Inviato · in attesa', cls: 'bg-sky-100 text-sky-700' },
  APERTO: { label: 'Visto dal cliente', cls: 'bg-amber-100 text-amber-700' },
  REGISTRATO: { label: 'Registrato', cls: 'bg-violet-100 text-violet-700' },
  ACCETTATO: { label: 'Accettato', cls: 'bg-emerald-100 text-emerald-700' },
  RIFIUTATO: { label: 'Rifiutato', cls: 'bg-rose-100 text-rose-700' },
}
const fmtFull = (s?: string | null) => (s ? new Date(s).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export function QuoteActivityCard({ quoteId }: { quoteId: string }) {
  const { data, isLoading } = useQuoteActivity(quoteId)
  if (isLoading || !data || (data as { error?: string }).error) return null
  const stage = data.stage ?? 'BOZZA'
  const st = STAGE[stage] ?? STAGE.BOZZA!
  const views = data.views ?? []

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-medium inline-flex items-center gap-2"><Eye size={16} className="text-[rgb(var(--gold-600))]" /> Attività del cliente</h3>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
      </div>

      {stage === 'BOZZA' ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">Non ancora inviato: il cliente non l'ha ancora visto.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Metric label="Aperture" value={String(data.open_count ?? 0)} />
            <Metric label="Prima vista" value={data.first_opened_at ? relTime(data.first_opened_at) : '—'} title={fmtFull(data.first_opened_at)} />
            <Metric label="Ultima vista" value={data.last_opened_at ? relTime(data.last_opened_at) : '—'} title={fmtFull(data.last_opened_at)} />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[rgb(var(--fg-muted))] mb-3">
            {data.sent_at && <span className="inline-flex items-center gap-1"><Send size={11} /> Inviato {fmtFull(data.sent_at)}</span>}
            {data.registered_at && <span className="inline-flex items-center gap-1"><UserCheck size={11} /> Registrato {fmtFull(data.registered_at)}</span>}
            {data.accepted_at && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={11} /> Accettato {fmtFull(data.accepted_at)}</span>}
            {data.rejected_at && <span className="inline-flex items-center gap-1 text-rose-600"><XCircle size={11} /> Rifiutato {fmtFull(data.rejected_at)}</span>}
          </div>

          {views.length > 0 ? (
            <div className="border-t border-[rgb(var(--border))] pt-2">
              <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Ogni visita ({views.length})</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {views.map((v, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[rgb(var(--fg))]">
                      {deviceFromUa(v.ua) === 'mobile' ? <Smartphone size={12} className="text-[rgb(var(--fg-subtle))]" /> : <Monitor size={12} className="text-[rgb(var(--fg-subtle))]" />}
                      {fmtFull(v.at)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[rgb(var(--fg-subtle))]"><Clock size={11} /> {relTime(v.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (data.open_count ?? 0) > 0 ? (
            <p className="text-xs text-[rgb(var(--fg-subtle))]">Aperture conteggiate ma senza dettaglio (viste precedenti alla nuova metrica).</p>
          ) : (
            <p className="text-xs text-[rgb(var(--fg-subtle))]">Il cliente non ha ancora aperto il preventivo.</p>
          )}
        </>
      )}
    </Card>
  )
}

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2" title={title}>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}
