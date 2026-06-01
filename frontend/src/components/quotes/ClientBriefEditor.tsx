import { useEffect, useState } from 'react'
import { Plus, Trash2, Eye, Save, CalendarClock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ============================================================================
// Editor del "brief di competenza" che il FORNITORE comunica al cliente per il
// singolo preventivo. Il cliente lo legge nella sua Area cliente. Esempi:
//  • fotografo → "Consegna foto" + data, scaletta scatti chiave
//  • band/dj   → setlist, brani scelti, orari set
//  • catering  → menù confermato, orari servizio
// Generico: delivery + lista [{label, value}] + nota.
// ============================================================================

type Item = { label: string; value: string }

// Suggerimenti di etichette per subrole, per compilazione veloce
const SUGGEST: Record<string, { deliveryLabel: string; itemLabels: string[] }> = {
  fotografo:   { deliveryLabel: 'Consegna foto',   itemLabels: ['Scaletta scatti', 'Momenti chiave', 'Album / formato'] },
  videomaker:  { deliveryLabel: 'Consegna video',  itemLabels: ['Scaletta riprese', 'Durata video', 'Consegna trailer'] },
  musica:      { deliveryLabel: 'Prove / soundcheck', itemLabels: ['Setlist', 'Brani scelti', 'Orari set'] },
  dj:          { deliveryLabel: 'Soundcheck',       itemLabels: ['Scaletta', 'Brani richiesti', 'Generi'] },
  band:        { deliveryLabel: 'Prove',            itemLabels: ['Setlist', 'Brani scelti', 'Formazione'] },
  catering:    { deliveryLabel: 'Conferma menù',    itemLabels: ['Menù', 'Orari servizio', 'Note allergie'] },
  pasticcere:  { deliveryLabel: 'Consegna torta',   itemLabels: ['Gusti', 'Piani / formato', 'Decorazioni'] },
  fioraio:     { deliveryLabel: 'Allestimento',     itemLabels: ['Composizioni', 'Palette', 'Punti da addobbare'] },
}

type AnyRpc = { rpc: (fn: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }

export function ClientBriefEditor({ quoteId, subrole }: { quoteId: string; subrole?: string | null }) {
  const sug = (subrole && SUGGEST[subrole]) || { deliveryLabel: 'Consegna', itemLabels: ['Dettaglio'] }
  const [deliveryLabel, setDeliveryLabel] = useState(sug.deliveryLabel)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [headline, setHeadline] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase as unknown as {
        from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } }
      })
        .from('supplier_client_briefs')
        .select('delivery_label, delivery_date, headline, items, note')
        .eq('quote_id', quoteId)
        .maybeSingle()
      const b = data as { delivery_label: string | null; delivery_date: string | null; headline: string | null; items: Item[] | null; note: string | null } | null
      if (b) {
        if (b.delivery_label) setDeliveryLabel(b.delivery_label)
        setDeliveryDate(b.delivery_date ?? '')
        setHeadline(b.headline ?? '')
        setItems(Array.isArray(b.items) ? b.items : [])
        setNote(b.note ?? '')
      }
      setLoading(false)
    })()
  }, [quoteId])

  function addItem(label = '') { setItems((xs) => [...xs, { label, value: '' }]) }
  function setItem(i: number, k: keyof Item, v: string) { setItems((xs) => xs.map((x, j) => j === i ? { ...x, [k]: v } : x)) }
  function delItem(i: number) { setItems((xs) => xs.filter((_, j) => j !== i)) }

  async function save(share: boolean) {
    setSaving(true)
    try {
      const cleanItems = items.filter((it) => it.label.trim() || it.value.trim())
      const { data, error } = await (supabase as unknown as AnyRpc).rpc('upsert_quote_client_brief', {
        p_quote_id: quoteId,
        p_delivery_label: deliveryLabel.trim() || null,
        p_delivery_date: deliveryDate || null,
        p_headline: headline.trim() || null,
        p_items: cleanItems,
        p_note: note.trim() || null,
        p_share: share,
      })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string }
      if (r.error) throw new Error(r.error)
      toast.success(share ? 'Condiviso col cliente nella sua area' : 'Bozza salvata')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Salvataggio non riuscito')
    } finally { setSaving(false) }
  }

  if (loading) return null

  return (
    <Card className="p-5 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Eye size={16} className="text-[rgb(var(--gold-500))]" />
        <h2 className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Cosa vede il cliente (area cliente)</h2>
      </div>
      <p className="text-xs text-[rgb(var(--fg-subtle))] mb-4">
        Informazioni di tua competenza che il cliente vedrà nella sua area, accanto a preventivo e contratto.
      </p>

      <div className="space-y-3">
        <div>
          <Label>Titolo / sintesi</Label>
          <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Es. Il tuo servizio fotografico — tutto pronto" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Etichetta consegna</Label>
            <Input value={deliveryLabel} onChange={(e) => setDeliveryLabel(e.target.value)} placeholder="Es. Consegna foto" />
          </div>
          <div>
            <Label className="inline-flex items-center gap-1"><CalendarClock size={13} /> Data consegna</Label>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="mb-0">Dettagli di competenza</Label>
            <div className="flex gap-1.5">
              {sug.itemLabels.map((l) => (
                <button key={l} type="button" onClick={() => addItem(l)}
                  className="text-[11px] px-2 py-0.5 rounded-full border text-[rgb(var(--fg-muted))]" style={{ borderColor: 'rgb(var(--border))' }}>
                  + {l}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input className="w-1/3" value={it.label} onChange={(e) => setItem(i, 'label', e.target.value)} placeholder="Etichetta" />
                <Input className="flex-1" value={it.value} onChange={(e) => setItem(i, 'value', e.target.value)} placeholder="Valore / descrizione" />
                <button type="button" onClick={() => delItem(i)} className="p-2 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--danger))]">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addItem()} className="text-xs inline-flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]">
              <Plus size={14} /> Aggiungi riga
            </button>
          </div>
        </div>

        <div>
          <Label>Nota libera per il cliente</Label>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Indicazioni, prossimi passi, riferimenti..." />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => void save(false)} disabled={saving}>
            <Save size={15} className="mr-1" /> Salva bozza
          </Button>
          <Button variant="gold" onClick={() => void save(true)} disabled={saving}>
            <Eye size={15} className="mr-1" /> Condividi col cliente
          </Button>
        </div>
      </div>
    </Card>
  )
}
