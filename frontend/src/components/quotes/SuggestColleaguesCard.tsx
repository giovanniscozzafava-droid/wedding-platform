import { useEffect, useState } from 'react'
import { Users, Send, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ============================================================================
// Dentro un preventivo firmato: suggerisci al cliente colleghi che SEGUI.
// Se il cliente poi firma un contratto con uno di loro (stessa email), scatta
// in automatico un credito di 100€ a chi ha segnalato (vedi /crediti).
// ============================================================================

const rpc = (fn: string, a?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, a)

type Sup = { id: string; name: string | null; subrole: string | null; city: string | null }

export function SuggestColleaguesCard({ quoteId }: { quoteId: string }) {
  const [list, setList] = useState<Sup[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    void (async () => {
      const { data } = await rpc('followed_suppliers')
      setList(((data as { suppliers?: Sup[] })?.suppliers) ?? [])
      setLoading(false)
    })()
  }, [])

  function toggle(id: string) {
    setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function send() {
    if (sel.size === 0) { toast.error('Seleziona almeno un collega'); return }
    setSending(true)
    const { data, error } = await rpc('suggest_suppliers_to_client', { p_quote_id: quoteId, p_suggested_ids: Array.from(sel) })
    setSending(false)
    const r = data as { ok?: boolean; error?: string; suggested?: number }
    if (error || r?.error) { toast.error(r?.error || 'Errore'); return }
    // Email al cliente coi fornitori suggeriti (fire-and-forget)
    void supabase.functions.invoke('suggested-suppliers-notify', { body: { quote_id: quoteId } }).catch(() => {})
    toast.success(`${r.suggested ?? 0} colleghi suggeriti al cliente (email inviata)`)
    setSel(new Set())
  }

  if (loading) return null

  return (
    <Card className="p-5 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Users size={16} className="text-[rgb(var(--gold-500))]" />
        <h2 className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Suggerisci colleghi al cliente</h2>
      </div>
      <p className="text-xs text-[rgb(var(--fg-subtle))] mb-3">
        Consiglia colleghi che segui (e che accettano di essere suggeriti). Se il cliente firmerà un contratto con uno di loro, ricevi <strong>39€ di credito</strong> automatico.
      </p>

      {list.length === 0 ? (
        <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Non segui ancora nessun collega fornitore. Seguili dalle loro vetrine per poterli suggerire.</p>
      ) : (
        <>
          <div className="space-y-1.5 mb-3">
            {list.map((s) => {
              const on = sel.has(s.id)
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)}
                  className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg border transition-colors"
                  style={on ? { borderColor: 'rgb(var(--gold-500))', background: 'rgb(var(--gold-500) / 0.08)' } : { borderColor: 'rgb(var(--border))' }}>
                  <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0" style={{ borderColor: on ? 'rgb(var(--gold-500))' : 'rgb(var(--border))' }}>
                    {on && <Check size={12} className="text-[rgb(var(--gold-600))]" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.subrole && <span className="text-xs text-[rgb(var(--fg-subtle))]">{s.subrole}</span>}
                </button>
              )
            })}
          </div>
          <Button variant="gold" onClick={() => void send()} disabled={sending || sel.size === 0}>
            <Send size={15} className="mr-1" /> Suggerisci al cliente ({sel.size})
          </Button>
        </>
      )}
    </Card>
  )
}
