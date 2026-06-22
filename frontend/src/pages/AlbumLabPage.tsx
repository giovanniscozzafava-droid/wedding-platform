import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Package, Clock, CheckCircle2, Truck, XCircle, PauseCircle, Download, LogOut, ArrowLeft, Images, X } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { AlbumMockup } from '@/components/album/AlbumMockup'
import { coverSummary } from '@/components/album/albumCatalog'
import { useIsAlbumLab, useAlbumLabList, useAlbumLabMutations, exportAlbumZip, fetchAlbumSelection, type AlbumOrder, type LabMedia } from '@/hooks/useAlbumLab'

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
  const [detail, setDetail] = useState<AlbumOrder | null>(null)
  if (isLoading) return null
  if (!isLab) return (
    <div className="min-h-full grid place-items-center p-10">
      <Card className="max-w-md p-10 text-center"><Package className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" /><h2 className="font-display text-xl mb-1">Area stamperia</h2><p className="text-sm text-[rgb(var(--fg-muted))]">Accesso riservato ai laboratori di stampa album. Se sei una stamperia partner, chiedi l'abilitazione.</p></Card>
    </div>
  )
  const counts = (orders ?? []).reduce((a, o) => { a[o.status] = (a[o.status] || 0) + 1; return a }, {} as Record<string, number>)
  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <header className="border-b border-[rgb(var(--border))]" style={{ background: 'rgb(var(--bg-elevated))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-3 flex items-center justify-between">
          <span className="font-display text-lg inline-flex items-center gap-2"><Package size={18} /> FotoLab · Console stampa</span>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/login' }} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1.5 hover:text-[rgb(var(--fg))]"><LogOut size={15} /> Esci</button>
        </div>
      </header>
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Service piattaforma" title="Console stampa album"
          description="Tutti gli album inviati in stampa dai fotografi della piattaforma. Vedi la copertina, accetti, metti in produzione, spedisci o rifiuti — e ordini la coda di lavorazione." />
        <div className="flex flex-wrap gap-2 mb-5 text-xs">
          {Object.entries(STATUS).map(([k, s]) => <span key={k} className={`px-2.5 py-1 rounded-full ${s.cls}`}>{s.label}: {counts[k] || 0}</span>)}
        </div>
        {detail ? <OrderDetail o={detail} onBack={() => setDetail(null)} /> : (
          <div className="space-y-3">
            {(orders ?? []).map((o) => <OrderCard key={o.id} o={o} onOpen={() => setDetail(o)} />)}
            {(orders ?? []).length === 0 && <Card className="p-10 text-center text-[rgb(var(--fg-subtle))]">Nessun ordine in coda. Quando un fotografo invia un album in stampa comparirà qui.</Card>}
          </div>
        )}
      </div>
    </div>
  )
}

function OrderCard({ o, onOpen }: { o: AlbumOrder; onOpen: () => void }) {
  const mut = useAlbumLabMutations()
  const [reason, setReason] = useState(o.reject_reason || '')
  const [showReject, setShowReject] = useState(false)
  const [exp, setExp] = useState(false)
  const s = STATUS[o.status] ?? { label: o.status, cls: 'bg-stone-200 text-stone-600', icon: Package }
  async function set(status: string, rej?: string) { try { await mut.mutateAsync({ order_id: o.id, status, reason: rej ?? null }); toast.success('Aggiornato') } catch (e) { toast.error((e as Error).message) } }
  async function prio(delta: number) { try { await mut.mutateAsync({ order_id: o.id, queue: Math.max(0, o.queue_order + delta) }) } catch (e) { toast.error((e as Error).message) } }
  async function exportZip() { setExp(true); try { await exportAlbumZip(o.entry_id, o.couple_label || 'ordine'); toast.success('Export pronto (originali in ZIP)') } catch (e) { toast.error((e as Error).message) } finally { setExp(false) } }
  return (
    <Card className="p-4 flex flex-col sm:flex-row gap-4">
      <button onClick={onOpen} className="shrink-0 grid place-items-center gap-1 group" title="Apri la selezione">
        <AlbumMockup cover={o.cover} width={140} interactive={false} />
        <span className="text-[11px] text-[rgb(var(--gold-700))] inline-flex items-center gap-1 group-hover:underline"><Images size={12} /> Vedi selezione{o.selection_count ? ` (${o.selection_count})` : ''}</span>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h3 className="font-display text-lg">{o.couple_label || 'Album'}</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${s.cls}`}><s.icon size={12} /> {s.label}</span>
        </div>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Fotografo: <strong>{o.photographer}</strong></p>
        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{FMT[o.format_key] || o.format_key} · {o.pages} pagine · {o.copies} {o.copies === 1 ? 'copia' : 'copie'} · copertina {coverSummary(o.cover)}</p>
        {o.status === 'REJECTED' && o.reject_reason && <p className="text-xs text-[rgb(var(--rose-600))] mt-1">Motivo rifiuto: {o.reject_reason}</p>}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button size="sm" variant="gold" disabled={exp} onClick={exportZip}><Download size={14} /> {exp ? 'Esporto…' : 'Esporta originali'}</Button>
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

function OrderDetail({ o, onBack }: { o: AlbumOrder; onBack: () => void }) {
  const [media, setMedia] = useState<LabMedia[] | null>(null)
  const [box, setBox] = useState<LabMedia | null>(null)
  const [exp, setExp] = useState(false)
  useEffect(() => {
    let alive = true
    fetchAlbumSelection(o.entry_id).then((m) => alive && setMedia(m)).catch(() => alive && setMedia([]))
    return () => { alive = false }
  }, [o.entry_id])
  const thumb = (m: LabMedia, sz: number) => {
    const id = m.drive_file_id
    const real = id && !id.startsWith('demo-') && !id.startsWith('guest:')
    return real ? `https://drive.google.com/thumbnail?id=${id}&sz=w${sz}` : (m.thumbnail_link ?? '')
  }
  async function exportZip() { setExp(true); try { await exportAlbumZip(o.entry_id, o.couple_label || 'ordine'); toast.success('Export pronto (originali in ZIP)') } catch (e) { toast.error((e as Error).message) } finally { setExp(false) } }
  return (
    <div>
      <button onClick={onBack} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))]"><ArrowLeft size={16} /> Torna agli ordini</button>
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="shrink-0 grid place-items-center"><AlbumMockup cover={o.cover} width={160} interactive={false} /></div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-2xl">{o.couple_label || 'Album'}</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Fotografo: <strong>{o.photographer}</strong></p>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{FMT[o.format_key] || o.format_key} · {o.pages} pagine · {o.copies} {o.copies === 1 ? 'copia' : 'copie'} · copertina {coverSummary(o.cover)}</p>
          <Button size="sm" variant="gold" className="mt-3" disabled={exp} onClick={exportZip}><Download size={14} /> {exp ? 'Esporto…' : 'Esporta originali (ZIP)'}</Button>
        </div>
      </div>
      <h3 className="font-display text-lg mb-2 inline-flex items-center gap-2"><Images size={18} /> Selezione {media ? `(${media.length})` : ''}</h3>
      {media === null ? <p className="text-sm text-[rgb(var(--fg-subtle))]">Carico la selezione…</p>
        : media.length === 0 ? <Card className="p-8 text-center text-[rgb(var(--fg-subtle))]">Nessuna foto selezionata, o il fotografo non ha collegato Google Drive.</Card>
        : <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2">
            {media.map((m, i) => (
              <button key={i} onClick={() => setBox(m)} className="aspect-square overflow-hidden rounded-lg bg-[rgb(var(--bg-sunken))]">
                <img src={thumb(m, 400)} loading="lazy" alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </button>
            ))}
          </div>}
      {box && (
        <div className="fixed inset-0 z-50 bg-black/85 grid place-items-center p-4" onClick={() => setBox(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setBox(null)}><X size={28} /></button>
          <img src={thumb(box, 2000)} alt="" className="max-h-[90vh] max-w-full object-contain rounded" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
