// Le richieste di modifica inviate dalla coppia, con lo STATO aggiornato dal wedding planner.
// Prima la coppia inviava e non sapeva più nulla: qui vede "in attesa / approvata / non accolta /
// applicata" + l'eventuale nota del planner.
import { useChangeRequests, entityLabel, type ReqStatus } from '@/hooks/useChangeRequests'
import { Card } from '@/components/ui/card'
import { MessageSquareReply } from 'lucide-react'

const STATUS: Record<ReqStatus, { label: string; cls: string }> = {
  PENDING: { label: 'In attesa', cls: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: 'Approvata', cls: 'bg-emerald-100 text-emerald-700' },
  APPLIED: { label: 'Applicata', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Non accolta', cls: 'bg-rose-100 text-rose-700' },
}

export function CoupleRequestsCard({ entryId }: { entryId: string }) {
  const { data, isLoading } = useChangeRequests(entryId)
  const reqs = data ?? []
  if (isLoading || reqs.length === 0) return null
  return (
    <Card className="p-4">
      <p className="text-sm font-medium flex items-center gap-2 mb-3"><MessageSquareReply size={16} className="text-[rgb(var(--gold-600))]" /> Le tue richieste di modifica</p>
      <ul className="space-y-2">
        {reqs.slice(0, 12).map((r) => {
          const s = STATUS[r.status] ?? STATUS.PENDING
          return (
            <li key={r.id} className="rounded-lg border border-[rgb(var(--border))] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-[rgb(var(--fg-muted))]">{entityLabel(r.entity_type)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
              </div>
              <p className="text-sm mt-0.5">{r.title}</p>
              {r.review_note && <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1 italic">Nota del planner: {r.review_note}</p>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
