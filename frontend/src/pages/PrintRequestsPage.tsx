import { useEffect, useState } from 'react'
import { Printer, Mail, Phone, MessageCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { PRODUCT_BY_KEY } from '@/lib/printCatalog'

type Req = {
  id: string; created_at: string; entry_id: string | null; photo_thumb: string | null
  product_key: string; format_key: string; buyer_name: string; buyer_email: string
  buyer_phone: string | null; note: string | null; status: string
}

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  NUOVA: { label: 'Nuova', bg: 'rgb(var(--gold-100))', fg: 'rgb(var(--gold-700))' },
  IN_CORSO: { label: 'In corso', bg: 'rgb(var(--sky-100,224_242_254))', fg: 'rgb(var(--sky-700,3_105_161))' },
  EVASA: { label: 'Evasa', bg: 'rgb(var(--emerald-100))', fg: 'rgb(var(--emerald-700))' },
}

export default function PrintRequestsPage() {
  const [rows, setRows] = useState<Req[] | null>(null)

  async function load() {
    const { data } = await (supabase.from as any)('print_requests').select('*').order('created_at', { ascending: false })
    setRows((data ?? []) as Req[])
  }
  useEffect(() => { void load() }, [])

  async function setStatus(id: string, status: string) {
    await (supabase.from as any)('print_requests').update({ status }).eq('id', id)
    setRows((r) => (r ?? []).map((x) => x.id === id ? { ...x, status } : x))
  }

  const fmtLabel = (pk: string, fk: string) => PRODUCT_BY_KEY[pk]?.formats.find((f) => f.key === fk)?.label ?? fk
  const prodName = (pk: string) => PRODUCT_BY_KEY[pk]?.name ?? pk

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Negozio stampe" title="Richieste di stampa"
          description="Le stampe che i tuoi clienti hanno richiesto dalle loro foto. Le evadi tu come preferisci: in beta Planfully non incassa nulla." />

        {rows === null ? (
          <p className="text-[rgb(var(--fg-subtle))] mt-6">Caricamento…</p>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center mt-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl mb-3" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><Printer size={22} /></span>
            <p className="font-medium">Nessuna richiesta ancora</p>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Attiva il negozio stampe dal Profilo: i clienti potranno richiederti stampe dalle loro foto.</p>
          </Card>
        ) : (
          <div className="space-y-3 mt-6">
            {rows.map((r) => {
              const st = STATUS[r.status] ?? STATUS.NUOVA!
              const wa = r.buyer_phone ? `https://wa.me/${r.buyer_phone.replace(/[^\d]/g, '')}` : null
              return (
                <Card key={r.id} className="p-4 flex gap-4 items-start">
                  {r.photo_thumb
                    ? <img src={r.photo_thumb} alt="" className="h-20 w-20 rounded-lg object-cover shrink-0" />
                    : <span className="h-20 w-20 rounded-lg shrink-0 grid place-items-center bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]"><Printer size={20} /></span>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{prodName(r.product_key)} · <span className="text-[rgb(var(--fg-muted))]">{fmtLabel(r.product_key, r.format_key)}</span></p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>{st.label}</span>
                    </div>
                    <p className="text-sm mt-0.5">{r.buyer_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[12px] text-[rgb(var(--fg-muted))] flex-wrap">
                      <a href={`mailto:${r.buyer_email}`} className="inline-flex items-center gap-1 hover:underline"><Mail size={12} /> {r.buyer_email}</a>
                      {r.buyer_phone && <a href={`tel:${r.buyer_phone}`} className="inline-flex items-center gap-1 hover:underline"><Phone size={12} /> {r.buyer_phone}</a>}
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline" style={{ color: '#1a8a4f' }}><MessageCircle size={12} /> WhatsApp</a>}
                    </div>
                    {r.note && <p className="text-[12px] text-[rgb(var(--fg-subtle))] mt-1 italic">“{r.note}”</p>}
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">{new Date(r.created_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                  <select value={r.status} onChange={(e) => void setStatus(r.id, e.target.value)}
                    className="shrink-0 text-xs rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5">
                    <option value="NUOVA">Nuova</option>
                    <option value="IN_CORSO">In corso</option>
                    <option value="EVASA">Evasa</option>
                  </select>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
