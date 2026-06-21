import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, Users, Mail, Phone, Calendar, Trash2, Pencil, FileText, X, CalendarHeart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  useSupplierClients,
  useCreateSupplierClient,
  useUpdateSupplierClient,
  useDeleteSupplierClient,
  type SupplierClientWithStats,
} from '@/hooks/useSupplierClients'
import { useCreateQuote } from '@/hooks/useQuotes'
import { supabase } from '@/lib/supabase'

const STATUS_TONE: Record<string, string> = {
  LEAD: 'rgb(var(--gold-100))',
  TRATTATIVA: 'rgb(var(--rose-100))',
  CLIENTE: 'rgb(var(--sage-100))',
  ARCHIVIATO: 'rgb(var(--bg-sunken))',
}

const EVENT_KINDS = ['matrimonio', 'battesimo', 'cresima', 'comunione', 'compleanno', 'altro']

type FormState = {
  full_name: string
  partner_name: string
  email: string
  phone: string
  event_date: string
  event_kind: string
  location_text: string
  guest_estimate: string
  budget_min: string
  budget_max: string
  notes: string
  source: string
  status: 'LEAD' | 'TRATTATIVA' | 'CLIENTE' | 'ARCHIVIATO'
}

const EMPTY_FORM: FormState = {
  full_name: '', partner_name: '', email: '', phone: '',
  event_date: '', event_kind: 'matrimonio', location_text: '',
  guest_estimate: '', budget_min: '', budget_max: '',
  notes: '', source: '', status: 'LEAD',
}

export default function SupplierClientsPage() {
  const { data, isLoading } = useSupplierClients()
  const create = useCreateSupplierClient()
  const update = useUpdateSupplierClient()
  const del = useDeleteSupplierClient()
  const createQuote = useCreateQuote()
  const nav = useNavigate()

  const [editing, setEditing] = useState<SupplierClientWithStats | null>(null)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOpen(true)
  }

  function openEdit(c: SupplierClientWithStats) {
    setEditing(c)
    setForm({
      full_name: c.full_name ?? '',
      partner_name: c.partner_name ?? '',
      email: c.email ?? '',
      phone: c.phone ?? '',
      event_date: c.event_date ?? '',
      event_kind: c.event_kind ?? 'matrimonio',
      location_text: '', // view non lo espone, lo riprenderà la mutate quando serve
      guest_estimate: '',
      budget_min: '',
      budget_max: '',
      notes: '',
      source: '',
      status: (c.status as FormState['status']) ?? 'LEAD',
    })
    setOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      toast.error('Nome cliente richiesto')
      return
    }
    const payload = {
      full_name: form.full_name.trim(),
      partner_name: form.partner_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      event_date: form.event_date || null,
      event_kind: form.event_kind || null,
      location_text: form.location_text.trim() || null,
      guest_estimate: form.guest_estimate ? Number(form.guest_estimate) : null,
      budget_min: form.budget_min ? Number(form.budget_min) : null,
      budget_max: form.budget_max ? Number(form.budget_max) : null,
      notes: form.notes.trim() || null,
      source: form.source.trim() || null,
      status: form.status,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, patch: payload })
        toast.success('Cliente aggiornato')
      } else {
        await create.mutateAsync(payload)
        toast.success('Cliente aggiunto')
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleDelete(c: SupplierClientWithStats) {
    if (!confirm(`Eliminare ${c.full_name}? I preventivi/contratti collegati restano (perdono solo il link).`)) return
    try {
      await del.mutateAsync(c.id)
      toast.success('Cliente eliminato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  async function handleNewQuoteFor(c: SupplierClientWithStats) {
    try {
      // Re-fetch cliente per avere location_text (la view non lo espone)
      const { data: full } = await supabase
        .from('supplier_clients').select('location_text').eq('id', c.id).maybeSingle()
      const q = await createQuote.mutateAsync({
        title: `Preventivo ${c.full_name}${c.partner_name ? ' & ' + c.partner_name : ''}`,
        client_name: [c.full_name, c.partner_name].filter(Boolean).join(' & '),
        client_email: c.email ?? null,
        event_date: c.event_date ?? null,
        event_location: (full as { location_text?: string | null } | null)?.location_text ?? null,
        direct_client_id: c.id,
      } as never)
      toast.success('Preventivo creato')
      nav(`/quotes/${q.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  // Apre il preventivo ESISTENTE del cliente (il più recente). Bug: il bottone creava sempre un
  // preventivo nuovo a 0, anche quando il cliente ne aveva già uno. Se non ne trova, ne crea uno.
  async function openLatestQuote(c: SupplierClientWithStats) {
    try {
      // Apre il preventivo che CONTA: valore più alto prima (così non apre una bozza vuota a 0
      // lasciata da un vecchio bug), a parità il più recente.
      const { data, error } = await supabase
        .from('quotes').select('id').eq('direct_client_id', c.id)
        .order('total_client', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (error) throw error
      if (data?.id) nav(`/quotes/${data.id}`)
      else await handleNewQuoteFor(c)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Clienti diretti"
          title="La tua rubrica clienti"
          description="Gestisci i clienti che ti contattano direttamente. Da qui crei preventivi e contratti senza passare da un wedding planner."
          actions={
            <Button variant="gold" onClick={openCreate} data-testid="new-client-btn">
              <Plus /> Nuovo cliente
            </Button>
          }
        />

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
          </div>
        )}

        {!isLoading && (data ?? []).length === 0 && (
          <div className="surface surface-elev p-12 text-center max-w-xl mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <Users size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Nessun cliente diretto</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Aggiungi il primo cliente che ti ha contattato direttamente per iniziare a tracciare preventivi e contratti.
            </p>
            <Button variant="gold" onClick={openCreate}>
              <Plus /> Aggiungi cliente
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((c, idx) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.02, 0.3) }}>
              <Card className="hover:shadow-[var(--shadow-lift)] transition-shadow h-full flex flex-col">
                <div className="p-5 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate">
                        {c.full_name}{c.partner_name && <span className="text-[rgb(var(--fg-muted))]"> & {c.partner_name}</span>}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ background: STATUS_TONE[c.status] ?? STATUS_TONE.LEAD, color: 'rgb(var(--fg))' }}>
                          {c.status}
                        </span>
                        {c.event_kind && (
                          <span className="text-[10px] text-[rgb(var(--fg-subtle))] capitalize">{c.event_kind}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-[rgb(var(--fg-muted))]">
                    {c.email && <p className="flex items-center gap-2 truncate"><Mail size={12} />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-2"><Phone size={12} />{c.phone}</p>}
                    {c.event_date && <p className="flex items-center gap-2"><Calendar size={12} />{new Date(c.event_date).toLocaleDateString('it-IT')}</p>}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 mt-auto border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Preventivi</p>
                      <p className="font-display text-base tabular-nums">{c.quote_count}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Quotato</p>
                      <p className="font-display text-base tabular-nums">€ {Number(c.quoted_amount ?? 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Firmati</p>
                      <p className="font-display text-base tabular-nums">{c.signed_contracts}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    {c.event_entry_id ? (
                      <>
                        <Button size="sm" variant="gold" onClick={() => nav(`/weddings/${c.event_entry_id}`)}>
                          <CalendarHeart size={14} /> Gestisci evento
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleNewQuoteFor(c)} disabled={createQuote.isPending} title="Nuovo preventivo">
                          <Plus size={14} />
                        </Button>
                      </>
                    ) : (c.quote_count ?? 0) > 0 ? (
                      <>
                        <Button size="sm" variant="gold" onClick={() => openLatestQuote(c)} title="Apri il preventivo">
                          <FileText size={14} /> Apri preventivo
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleNewQuoteFor(c)} disabled={createQuote.isPending} title="Nuovo preventivo">
                          <Plus size={14} />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="gold" onClick={() => handleNewQuoteFor(c)} disabled={createQuote.isPending}>
                        <FileText size={14} /> Preventivo
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
            <div className="surface surface-elev max-w-2xl w-full max-h-[90vh] overflow-auto p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl">{editing ? 'Modifica cliente' : 'Nuovo cliente diretto'}</h2>
                <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
              </div>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-1">
                  <Label htmlFor="full_name">Nome cliente *</Label>
                  <Input id="full_name" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Es. Andrea Rossi" />
                </div>
                <div>
                  <Label htmlFor="partner_name">Partner</Label>
                  <Input id="partner_name" value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Es. Sofia Bianchi" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="phone">Telefono</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="event_date">Data evento</Label>
                  <Input id="event_date" type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="event_kind">Tipo evento</Label>
                  <select id="event_kind" value={form.event_kind} onChange={(e) => setForm({ ...form, event_kind: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                    {EVENT_KINDS.map(k => <option key={k} value={k} className="capitalize">{k}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="location_text">Location</Label>
                  <Input id="location_text" value={form.location_text} onChange={(e) => setForm({ ...form, location_text: e.target.value })} placeholder="Villa, ristorante, città..." />
                </div>
                <div>
                  <Label htmlFor="guest_estimate">Invitati stimati</Label>
                  <Input id="guest_estimate" type="number" min="0" value={form.guest_estimate} onChange={(e) => setForm({ ...form, guest_estimate: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="budget_min">Budget min €</Label>
                    <Input id="budget_min" type="number" min="0" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="budget_max">Budget max €</Label>
                    <Input id="budget_max" type="number" min="0" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="source">Come ti ha trovato</Label>
                  <Input id="source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="instagram, passaparola, ..." />
                </div>
                <div>
                  <Label htmlFor="status">Stato</Label>
                  <select id="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FormState['status'] })}
                    className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                    <option value="LEAD">Lead</option>
                    <option value="TRATTATIVA">In trattativa</option>
                    <option value="CLIENTE">Cliente</option>
                    <option value="ARCHIVIATO">Archiviato</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="notes">Note</Label>
                  <textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm" />
                </div>

                <div className="md:col-span-2 flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
                  <Button type="submit" variant="gold" disabled={create.isPending || update.isPending}>
                    {editing ? 'Salva modifiche' : 'Crea cliente'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
