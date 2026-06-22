import { useState } from 'react'
import { toast } from 'sonner'
import { Package, Clock, CheckCircle2, Truck, XCircle, PauseCircle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlbumMockup } from '@/components/album/AlbumMockup'
import { useIsAlbumLab, useAlbumLabList, useAlbumLabMutations, type AlbumOrder } from '@/hooks/useAlbumLab'

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  NEW: { label: 'Nuovo', cls: 'bg-blue-100 text-blue-700', icon: Clock },
  ACCEPTED: { label: 'Accettato', cls: 'bg-violet-100 text-violet-700', icon: CheckCircle2 },
  IN_PRODUCTION: { label: 'In produzione', cls: 'bg-amber-100 text-amber-700', icon: Package },
  SHIPPED: { label: 'Spedito', cls: 'bg-emerald-100 text-emerald-700', icon: Truck },
  ON_HOLD: { label: 'In attesa', cls: 'bg-stone-200 text-stone-600', icon: PauseCircle },
  REJECTED: { label: 'Rifiutato', cls: 'bg-rose-100 text-rose-700', icon: XCircle },
}
const FMT: Record<string, string> = { SQ_30: '30×30 quadrato', SQ_25: '25×25 quadrato', LAND_35: '35×25 orizzontale', PORT_25: '25×35 verticale' }

export default function AlbumLabPage() {
  const { data: isLab, isLoading } = useIsAlbumLab()
  const { data: orders } = useAlbumLabList()
  if (isLoading) return null
  if (!isLab) return (
    <div className="min-h-full grid place-items-center p-10">
      <Card className="max-w-md p-10 text-center"><Package className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" /><h2 className="font-display text-xl mb-1">Area stamperia</h2><p className="text-sm text-[rgb(var(--fg-muted))]">Accesso riservato ai laboratori di stampa album. Se sei una stamperia partner, chiedi l'abilitazione.</p></Card>
    </div>
  )
  const counts = (orders ?? []).reduce((a, o) => { a[o.status] = (a[o.status] || 0) + 1; return a }, {} as Record<string, number>)
  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Stamperia album" title="Ordini di stampa"
          description="Tutti gli album inviati in stampa dai fotografi della piattaforma. Vedi la copertina, accetti, metti in produzione, spedisci o rifiuti — e ordini la coda di lavorazione." />
        <div className="flex flex-wrap gap-2 mb-5 text-xs">
          {Object.entries(STATUS).map(([k, s]) => <span key={k} className={`px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}: {counts[k] || 0}</span>)}
        </div>
        <div className="space-y-3">
          {(orders ?? []).map((o) => <OrderCard key={o.id} o={o} />)}
          {(orders ?? []).length === 0 && <Card className="p-10 text-center text-[rgb(var(--fg-subtle))]">Nessun ordine in coda. Quando un fotografo invia un album in stampa comparirà qui.</Card>}
        </div>
      </div>
    </div>
  )
}

function OrderCard({ o }: { o: AlbumOrder }) {
  const mut = useAlbumLabMutations()
  const [reason, setReason] = useState(o.reject_reason || '')
  const [showReject, setShowReject] = useState(false)
  const s = STATUS[o.status] ?? { label: o.status, cls: 'bg-stone-200 text-stone-600', icon: Package }
  async function set(status: string, rej?: string) { try { await mut.mutateAsync({ order_id: o.id, status, reason: rej ?? null }); toast.success('Aggiornato') } catch (e) { toast.error((e as Error).message) } }
  async function prio(delta: number) { try { await mut.mutateAsync({ order_id: o.id, queue: Math.max(0, o.queue_order + delta) }) } catch (e) { toast.error((e as Error).message) } }
  return (
    <Card className="p-4 flex flex-col sm:flex-row gap-4">
      <div className="shrink-0 grid place-items-center"><AlbumMockup cover={o.cover} width={140} interactive={false} /></div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-display text-lg">{o.couple_label || 'Album'}</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${s.cls}`}><s.icon size={12} /> {s.label}</span>
        </div>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Fotografo: <strong>{o.photographer}</strong></p>
        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{FMT[o.format_key] || o.format_key} · {o.pages} pagine · {o.copies} {o.copies === 1 ? 'copia' : 'copie'} · copertina {o.cover?.fabric || '—'}{o.cover?.model ? ` (${o.cover.model})` : ''}</p>
        {o.status === 'REJECTED' && o.reject_reason && <p className="text-xs text-[rgb(var(--rose-600))] mt-1">Motivo rifiuto: {o.reject_reason}</p>}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {o.status !== 'ACCEPTED' && o.status !== 'IN_PRODUCTION' && o.status !== 'SHIPPED' && <Button size="sm" variant="outline" onClick={() => set('ACCEPTED')}>Accetta</Button>}
          {(o.status === 'ACCEPTED' || o.status === 'ON_HOLD' || o.status === 'NEW') && <Button size="sm" variant="outline" onClick={() => set('IN_PRODUCTION')}>In produzione</Button>}
          {o.status === 'IN_PRODUCTION' && <Button size="sm" variant="gold" onClick={() => set('SHIPPED')}>Segna spedito</Button>}
          {o.status !== 'ON_HOLD' && o.status !== 'SHIPPED' && <Button size="sm" variant="outline" onClick={() => set('ON_HOLD')}>Metti in attesa</Button>}
          {o.status !== 'REJECTED' && <Button size="sm" variant="outline" className="!text-[rgb(var(--rose-600))]" onClick={() => setShowReject((v) => !v)}>Rifiuta</Button>}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-[rgb(var(--fg-subtle))]">priorità {o.queue_order}
            <button onClick={() => prio(-1)} className="px-1.5 border border-[rgb(var(--border))] rounded">↑</button>
            <button onClick={() => prio(1)} className="px-1.5 border border-[rgb(var(--border))] rounded">↓</button>
          </span>
        </div>
        {showReject && (
          <div className="flex items-end gap-2 mt-2">
            <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1">Motivo del rifiuto<Input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-0.5" placeholder="Es. risoluzione copertina troppo bassa" /></label>
            <Button size="sm" className="!bg-[rgb(var(--rose-600))]" onClick={() => { set('REJECTED', reason); setShowReject(false) }}>Conferma rifiuto</Button>
          </div>
        )}
      </div>
    </Card>
  )
}
