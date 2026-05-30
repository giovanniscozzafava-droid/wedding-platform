import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, ListChecks, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

// ────────────────────────────────────────────────────────────────────────────
// FASE 2.2 — Componente "Prossima Mossa"
//
// Mobile-first: una colonna, ogni voce e` un pulsante grande (>=44px) con
// l'azione primaria. Le notifiche sono PENDING dell'utente loggato, ordinate
// per priorita desc + creato_il desc (indice db_notifiche_dest_stato_priorita).
// ────────────────────────────────────────────────────────────────────────────

type Notifica = {
  id: string
  evento_id: string | null
  tipo: string
  titolo: string
  descrizione: string | null
  link_action: string | null
  priorita: number
  creato_il: string
}

type Props = {
  /** Limita il numero di card mostrate (default: 5). */
  limit?: number
  /** Filtra per evento specifico (es. dentro CoupleDashboard.overview). */
  entryId?: string
  /** Titolo opzionale; se omesso usa "La tua prossima mossa". */
  title?: string
  /** className opzionale per wrappare il blocco. */
  className?: string
}

export function ProssimaMossa({ limit = 5, entryId, title = 'La tua prossima mossa', className }: Props) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [items, setItems] = useState<Notifica[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    if (!user?.id) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    let q = (supabase.from('notifiche' as any) as any)
      .select('id, evento_id, tipo, titolo, descrizione, link_action, priorita, creato_il')
      .eq('destinatario_id', user.id)
      .eq('stato', 'PENDING')
      .order('priorita', { ascending: false })
      .order('creato_il', { ascending: false })
      .limit(limit)
    if (entryId) q = q.eq('evento_id', entryId)
    const { data, error } = await q
    if (error) {
      // Best-effort: non rompiamo la pagina, mostriamo empty state.
      setItems([])
    } else {
      setItems((data ?? []) as Notifica[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // re-load on user change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, entryId, limit])

  async function markDone(n: Notifica) {
    if (!user?.id) return
    setBusyId(n.id)
    try {
      await (supabase.from('notifiche' as any) as any)
        .update({ stato: 'DONE', letto_il: new Date().toISOString() })
        .eq('id', n.id)
        .eq('destinatario_id', user.id)
      // refetch
      await load()
    } finally {
      setBusyId(null)
    }
  }

  function go(n: Notifica) {
    // Segniamo letto_il come "preso in carico" senza chiudere; l'evento_stato
    // si aggiornera` via trigger quando l'azione sara` completata.
    if (user?.id) {
      void (supabase.from('notifiche' as any) as any)
        .update({ letto_il: new Date().toISOString() })
        .eq('id', n.id)
        .eq('destinatario_id', user.id)
    }
    if (n.link_action) {
      // link_action puo` essere interno (/...) o esterno (https://...)
      if (/^https?:\/\//i.test(n.link_action)) {
        window.open(n.link_action, '_blank', 'noopener,noreferrer')
      } else {
        nav(n.link_action)
      }
    }
  }

  if (loading) {
    return (
      <section className={className}>
        <Header title={title} count={null} />
        <Card className="p-5 sm:p-6">
          <p className="text-sm text-[rgb(var(--fg-subtle))]">Carico le prossime mosse…</p>
        </Card>
      </section>
    )
  }

  if (!items || items.length === 0) {
    return (
      <section className={className}>
        <Header title={title} count={0} />
        <Card className="p-6 text-center">
          <CheckCircle2 size={24} className="mx-auto mb-2 text-[rgb(var(--gold-600))]" />
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Nessuna azione in sospeso. Sei in pari con il workflow.
          </p>
        </Card>
      </section>
    )
  }

  return (
    <section className={className}>
      <Header title={title} count={items.length} />
      {/* Mobile-first: lista verticale a una colonna; ogni voce e` un pulsante grande. */}
      <ul className="flex flex-col gap-3">
        {items.map((n) => (
          <li key={n.id}>
            <Card className="overflow-hidden">
              <button
                type="button"
                onClick={() => go(n)}
                className="w-full text-left flex items-start gap-3 p-4 sm:p-5 min-h-[44px] hover:bg-[rgb(var(--bg-sunken))] active:scale-[.998] transition-colors"
                aria-label={`Apri: ${n.titolo}`}
              >
                <span
                  className="mt-0.5 inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-full"
                  style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}
                >
                  <Sparkles size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-medium text-[15px] leading-snug">{n.titolo}</p>
                    {n.priorita >= 9 && (
                      <span
                        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: 'rgb(var(--rose-500))', color: 'white' }}
                      >
                        Urgente
                      </span>
                    )}
                  </div>
                  {n.descrizione && (
                    <p className="text-xs sm:text-sm text-[rgb(var(--fg-muted))] mt-1 line-clamp-3">
                      {n.descrizione}
                    </p>
                  )}
                </div>
                <ArrowRight size={18} className="shrink-0 self-center text-[rgb(var(--fg-subtle))]" />
              </button>
              <div
                className="flex items-center justify-end px-3 py-2 border-t"
                style={{ borderColor: 'rgb(var(--border))' }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void markDone(n)}
                  disabled={busyId === n.id}
                  className="min-h-[44px]"
                  aria-label="Segna come fatta"
                >
                  <CheckCircle2 size={14} /> Fatto
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Header({ title, count }: { title: string; count: number | null }) {
  return (
    <div className="flex items-end justify-between gap-2 mb-3">
      <h2 className="font-display text-xl sm:text-2xl inline-flex items-center gap-2">
        <ListChecks size={18} className="text-[rgb(var(--gold-600))]" />
        {title}
      </h2>
      {count != null && count > 0 && (
        <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
          {count} {count === 1 ? 'azione' : 'azioni'}
        </span>
      )}
    </div>
  )
}

export default ProssimaMossa
