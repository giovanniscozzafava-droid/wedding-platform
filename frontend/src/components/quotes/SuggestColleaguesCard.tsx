import { useEffect, useState } from 'react'
import { Users, Send, Check, Mail } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { BETA_NO_MONEY } from '@/lib/beta'

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
  const [query, setQuery] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  // Allineamento preventivo↔evento: chi è GIA' nel cerchio dell'evento e chi è GIA' suggerito.
  const [circle, setCircle] = useState<Set<string>>(new Set())
  const [already, setAlready] = useState<Set<string>>(new Set())

  const filtered = query.trim().length === 0 ? list
    : list.filter((s) => (s.name ?? '').toLowerCase().includes(query.trim().toLowerCase()) || (s.subrole ?? '').toLowerCase().includes(query.trim().toLowerCase()))

  // Invita un collega non ancora su Planfully via email (link di registrazione).
  function inviteByEmail() {
    const email = inviteEmail.trim()
    if (!/\S+@\S+\.\S+/.test(email)) { toast.error('Email non valida'); return }
    const url = `${window.location.origin}/register`
    const subject = encodeURIComponent('Ti invito su Planfully')
    const body = encodeURIComponent(`Ciao,\nti invito su Planfully, lo strumento con cui gestisco preventivi, contratti ed eventi. Iscriviti qui: ${url}\nUna volta registrato potrò suggerirti ai miei clienti.\n— inviato con Planfully`)
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`
    setInviteEmail('')
    toast.success('Email di invito pronta')
  }

  useEffect(() => {
    void (async () => {
      const [{ data }, { data: conf }] = await Promise.all([
        rpc('followed_suppliers'),
        rpc('quote_suggestion_conflicts', { p_quote: quoteId }),
      ])
      setList(((data as { suppliers?: Sup[] })?.suppliers) ?? [])
      const c = conf as { in_circle?: string[]; already_suggested?: string[] } | null
      setCircle(new Set(c?.in_circle ?? []))
      setAlready(new Set(c?.already_suggested ?? []))
      setLoading(false)
    })()
  }, [quoteId])

  function toggle(id: string) {
    if (circle.has(id)) { toast.message('Questo professionista è già nel cerchio dell’evento: non serve suggerirlo.'); return }
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
        {BETA_NO_MONEY
          ? 'Consiglia colleghi che segui (e che accettano di essere suggeriti). Se il cliente sceglie uno di loro, la tua segnalazione resta tracciata.'
          : <>Consiglia colleghi che segui (e che accettano di essere suggeriti). Se il cliente firmerà un contratto con uno di loro, ricevi <strong>39€ di credito</strong> automatico.</>}
      </p>

      {list.length > 0 && (
        <Input className="mb-2 text-sm" placeholder="Cerca tra i colleghi che segui…" value={query} onChange={(e) => setQuery(e.target.value)} />
      )}
      {list.length === 0 ? (
        <p className="text-xs text-[rgb(var(--fg-subtle))] italic mb-3">Non segui ancora nessun collega fornitore. Seguili dalle loro vetrine per poterli suggerire — oppure invita qui sotto un collega a iscriversi.</p>
      ) : (
        <>
          <div className="space-y-1.5 mb-3 max-h-60 overflow-auto">
            {filtered.map((s) => {
              const on = sel.has(s.id)
              const inCircle = circle.has(s.id)
              const isSuggested = !inCircle && already.has(s.id)
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)} disabled={inCircle}
                  title={inCircle ? 'Già nel cerchio dell’evento' : isSuggested ? 'Già suggerito per questo evento' : undefined}
                  className="w-full flex items-center gap-2 text-left text-sm px-3 py-2 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  style={on ? { borderColor: 'rgb(var(--gold-500))', background: 'rgb(var(--gold-500) / 0.08)' } : { borderColor: 'rgb(var(--border))' }}>
                  <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0" style={{ borderColor: on ? 'rgb(var(--gold-500))' : 'rgb(var(--border))' }}>
                    {on && <Check size={12} className="text-[rgb(var(--gold-600))]" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {inCircle && <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-[rgb(var(--emerald-500))/0.12] text-[rgb(var(--emerald-600))] inline-flex items-center gap-0.5 shrink-0"><Check size={10} /> nel cerchio</span>}
                  {isSuggested && <span className="text-[10px] font-medium rounded-full px-1.5 py-0.5 bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] shrink-0">già suggerito</span>}
                  {!inCircle && !isSuggested && s.subrole && <span className="text-xs text-[rgb(var(--fg-subtle))]">{s.subrole}</span>}
                </button>
              )
            })}
            {filtered.length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessun collega seguito corrisponde alla ricerca.</p>}
          </div>
          <Button variant="gold" onClick={() => void send()} disabled={sending || sel.size === 0}>
            <Send size={15} className="mr-1" /> Suggerisci al cliente ({sel.size})
          </Button>
        </>
      )}

      {/* Invito a un collega non ancora iscritto */}
      <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
        <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-2">Il collega non è ancora su Planfully? Invitalo a iscriversi:</p>
        <div className="flex gap-2">
          <Input className="flex-1 text-sm" type="email" placeholder="email del collega" value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') inviteByEmail() }} />
          <Button variant="outline" onClick={inviteByEmail}><Mail size={15} className="mr-1" /> Invita</Button>
        </div>
      </div>
    </Card>
  )
}
