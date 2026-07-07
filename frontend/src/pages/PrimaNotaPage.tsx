import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDownCircle, ArrowUpCircle, Plus, RefreshCw, Trash2, Pencil, X, Wallet, TrendingUp, TrendingDown, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { eur } from '@/lib/money'

type Direction = 'ENTRATA' | 'USCITA'
type Source = 'MANUAL' | 'QUOTE_ITEM' | 'FB_PO'
type PN = {
  id: string
  owner_id: string
  entry_date: string
  direction: Direction
  amount: number
  description: string
  category: string | null
  method: string | null
  event_id: string | null
  source: Source
  source_ref_id: string | null
  note: string | null
  created_at: string
}

// Cast leggero: la tabella/RPC non sono ancora nei tipi generati.
const sb = supabase as unknown as {
  from: (t: string) => any
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>
}

const METHODS = ['CONTANTI', 'BONIFICO', 'POS', 'ASSEGNO', 'ALTRO']
const CATEGORIES = ['Incasso preventivo', 'Acconto', 'Saldo', 'Mancia', 'Acquisti F&B', 'Utenze', 'Stipendi', 'Manutenzione', 'Tasse', 'Altro']
const SOURCE_LABEL: Record<Source, string> = { MANUAL: 'Manuale', QUOTE_ITEM: 'Da preventivo', FB_PO: 'Da ordine F&B' }

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Draft = {
  id?: string
  entry_date: string
  direction: Direction
  amount: string
  description: string
  category: string
  method: string
  note: string
}

function emptyDraft(direction: Direction): Draft {
  return { entry_date: new Date().toISOString().slice(0, 10), direction, amount: '', description: '', category: '', method: '', note: '' }
}

export default function PrimaNotaPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<PN[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [month, setMonth] = useState<string>(monthKey())
  const [filter, setFilter] = useState<'ALL' | Direction>('ALL')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await sb.from('prima_nota_entries').select('*').order('entry_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) { toast.error(error.message); return }
    setRows((data as PN[]) ?? [])
  }, [])

  const sync = useCallback(async (silent = false) => {
    setSyncing(true)
    try {
      const { error } = await sb.rpc('prima_nota_sync')
      if (error) throw error
      await load()
      if (!silent) toast.success('Prima nota sincronizzata')
    } catch (e) { toast.error((e as Error).message) }
    finally { setSyncing(false) }
  }, [load])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      await sync(true) // sincronizza le righe AUTO all'apertura, poi mostra tutto
      setLoading(false)
    })()
  }, [sync])

  // mesi disponibili (dai dati) + mese corrente sempre presente
  const months = useMemo(() => {
    const set = new Set<string>([monthKey()])
    for (const r of rows) set.add(r.entry_date.slice(0, 7))
    return Array.from(set).sort().reverse()
  }, [rows])

  const monthRows = useMemo(
    () => rows.filter((r) => r.entry_date.slice(0, 7) === month && (filter === 'ALL' || r.direction === filter)),
    [rows, month, filter],
  )

  const kpi = useMemo(() => {
    const inMonth = rows.filter((r) => r.entry_date.slice(0, 7) === month)
    const entrate = inMonth.filter((r) => r.direction === 'ENTRATA').reduce((s, r) => s + Number(r.amount), 0)
    const uscite = inMonth.filter((r) => r.direction === 'USCITA').reduce((s, r) => s + Number(r.amount), 0)
    const saldoTot = rows.reduce((s, r) => s + (r.direction === 'ENTRATA' ? 1 : -1) * Number(r.amount), 0)
    return { entrate, uscite, saldoMese: entrate - uscite, saldoTot }
  }, [rows, month])

  async function saveDraft() {
    if (!draft || !user) return
    const amount = Number(draft.amount.replace(',', '.'))
    if (!draft.description.trim()) { toast.error('Aggiungi una descrizione'); return }
    if (!(amount > 0)) { toast.error('Importo non valido'); return }
    setSaving(true)
    try {
      const payload = {
        owner_id: user.id,
        entry_date: draft.entry_date,
        direction: draft.direction,
        amount,
        description: draft.description.trim(),
        category: draft.category || null,
        method: draft.method || null,
        note: draft.note.trim() || null,
        source: 'MANUAL' as const,
      }
      if (draft.id) {
        const { error } = await sb.from('prima_nota_entries').update(payload).eq('id', draft.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('prima_nota_entries').insert(payload)
        if (error) throw error
      }
      setDraft(null)
      await load()
      toast.success('Movimento salvato')
    } catch (e) { toast.error((e as Error).message) }
    finally { setSaving(false) }
  }

  async function remove(r: PN) {
    if (!confirm('Eliminare questo movimento?')) return
    const { error } = await sb.from('prima_nota_entries').delete().eq('id', r.id)
    if (error) { toast.error(error.message); return }
    await load()
  }

  function editRow(r: PN) {
    setDraft({
      id: r.id, entry_date: r.entry_date, direction: r.direction, amount: String(r.amount),
      description: r.description, category: r.category ?? '', method: r.method ?? '', note: r.note ?? '',
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <PageHeader
        eyebrow="Cassa"
        title="Prima nota"
        description="Il registro di tutte le entrate e le uscite della location. Gli incassi dai preventivi e gli ordini F&B ricevuti entrano in automatico: tu aggiungi a mano contanti, mance e le altre spese."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void sync()} disabled={syncing}>
              <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} /> Sincronizza
            </Button>
            <Button onClick={() => setDraft(emptyDraft('ENTRATA'))}>
              <Plus size={15} /> Nuovo movimento
            </Button>
          </div>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Saldo cassa" value={eur(kpi.saldoTot)} icon={Wallet} accent={kpi.saldoTot >= 0 ? 'gold' : 'rose'} />
        <Kpi label="Entrate del mese" value={eur(kpi.entrate)} icon={TrendingUp} accent="emerald" />
        <Kpi label="Uscite del mese" value={eur(kpi.uscite)} icon={TrendingDown} accent="rose" />
        <Kpi label="Saldo del mese" value={eur(kpi.saldoMese)} icon={Sparkles} accent={kpi.saldoMese >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-sm bg-[rgb(var(--bg))]" style={{ borderColor: 'rgb(var(--border-strong))' }}>
          {months.map((m) => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</option>)}
        </select>
        <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: 'rgb(var(--border-strong))' }}>
          {(['ALL', 'ENTRATA', 'USCITA'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm ${filter === f ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
              {f === 'ALL' ? 'Tutti' : f === 'ENTRATA' ? 'Entrate' : 'Uscite'}
            </button>
          ))}
        </div>
      </div>

      {/* Editor movimento manuale */}
      {draft && (
        <Card className="border-[rgb(var(--gold-300))]">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg">{draft.id ? 'Modifica movimento' : 'Nuovo movimento'}</h3>
              <button onClick={() => setDraft(null)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
            </div>
            <div className="flex rounded-lg border overflow-hidden w-fit" style={{ borderColor: 'rgb(var(--border-strong))' }}>
              {(['ENTRATA', 'USCITA'] as const).map((d) => (
                <button key={d} onClick={() => setDraft({ ...draft, direction: d })}
                  className={`px-4 py-1.5 text-sm inline-flex items-center gap-1.5 ${draft.direction === d ? (d === 'ENTRATA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700') + ' font-medium' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                  {d === 'ENTRATA' ? <ArrowDownCircle size={15} /> : <ArrowUpCircle size={15} />} {d === 'ENTRATA' ? 'Entrata' : 'Uscita'}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Field label="Data">
                <input type="date" value={draft.entry_date} onChange={(e) => setDraft({ ...draft, entry_date: e.target.value })} className="inp" />
              </Field>
              <Field label="Importo (€)">
                <input inputMode="decimal" placeholder="0,00" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} className="inp" />
              </Field>
              <Field label="Categoria">
                <input list="pn-cats" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="inp" placeholder="—" />
                <datalist id="pn-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Metodo">
                <select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value })} className="inp">
                  <option value="">—</option>
                  {METHODS.map((m) => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Descrizione">
              <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="inp" placeholder="Es. Acconto matrimonio Rossi / Contanti fioraio" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>Annulla</Button>
              <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista movimenti */}
      {loading ? (
        <div className="animate-pulse space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-[rgb(var(--bg-sunken))]" />)}</div>
      ) : monthRows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-[rgb(var(--fg-muted))]">
          Nessun movimento in questo mese. Aggiungi il primo o <button className="underline" onClick={() => void sync()}>sincronizza</button> gli incassi.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="p-0 divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
          {monthRows.map((r) => {
            const isEntrata = r.direction === 'ENTRATA'
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`shrink-0 rounded-full p-2 ${isEntrata ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {isEntrata ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.description}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[rgb(var(--fg-subtle))]">
                    <span>{new Date(r.entry_date).toLocaleDateString('it-IT')}</span>
                    {r.category && <><span>·</span><span>{r.category}</span></>}
                    {r.method && <><span>·</span><span>{r.method.charAt(0) + r.method.slice(1).toLowerCase()}</span></>}
                    {r.source !== 'MANUAL' && (
                      <span className="ml-1 rounded-full px-1.5 py-0.5 bg-[rgb(var(--bg-sunken))] text-[10px] uppercase tracking-wide">{SOURCE_LABEL[r.source]}</span>
                    )}
                  </div>
                </div>
                <div className={`shrink-0 text-sm font-semibold tabular-nums ${isEntrata ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {isEntrata ? '+' : '−'}{eur(r.amount)}
                </div>
                {r.source === 'MANUAL' ? (
                  <div className="shrink-0 flex items-center gap-1">
                    <button onClick={() => editRow(r)} className="p-1.5 rounded hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]" title="Modifica"><Pencil size={15} /></button>
                    <button onClick={() => void remove(r)} className="p-1.5 rounded hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--rose-500))]" title="Elimina"><Trash2 size={15} /></button>
                  </div>
                ) : (
                  <div className="shrink-0 w-[62px]" />
                )}
              </div>
            )
          })}
        </CardContent></Card>
      )}

      <style>{`.inp{width:100%;border-radius:0.5rem;border:1px solid rgb(var(--border-strong));background:rgb(var(--bg));padding:0.45rem 0.6rem;font-size:0.875rem}`}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1 text-[rgb(var(--fg-subtle))]">{label}</span>
      {children}
    </label>
  )
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Wallet; accent: 'gold' | 'emerald' | 'rose' }) {
  const bg = accent === 'gold' ? 'rgb(var(--gold-100))' : accent === 'emerald' ? 'rgb(220 252 231)' : 'rgb(255 228 230)'
  const fg = accent === 'gold' ? 'rgb(var(--gold-700))' : accent === 'emerald' ? 'rgb(4 120 87)' : 'rgb(190 18 60)'
  return (
    <Card><CardContent className="p-4">
      <div className="flex items-center gap-2 text-xs text-[rgb(var(--fg-muted))]">
        <span className="rounded-full p-1.5" style={{ background: bg, color: fg }}><Icon size={14} /></span>{label}
      </div>
      <div className="mt-2 text-xl font-semibold tabular-nums">{value}</div>
    </CardContent></Card>
  )
}
