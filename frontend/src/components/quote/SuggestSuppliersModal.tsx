import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { X, Users, Send, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSuppliers, useFollowedSuppliers } from '@/hooks/useSuppliers'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'

type Candidate = { id: string; name: string; subrole: string | null }

// Modale "Suggerisci i miei fornitori a questo cliente": preseleziona TUTTI i fornitori che SEGUI
// (criterio: basta seguirli) + eventuali collaborazioni ACTIVE, deselezionabili, + messaggio opzionale.
// Invia via edge suggest-my-suppliers: 1 mail al cliente con la lista, 1 mail per ogni fornitore.
export function SuggestSuppliersModal({ quoteId, clientName, onClose }: { quoteId: string; clientName?: string | null; onClose: () => void }) {
  const { data: collabs, isLoading: loadingCollabs } = useSuppliers()
  const { data: followed, isLoading: loadingFollowed } = useFollowedSuppliers()
  const isLoading = loadingCollabs || loadingFollowed
  // Candidati = fornitori SEGUITI ∪ collaborazioni ACTIVE (dedup per id).
  const suppliers = useMemo<Candidate[]>(() => {
    const map = new Map<string, Candidate>()
    for (const s of (collabs ?? []).filter((c) => c.collaboration_status === 'ACTIVE')) {
      map.set(s.id, { id: s.id, name: s.business_name ?? s.full_name ?? 'Fornitore', subrole: s.subrole })
    }
    for (const s of followed ?? []) {
      map.set(s.id, { id: s.id, name: s.name ?? 'Fornitore', subrole: s.subrole })
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [collabs, followed])
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Preselezione: tutti spuntati al primo render con dati.
  const sel = selected ?? new Set(suppliers.map((s) => s.id))
  const toggle = (id: string) => {
    const next = new Set(sel)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  async function send() {
    const ids = [...sel]
    if (ids.length === 0) { toast.message('Scegli almeno un fornitore'); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('suggest-my-suppliers', {
        body: { quote_id: quoteId, supplier_ids: ids, message: message.trim() || undefined },
      })
      const err = (data as { error?: string } | null)?.error
      if (error || err) { toast.error(err === 'no_valid_suppliers' ? 'Nessun fornitore valido tra i seguiti' : `Non riuscito${err ? `: ${err}` : ''}`); return }
      const n = (data as { count?: number })?.count ?? ids.length
      toast.success(`Suggeriti ${n} fornitori${(data as { client_sent?: boolean })?.client_sent ? ' · email inviata al cliente' : ''}`)
      onClose()
    } catch (e) { toast.error(`Non riuscito: ${String((e as Error)?.message ?? e).slice(0, 120)}`) }
    finally { setBusy(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-[min(94vw,560px)] max-h-[88vh] flex flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[rgb(var(--border))]">
          <div>
            <div className="flex items-center gap-2"><Users size={18} className="text-[rgb(var(--gold-600))]" /><h2 className="font-display text-xl">Suggerisci i miei fornitori</h2></div>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">A {clientName ? <strong>{clientName}</strong> : 'questo cliente'}: mando una mail con i fornitori che segui e avviso ogni fornitore di preparare un'offerta. Il fornitore vede solo la data, non i tuoi dati cliente.</p>
          </div>
          <button onClick={onClose} className="shrink-0 h-8 w-8 inline-flex items-center justify-center rounded-lg hover:bg-[rgb(var(--bg-sunken))]"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="py-8 text-center text-[rgb(var(--fg-muted))]"><Loader2 size={18} className="animate-spin inline" /> Carico i tuoi fornitori…</div>
          ) : suppliers.length === 0 ? (
            <div className="py-8 text-center text-sm text-[rgb(var(--fg-muted))]">Non segui ancora nessun fornitore. Aggiungili dalla pagina <strong>I tuoi fornitori</strong>.</div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-[rgb(var(--fg-muted))]">
                <span><strong>{sel.size}</strong>/{suppliers.length} selezionati</span>
                <button className="hover:underline" onClick={() => setSelected(sel.size === suppliers.length ? new Set() : new Set(suppliers.map((s) => s.id)))}>{sel.size === suppliers.length ? 'Deseleziona tutti' : 'Seleziona tutti'}</button>
              </div>
              <div className="space-y-1.5">
                {suppliers.map((s) => {
                  const on = sel.has(s.id)
                  const name = s.name
                  return (
                    <button key={s.id} onClick={() => toggle(s.id)}
                      className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]/40' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                      <span className={`h-5 w-5 shrink-0 rounded-md border flex items-center justify-center ${on ? 'bg-[rgb(var(--gold-500))] border-transparent text-white' : 'border-[rgb(var(--border-strong))]'}`}>{on && <Check size={13} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{name}</span>
                        {s.subrole && <span className="block text-[11px] text-[rgb(var(--fg-subtle))] capitalize">{s.subrole}</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div>
                <label className="text-xs text-[rgb(var(--fg-muted))]">Messaggio per il cliente (opzionale)</label>
                <Textarea rows={3} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Es. Questi sono i professionisti con cui collaboro e mi fido: te li consiglio per il tuo evento." />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-[rgb(var(--border))]">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Annulla</Button>
          <Button variant="gold" size="sm" onClick={() => void send()} disabled={busy || suppliers.length === 0 || sel.size === 0}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Invia suggerimenti
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
