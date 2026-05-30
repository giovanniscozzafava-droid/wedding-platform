// FASE 5.1 — Chat evento mobile-first.
// Scroll cronologico (vecchi sopra, nuovi sotto), input fissato in basso,
// touch target >= 44px, una azione primaria (Invia).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, MessageCircle, Quote } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type ChatRow = {
  id: string
  entry_id: string
  mittente_id: string
  corpo: string
  allegato_url: string | null
  voce_quote_item_id: string | null
  letto_il: string | null
  creato_il: string
}

type Profile = {
  id: string
  full_name: string | null
  business_name: string | null
  avatar_url: string | null
}

type QuoteItemRef = { id: string; name_snapshot: string }

export function ChatEvento({ entryId }: { entryId: string }) {
  const [rows, setRows] = useState<ChatRow[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [voci, setVoci] = useState<QuoteItemRef[]>([])
  const [draft, setDraft] = useState('')
  const [vocePick, setVocePick] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [me, setMe] = useState<string | null>(null)
  const listEndRef = useRef<HTMLDivElement | null>(null)

  async function load() {
    setLoading(true)
    try {
      const { data: u } = await supabase.auth.getUser()
      setMe(u.user?.id ?? null)

      const { data, error } = await (supabase as any).from('chat_messaggi')
        .select('*')
        .eq('entry_id', entryId)
        .order('creato_il', { ascending: true })
        .limit(500)
      if (error) throw error
      const list = (data ?? []) as ChatRow[]
      setRows(list)

      // profili mittenti.
      const ids = Array.from(new Set(list.map((r) => r.mittente_id)))
      if (ids.length > 0) {
        const { data: pr } = await (supabase.from('profiles') as any)
          .select('id, full_name, business_name, avatar_url')
          .in('id', ids)
        const map: Record<string, Profile> = {}
        for (const p of ((pr ?? []) as Profile[])) map[p.id] = p
        setProfiles(map)
      }

      // voci preventivo dell'evento (best-effort) per il selettore di citazione.
      const { data: ce } = await (supabase.from('calendar_entries') as any)
        .select('quote_id')
        .eq('id', entryId)
        .maybeSingle()
      const qid = (ce as any)?.quote_id as string | null
      if (qid) {
        const { data: qi } = await (supabase.from('quote_items') as any)
          .select('id, name_snapshot')
          .eq('quote_id', qid)
          .order('sort_order', { ascending: true })
          .limit(200)
        setVoci(((qi ?? []) as QuoteItemRef[]))
      } else {
        setVoci([])
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId])

  useEffect(() => {
    // Auto-scroll all'ultimo messaggio quando arrivano nuovi.
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [rows.length])

  async function send() {
    const body = draft.trim()
    if (!body) return
    if (!me) {
      toast.error('Sessione scaduta')
      return
    }
    setSending(true)
    try {
      const payload: any = {
        entry_id: entryId,
        mittente_id: me,
        corpo: body,
      }
      if (vocePick) payload.voce_quote_item_id = vocePick
      const { error } = await (supabase as any).from('chat_messaggi').insert(payload)
      if (error) throw error
      setDraft('')
      setVocePick('')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  const vociById = useMemo(() => {
    const m: Record<string, QuoteItemRef> = {}
    for (const v of voci) m[v.id] = v
    return m
  }, [voci])

  return (
    <div className="flex flex-col" style={{ minHeight: '70vh' }}>
      <header className="mb-3">
        <h2 className="font-display text-2xl flex items-center gap-2">
          <MessageCircle size={20} /> Chat evento
        </h2>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
          Conversazione visibile a wedding planner, sposi e fornitori del preventivo.
        </p>
      </header>

      {/* Lista messaggi: scroll up, input bottom. */}
      <Card className="flex-1 p-3 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {loading ? (
          <p className="text-sm text-[rgb(var(--fg-subtle))] p-2">Caricamento...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[rgb(var(--fg-subtle))] p-4 text-center">
            Nessun messaggio. Scrivi tu il primo.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const mine = r.mittente_id === me
              const p = profiles[r.mittente_id]
              const author = p?.business_name ?? p?.full_name ?? 'Utente'
              const voce = r.voce_quote_item_id ? vociById[r.voce_quote_item_id] : null
              return (
                <li
                  key={r.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 ${
                      mine
                        ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--fg))]'
                        : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg))]'
                    }`}>
                    <div className="text-[11px] font-medium text-[rgb(var(--fg-muted))] flex items-center gap-1 flex-wrap">
                      <span>{mine ? 'Tu' : author}</span>
                      <span>·</span>
                      <span>
                        {new Date(r.creato_il).toLocaleString('it-IT', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {voce && (
                      <div className="mt-1 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
                        style={{ borderColor: 'rgb(var(--border))' }}>
                        <Quote size={10} /> {voce.name_snapshot}
                      </div>
                    )}
                    <p className="mt-1 text-sm whitespace-pre-wrap break-words">{r.corpo}</p>
                    {r.allegato_url && (
                      <a
                        href={r.allegato_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-xs underline text-[rgb(var(--gold-700))]">
                        Allegato
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
            <div ref={listEndRef} />
          </ul>
        )}
      </Card>

      {/* Input area: input bottom, mobile-first. */}
      <div className="mt-3 space-y-2">
        {voci.length > 0 && (
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">
              Cita voce preventivo (opzionale)
            </label>
            <select
              value={vocePick}
              onChange={(e) => setVocePick(e.target.value)}
              className="w-full rounded-lg border bg-[rgb(var(--bg-elev))] px-3 py-2 text-sm min-h-[44px]"
              style={{ borderColor: 'rgb(var(--border-strong))' }}>
              <option value="">— Nessuna voce —</option>
              {voci.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name_snapshot}
                </option>
              ))}
            </select>
          </div>
        )}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Scrivi un messaggio..."
          rows={3}
          className="min-h-[88px]"
        />
        <div className="flex justify-end">
          <Button
            variant="gold"
            onClick={() => void send()}
            disabled={sending || draft.trim().length === 0}
            className="min-h-[44px]">
            <Send size={14} /> {sending ? 'Invio...' : 'Invia'}
          </Button>
        </div>
      </div>
    </div>
  )
}
