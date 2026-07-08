import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, Download, Loader2, FileText, Package } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getFormat } from '@/lib/albumFormats'
import { modelLabel, materialLabel, colorLabel, boxLabel, sizeByKey, FINISHES, type Cover } from '@/components/album/albumCatalog'

type Commission = {
  order: {
    format_key: string; pages: number; copies: number; cover: Cover
    couple_label: string | null; notes: string | null; file_link: string | null
    status: string; created_at: string
  }
  photographer: { business_name: string | null; full_name: string | null; phone: string | null; email: string | null; logo: string | null; color: string | null }
  selection_count: number
  event_date: string | null
}

const fmtDate = (s: string | null) => { if (!s) return null; const d = new Date(s); return Number.isNaN(+d) ? null : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) }

// Riga specifica: etichetta + valore, saltata se vuota.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '' || value === '—') return null
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-black/5 last:border-0">
      <span className="text-[13px] uppercase tracking-wide text-neutral-500">{label}</span>
      <span className="text-[15px] text-neutral-900 text-right font-medium">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6 break-inside-avoid">
      <h2 className="font-display text-lg text-neutral-900 mb-2">{title}</h2>
      {children}
    </section>
  )
}

export default function CommissionPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Commission | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [dl, setDl] = useState(false)

  // Download dei file (come un WeTransfer, poggia sul Drive del fotografo): il token risolve la
  // commissione, l'edge function zippa la selezione dal Drive dell'owner e la restituisce.
  async function downloadFiles(size: 'original' | 'web' = 'original') {
    if (!token || dl) return
    setDl(true)
    try {
      const base = import.meta.env.VITE_SUPABASE_URL
      const anon = import.meta.env.VITE_SUPABASE_ANON_KEY
      const r = await fetch(`${base}/functions/v1/album-commission-zip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: anon, Authorization: `Bearer ${anon}` },
        body: JSON.stringify({ token, size }),
      })
      if (!r.ok) {
        const b = await r.json().catch(() => ({}))
        throw new Error(b?.error === 'no_selection' ? 'Nessun file selezionato' : b?.error === 'empty' ? 'File non scaricabili (Drive non collegato dal fotografo)' : 'Download non riuscito')
      }
      const blob = await r.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `file-album.zip`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } catch (e) { alert((e as Error).message) }
    finally { setDl(false) }
  }

  useEffect(() => {
    (async () => {
      if (!token) { setErr('Link non valido'); setLoading(false); return }
      try {
        const { data: d, error } = await (supabase.rpc as any)('album_commission_by_token', { p_token: token })
        const res = d as (Commission & { ok?: boolean; error?: string }) | null
        if (error || !res || res.error) { setErr(res?.error === 'not_found' ? 'Commissione non trovata (link revocato o errato)' : 'Impossibile aprire la commissione'); return }
        setData(res)
      } catch { setErr('Errore di rete') }
      finally { setLoading(false) }
    })()
  }, [token])

  if (loading) return <div className="min-h-screen grid place-items-center bg-neutral-100"><Loader2 className="animate-spin text-neutral-400" size={28} /></div>
  if (err || !data) return (
    <div className="min-h-screen grid place-items-center bg-neutral-100 px-6">
      <div className="text-center"><Package size={40} className="mx-auto text-neutral-300" /><p className="mt-3 text-neutral-700">{err ?? 'Commissione non disponibile'}</p></div>
    </div>
  )

  const { order, photographer, selection_count, event_date } = data
  const c = order.cover ?? {}
  const fmt = getFormat(order.format_key)
  const coverSize = sizeByKey(c.sizeKey)?.label
  const finishes = (c.finishes ?? []).map((k) => FINISHES.find((f) => f.key === k)?.label ?? k).filter(Boolean)
  const studio = photographer.business_name || photographer.full_name || 'Studio fotografico'
  const accent = photographer.color || '#1A2E4F'

  return (
    <div className="min-h-screen bg-neutral-100 py-6 sm:py-10 print:bg-white print:py-0">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* barra azioni (non stampata) */}
        <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
          <span className="text-xs text-neutral-500">Copia commissione · sola lettura</span>
          <div className="flex items-center gap-2">
            {order.file_link && (
              <a href={order.file_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg text-white" style={{ backgroundColor: accent }}>
                <Download size={15} /> Scarica le tavole
              </a>
            )}
            {selection_count > 0 && (
              <button onClick={() => void downloadFiles('original')} disabled={dl}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-60">
                {dl ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {dl ? 'ZIP…' : 'Foto selezionate'}
              </button>
            )}
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50">
              <Printer size={15} /> Stampa
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {/* intestazione fotografo */}
          <div className="rounded-2xl bg-white border border-black/10 p-5 sm:p-6 flex items-center gap-4">
            {photographer.logo
              ? <img src={photographer.logo} alt="" className="h-14 w-14 rounded-full object-cover border border-black/10" />
              : <div className="h-14 w-14 rounded-full grid place-items-center text-white font-display text-xl" style={{ backgroundColor: accent }}>{studio.slice(0, 1)}</div>}
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-400">Copia commissione album</p>
              <h1 className="font-display text-2xl text-neutral-900 truncate">{studio}</h1>
              <p className="text-sm text-neutral-500">{[photographer.phone, photographer.email].filter(Boolean).join(' · ')}</p>
            </div>
          </div>

          <Section title="Evento">
            <Row label="Cliente" value={order.couple_label} />
            <Row label="Data evento" value={fmtDate(event_date)} />
            <Row label="Foto selezionate dai clienti" value={selection_count > 0 ? `${selection_count}` : null} />
            <Row label="Commissione creata il" value={fmtDate(order.created_at)} />
          </Section>

          <Section title="Album">
            <Row label="Formato" value={fmt.label.replace(/ · tavola.*/, '')} />
            <Row label="Pagine" value={order.pages > 0 ? `${order.pages}` : null} />
            <Row label="Copie" value={`${order.copies}`} />
            <Row label="Blocco interno" value={c.blockType === 'bookflat' ? 'Book flat (cartoncino)' : c.blockType === 'photo' ? 'Stampa foto (LUX)' : null} />
          </Section>

          {(c.model || c.fabric || (c.box && c.box !== 'nessuno') || c.parents || finishes.length || c.title || c.subtitle || c.monogram || c.photo_url || coverSize) && (
          <Section title="Copertina">
            <Row label="Modello" value={c.model ? modelLabel(c.model) : null} />
            <Row label="Misura copertina" value={coverSize} />
            <Row label="Materiale" value={c.fabric ? materialLabel(c.fabric) : null} />
            <Row label="Colore" value={c.fabric || c.colorKey ? colorLabel(c) : null} />
            <Row label="Box / custodia" value={c.box && c.box !== 'nessuno' ? boxLabel(c.box) : null} />
            <Row label="Album genitori" value={c.parents ? 'Sì (2 mini)' : null} />
            <Row label="Rifiniture" value={finishes.length ? finishes.join(', ') : null} />
            <Row label="Titolo in copertina" value={c.title} />
            <Row label="Sottotitolo" value={c.subtitle} />
            <Row label="Iniziali / monogramma" value={c.monogram} />
            {c.photo_url && (
              <div className="pt-3">
                <p className="text-[13px] uppercase tracking-wide text-neutral-500 mb-1.5">Foto in copertina</p>
                <img src={c.photo_url} alt="Foto copertina" className="max-h-48 rounded-lg border border-black/10" />
              </div>
            )}
          </Section>
          )}

          {order.notes && (
            <Section title="Note per la stampa">
              <p className="text-[15px] text-neutral-800 whitespace-pre-wrap">{order.notes}</p>
            </Section>
          )}

          {order.file_link && (
            <a href={order.file_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-2xl border border-dashed border-black/20 bg-white p-4 hover:bg-neutral-50 print:hidden">
              <FileText size={18} style={{ color: accent }} />
              <span className="text-sm text-neutral-700">Tavole dell'album da stampare: <span className="underline">scarica dal Drive</span></span>
            </a>
          )}

          <p className="text-center text-[11px] text-neutral-400 pt-2">Generato con Planfully · scheda di sola lettura per la stampa</p>
        </div>
      </div>
    </div>
  )
}
