import { Link } from 'react-router-dom'
import { CalendarClock, Table2, Users, Wallet, ListChecks, Palette, Music, FileSignature, FolderOpen, MessageSquare, Check, X as XIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useBudget, useGuests, useMood, usePlaylist, useTables, useTasks, useTimeline } from '@/hooks/useWedding'
import { useChangeRequests, useReviewChangeRequest, entityLabel } from '@/hooks/useChangeRequests'

export function OverviewTab({ wedding, onTab }: { wedding: any; onTab: (k: string) => void }) {
  const eid = wedding.id
  const tl = useTimeline(eid)
  const gu = useGuests(eid)
  const tb = useTables(eid)
  const ts = useTasks(eid)
  const bu = useBudget(eid)
  const mo = useMood(eid)
  const pl = usePlaylist(eid)

  const cards = [
    { key: 'timeline',  label: 'Scaletta',   icon: CalendarClock, value: tl.data?.length ?? 0, hint: 'momenti' },
    { key: 'guests',    label: 'Invitati',   icon: Users, value: gu.data?.length ?? 0, hint: 'in lista' },
    { key: 'tables',    label: 'Tavoli',     icon: Table2, value: tb.data?.length ?? 0, hint: 'allestiti' },
    { key: 'checklist', label: 'Task',       icon: ListChecks, value: (ts.data ?? []).filter((t: any) => !t.done).length, hint: 'da fare' },
    { key: 'budget',    label: 'Budget',     icon: Wallet, value: (bu.data?.entries ?? []).length, hint: 'movimenti' },
    { key: 'mood',      label: 'Mood',       icon: Palette, value: mo.data?.length ?? 0, hint: 'reference' },
    { key: 'playlist',  label: 'Playlist',   icon: Music, value: pl.data?.length ?? 0, hint: 'brani' },
    { key: 'contract',  label: 'Contratto',  icon: FileSignature, value: wedding.quote ? 'pronto' : '—', hint: '' },
    { key: 'docs',      label: 'Documenti',  icon: FolderOpen, value: '—', hint: 'allegati' },
  ]

  const participants = (wedding.calendar_entry_participants ?? []) as any[]
  const requests = useChangeRequests(eid)
  const review = useReviewChangeRequest(eid)
  const pendingReqs = (requests.data ?? []).filter((r) => r.status === 'PENDING')

  async function reviewReq(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await review.mutateAsync({ id, status })
      toast.success(status === 'APPROVED' ? 'Richiesta approvata' : 'Richiesta rifiutata')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <button key={c.key} onClick={() => onTab(c.key)}
              className="surface surface-elev p-4 text-left hover:shadow-[var(--shadow-lift)] transition-shadow">
              <Icon size={18} className="text-[rgb(var(--gold-600))]" />
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mt-2">{c.label}</p>
              <p className="font-display text-2xl mt-0.5 tabular-nums">{c.value}</p>
              {c.hint && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">{c.hint}</p>}
            </button>
          )
        })}
      </div>

      {(pendingReqs.length > 0 || (requests.data ?? []).length > 0) && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg flex items-center gap-2">
              <MessageSquare size={16} /> Richieste dei clienti
              {pendingReqs.length > 0 && <Badge tone="amber">{pendingReqs.length} da gestire</Badge>}
            </h2>
          </div>
          {pendingReqs.length === 0 ? (
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessuna richiesta in attesa.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {pendingReqs.map((r) => (
                <li key={r.id} className="py-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone="sage">{entityLabel(r.entity_type)}</Badge>
                      <Badge tone="neutral">{r.action}</Badge>
                      <span className="text-xs text-[rgb(var(--fg-subtle))]">
                        {r.requester?.full_name ?? 'Cliente'} · {new Date(r.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-medium mt-1">{r.title}</p>
                    {r.description && <p className="text-sm text-[rgb(var(--fg-muted))] mt-0.5 whitespace-pre-wrap">{r.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => reviewReq(r.id, 'REJECTED')} disabled={review.isPending}>
                      <XIcon size={13} /> Rifiuta
                    </Button>
                    <Button variant="gold" size="sm" onClick={() => reviewReq(r.id, 'APPROVED')} disabled={review.isPending}>
                      <Check size={13} /> Approva
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="font-display text-lg mb-3">Dettagli evento</h2>
          <dl className="space-y-2 text-sm">
            <Row k="Cliente" v={wedding.client_name ?? '—'} />
            <Row k="Email" v={wedding.client_email ?? '—'} />
            <Row k="Data" v={new Date(wedding.date_from).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
            <Row k="Invitati" v={wedding.guest_count?.toString() ?? '—'} />
            <Row k="Tavoli" v={wedding.table_count?.toString() ?? '—'} />
            <Row k="Valore" v={`€ ${Number(wedding.value_amount ?? 0).toLocaleString('it-IT')}`} />
          </dl>
          {wedding.notes && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Note private</p>
              <p className="text-sm mt-1">{wedding.notes}</p>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-display text-lg mb-3">Fornitori coinvolti ({participants.length})</h2>
          {participants.length === 0 ? (
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessun fornitore agganciato ancora.</p>
          ) : (
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {participants.map((p) => (
                <li key={p.id} className="py-2 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{p.user?.business_name ?? p.user?.full_name}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">{p.user?.subrole} · {p.role_in_entry}</p>
                  </div>
                  <Link to={`/suppliers/${p.user?.id}`} className="text-xs text-[rgb(var(--fg-muted))] hover:underline">apri →</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {wedding.quote && (
          <Card className="lg:col-span-2 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-lg">Preventivo</h2>
              <Link to={`/quotes/${wedding.quote.id}`} className="text-sm text-[rgb(var(--fg-muted))] hover:underline">apri editor →</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <Row k="Stato" v={wedding.quote.status} />
              <Row k="Revisione" v={`v${wedding.quote.revision}`} />
              <Row k="Cliente" v={`€ ${Number(wedding.quote.total_client).toLocaleString('it-IT')}`} />
              <Row k="Costo" v={`€ ${Number(wedding.quote.total_cost ?? 0).toLocaleString('it-IT')}`} />
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[rgb(var(--fg-muted))]">{k}</dt>
      <dd className="font-medium text-right">{v}</dd>
    </div>
  )
}
