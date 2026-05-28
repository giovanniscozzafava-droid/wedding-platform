import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Check, X, Sparkles } from 'lucide-react'
import { StarsBadge } from '@/components/social/StarsBadge'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Candidacy = {
  follower_id: string
  follower_role: string
  full_name: string | null
  business_name: string | null
  subrole: string | null
  city: string | null
  brand_logo_url: string | null
  slug: string | null
  requested_at: string
}

/**
 * Badge + dropdown delle candidature pendenti che hai ricevuto.
 * Solo per WP/LOCATION/ADMIN (i fornitori non ricevono candidature da seguire,
 * ma se ne ricevessero da peer la lista resterebbe vuota).
 */
export function CandidacyInbox({ placement = 'below' }: { placement?: 'below' | 'beside' } = {}) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<Candidacy[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const visible = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'

  async function load() {
    if (!visible) return
    setLoading(true)
    try {
      const { data, error } = await (supabase as any).rpc('pending_candidacies')
      if (error) throw error
      setList((data as Candidacy[]) ?? [])
    } catch (e) {
      // silenzioso: badge resta 0
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [visible])

  // Refresh quando apro il dropdown
  useEffect(() => { if (open) void load() }, [open])

  async function approve(followerId: string) {
    setBusyId(followerId)
    try {
      const { data, error } = await (supabase as any).rpc('approve_candidacy', { p_follower: followerId })
      if (error) throw error
      if (data === false) throw new Error('Candidatura non trovata')
      toast.success('Aggiunto al team')
      setList((l) => l.filter((c) => c.follower_id !== followerId))
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusyId(null) }
  }

  async function reject(followerId: string) {
    setBusyId(followerId)
    try {
      const { error } = await (supabase as any).rpc('reject_candidacy', { p_follower: followerId })
      if (error) throw error
      toast.success('Candidatura rifiutata')
      setList((l) => l.filter((c) => c.follower_id !== followerId))
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusyId(null) }
  }

  if (!visible) return null

  const count = list.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]"
        title="Candidature ricevute"
        aria-label="Candidature">
        <Inbox size={16} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
            style={{ background: 'rgb(var(--rose-500))', color: 'white' }}>
            {count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <Card className={`absolute z-50 w-[320px] max-h-[70vh] overflow-hidden flex flex-col shadow-xl ${
            placement === 'beside'
              ? 'left-full top-0 ml-2'
              : 'right-0 top-full mt-2'
          }`}>
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
              <h3 className="font-display text-base">Candidature al team</h3>
              <span className="text-xs text-[rgb(var(--fg-muted))]">{count}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && <p className="p-4 text-sm text-[rgb(var(--fg-subtle))]">Caricamento…</p>}
              {!loading && count === 0 && (
                <div className="px-4 py-10 text-center text-sm text-[rgb(var(--fg-muted))]">
                  <Sparkles size={18} className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
                  Nessuna candidatura in attesa.
                  <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                    Quando un fornitore si candida al tuo team la trovi qui.
                  </p>
                </div>
              )}
              {list.map((c) => {
                const name = c.business_name ?? c.full_name ?? 'Fornitore'
                return (
                  <div key={c.follower_id} className="px-4 py-3 border-b last:border-b-0 flex items-start gap-3"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    <div className="shrink-0">
                      {c.brand_logo_url ? (
                        <img src={c.brand_logo_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                      ) : (
                        <div className="h-10 w-10 rounded-full flex items-center justify-center text-xs font-semibold"
                          style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {c.slug ? (
                        <Link to={`/p/fornitore/${c.slug}`} className="font-medium text-sm truncate hover:underline block">
                          {name}
                        </Link>
                      ) : (
                        <p className="font-medium text-sm truncate">{name}</p>
                      )}
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))]">
                        {c.subrole ?? '—'}{c.city && ` · ${c.city}`}
                      </p>
                      <StarsBadge userId={c.follower_id} size="sm" />
                      <div className="flex gap-1.5 mt-2">
                        <Button size="sm" variant="gold" disabled={busyId === c.follower_id}
                          onClick={() => void approve(c.follower_id)}>
                          <Check size={12} /> Aggiungi al team
                        </Button>
                        <Button size="sm" variant="outline" disabled={busyId === c.follower_id}
                          onClick={() => void reject(c.follower_id)}
                          className="text-[rgb(var(--rose-500))]">
                          <X size={12} /> Rifiuta
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
