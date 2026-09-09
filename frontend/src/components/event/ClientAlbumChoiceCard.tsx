import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, Copy, FileText, ImageIcon, Loader2, MapPin, ExternalLink, ChevronDown } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { euroA } from '@/lib/albumPricing'
import { getCatalogForEntry, catalogPublicUrl } from '@/hooks/useAlbumCatalog'
import { loadPdf, renderPdfPageDataUrl } from '@/lib/pdf'

// Dentro l'EVENTO, per il fotografo: LA scelta di questo cliente — una sola.
// In ordine di forza: la commessa firmata dal catalogo (modello, composizione, conto,
// foto di copertina, PDF); altrimenti la puntina che il cliente ha CONFERMATO sul
// catalogo (tavola, materiale, colore, logo, foto in copertina, pagine). Le altre
// puntine aperte stanno sotto, chiuse. Il catalogo in sé si gestisce da Strumenti.

type Commission = {
  id: string; created_at: string; status: string
  cover: {
    source?: string; model_label?: string; page?: number | null
    specs?: { format?: string; size?: string; pages?: number; box?: string; finishes?: string[]; note?: string }
    signed_by?: string; signed_at?: string; commission_pdf_path?: string | null
    psd_path?: string | null; mockup_path?: string | null
    composition?: {
      lines?: string[]
      coverPhoto?: { url?: string; label?: string | null } | null
      pricing?: { inQuote?: number | null; includedPages?: number | null; additions?: { label: string; amount: number; hint?: string }[]; difference?: number; remaining?: number }
    }
  }
}
type Pin = {
  id: string; page: number; comment: string | null; material: string | null; color: string | null
  logo: string | null; cover_photo: boolean | null; pages: number | null; status: string; created_at: string
}

export function ClientAlbumChoiceCard({ entryId }: { entryId: string }) {
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<Commission[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [thumb, setThumb] = useState<string | null>(null)
  const [showOthers, setShowOthers] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [{ data: o }, { data: p }] = await Promise.all([
          (supabase.from as any)('album_orders').select('id, created_at, status, cover').eq('entry_id', entryId).order('created_at', { ascending: false }),
          (supabase.from as any)('album_pins').select('id, page, comment, material, color, logo, cover_photo, pages, status, created_at').eq('entry_id', entryId).order('created_at', { ascending: false }),
        ])
        if (!alive) return
        setOrders(((o ?? []) as Commission[]).filter((x) => x.cover?.source === 'pdf_catalog'))
        setPins((p ?? []) as Pin[])
      } catch { /* la card resta vuota */ } finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [entryId])

  // La scelta più recente vince: se il cliente ha confermato una puntina DOPO l'ultima
  // commessa firmata, è quella la sua scelta di oggi (e viceversa).
  const chosenPinAll = pins.find((p) => p.status === 'CHOSEN') ?? null
  const lastOrder = orders[0] ?? null
  const pinNewer = !!chosenPinAll && (!lastOrder || new Date(chosenPinAll.created_at) > new Date(lastOrder.created_at))
  const last = pinNewer ? null : lastOrder
  const chosenPin = pinNewer ? chosenPinAll : (lastOrder ? null : chosenPinAll)
  const others = pins.filter((p) => p.id !== chosenPin?.id)
  // la tavola scelta, in miniatura: dal PDF del catalogo del fotografo (pagina = tavola)
  const sheet = last?.cover?.page ?? chosenPin?.page ?? null
  useEffect(() => {
    let alive = true
    if (!sheet) { setThumb(null); return }
    void (async () => {
      try {
        const r = await getCatalogForEntry(entryId)
        if (!r || !alive) return
        const doc = await loadPdf(catalogPublicUrl(r.catalog.pdf_path))
        const url = await renderPdfPageDataUrl(doc, sheet, 720, 0.8)
        if (alive) setThumb(url)
      } catch { /* niente miniatura */ }
    })()
    return () => { alive = false }
  }, [entryId, sheet])

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

  const comp = last?.cover?.composition
  const pricing = comp?.pricing
  const pinLines = chosenPin ? [
    chosenPin.material ? `Materiale: ${chosenPin.material}` : null,
    chosenPin.color ? `Colore: ${chosenPin.color}` : null,
    chosenPin.logo ? `Logo / personalizzazione: ${chosenPin.logo}` : null,
    chosenPin.cover_photo != null ? `Foto in copertina: ${chosenPin.cover_photo ? 'sì' : 'no'}` : null,
    chosenPin.pages ? `Pagine: ${chosenPin.pages}` : null,
  ].filter((x): x is string => !!x) : []

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium flex items-center gap-2"><BookOpen size={16} className="text-[rgb(var(--gold-600))] shrink-0" /> Copertina scelta dal cliente</p>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Una scelta sola, per questo evento: quella firmata dal catalogo o quella confermata con la puntina.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => void copyLink()} title={link}><Copy size={14} /> Copia link per il cliente</Button>
          <Link to={chosenPin && !last ? `/scegli-album/${entryId}?pin=${chosenPin.id}` : `/scegli-album/${entryId}`}><Button variant="outline" size="sm" title="Apri la scelta come la vede il cliente"><ExternalLink size={14} /> Apri la scelta</Button></Link>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-[rgb(var(--fg-subtle))] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Carico…</p>
      ) : !last && !chosenPin ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Il cliente non ha ancora scelto.{others.length > 0 ? ` Ha lasciato ${others.length} ${others.length === 1 ? 'puntina' : 'puntine'} sul catalogo senza confermarne una.` : ' Mandagli il link: sfoglia, tocca il modello, compone la copertina e firma.'}
        </p>
      ) : (
        <div className="rounded-xl border border-[rgb(var(--border))] p-3">
          <div className="grid sm:grid-cols-[220px_1fr] gap-4">
            {/* la tavola scelta */}
            <div className="space-y-2">
              {thumb
                ? <img src={thumb} alt={`Tavola ${sheet} del catalogo`} className="w-full rounded-lg border border-[rgb(var(--border))]" />
                : <div className="w-full aspect-[2.7/1] rounded-lg bg-[rgb(var(--bg-sunken))] grid place-items-center text-[11px] text-[rgb(var(--fg-subtle))]">tavola {sheet}</div>}
              {comp?.coverPhoto?.url && (
                <div className="flex items-center gap-2">
                  <img src={comp.coverPhoto.url} alt="Foto scelta per la copertina" className="h-16 w-16 rounded-lg object-cover border border-[rgb(var(--border))]" />
                  <span className="text-[11px] text-[rgb(var(--fg-muted))]">Foto in copertina{comp.coverPhoto.label ? ` · ${comp.coverPhoto.label}` : ''}</span>
                </div>
              )}
            </div>
            {/* la scelta, riga per riga */}
            <div className="min-w-0 space-y-2">
              {last ? (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Commessa firmata</p>
                    <p className="font-display text-lg leading-tight">{last.cover.model_label ?? 'Modello dal catalogo'}{last.cover.page ? <span className="text-xs text-[rgb(var(--fg-subtle))] font-sans"> · tavola {last.cover.page}</span> : null}</p>
                    <p className="text-[12px] text-[rgb(var(--fg-muted))] flex items-center gap-1"><Check size={12} className="text-[rgb(var(--emerald-700))]" /> Firmata da {last.cover.signed_by ?? 'cliente'}{last.cover.signed_at ? ` il ${new Date(last.cover.signed_at).toLocaleDateString('it-IT')}` : ''}</p>
                  </div>
                  <div className="text-[13px] space-y-0.5">
                    {(comp?.lines ?? []).map((l) => <p key={l}>{l}</p>)}
                    {!comp?.lines?.length && last.cover.specs && (
                      <p className="text-[rgb(var(--fg-muted))]">{[last.cover.specs.size, last.cover.specs.pages ? `${last.cover.specs.pages} pagine` : null, last.cover.specs.box && last.cover.specs.box !== 'nessuno' ? `box ${last.cover.specs.box}` : null].filter(Boolean).join(' · ')}</p>
                    )}
                    {last.cover.specs?.note && <p className="text-[12px] text-[rgb(var(--fg-muted))] whitespace-pre-wrap pt-1">{last.cover.specs.note}</p>}
                  </div>
                  {pricing && (pricing.inQuote != null || pricing.additions?.length) && (
                    <div className="rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2 text-[12px] space-y-0.5">
                      {pricing.inQuote != null && <div className="flex justify-between gap-3"><span>Nel preventivo{pricing.includedPages ? ` · ${pricing.includedPages} pagine` : ''}</span><span>{euroA(pricing.inQuote)}</span></div>}
                      {(pricing.additions ?? []).map((a, i) => <div key={i} className="flex justify-between gap-3 text-[rgb(var(--fg-muted))]"><span className="truncate">+ {a.label}</span><span className="shrink-0">{a.amount > 0 ? euroA(a.amount) : 'incluso'}</span></div>)}
                      <div className="flex justify-between gap-3 font-medium border-t border-[rgb(var(--border))] pt-1 mt-1"><span>{pricing.inQuote != null ? 'Differenza' : 'Prezzo album'}</span><span>{euroA(pricing.difference ?? 0)}</span></div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {last.cover.commission_pdf_path && <Button variant="gold" size="sm" onClick={() => void openPdf(last.cover.commission_pdf_path!)}><FileText size={14} /> Commessa PDF</Button>}
                    {last.cover.psd_path && <Button variant="outline" size="sm" onClick={() => void openPdf(last.cover.psd_path!)} title="Copertina a livelli, 300 dpi, con le posizioni: da girare all'azienda insieme alle tavole"><FileText size={14} /> PSD copertina</Button>}
                    {last.cover.mockup_path && <Button variant="outline" size="sm" onClick={() => void openPdf(last.cover.mockup_path!)}><ImageIcon size={14} /> Mockup 3D</Button>}
                    {orders.length > 1 && <span className="text-[11px] text-[rgb(var(--fg-subtle))]">{orders.length - 1} {orders.length === 2 ? 'versione precedente' : 'versioni precedenti'}</span>}
                  </div>
                </>
              ) : chosenPin && (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Scelta confermata sul catalogo</p>
                    <p className="font-display text-lg leading-tight">{chosenPin.comment ? chosenPin.comment : `Modello alla tavola ${chosenPin.page}`}{chosenPin.comment ? <span className="text-xs text-[rgb(var(--fg-subtle))] font-sans"> · tavola {chosenPin.page}</span> : null}</p>
                    <p className="text-[12px] text-[rgb(var(--fg-muted))] flex items-center gap-1"><Check size={12} className="text-[rgb(var(--emerald-700))]" /> Confermata il {new Date(chosenPin.created_at).toLocaleDateString('it-IT')} · non ancora firmata come commessa</p>
                  </div>
                  <div className="text-[13px] space-y-0.5">
                    {pinLines.map((l) => <p key={l}>{l}</p>)}
                    {pinLines.length === 0 && <p className="text-[rgb(var(--fg-muted))]">Solo la tavola: materiale, colore e logo non indicati.</p>}
                  </div>
                  <div className="pt-1">
                    <Link to={`/scegli-album/${entryId}?pin=${chosenPin.id}`}><Button variant="outline" size="sm"><MapPin size={14} /> Apri la puntina e la conversazione</Button></Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowOthers((v) => !v)} className="text-[12px] text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 hover:text-[rgb(var(--fg))]">
            <ChevronDown size={13} className={showOthers ? 'rotate-180 transition' : 'transition'} /> {others.length} {others.length === 1 ? 'altra puntina' : 'altre puntine'} sul catalogo
          </button>
          {showOthers && (
            <ul className="mt-1.5 space-y-1">
              {others.map((p) => (
                <li key={p.id} className="text-[13px] flex items-start justify-between gap-2">
                  <span className="min-w-0"><span className="text-[rgb(var(--fg-muted))]">tavola {p.page}</span>{p.comment ? ` · ${p.comment}` : ''}{p.material ? ` · ${p.material}` : ''}{p.color ? ` · ${p.color}` : ''}<span className="text-[rgb(var(--fg-subtle))]"> · {new Date(p.created_at).toLocaleDateString('it-IT')}</span></span>
                  <Link to={`/scegli-album/${entryId}?pin=${p.id}`} className="text-[12px] text-[rgb(var(--gold-700))] hover:underline shrink-0">apri</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}

export default ClientAlbumChoiceCard
