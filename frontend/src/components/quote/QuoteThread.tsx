import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Phone, MessageCircle, Loader2, Check, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'

type Msg = { id: string; sender_role: 'CLIENT' | 'PRO'; kind: 'MESSAGE' | 'CALL_REQUEST'; body: string; created_at: string; read_at: string | null; mine: boolean }

// Chat sul PREVENTIVO tra cliente e professionista. Stesso componente per entrambi i lati:
// il "party" (PRO/CLIENT) lo decide il server. Il professionista può anche "Richiedere una call".
export function QuoteThread({ quoteId }: { quoteId: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [party, setParty] = useState<'CLIENT' | 'PRO' | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    const { data } = await (supabase.rpc as any)('quote_thread', { p_quote: quoteId })
    const d = data as { error?: string; party?: 'CLIENT' | 'PRO'; messages?: Msg[] } | null
    if (d && !d.error) { setParty(d.party ?? null); setMsgs(d.messages ?? []) }
    setLoading(false)
  }, [quoteId])

  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 20000); return () => window.clearInterval(t) }, [load])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }) }, [msgs.length])

  async function send(kind: 'MESSAGE' | 'CALL_REQUEST') {
    const body = kind === 'CALL_REQUEST' ? text.trim() : text.trim()
    if (kind === 'MESSAGE' && !body) return
    setBusy(true)
    try {
      const { data, error } = await (supabase.rpc as any)('quote_send_message', { p_quote: quoteId, p_body: body, p_kind: kind })
      const err = (data as { error?: string } | null)?.error
      if (error || err) {
        toast.error(err === 'only_pro_call' ? 'Solo il professionista può richiedere una call' : err === 'empty' ? 'Scrivi un messaggio' : 'Invio non riuscito')
        return
      }
      setText('')
      await load()
      toast.success(kind === 'CALL_REQUEST' ? 'Richiesta di call inviata' : 'Messaggio inviato')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="rounded-xl border border-[rgb(var(--border))] overflow-hidden">
      <div className="px-3 py-2 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] flex items-center gap-2">
        <MessageCircle size={15} className="text-[rgb(var(--gold-600))]" />
        <span className="text-sm font-medium">{party === 'PRO' ? 'Messaggi con il cliente' : 'Domande al professionista'}</span>
      </div>
      <div className="max-h-72 overflow-y-auto p-3 space-y-2 bg-[rgb(var(--bg))]">
        {loading ? (
          <div className="text-center text-[rgb(var(--fg-subtle))] py-6"><Loader2 size={16} className="animate-spin inline" /></div>
        ) : msgs.length === 0 ? (
          <p className="text-[12px] text-[rgb(var(--fg-subtle))] text-center py-4">
            {party === 'PRO' ? 'Nessun messaggio. Puoi scrivere al cliente o proporgli una call.' : 'Hai domande su questo preventivo? Scrivi al professionista.'}
          </p>
        ) : msgs.map((m) => (
          <div key={m.id} className={`flex flex-col ${m.mine ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.kind === 'CALL_REQUEST' ? 'border' : ''} ${m.mine ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-[rgb(var(--bg-sunken))]'}`}
              style={m.kind === 'CALL_REQUEST' && !m.mine ? { borderColor: 'rgb(var(--gold-500))', background: 'rgb(var(--gold-100))' } : undefined}>
              {m.kind === 'CALL_REQUEST' && (
                <span className="flex items-center gap-1 text-[11px] font-semibold mb-0.5 opacity-90"><Phone size={12} /> Richiesta di call</span>
              )}
              <span className="whitespace-pre-wrap break-words">{m.body}</span>
            </div>
            {m.mine && (
              <span className={`text-[10px] mt-0.5 px-1 inline-flex items-center gap-0.5 ${m.read_at ? 'text-[rgb(var(--gold-700))]' : 'text-[rgb(var(--fg-subtle))]'}`}
                title={m.read_at ? `Letto ${new Date(m.read_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : 'Consegnato, non ancora letto'}>
                {m.read_at ? <><CheckCheck size={12} /> Letto</> : <><Check size={12} /> Inviato</>}
              </span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-[rgb(var(--border))] space-y-2">
        <Textarea rows={2} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)}
          placeholder={party === 'PRO' ? 'Scrivi al cliente…' : 'Scrivi la tua domanda…'}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send('MESSAGE') }} />
        <div className="flex items-center gap-2">
          {party === 'PRO' && (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void send('CALL_REQUEST')} title="Proponi al cliente una call">
              <Phone size={14} /> Richiedi una call
            </Button>
          )}
          <Button variant="gold" size="sm" className="ml-auto" disabled={busy || !text.trim()} onClick={() => void send('MESSAGE')}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Invia
          </Button>
        </div>
      </div>
    </div>
  )
}
