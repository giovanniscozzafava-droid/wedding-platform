import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { UserPlus, Pencil, X as XIcon, Mail, Clock, CheckCircle2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Collab = {
  id: string
  capostipite_id: string
  status: string
  initiated_by: string
  supplier_markup_modifier_percent: number
  supplier_note: string | null
  invited_at: string
  accepted_at: string | null
  capostipite: {
    full_name: string | null
    business_name: string | null
    role: string
    city: string | null
  } | null
}

type ServiceLite = { id: string; name: string; base_price: number; unit: string }
type PriceOverride = { id?: string; service_id: string; override_price: number; notes?: string | null }

export default function SupplierCapostipitiPage() {
  const { user } = useAuth()
  const [collabs, setCollabs] = useState<Collab[]>([])
  const [services, setServices] = useState<ServiceLite[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [editing, setEditing] = useState<Collab | null>(null)
  const [pricingOverrides, setPricingOverrides] = useState<PriceOverride[]>([])
  const [markupMod, setMarkupMod] = useState('0')
  const [collabNote, setCollabNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!user) return
    setLoading(true)
    const [colRes, svcRes] = await Promise.all([
      supabase
        .from('collaborations')
        .select(`
          id, capostipite_id, status, initiated_by, supplier_markup_modifier_percent,
          supplier_note, invited_at, accepted_at,
          capostipite:profiles!collaborations_capostipite_id_fkey(full_name, business_name, role, city)
        `)
        .eq('fornitore_id', user.id)
        .order('invited_at', { ascending: false }),
      supabase
        .from('services')
        .select('id, name, base_price, unit')
        .eq('fornitore_id', user.id)
        .eq('is_active', true)
        .order('name'),
    ])
    setCollabs((colRes.data ?? []) as unknown as Collab[])
    setServices((svcRes.data ?? []) as ServiceLite[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [user])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviteBusy(true)
    try {
      const { data, error } = await supabase.rpc('supplier_invite_capostipite', { p_email: inviteEmail.trim() })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string; detail?: string; capostipite_name?: string; mode?: string }
      if (r.error === 'capostipite_non_trovato') {
        toast.error(r.detail ?? 'Capostipite non trovato')
      } else if (r.error === 'non_e_capostipite') {
        toast.error(r.detail ?? 'Account trovato ma non è wedding planner/location')
      } else if (r.error === 'gia_collaborano') {
        toast.info('Collaborate già attivamente')
      } else if (r.error) {
        toast.error(`Errore: ${r.error}`)
      } else if (r.ok) {
        toast.success(`Richiesta inviata${r.capostipite_name ? ' a ' + r.capostipite_name : ''}. ${r.mode === 'reopened' ? 'Collab riaperta' : 'Aspetta che accetti'}`)
        setInviteOpen(false)
        setInviteEmail('')
        await load()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore richiesta')
    } finally {
      setInviteBusy(false)
    }
  }

  async function openPricing(c: Collab) {
    setEditing(c)
    setMarkupMod(c.supplier_markup_modifier_percent.toString())
    setCollabNote(c.supplier_note ?? '')
    // Carica override esistenti
    const { data } = await supabase
      .from('supplier_capostipite_pricing')
      .select('id, service_id, override_price, notes')
      .eq('supplier_id', user!.id)
      .eq('capostipite_id', c.capostipite_id)
    setPricingOverrides((data ?? []) as PriceOverride[])
  }

  async function savePricing() {
    if (!editing || !user) return
    setSaving(true)
    try {
      // 1. Salva markup modifier + note sulla collab
      const { error: collErr } = await supabase
        .from('collaborations')
        .update({
          supplier_markup_modifier_percent: Number(markupMod) || 0,
          supplier_note: collabNote.trim() || null,
        })
        .eq('id', editing.id)
      if (collErr) throw collErr

      // 2. Upsert override prezzi per ogni servizio toccato
      const toUpsert = pricingOverrides.filter((p) => p.override_price > 0)
      if (toUpsert.length > 0) {
        const rows = toUpsert.map((p) => ({
          supplier_id: user.id,
          capostipite_id: editing.capostipite_id,
          service_id: p.service_id,
          override_price: Number(p.override_price),
          notes: p.notes ?? null,
        }))
        const { error: upErr } = await supabase
          .from('supplier_capostipite_pricing')
          .upsert(rows, { onConflict: 'supplier_id,capostipite_id,service_id' })
        if (upErr) throw upErr
      }
      // 3. Cancella override con override_price = 0 (reset)
      const toDel = pricingOverrides.filter((p) => p.id && p.override_price === 0).map((p) => p.id!)
      if (toDel.length > 0) {
        await supabase.from('supplier_capostipite_pricing').delete().in('id', toDel)
      }
      toast.success('Prezziario aggiornato')
      setEditing(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  function setOverride(serviceId: string, value: string) {
    const num = Number(value || 0)
    setPricingOverrides((arr) => {
      const idx = arr.findIndex((p) => p.service_id === serviceId)
      if (idx >= 0) {
        const next = [...arr]
        next[idx] = { ...next[idx]!, override_price: num }
        return next
      }
      return [...arr, { service_id: serviceId, override_price: num }]
    })
  }

  function getOverride(serviceId: string): number {
    return pricingOverrides.find((p) => p.service_id === serviceId)?.override_price ?? 0
  }

  const STATUS_TONE: Record<string, string> = {
    ACTIVE: 'rgb(var(--sage-100))',
    PENDING: 'rgb(var(--gold-100))',
    REVOKED: 'rgb(var(--bg-sunken))',
  }

  const sortedCollabs = useMemo(() => {
    const order = (s: string) => s === 'ACTIVE' ? 0 : s === 'PENDING' ? 1 : 2
    return [...collabs].sort((a, b) => order(a.status) - order(b.status))
  }, [collabs])

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Network"
          title="I tuoi capostipiti"
          description="I wedding planner e le location con cui collabori. Per ognuno puoi impostare prezzi personalizzati e modificatori di markup."
          actions={
            <Button variant="gold" onClick={() => setInviteOpen(true)}>
              <UserPlus size={14} /> Invita capostipite
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
        ) : sortedCollabs.length === 0 ? (
          <Card className="p-12 text-center">
            <UserPlus size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <h3 className="font-display text-lg mb-1">Nessun capostipite ancora</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Aggiungi i wedding planner o le location con cui lavori. Riceveranno una richiesta che possono accettare per iniziare la collaborazione.
            </p>
            <Button variant="gold" onClick={() => setInviteOpen(true)}>
              <UserPlus size={14} /> Invita il primo
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedCollabs.map((c, i) => {
              const name = c.capostipite?.business_name || c.capostipite?.full_name || 'Capostipite'
              const roleLabel = c.capostipite?.role === 'LOCATION' ? 'Location' : c.capostipite?.role === 'WEDDING_PLANNER' ? 'Wedding planner' : 'Admin'
              return (
                <motion.div key={c.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}>
                  <Card className="p-5 hover:shadow-[var(--shadow-lift)] transition-shadow h-full flex flex-col">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium truncate">{name}</h3>
                        <p className="text-xs text-[rgb(var(--fg-subtle))]">{roleLabel}{c.capostipite?.city ? ` · ${c.capostipite.city}` : ''}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: STATUS_TONE[c.status] ?? STATUS_TONE.REVOKED, color: 'rgb(var(--fg))' }}>
                        {c.status === 'ACTIVE' && <CheckCircle2 size={10} />}
                        {c.status === 'PENDING' && <Clock size={10} />}
                        {c.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Tuo markup modifier</p>
                        <p className="font-medium">{Number(c.supplier_markup_modifier_percent ?? 0) > 0 ? '+' : ''}{Number(c.supplier_markup_modifier_percent ?? 0)}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Iniziato da</p>
                        <p className="font-medium">{c.initiated_by === 'FORNITORE' ? 'Te' : 'Capostipite'}</p>
                      </div>
                    </div>
                    {c.supplier_note && (
                      <p className="text-xs text-[rgb(var(--fg-muted))] italic mb-3 line-clamp-2">{c.supplier_note}</p>
                    )}
                    <div className="flex items-center gap-2 mt-auto pt-2">
                      <Button size="sm" variant="outline" onClick={() => void openPricing(c)} disabled={c.status !== 'ACTIVE'}>
                        <Pencil size={13} /> Prezziario
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}

        {/* Modale invito */}
        {inviteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setInviteOpen(false)}>
            <div className="surface surface-elev max-w-md w-full p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl">Invita capostipite</h2>
                <Button variant="ghost" size="icon" onClick={() => setInviteOpen(false)} aria-label="Chiudi"><XIcon size={18} /></Button>
              </div>
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <Label htmlFor="capo-email">Email del wedding planner o della location</Label>
                  <Input id="capo-email" type="email" required value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="nome@studio.it" autoFocus />
                  <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                    Deve essere già registrato su Planfully come wedding planner o location. Se non lo è, chiedigli di iscriversi prima.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>Annulla</Button>
                  <Button type="submit" variant="gold" disabled={inviteBusy}>
                    <Mail size={14} /> {inviteBusy ? 'Invio…' : 'Invia richiesta'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modale prezziario */}
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setEditing(null)}>
            <div className="surface surface-elev max-w-3xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
                <div>
                  <h2 className="font-display text-xl">Prezziario per {editing.capostipite?.business_name || editing.capostipite?.full_name}</h2>
                  <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                    Modificatore globale + override per singolo servizio. Lascia il campo a 0 per usare il prezzo catalogo standard.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)} aria-label="Chiudi"><XIcon size={18} /></Button>
              </div>
              <div className="overflow-y-auto flex-1 p-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="mk-mod">Modificatore markup % (per questo capostipite)</Label>
                    <Input id="mk-mod" type="number" step="0.1" min="-100" value={markupMod}
                      onChange={(e) => setMarkupMod(e.target.value)} placeholder="0" />
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">
                      Negativo = sconto fidelizzazione, positivo = maggiorazione. Sommato al markup default del WP.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="note">Note interne (visibili solo a te)</Label>
                    <Input id="note" value={collabNote} onChange={(e) => setCollabNote(e.target.value)}
                      placeholder="Es. Paga sempre entro 30gg" />
                  </div>
                </div>

                <div>
                  <h3 className="font-display text-base mb-2">Override prezzi per servizio</h3>
                  {services.length === 0 ? (
                    <p className="text-sm text-[rgb(var(--fg-muted))] italic">Non hai ancora servizi nel catalogo. Aggiungili da Catalogo.</p>
                  ) : (
                    <ul className="space-y-2">
                      {services.map((s) => {
                        const ov = getOverride(s.id)
                        return (
                          <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{s.name}</p>
                              <p className="text-xs text-[rgb(var(--fg-subtle))]">
                                Prezzo catalogo: € {Number(s.base_price).toLocaleString('it-IT')} / {s.unit.toLowerCase()}
                              </p>
                            </div>
                            <div className="w-32">
                              <Input type="number" min="0" step="0.5"
                                value={ov || ''}
                                onChange={(e) => setOverride(s.id, e.target.value)}
                                placeholder="catalogo" />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
              <div className="border-t p-4 flex justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
                <Button variant="ghost" onClick={() => setEditing(null)}>Annulla</Button>
                <Button variant="gold" onClick={savePricing} disabled={saving}>
                  <Save size={14} /> {saving ? 'Salvataggio…' : 'Salva prezziario'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
