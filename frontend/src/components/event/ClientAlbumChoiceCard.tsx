import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Copy, FileText, Loader2, MapPin, ExternalLink } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { euroA } from '@/lib/albumPricing'

// Dentro l'EVENTO, per il fotografo: la scelta album di QUESTO cliente e basta —
// la commessa firmata dal catalogo (modello, composizione, conto, foto di copertina,
// PDF) e le puntine che ha lasciato sulle pagine. Il catalogo in sé (PDF, modelli,
// prezzi, opzioni) si gestisce da Strumenti, non da qui.

type Commission = {
  id: string; created_at: string; status: string
  cover: {
    source?: string; model_label?: string; page?: number | null
    specs?: { format?: string; size?: string; pages?: number; box?: string; finishes?: string[]; note?: string }
    signed_by?: string; signed_at?: string; commission_pdf_path?: string | null
    composition?: {
      lines?: string[]
      coverPhoto?: { url?: string; label?: string | null } | null
      pricing?: { inQuote?: number | null; includedPages?: number | null; additions?: { label: string; amount: number; hint?: string }[]; difference?: number; remaining?: number }
    }
  }
}
type Pin = { id: string; page: number; comment: string | null; material: string | null; color: string | null; status: string; created_at: string }

export function ClientAlbumChoiceCard({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Commission[]>([])
  const [pins, setPins] = useState<Pin[]>([])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [{ data: o }, { data: p }] = await Promise.all([
          (supabase.from as any)('album_orders').select('id, created_at, status, cover').eq('entry_id', entryId).order('created_at', { ascending: false }),
          (supabase.from as any)('album_pins').select('id, page, comment, material, color, status, created_at').eq('entry_id', entryId).order('created_at', { ascending: false }),
        ])
        if (!alive) return
        setOrders(((o ?? []) as Commission[]).filter((x) => x.cover?.source === 'pdf_catalog'))
        setPins((p ?? []) as Pin[])
      } catch { /* la card resta vuota */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [entryId])

  const link = `${window.location.origin}/scegli-album/${entryId}`
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); toast.success('Link copiato: mandalo al cliente per la scelta dal catalogo.') } catch { toast.error('Copia non riuscita') }
  }
  async function openPdf(path: string) {
    try {
      const { data, error } = await supabase.storage.from('album-commissions').createSignedUrl(path, 3600)
      if (error) throw error
      window.open(data.signedUrl, '_blank', 'noopener')
    } catch (e) { toast.error((e as Error).message || 'PDF non disponibile') }
  }

  const last = orders[0]
  const comp = last?.cover?.composition
  const pricing = comp?.pricing
  const open = pins.filter((p) => p.status !== 'CHOSEN')

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium flex items-center gap-2"><BookOpen size={16} className="text-[rgb(var(--gold-600))] shrink-0" /> Scelta album del cliente</p>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Solo questo evento: il modello scelto dal catalogo, la composizione, il conto e le puntine lasciate sulle pagine.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => void copyLink()} title={link}><Copy size={14} /> Copia link per il cliente</Button>
          <Link to={`/scegli-album/${entryId}`}><Button variant="outline" size="sm" title="Apri la scelta come la vede il cliente"><ExternalLink size={14} /> Apri la scelta</Button></Link>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[rgb(var(--fg-subtle))] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Carico…</p>
      ) : !last && pins.length === 0 ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">Il cliente non ha ancora scelto dal catalogo. Mandagli il link: sfoglia, tocca il modello, compone la copertina e firma.</p>
      ) : (
        <>
          {last && (
            <div className="rounded-xl border border-[rgb(var(--border))] p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Commessa firmata</p>
                  <p className="font-display text-lg leading-tight">{last.cover.model_label ?? 'Modello dal catalogo'}{last.cover.page ? <span className="text-xs text-[rgb(var(--fg-subtle))] font-sans"> · tavola {last.cover.page}</span> : null}</p>
                  <p className="text-[12px] text-[rgb(var(--fg-muted))] flex items-center gap-1"><Check size={12} className="text-[rgb(var(--emerald-700))]" /> Firmata da {last.cover.signed_by ?? 'cliente'}{last.cover.signed_at ? ` il ${new Date(last.cover.signed_at).toLocaleDateString('it-IT')}` : ''}{orders.length > 1 ? ` · ${orders.length - 1} ${orders.length === 2 ? 'versione precedente' : 'versioni precedenti'}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {last.cover.commission_pdf_path && <Button variant="gold" size="sm" onClick={() => void openPdf(last.cover.commission_pdf_path!)}><FileText size={14} /> Commessa PDF</Button>}
                </div>
              </div>
              <div className="grid sm:grid-cols-[1fr_auto] gap-3">
                <div className="text-[13px] space-y-0.5">
                  {(comp?.lines ?? []).map((l) => <p key={l} className="text-[rgb(var(--fg))]">{l}</p>)}
                  {!comp?.lines?.length && last.cover.specs && (
                    <p className="text-[rgb(var(--fg-muted))]">{[last.cover.specs.size, last.cover.specs.pages ? `${last.cover.specs.pages} pagine` : null, last.cover.specs.box && last.cover.specs.box !== 'nessuno' ? `box ${last.cover.specs.box}` : null].filter(Boolean).join(' · ')}</p>
                  )}
                  {last.cover.specs?.note && <p className="text-[12px] text-[rgb(var(--fg-muted))] whitespace-pre-wrap pt-1">{last.cover.specs.note}</p>}
                </div>
                {comp?.coverPhoto?.url && <img src={comp.coverPhoto.url} alt="Foto scelta per la copertina" className="h-24 w-24 rounded-lg object-cover border border-[rgb(var(--border))]" />}
              </div>
              {pricing && (pricing.inQuote != null || pricing.additions?.length) && (
                <div className="rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2 text-[12px] space-y-0.5">
                  {pricing.inQuote != null && <div className="flex justify-between gap-3"><span>Nel preventivo{pricing.includedPages ? ` · ${pricing.includedPages} pagine` : ''}</span><span>{euroA(pricing.inQuote)}</span></div>}
                  {(pricing.additions ?? []).map((a, i) => <div key={i} className="flex justify-between gap-3 text-[rgb(var(--fg-muted))]"><span className="truncate">+ {a.label}</span><span className="shrink-0">{a.amount > 0 ? euroA(a.amount) : 'incluso'}</span></div>)}
                  <div className="flex justify-between gap-3 font-medium border-t border-[rgb(var(--border))] pt-1 mt-1"><span>{pricing.inQuote != null ? 'Differenza' : 'Prezzo album'}</span><span>{euroA(pricing.difference ?? 0)}</span></div>
                  {pricing.remaining != null && <div className="flex justify-between gap-3"><span>Rimanenza alla consegna</span><span>{euroA(pricing.remaining)}</span></div>}
                </div>
              )}
            </div>
          )}

          {pins.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1 flex items-center gap-1"><MapPin size={12} /> Puntine del cliente sul catalogo · {open.length} aperte</p>
              <ul className="space-y-1">
                {pins.slice(0, 8).map((p) => (
                  <li key={p.id} className="text-[13px] flex items-start justify-between gap-2">
                    <span className="min-w-0"><span className="text-[rgb(var(--fg-muted))]">tavola {p.page}</span>{p.comment ? ` · ${p.comment}` : ''}{p.material ? ` · ${p.material}` : ''}{p.color ? ` · ${p.color}` : ''}{p.status === 'CHOSEN' ? <span className="text-[rgb(var(--emerald-700))]"> · scelto</span> : null}</span>
                    <Link to={`/scegli-album/${entryId}?pin=${p.id}`} className="text-[12px] text-[rgb(var(--gold-700))] hover:underline shrink-0">apri</Link>
                  </li>
                ))}
                {pins.length > 8 && <li className="text-[12px] text-[rgb(var(--fg-subtle))]">…e altre {pins.length - 8}: aprile dalla scelta.</li>}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default ClientAlbumChoiceCard
