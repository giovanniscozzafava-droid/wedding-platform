// PAGAMENTI DEL CONTRATTO — proiezione dell'Art. 2.2 nell'app.
// I pagamenti non stanno più sulle voci di preventivo: nascono col contratto e
// riportano le rate con la cifra ESATTA che il cliente legge sul contratto. Qui il
// professionista registra l'incasso avvenuto (data, metodo, numero fattura/riferimento).
import { useCallback, useEffect, useState } from 'react'
import { Wallet, CheckCircle2, CircleDashed, Calendar, Receipt } from '@/components/icons/lucide'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Rata = {
  id: string
  seq: number
  label: string
  percent: number | null
  amount: number
  due_hint: string | null
  due_date: string | null
  paid: boolean
  paid_at: string | null
  paid_amount: number | null
  method: string | null
  reference: string | null
  notes: string | null
  fic_invoice_id: string | null
  fic_invoice_number: string | null
}

// database.types.ts è generato e non conosce ancora contract_payments: stesso
// escamotage già usato per supplier_contract_templates in ContractTab.
const cp = (): any => (supabase as any).from('contract_payments')

const METODI = ['Bonifico', 'Contanti', 'POS / Carta', 'Stripe', 'Assegno', 'Altro']
const eur = (n: number) => `€ ${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dmy = (d: string) => new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function ContractPayments({ contractId, total }: { contractId: string; total: number }) {
  const [rate, setRate] = useState<Rata[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ paid_at: '', paid_amount: '', method: 'Bonifico', reference: '', notes: '' })
  const [invoicingId, setInvoicingId] = useState<string | null>(null)
  const [invoiceFormId, setInvoiceFormId] = useState<string | null>(null)
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [reconcileId, setReconcileId] = useState<string | null>(null)
  const [reconcileNum, setReconcileNum] = useState('')
  const [reconcileBusy, setReconcileBusy] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await cp()
      .select('id, seq, label, percent, amount, due_hint, due_date, paid, paid_at, paid_amount, method, reference, notes, fic_invoice_id, fic_invoice_number')
      .eq('contract_id', contractId).order('seq')
    if (error) { setLoading(false); return }
    let rows = (data ?? []) as Rata[]
    // Contratti creati prima di questa funzione non hanno ancora le rate: le genero
    // dal contratto stesso (stessa aritmetica dell'Art. 2.2), una volta sola.
    if (rows.length === 0) {
      const { data: r } = await (supabase.rpc as any)('contract_payments_sync', { p_contract_id: contractId })
      if (r?.ok) {
        const { data: again } = await cp()
          .select('id, seq, label, percent, amount, due_hint, due_date, paid, paid_at, paid_amount, method, reference, notes, fic_invoice_id, fic_invoice_number')
          .eq('contract_id', contractId).order('seq')
        rows = (again ?? []) as Rata[]
      }
    }
    setRate(rows)
    setLoading(false)
  }, [contractId])

  useEffect(() => { void load() }, [load])

  function apri(r: Rata) {
    setOpenId(r.id)
    setForm({
      paid_at: r.paid_at ?? new Date().toISOString().slice(0, 10),
      paid_amount: String(r.paid_amount ?? r.amount),
      method: r.method ?? 'Bonifico',
      reference: r.reference ?? '',
      notes: r.notes ?? '',
    })
  }

  async function registra(r: Rata) {
    if (!form.paid_at) return toast.error('Indica la data dell’incasso')
    const importo = Number(form.paid_amount)
    if (!Number.isFinite(importo) || importo <= 0) return toast.error('Importo non valido')
    setSaving(true)
    // supabase-js NON lancia sugli errori Postgres: senza controllare `error` la rata
    // sembrerebbe registrata mentre il denaro non risulta da nessuna parte.
    const { error } = await cp().update({
      paid: true, paid_at: form.paid_at, paid_amount: importo,
      method: form.method, reference: form.reference.trim() || null, notes: form.notes.trim() || null,
    }).eq('id', r.id)
    setSaving(false)
    if (error) return toast.error('Non sono riuscito a registrare l’incasso. Riprova.')
    toast.success(`Incasso registrato: ${eur(importo)}`)
    setOpenId(null)
    void load()
  }

  async function annulla(r: Rata) {
    const { error } = await cp()
      .update({ paid: false, paid_at: null, paid_amount: null }).eq('id', r.id)
    if (error) return toast.error('Non sono riuscito ad annullare la registrazione.')
    toast.success('Registrazione annullata')
    void load()
  }

  // La scadenza è precompilata con quella già sul contratto (r.due_date), ma la
  // decide il professionista fattura per fattura: la può cambiare qui.
  function apriCreaFattura(r: Rata) {
    setInvoiceFormId(r.id)
    setInvoiceDueDate(r.due_date ?? new Date().toISOString().slice(0, 10))
  }

  async function creaFattura(r: Rata) {
    setInvoicingId(r.id)
    try {
      const { data, error } = await supabase.functions.invoke('fic-invoice-create', {
        body: { payment_id: r.id, due_date: invoiceDueDate || undefined },
      })
      if (error) throw error
      const res = data as { ok?: boolean; error?: string; hint?: string; already?: boolean; fic_invoice_number?: string | number }
      if (res?.error) { toast.error(res.hint ?? res.error); return }
      toast.success(res.already ? 'Fattura già emessa per questa rata' : `Fattura emessa${res.fic_invoice_number ? ` — n. ${res.fic_invoice_number}` : ''}`)
      setInvoiceFormId(null)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore creazione fattura')
    } finally {
      setInvoicingId(null)
    }
  }

  function apriRiconcilia(r: Rata) {
    setReconcileId(r.id)
    setReconcileNum(r.fic_invoice_number ?? '')
  }

  async function riconcilia(r: Rata) {
    if (!reconcileNum.trim()) return toast.error('Indica il numero della fattura già emessa')
    setReconcileBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('fic-invoice-reconcile', {
        body: { payment_id: r.id, invoice_number: reconcileNum.trim() },
      })
      if (error) throw error
      const res = data as { ok?: boolean; error?: string; hint?: string }
      if (res?.error) { toast.error(res.hint ?? res.error); return }
      toast.success('Fattura collegata')
      setReconcileId(null)
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore collegamento fattura')
    } finally {
      setReconcileBusy(false)
    }
  }

  if (loading || rate.length === 0) return null

  const incassato = rate.filter((r) => r.paid).reduce((s, r) => s + Number(r.paid_amount ?? r.amount), 0)
  const atteso = rate.reduce((s, r) => s + Number(r.amount), 0)
  const pct = atteso > 0 ? Math.min(100, Math.round((incassato / atteso) * 100)) : 0

  return (
    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-[rgb(var(--fg-muted))]">
          <Wallet size={13} /> Pagamenti del contratto
        </span>
        <span className="text-xs tabular-nums text-[rgb(var(--fg-muted))]">
          Incassato <strong className="text-[rgb(var(--fg))]">{eur(incassato)}</strong> di {eur(atteso)}
          {Math.abs(atteso - Number(total)) > 0.01 && (
            <span className="ml-1">· totale contratto {eur(Number(total))}</span>
          )}
        </span>
      </div>

      <div className="h-1.5 rounded-full mb-3 overflow-hidden" style={{ background: 'rgb(var(--bg-sunken))' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'rgb(var(--gold-500))' }} />
      </div>

      <ul className="space-y-2">
        {rate.map((r) => (
          <li key={r.id} className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                {r.due_date && !r.paid && (
                  <p className="text-xs font-semibold flex items-center gap-1 mb-0.5" style={{ color: 'rgb(var(--gold-700))' }}>
                    <Calendar size={12} /> da pagare entro il {dmy(r.due_date)}
                  </p>
                )}
                <p className="font-medium text-sm flex items-center gap-1.5">
                  {r.paid
                    ? <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    : <CircleDashed size={14} className="text-[rgb(var(--fg-subtle))] shrink-0" />}
                  {r.label}
                  {r.percent != null && <span className="text-[rgb(var(--fg-subtle))] font-normal">· {Number(r.percent)}%</span>}
                </p>
                {r.due_hint && (
                  <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{r.due_hint}</p>
                )}
                {r.paid && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Incassato {r.paid_at ? `il ${dmy(r.paid_at)}` : ''}
                    {r.method ? ` · ${r.method}` : ''}
                    {r.reference ? ` · rif. ${r.reference}` : ''}
                  </p>
                )}
                {r.fic_invoice_number && (
                  <p className="text-xs text-[rgb(var(--gold-600))] mt-1 flex items-center gap-1">
                    <Receipt size={11} /> Fattura n. {r.fic_invoice_number}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-display text-lg tabular-nums">{eur(r.amount)}</span>
                {r.paid ? (
                  <Button variant="ghost" size="sm" onClick={() => void annulla(r)}>Annulla</Button>
                ) : (
                  <Button variant="gold" size="sm" onClick={() => apri(r)}>Registra incasso</Button>
                )}
              </div>
            </div>

            {!r.fic_invoice_id && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => apriCreaFattura(r)}>
                  <Receipt size={13} /> Crea fattura
                </Button>
                <Button variant="ghost" size="sm" onClick={() => apriRiconcilia(r)}>Fattura già emessa altrove?</Button>
              </div>
            )}

            {invoiceFormId === r.id && (
              <div className="mt-3 pt-3 border-t flex flex-wrap items-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
                <div>
                  <Label>Scadenza pagamento fattura</Label>
                  <Input type="date" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} />
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">Puoi dare più o meno giorni di quanto scritto nel contratto.</p>
                </div>
                <Button variant="gold" size="sm" disabled={invoicingId === r.id} onClick={() => void creaFattura(r)}>
                  <Receipt size={13} /> {invoicingId === r.id ? 'Emetto…' : 'Emetti fattura'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setInvoiceFormId(null)}>Annulla</Button>
              </div>
            )}

            {reconcileId === r.id && (
              <div className="mt-3 pt-3 border-t flex flex-wrap items-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
                <div>
                  <Label>N° fattura già emessa</Label>
                  <Input value={reconcileNum} placeholder="es. 12/A" onChange={(e) => setReconcileNum(e.target.value)} />
                </div>
                <Button variant="gold" size="sm" disabled={reconcileBusy} onClick={() => void riconcilia(r)}>
                  {reconcileBusy ? 'Collego…' : 'Collega'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setReconcileId(null)}>Annulla</Button>
              </div>
            )}

            {openId === r.id && !r.paid && (
              <div className="mt-3 pt-3 border-t grid gap-2 sm:grid-cols-2" style={{ borderColor: 'rgb(var(--border))' }}>
                <div>
                  <Label>Data incasso</Label>
                  <Input type="date" value={form.paid_at} onChange={(e) => setForm((f) => ({ ...f, paid_at: e.target.value }))} />
                </div>
                <div>
                  <Label>Importo incassato</Label>
                  <Input type="number" step="0.01" value={form.paid_amount}
                    onChange={(e) => setForm((f) => ({ ...f, paid_amount: e.target.value }))} />
                </div>
                <div>
                  <Label>Metodo</Label>
                  <Select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}>
                    {METODI.map((m) => <option key={m} value={m}>{m}</option>)}
                  </Select>
                </div>
                <div>
                  <Label>N° fattura / riferimento</Label>
                  <Input value={form.reference} placeholder="es. FT 2026/114"
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Note (facoltative)</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button variant="gold" size="sm" disabled={saving} onClick={() => void registra(r)}>
                    {saving ? 'Registro…' : 'Conferma incasso'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>Annulla</Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
