import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FileText, ArrowUpRight, X, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useCreateQuote, useDeleteQuote, useQuotes } from '@/hooks/useQuotes'
import { HelpDot } from '@/components/help/HelpDot'
import { useAuth } from '@/lib/auth'

type BusyCheck = {
  busy: boolean
  quotes: Array<{ id: string; title: string; client_name: string | null; status: string; total_client: number; revision: number }>
  entries: Array<{ id: string; title: string; status: string; kind: string }>
}

type Act = { stage: string; open_count: number; last_opened_at: string | null; registered: boolean }
const STAGE: Record<string, { l: string; c: string }> = {
  BOZZA: { l: 'Bozza', c: '#94a3b8' },
  INVIATO: { l: 'Inviato', c: '#6366f1' },
  APERTO: { l: 'Aperto dal cliente', c: '#0ea5e9' },
  REGISTRATO: { l: 'Cliente registrato', c: '#d97706' },
  ACCETTATO: { l: 'Accettato', c: '#16a34a' },
  RIFIUTATO: { l: 'Rifiutato', c: '#dc2626' },
}

export default function QuotesPage() {
  const { data, isLoading } = useQuotes()
  const { profile } = useAuth()
  const isLocation = profile?.role === 'LOCATION'
  const [activity, setActivity] = useState<Record<string, Act>>({})
  useEffect(() => {
    const ids = (data ?? []).map((q) => q.id)
    if (ids.length === 0) return
    void (async () => {
      const { data: r } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }> })
        .rpc('quotes_activity_summary', { p_quote_ids: ids })
      setActivity(((r as { map?: Record<string, Act> })?.map) ?? {})
    })()
  }, [data])
  const create = useCreateQuote()
  const del = useDeleteQuote()
  const nav = useNavigate()
  const [openNew, setOpenNew] = useState(false)
  const [form, setForm] = useState({
    title: '', client_name: '', client_email: '', event_date: '', guest_count: '', event_location: '', event_kind: 'matrimonio',
  })
  const [createErr, setCreateErr] = useState<string | null>(null)
  const [busyCheck, setBusyCheck] = useState<BusyCheck | null>(null)
  const [checkingBusy, setCheckingBusy] = useState(false)

  // Verifica disponibilità data evento in tempo reale
  useEffect(() => {
    if (!openNew || !form.event_date) { setBusyCheck(null); return }
    setCheckingBusy(true)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('check_owner_date_busy', { p_date: form.event_date })
        if (error) throw error
        setBusyCheck(data as BusyCheck)
      } catch {
        setBusyCheck(null)
      } finally {
        setCheckingBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [openNew, form.event_date])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateErr(null)
    try {
      const q = await create.mutateAsync({
        title: form.title.trim(),
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        event_date: form.event_date || null,
        guest_count: form.guest_count ? Number(form.guest_count) : null,
        event_location: form.event_location || null,
        event_kind: form.event_kind || 'matrimonio',
      } as never)
      toast.success('Preventivo creato')
      nav(`/quotes/${q.id}`)
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Preventivi"
          title="Le tue offerte"
          description="Crea, invia e monitora i preventivi. Stato e margine aggiornati in tempo reale."
          actions={
            <span className="inline-flex items-center gap-1.5">
              <Button variant="gold" onClick={() => setOpenNew(true)} data-testid="new-quote-btn">
                <Plus /> Nuovo preventivo
              </Button>
              <HelpDot id="quotes.nuovo" />
            </span>
          }
        />

        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="skeleton h-20" />))}
          </div>
        )}

        {!isLoading && (data ?? []).length === 0 && (
          <div className="surface surface-elev p-12 text-center max-w-xl mx-auto" data-testid="empty-quotes">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <FileText size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Ancora nessun preventivo</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Crea il primo per iniziare a vendere.</p>
            <Button variant="gold" onClick={() => setOpenNew(true)}>
              <Plus /> Crea preventivo
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map((q, idx) => (
            <motion.div key={q.id} data-testid={`quote-${q.id}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.02, 0.3) }}
            >
              <Card className="hover:shadow-[var(--shadow-lift)] transition-shadow">
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link to={`/quotes/${q.id}`} className="font-medium hover:underline truncate inline-flex items-center gap-1">
                        {q.title} <ArrowUpRight size={14} className="opacity-60" />
                      </Link>
                      <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                        v{q.revision} · {q.client_name ?? '— Cliente —'} · {q.event_date ?? 'Data libera'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className="inline-flex items-center gap-1">
                        {idx === 0 && <HelpDot id="quotes.stato" />}
                        <Badge status={q.status} />
                      </span>
                      {activity[q.id] && (() => {
                        const a = activity[q.id]!; const s = STAGE[a.stage] ?? STAGE.INVIATO!
                        return (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: s.c, background: `${s.c}1a` }}
                            title={a.last_opened_at ? `Ultima apertura: ${new Date(a.last_opened_at).toLocaleString('it-IT')}` : undefined}>
                            {s.l}{a.open_count > 0 ? ` · ${a.open_count}×` : ''}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Cliente</p>
                      <p className="font-display text-lg tabular-nums">
                        € {Number(q.total_client).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1">Margine {idx === 0 && <HelpDot id="quotes.margine" />}</p>
                      <p className="font-display text-lg tabular-nums">
                        € {Number(q.margin_amount).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">%</p>
                      <p className="font-display text-lg tabular-nums">{Number(q.margin_percent).toFixed(1)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/quotes/${q.id}`}>Apri editor</Link>
                    </Button>
                    <Button variant="ghost" size="icon"
                      onClick={async () => {
                        if (!confirm(`Elimini definitivamente questo preventivo?\n\nVerranno cancellati per sempre:\n• Tutte le voci e i markup\n• Eventuali accettazioni cliente con firme digitali\n• Contratti generati dal preventivo\n• Documenti caricati e PDF di firma\n\nL'azione è IRREVERSIBILE e conforme al GDPR 196/2003.`)) return
                        try { await del.mutateAsync(q.id); toast.success('Preventivo eliminato. Dati cliente rimossi.') }
                        catch (e) { toast.error((e as Error).message) }
                      }}
                      title="Elimina preventivo (GDPR)">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {openNew && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpenNew(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-md surface surface-lift overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
                <h2 className="font-display text-lg">Nuovo preventivo</h2>
                <Button variant="ghost" size="icon" onClick={() => setOpenNew(false)}><X size={18} /></Button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4" data-testid="quote-create-form">
                <div className="space-y-1">
                  <Label htmlFor="title">Titolo</Label>
                  <Input id="title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Es. Matrimonio Rossi, Battesimo Giulia, Comunione Marco..." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="cname">Cliente</Label>
                    <Input id="cname" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cemail">Email</Label>
                    <Input id="cemail" type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edate">Data evento</Label>
                    <Input id="edate" type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gc">Invitati</Label>
                    <Input id="gc" type="number" value={form.guest_count} onChange={(e) => setForm((f) => ({ ...f, guest_count: e.target.value }))} />
                  </div>
                </div>
                {/* Alert disponibilità data */}
                {form.event_date && busyCheck?.busy && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border p-3 text-xs"
                    style={{
                      borderColor: 'rgb(var(--amber-500))',
                      background: 'rgb(var(--amber-100))',
                      color: 'rgb(var(--ink, 26 23 20))',
                    }}>
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-[rgb(var(--amber-500))]" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">Hai già impegni su questa data</p>
                        <ul className="mt-1 space-y-0.5">
                          {busyCheck.quotes.map((q) => (
                            <li key={q.id} className="truncate">
                              · <strong>{q.status}</strong> · {q.title} {q.client_name && `(${q.client_name})`}
                            </li>
                          ))}
                          {busyCheck.entries.map((e) => (
                            <li key={e.id} className="truncate">
                              · Calendario <strong>{e.status}</strong> · {e.title}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 opacity-80">Procedi solo se sei sicuro di poter gestire più eventi contemporaneamente.</p>
                      </div>
                    </div>
                  </motion.div>
                )}
                {form.event_date && checkingBusy && !busyCheck && (
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Verifica disponibilità...</p>
                )}
                <div className="space-y-1">
                  <Label htmlFor="eloc">{isLocation ? 'Zona (dove vogliono sposarsi)' : 'Location evento'}</Label>
                  <Input id="eloc" value={form.event_location} onChange={(e) => setForm((f) => ({ ...f, event_location: e.target.value }))}
                    placeholder={isLocation ? 'Es. Tropea, costa cosentina…' : 'Es. Villa Rosa - Tropea'} />
                  {isLocation && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Tu sei già la sede: indica al massimo la zona di interesse della coppia.</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ekind">Tipo evento</Label>
                  <select id="ekind" value={form.event_kind}
                    onChange={(e) => setForm((f) => ({ ...f, event_kind: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm">
                    <option value="matrimonio">Matrimonio</option>
                    <option value="battesimo">Battesimo</option>
                    <option value="cresima">Cresima</option>
                    <option value="comunione">Prima comunione</option>
                    <option value="compleanno">Compleanno</option>
                    <option value="anniversario">Anniversario</option>
                    <option value="laurea">Festa di laurea</option>
                    <option value="corporate">Evento aziendale</option>
                    <option value="altro">Altro</option>
                  </select>
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))]">
                    Disciplina linguaggio email, PDF, form firma e contratto.
                  </p>
                </div>
                {createErr && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert" data-testid="quote-create-error">{createErr}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>Annulla</Button>
                  <Button type="submit" variant="gold">Crea e apri</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
