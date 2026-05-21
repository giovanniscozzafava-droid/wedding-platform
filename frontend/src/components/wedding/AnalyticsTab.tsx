import { useQuoteViews } from '@/hooks/useWedding'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'

const TONE: Record<string, 'gold' | 'sage' | 'rose' | 'sky' | 'amber'> = {
  OPEN: 'sky',
  SCROLL: 'neutral' as any,
  ITEM_FOCUS: 'sage',
  OPTIONAL_TOGGLE: 'amber',
  ALTERNATIVE_PICK: 'gold',
  PDF_DOWNLOAD: 'sage',
  ACCEPT: 'sage',
  REJECT: 'rose',
}

export function AnalyticsTab({ quoteId }: { quoteId: string | null }) {
  const { data, isLoading } = useQuoteViews(quoteId)

  if (!quoteId) return (
    <Card className="p-10 text-center"><p className="text-[rgb(var(--fg-muted))]">Nessun preventivo collegato a questo matrimonio.</p></Card>
  )
  if (isLoading) return <p className="text-[rgb(var(--fg-subtle))]">Caricamento...</p>

  const counts = (data ?? []).reduce((acc: Record<string, number>, v: any) => {
    acc[v.event_type] = (acc[v.event_type] ?? 0) + 1
    return acc
  }, {})

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Analytics preventivo</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Tutto cio` che il cliente fa sulla pagina di anteprima.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="surface p-3">
            <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{k.replace(/_/g, ' ')}</p>
            <p className="font-display text-2xl mt-0.5 tabular-nums">{v as number}</p>
          </div>
        ))}
        {Object.keys(counts).length === 0 && (
          <div className="surface p-6 col-span-full text-center">
            <Eye size={20} className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
            <p className="text-sm text-[rgb(var(--fg-muted))]">Il cliente non ha ancora aperto il link.</p>
          </div>
        )}
      </div>

      <h3 className="font-display text-lg mb-3">Stream eventi ({data?.length ?? 0})</h3>
      <Card className="overflow-hidden">
        <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
          {(data ?? []).map((v: any) => (
            <li key={v.id} className="px-4 py-2 flex items-center gap-3 text-sm">
              <Badge tone={(TONE[v.event_type] as any) ?? 'neutral'}>{v.event_type}</Badge>
              <span className="flex-1 text-[rgb(var(--fg-muted))] truncate">
                {Object.keys(v.payload ?? {}).length > 0 ? JSON.stringify(v.payload) : ''}
              </span>
              <span className="text-xs text-[rgb(var(--fg-subtle))]">
                {new Date(v.created_at).toLocaleString('it-IT')}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
