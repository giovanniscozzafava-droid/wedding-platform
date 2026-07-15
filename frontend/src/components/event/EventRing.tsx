import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Heart, Sparkles, UserPlus, Gift, X, Loader2, Mail, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'

type RingRole = { role_key: string; label: string; covered: boolean; covered_by: string | null }
type RingState = { roles: RingRole[]; total: number; covered: number; closed: boolean; wp?: { name: string; role: string }[] | null }
const wpRoleLabel = (role?: string) => (role === 'WEDDING_PLANNER' ? 'Wedding planner' : role === 'LOCATION' ? 'Location' : 'Capostipite')
type Suggestable = { id: string; name: string; subrole: string | null; matches: boolean; in_event: boolean }
type CircleSuggestion = { id: string; role_key: string | null; status: string; supplier_name: string; suggested_by_name: string }
type Capostipite = { id: string; name: string; role: string; in_event: boolean }

function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: T }> })
    .rpc(fn, args).then((r) => r.data)
}

// L'anello-a-segmenti che si chiude è RISERVATO al completamento dell'evento (§10.3).
// Niente percentuali, niente numeri: si vede quanto manca, non si legge.

export function EventRing({ entryId, view }: { entryId: string; view: 'capostipite' | 'fornitore' | 'sposi' }) {
  const [ring, setRing] = useState<RingState | null>(null)
  // picker "suggerisci fornitore": ruolo aperto + lista fornitori + stato
  const [pick, setPick] = useState<{ roleKey: string; label: string } | null>(null)
  const [suppliers, setSuppliers] = useState<Suggestable[] | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  // invito email a un fornitore NON ancora su Planfully (conta per i punti referral)
  const [invite, setInvite] = useState<{ email: string; sending: boolean }>({ email: '', sending: false })
  // aggiungi wedding planner / location (capostipite): picker dei già iscritti + email
  const [capEmail, setCapEmail] = useState('')
  const [capBusy, setCapBusy] = useState(false)
  const [caps, setCaps] = useState<Capostipite[] | null>(null)
  // il cerchio NON è chiuso: si possono aggiungere altri ruoli/fornitori
  const [addOpen, setAddOpen] = useState(false)
  const [addBusy, setAddBusy] = useState<string | null>(null)
  // richieste pendenti da approvare (vista sposi)
  const [sugs, setSugs] = useState<CircleSuggestion[]>([])

  const load = useCallback(async () => {
    if (!entryId) return
    const r = await rpc<RingState & { error?: string }>('get_event_ring', { p_entry: entryId })
    if (r && !r.error) setRing(r)
    if (view === 'sposi') {
      const sr = await rpc<{ suggestions?: CircleSuggestion[]; error?: string }>('list_circle_suggestions', { p_entry: entryId })
      setSugs(sr?.suggestions ?? [])
    }
  }, [entryId, view])

  useEffect(() => { void load() }, [load])
  // carica i capostipiti già iscritti (per il picker) quando si apre il modale
  useEffect(() => {
    if (!addOpen || caps !== null) return
    void rpc<{ caps?: Capostipite[] }>('list_addable_capostipiti', { p_entry: entryId }).then((r) => setCaps(r?.caps ?? []))
  }, [addOpen, caps, entryId])

  async function openPicker(roleKey: string, label: string) {
    setPick({ roleKey, label })
    setSuppliers(null)
    const r = await rpc<{ suppliers?: Suggestable[]; error?: string }>('list_suggestable_suppliers', { p_entry: entryId, p_role_key: roleKey })
    if (r?.error) { toast.error(r.error === 'forbidden' ? 'Non puoi suggerire su questo evento.' : r.error); setPick(null); return }
    setSuppliers(r?.suppliers ?? [])
  }

  async function addCapostipite() {
    const email = capEmail.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Email non valida'); return }
    setCapBusy(true)
    try {
      const r = await rpc<{ ok?: boolean; error?: string }>('event_add_capostipite', { p_entry: entryId, p_email: email })
      if (r?.error) {
        toast.error(r.error === 'not_found' ? 'Nessun account con questa email.'
          : r.error === 'not_a_planner' ? 'Questo account non è un wedding planner / location.'
          : r.error === 'forbidden' ? 'Non puoi aggiungere collaboratori a questo evento.' : 'Operazione non riuscita.')
        return
      }
      toast.success('Wedding planner / location aggiunto al cerchio')
      setCapEmail(''); setAddOpen(false); await load()
    } catch (e) { toast.error((e as Error).message) } finally { setCapBusy(false) }
  }

  async function addCapById(id: string) {
    setCapBusy(true)
    try {
      const r = await rpc<{ ok?: boolean; error?: string }>('event_add_capostipite_id', { p_entry: entryId, p_user: id })
      if (r?.error) { toast.error(r.error === 'forbidden' ? 'Non puoi aggiungere qui.' : 'Operazione non riuscita.'); return }
      toast.success('Wedding planner / location aggiunto al cerchio')
      setAddOpen(false); await load()
    } catch (e) { toast.error((e as Error).message) } finally { setCapBusy(false) }
  }

  // Inserimento nel cerchio dell'evento = SEMPRE condivisione (SHARE), gratis e senza richiesta €39.
  // Il credito referral €39 vive SOLO nella fase preventivo ("Suggerisci i miei fornitori"), non qui.
  async function addSupplier(s: Suggestable) {
    setAdding(s.id)
    try {
      const r = await rpc<{ ok?: boolean; pending?: boolean; error?: string }>('suggest_supplier_to_event', { p_entry: entryId, p_supplier: s.id, p_kind: 'SHARE' })
      if (r?.error) {
        toast.error(r.error === 'not_a_supplier' ? 'Profilo non valido.' : `Non aggiunto: ${r.error}`)
        return
      }
      if (r?.pending) toast.success(`Richiesta inviata agli sposi: ${s.name} entrerà quando accettano.`)
      else toast.success(`${s.name} è ora nell'evento`)
      setPick(null); setSuppliers(null)
      await load()
    } finally { setAdding(null) }
  }

  // Gli sposi rispondono a una richiesta (accetta con firma leggera / rifiuta).
  async function respondSuggestion(id: string, accept: boolean) {
    let name: string | null = null
    if (accept) {
      name = prompt('Per accettare, firma col tuo nome e cognome:')
      if (name === null) return
      if (!name.trim()) { toast.error('Firma richiesta'); return }
    }
    const r = await rpc<{ ok?: boolean; error?: string }>('respond_circle_suggestion', { p_suggestion: id, p_accept: accept, p_signed_name: name })
    if (r?.error) { toast.error(r.error === 'signature_required' ? 'Firma richiesta' : r.error); return }
    toast.success(accept ? 'Fornitore accettato nel cerchio' : 'Richiesta rifiutata')
    await load()
  }

  // Invita per email un fornitore non iscritto: l'invito è registrato a tuo nome
  // (capostipite_id = tu) → vale per i tuoi punti referral secondo la logica esistente.
  async function sendInvite() {
    const email = invite.email.trim().toLowerCase()
    if (!email.includes('@')) { toast.error('Email non valida'); return }
    // riservo il popup sul gesto del click → poi lo dirotto su WhatsApp (no popup-block)
    const waWin = window.open('', '_blank')
    setInvite((s) => ({ ...s, sending: true }))
    try {
      const { data, error } = await supabase.functions.invoke('invite-supplier', {
        // entry_id + role_key: l'invito è legato a QUESTO evento → su evento passato il
        // fornitore, una volta iscritto, entra subito nel cerchio e vede le foto condivise.
        body: { email, subrole: pick?.roleKey, entry_id: entryId, role_key: pick?.roleKey, message: `Ti invito su Planfully per collaborare a un evento come ${pick?.label}.` },
      })
      if (error) throw error
      const d = data as { mode?: string; error?: string; accept_url?: string }
      if (d?.error) { waWin?.close(); toast.error(d.error); return }
      // finché le email non sono stabili: lo stesso pulsante apre anche WhatsApp con il link
      const url = d.accept_url || window.location.origin
      const text = `Ciao! Ti invito su Planfully per collaborare a un evento${pick?.label ? ` come ${pick.label}` : ''}. Registrati qui: ${url}`
      if (waWin) waWin.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`
      // Sii onesti: se l'email NON è partita (es. provider non configurato) non dire "email inviata".
      if (d?.mode === 'email_failed_link_fallback') toast.message(`Email non inviata a ${email} — ho aperto WhatsApp col link`)
      else toast.success(`Invito inviato a ${email} — email + WhatsApp`)
      setInvite({ email: '', sending: false })
    } catch (e) { waWin?.close(); toast.error((e as Error).message) } finally { setInvite((s) => ({ ...s, sending: false })) }
  }

  // Aggiunge un nuovo ruolo al cerchio (oltre i 10 standard): il cerchio è aperto.
  async function addRole(s: { v: string; l: string }) {
    setAddBusy(s.v)
    try {
      const r = await rpc<{ ok?: boolean; error?: string }>('set_event_ring_role', { p_entry: entryId, p_role_key: s.v, p_active: true, p_label: s.l })
      if (r?.error) { toast.error(r.error === 'forbidden' ? 'Non puoi modificare il cerchio.' : r.error); return }
      await load()
    } finally { setAddBusy(null) }
  }

  if (!ring || ring.total === 0) return null

  const canSuggest = view === 'fornitore' || view === 'capostipite'
  const addable = SUPPLIER_SUBROLES.filter((s) => !ring.roles.some((r) => r.role_key === s.v))
  const N = ring.total
  const size = 168, cx = size / 2, cy = size / 2, r = 70, sw = 14
  const C = 2 * Math.PI * r
  const progress = N > 0 ? ring.covered / N : 0

  return (
    <div className="surface surface-lift p-5 sm:p-6">
      {view === 'sposi' && sugs.length > 0 && (
        <div className="mb-4 rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/40 p-3 space-y-2">
          <p className="text-sm font-medium">Richieste di fornitori da approvare</p>
          {sugs.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 text-sm flex-wrap">
              <span className="min-w-0">
                <strong>{s.supplier_name}</strong>
                {s.role_key && <span className="text-[rgb(var(--fg-subtle))]"> · {s.role_key}</span>}
                <span className="block text-[11px] text-[rgb(var(--fg-subtle))]">suggerito da {s.suggested_by_name}</span>
              </span>
              <span className="flex items-center gap-1.5 shrink-0">
                <Button variant="gold" size="sm" onClick={() => respondSuggestion(s.id, true)}>Accetta (firma)</Button>
                <Button variant="ghost" size="sm" onClick={() => respondSuggestion(s.id, false)}>Rifiuta</Button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        {/* Anello */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <defs>
              <linearGradient id="ringGold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgb(var(--gold-600))" />
                <stop offset="55%" stopColor="rgb(var(--gold-500))" />
                <stop offset="100%" stopColor="rgb(var(--gold-300))" />
              </linearGradient>
            </defs>
            {/* track (binario di fondo) */}
            <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} stroke="rgb(var(--bg-sunken))" />
            {/* arco di progressione continuo, stile anello Apple */}
            <motion.circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} strokeLinecap="round"
              stroke="url(#ringGold)" strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C * (1 - progress) }}
              transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
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

          {ring.wp && ring.wp.length > 0 && (
            <div className="mt-2 mb-1 pb-1.5 border-b border-[rgb(var(--border))] space-y-1">
              {ring.wp.map((w, i) => (
                <div key={`${w.name}-${i}`} className="flex items-center gap-2 text-sm">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full shrink-0" style={{ background: 'rgb(var(--gold-600))' }}>
                    <Sparkles size={10} className="text-white" />
                  </span>
                  <span className="font-medium truncate">{w.name}</span>
                  <span className="text-[11px] text-[rgb(var(--fg-subtle))] shrink-0">· {wpRoleLabel(w.role)}</span>
                </div>
              ))}
            </div>
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
          {canSuggest && (
            <button type="button" onClick={() => setAddOpen(true)}
              className="mt-3 text-xs text-[rgb(var(--gold-600))] hover:underline inline-flex items-center gap-1">
              <Plus size={13} /> Aggiungi un fornitore / collaboratore
            </button>
          )}
        </div>
      </div>

      {/* Aggiungi ruolo: il cerchio è aperto, si possono inserire altri fornitori */}
      {addOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAddOpen(false)}>
          <div className="bg-[rgb(var(--bg))] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
              <div>
                <h4 className="font-medium">Aggiungi un fornitore al cerchio</h4>
                <p className="text-[11px] text-[rgb(var(--fg-muted))]">Anche a evento concluso: scegli il ruolo, poi inviti o suggerisci. Le collaborazioni restano sempre gestibili.</p>
              </div>
              <button className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={() => setAddOpen(false)} aria-label="Chiudi"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto p-2 space-y-3">
              {addable.length > 0 && (
                <div>
                  <p className="px-1 text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mb-1">Aggiungi un ruolo mancante</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {addable.map((s) => (
                      <button key={s.v} type="button" disabled={addBusy === s.v} onClick={() => addRole(s)}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-60 text-left text-sm">
                        <span className="truncate">{s.l}</span>
                        {addBusy === s.v ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Plus size={14} className="text-[rgb(var(--gold-600))] shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="px-1 text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mb-1">Invita un fornitore per un ruolo</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {SUPPLIER_SUBROLES.map((s) => (
                    <button key={`inv-${s.v}`} type="button" onClick={() => { setAddOpen(false); openPicker(s.v, s.l) }}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-[rgb(var(--bg-sunken))] text-left text-sm">
                      <span className="truncate">{s.l}</span>
                      <UserPlus size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="px-1 text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mb-1">Aggiungi wedding planner / location</p>
                {caps && caps.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 mb-2">
                    {caps.map((c) => (
                      <button key={c.id} type="button" disabled={c.in_event || capBusy} onClick={() => addCapById(c.id)}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-60 disabled:cursor-not-allowed text-left text-sm">
                        <span className="min-w-0">
                          <span className="block truncate">{c.name}</span>
                          <span className="block text-[11px] text-[rgb(var(--fg-subtle))]">{wpRoleLabel(c.role)}</span>
                        </span>
                        {c.in_event
                          ? <span className="text-[11px] text-[rgb(var(--emerald-600))] inline-flex items-center gap-0.5 shrink-0"><Check size={12} /> nell'evento</span>
                          : <UserPlus size={14} className="text-[rgb(var(--gold-600))] shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
                <p className="px-1 text-[11px] text-[rgb(var(--fg-muted))] mb-1.5">{caps && caps.length > 0 ? 'Oppure aggiungi per email:' : 'Aggiungi per email (account Planfully): entra subito nel cerchio.'}</p>
                <div className="flex gap-2 px-1">
                  <input type="email" value={capEmail} onChange={(e) => setCapEmail(e.target.value)} placeholder="email del wedding planner / location"
                    className="flex-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2.5 py-1.5 text-sm" />
                  <Button variant="outline" size="sm" disabled={capBusy} onClick={addCapostipite}>
                    {capBusy ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Aggiungi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <p className="text-[11px] text-[rgb(var(--fg-muted))]">Non lo trovi? <strong>Invitalo su Planfully</strong>: l'invito è legato a questo evento, così una volta iscritto <strong>entra subito nel cerchio</strong> (per gli eventi passati, senza conferma degli sposi) e <strong>trova le foto condivise</strong>. Registrato a tuo nome → vale anche per i tuoi punti referral.</p>
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
