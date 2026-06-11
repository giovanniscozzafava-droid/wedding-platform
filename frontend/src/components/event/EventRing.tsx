import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Heart, Sparkles, UserPlus, Gift, X, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

type RingRole = { role_key: string; label: string; covered: boolean; covered_by: string | null }
type RingState = { roles: RingRole[]; total: number; covered: number; closed: boolean }
type Suggestable = { id: string; name: string; subrole: string | null; matches: boolean; in_event: boolean }

function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: T }> })
    .rpc(fn, args).then((r) => r.data)
}

// L'anello-a-segmenti che si chiude è RISERVATO al completamento dell'evento (§10.3).
// Niente percentuali, niente numeri: si vede quanto manca, non si legge.

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const [sx, sy] = polar(cx, cy, r, end)
  const [ex, ey] = polar(cx, cy, r, start)
  const large = end - start <= 180 ? 0 : 1
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 0 ${ex} ${ey}`
}

export function EventRing({ entryId, view }: { entryId: string; view: 'capostipite' | 'fornitore' | 'sposi' }) {
  const [ring, setRing] = useState<RingState | null>(null)
  // picker "suggerisci fornitore": ruolo aperto + lista fornitori + stato
  const [pick, setPick] = useState<{ roleKey: string; label: string } | null>(null)
  const [suppliers, setSuppliers] = useState<Suggestable[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  // invito email a un fornitore NON ancora su Planfully (conta per i punti referral)
  const [invite, setInvite] = useState<{ email: string; sending: boolean }>({ email: '', sending: false })

  const load = useCallback(async () => {
    if (!entryId) return
    const r = await rpc<RingState & { error?: string }>('get_event_ring', { p_entry: entryId })
    if (r && !r.error) setRing(r)
  }, [entryId])

  useEffect(() => { void load() }, [load])

  async function openPicker(roleKey: string, label: string) {
    setPick({ roleKey, label })
    setSuppliers(null)
    const r = await rpc<{ suppliers?: Suggestable[]; error?: string }>('list_suggestable_suppliers', { p_entry: entryId, p_role_key: roleKey })
    if (r?.error) { toast.error(r.error === 'forbidden' ? 'Non puoi suggerire su questo evento.' : r.error); setPick(null); return }
    setSuppliers(r?.suppliers ?? [])
  }

  async function addSupplier(s: Suggestable) {
    setAdding(s.id)
    try {
      const r = await rpc<{ ok?: boolean; error?: string }>('suggest_supplier_to_event', { p_entry: entryId, p_supplier: s.id })
      if (r?.error) {
        toast.error(r.error === 'not_a_supplier' ? 'Profilo non valido.' : `Non aggiunto: ${r.error}`)
        return
      }
      toast.success(`${s.name} è ora nell'evento`)
      setPick(null); setSuppliers(null)
      await load()
    } finally { setAdding(null) }
  }

  // Invita per email un fornitore non iscritto: l'invito è registrato a tuo nome
  // (capostipite_id = tu) → vale per i tuoi punti referral secondo la logica esistente.
  async function sendInvite() {
    const email = invite.email.trim().toLowerCase()
    if (!email.includes('@')) { toast.error('Email non valida'); return }
    setInvite((s) => ({ ...s, sending: true }))
    try {
      const { data, error } = await supabase.functions.invoke('invite-supplier', {
        body: { email, subrole: pick?.roleKey, message: `Ti invito su Planfully per collaborare a un evento come ${pick?.label}.` },
      })
      if (error) throw error
      const mode = (data as { mode?: string; error?: string })?.mode
      const err = (data as { error?: string })?.error
      if (err) { toast.error(err); return }
      if (mode === 'email_failed_link_fallback') toast.success('Invito creato (email non partita: link generato nel tuo profilo)')
      else toast.success(`Invito inviato a ${email}`)
      setInvite({ email: '', sending: false })
    } catch (e) { toast.error((e as Error).message) } finally { setInvite((s) => ({ ...s, sending: false })) }
  }

  if (!ring || ring.total === 0) return null

  const canSuggest = view === 'fornitore' || view === 'capostipite'
  const N = ring.total
  const size = 168, cx = size / 2, cy = size / 2, r = 70, sw = 12, gap = N > 1 ? 7 : 0
  const seg = 360 / N

  return (
    <div className="surface surface-lift p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {/* Anello */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            {ring.roles.map((role, i) => {
              const start = i * seg + gap / 2
              const end = (i + 1) * seg - gap / 2
              return (
                <motion.path key={role.role_key}
                  d={arcPath(cx, cy, r, start, end)}
                  fill="none" strokeWidth={sw} strokeLinecap="round"
                  stroke={role.covered ? 'rgb(var(--gold-500))' : 'rgb(var(--border))'}
                  initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04, duration: 0.5 }} />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {ring.closed ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: N * 0.04 }}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                <Heart size={22} className="fill-[rgb(var(--gold-600))]" />
              </motion.span>
            ) : (
              <Heart size={22} style={{ color: 'rgb(var(--fg-subtle))' }} />
            )}
          </div>
        </div>

        {/* Dettaglio / azioni */}
        <div className="flex-1 min-w-0 w-full">
          {ring.closed ? (
            <div className="mb-3">
              <h3 className="font-display text-lg flex items-center gap-2" style={{ color: 'rgb(var(--gold-700))' }}>
                <Sparkles size={18} /> Il cerchio si è chiuso
              </h3>
              <p className="text-sm text-[rgb(var(--fg-muted))]">
                {view === 'sposi' ? 'La tua squadra è al completo.' : 'Una rete, un evento completo.'}
              </p>
            </div>
          ) : (
            <h3 className="font-display text-lg mb-1">
              {view === 'capostipite' ? 'Chiudi il cerchio' : view === 'fornitore' ? 'Il cerchio dell’evento' : 'La squadra si sta formando'}
            </h3>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
            {ring.roles.map((role) => (
              <div key={role.role_key} className="flex items-center gap-2 text-sm">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0"
                  style={{ background: role.covered ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))' }}>
                  {role.covered && <Check size={11} className="text-white" />}
                </span>
                <span className={role.covered ? '' : 'text-[rgb(var(--fg-subtle))]'}>{role.label}</span>
                {role.covered && role.covered_by && view !== 'sposi' && (
                  <span className="text-[11px] text-[rgb(var(--fg-subtle))] truncate">· {role.covered_by}</span>
                )}
                {!role.covered && canSuggest && (
                  <button type="button" onClick={() => openPicker(role.role_key, role.label)}
                    className="ml-auto text-[11px] text-[rgb(var(--gold-600))] hover:underline inline-flex items-center gap-0.5 shrink-0">
                    {view === 'capostipite' ? <><UserPlus size={11} /> invita</> : <><Gift size={11} /> suggerisci</>}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Picker fornitori: scegli → entra subito nell'evento */}
      {pick && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setPick(null)}>
          <div className="bg-[rgb(var(--bg))] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
              <div>
                <h4 className="font-medium">Suggerisci per «{pick.label}»</h4>
                <p className="text-[11px] text-[rgb(var(--fg-muted))]">Il fornitore scelto entra subito nell'evento.</p>
              </div>
              <button className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={() => setPick(null)} aria-label="Chiudi"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-2">
              {suppliers === null ? (
                <div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] p-4"><Loader2 size={15} className="animate-spin" /> Carico i fornitori…</div>
              ) : suppliers.length === 0 ? (
                <p className="text-sm text-[rgb(var(--fg-muted))] p-4">Nessun fornitore disponibile.</p>
              ) : (
                suppliers.map((s) => (
                  <button key={s.id} type="button" disabled={s.in_event || adding === s.id} onClick={() => addSupplier(s)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-60 disabled:cursor-not-allowed text-left">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] text-sm font-medium shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium truncate">{s.name}</span>
                      <span className="block text-[11px] text-[rgb(var(--fg-subtle))] truncate">{s.subrole ?? '—'}{s.matches && ' · consigliato'}</span>
                    </span>
                    {s.in_event
                      ? <span className="text-[11px] text-[rgb(var(--emerald-600))] inline-flex items-center gap-0.5 shrink-0"><Check size={12} /> nell'evento</span>
                      : adding === s.id
                        ? <Loader2 size={15} className="animate-spin shrink-0" />
                        : <span className="text-[11px] text-[rgb(var(--gold-600))] shrink-0">aggiungi</span>}
                  </button>
                ))
              )}
            </div>
            {/* Ramo "non iscritto": invita per email — vale per i punti referral */}
            <div className="border-t border-[rgb(var(--border))] p-3 space-y-2">
              <p className="text-[11px] text-[rgb(var(--fg-muted))]">Non lo trovi? <strong>Invitalo su Planfully</strong>: una volta iscritto potrai aggiungerlo al cerchio. L'invito è registrato a tuo nome e vale per i tuoi punti referral.</p>
              <div className="flex gap-2">
                <input type="email" value={invite.email} onChange={(e) => setInvite((s) => ({ ...s, email: e.target.value }))}
                  placeholder="email del fornitore"
                  className="flex-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 py-1.5 text-sm" />
                <Button variant="outline" size="sm" disabled={invite.sending} onClick={sendInvite}>
                  {invite.sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Invita
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
