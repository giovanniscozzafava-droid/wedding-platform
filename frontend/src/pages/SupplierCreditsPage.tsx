import { useEffect, useState, useCallback } from 'react'
import { Coins, ArrowUpRight, ArrowDownRight, Plus, Check, X, Handshake, Search } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

// ============================================================================
// Crediti tra fornitori: la rete si auto-organizza senza capostipite.
// Se segnalo un collega, lui mi riconosce un credito (~100€). Si salda in
// denaro o restituendo la segnalazione (reciproco). Traccia creditore/debitore.
// ============================================================================

const rpc = (fn: string, a?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, a)
const fmtE = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

type Balance = { counterpart_id: string; counterpart_name: string; subrole: string | null; net: number; open_count: number }
type Credit = {
  id: string; amount: number; status: string; reason: string | null; event_kind: string | null
  client_label: string | null; settlement_type: string | null; created_at: string; i_am_creditor: boolean
  creditor_name: string; debtor_name: string; counterpart_id: string
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'In attesa', ACCEPTED: 'Confermato', SETTLED: 'Saldato', CANCELLED: 'Annullato', DISPUTED: 'Contestato',
}

export default function SupplierCreditsPage() {
  const [balances, setBalances] = useState<Balance[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const load = useCallback(async () => {
    const [b, c] = await Promise.all([rpc('supplier_credit_balances'), rpc('list_supplier_credits')])
    setBalances(((b.data as { balances?: Balance[] })?.balances) ?? [])
    setCredits(((c.data as { credits?: Credit[] })?.credits) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  async function act(fn: string, args: Record<string, unknown>) {
    const { data, error } = await rpc(fn, args)
    const r = data as { ok?: boolean; error?: string }
    if (error || r?.error) { toast.error(r?.error || 'Errore'); return }
    toast.success('Fatto'); await load()
  }

  const totalCredit = balances.filter((b) => b.net > 0).reduce((s, b) => s + b.net, 0)
  const totalDebt = balances.filter((b) => b.net < 0).reduce((s, b) => s + Math.abs(b.net), 0)

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Rete" title="Crediti tra colleghi"
          description="Segnala un collega e ricevi un credito. Saldabile in denaro o con una segnalazione di ritorno."
          actions={<Button variant="gold" onClick={() => setShowForm((v) => !v)}><Plus size={16} /> Registra segnalazione</Button>} />

        {showForm && <ReferralForm onDone={() => { setShowForm(false); void load() }} />}

        {/* Riepilogo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
          <Card className="p-4">
            <div className="text-xs text-[rgb(var(--fg-muted))] inline-flex items-center gap-1"><ArrowUpRight size={14} className="text-[rgb(var(--emerald-500))]" /> Mi devono</div>
            <div className="text-2xl font-semibold mt-1" style={{ color: '#16a34a' }}>{fmtE(totalCredit)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-[rgb(var(--fg-muted))] inline-flex items-center gap-1"><ArrowDownRight size={14} className="text-[rgb(var(--rose-500))]" /> Devo</div>
            <div className="text-2xl font-semibold mt-1" style={{ color: '#dc2626' }}>{fmtE(totalDebt)}</div>
          </Card>
        </div>

        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : (
          <>
            {/* Bilanci per controparte */}
            {balances.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Saldo per collega</p>
                <div className="space-y-2">
                  {balances.map((b) => (
                    <Card key={b.counterpart_id} className="p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{b.counterpart_name}</p>
                        <p className="text-xs text-[rgb(var(--fg-muted))]">{b.subrole ?? ''} · {b.open_count} aperti</p>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: b.net > 0 ? '#16a34a' : '#dc2626' }}>
                        {b.net > 0 ? `+${fmtE(b.net)} (ti deve)` : `${fmtE(b.net)} (gli devi)`}
                      </span>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Movimenti */}
            <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Movimenti</p>
            {credits.length === 0 ? (
              <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun credito. Registra la tua prima segnalazione.</Card>
            ) : (
              <div className="space-y-2">
                {credits.map((c) => (
                  <Card key={c.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <Coins size={18} className="mt-0.5 shrink-0" style={{ color: c.i_am_creditor ? '#16a34a' : '#dc2626' }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          {c.i_am_creditor
                            ? <>Hai segnalato <strong>{c.debtor_name}</strong> — ti deve <strong>{fmtE(c.amount)}</strong></>
                            : <><strong>{c.creditor_name}</strong> ti ha segnalato — gli devi <strong>{fmtE(c.amount)}</strong></>}
                        </p>
                        <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                          {[c.event_kind, c.client_label, c.reason].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
                        {STATUS_LABEL[c.status] ?? c.status}{c.settlement_type ? ` · ${c.settlement_type === 'CASH' ? 'denaro' : 'reciproco'}` : ''}
                      </span>
                    </div>
                    {(c.status === 'PENDING' || c.status === 'ACCEPTED') && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {!c.i_am_creditor && c.status === 'PENDING' && (
                          <Button variant="outline" onClick={() => void act('accept_supplier_credit', { p_id: c.id })}><Check size={14} className="mr-1" /> Conferma</Button>
                        )}
                        <Button variant="outline" onClick={() => void act('settle_supplier_credit', { p_id: c.id, p_type: 'CASH' })}>Salda in denaro</Button>
                        <Button variant="outline" onClick={() => void act('settle_supplier_credit', { p_id: c.id, p_type: 'RECIPROCAL' })}><Handshake size={14} className="mr-1" /> Saldo con segnalazione</Button>
                        <Button variant="ghost" onClick={() => void act('cancel_supplier_credit', { p_id: c.id })}><X size={14} /></Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ReferralForm({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ id: string; full_name: string | null; business_name: string | null; subrole: string | null }[]>([])
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [amount, setAmount] = useState('100')
  const [eventKind, setEventKind] = useState('')
  const [clientLabel, setClientLabel] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  async function search() {
    if (q.trim().length < 2) return
    const { data } = await rpc('discover_suppliers', { p_search: q.trim(), p_limit: 8 })
    setResults((data as typeof results) ?? [])
  }

  async function submit() {
    if (!picked) { toast.error('Scegli il collega segnalato'); return }
    setSaving(true)
    const { data, error } = await rpc('log_supplier_referral', {
      p_debtor_id: picked.id, p_amount: Number(amount) || 100,
      p_reason: reason.trim() || null, p_event_kind: eventKind.trim() || null, p_client_label: clientLabel.trim() || null,
    })
    setSaving(false)
    const r = data as { ok?: boolean; error?: string }
    if (error || r?.error) { toast.error(r?.error || 'Errore'); return }
    toast.success('Segnalazione registrata'); onDone()
  }

  return (
    <Card className="p-4 mb-2">
      <p className="text-sm font-medium mb-3">Hai segnalato un collega? Registralo per tenere il conto.</p>
      {picked ? (
        <div className="flex items-center gap-2 mb-3 text-sm">
          <span className="px-2 py-1 rounded-lg" style={{ background: 'rgb(var(--bg-sunken))' }}>{picked.name}</span>
          <button onClick={() => setPicked(null)} className="text-xs text-[rgb(var(--fg-muted))]">cambia</button>
        </div>
      ) : (
        <div className="mb-3">
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca il collega (nome attività)…"
              onKeyDown={(e) => { if (e.key === 'Enter') void search() }} />
            <Button variant="outline" onClick={() => void search()}><Search size={15} /></Button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((r) => (
                <button key={r.id} onClick={() => { setPicked({ id: r.id, name: r.business_name || r.full_name || 'Collega' }); setResults([]) }}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border hover:bg-[rgb(var(--bg-sunken))]" style={{ borderColor: 'rgb(var(--border))' }}>
                  {r.business_name || r.full_name} {r.subrole && <span className="text-xs text-[rgb(var(--fg-subtle))]">· {r.subrole}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div><label className="text-xs text-[rgb(var(--fg-muted))]">Credito (€)</label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="text-xs text-[rgb(var(--fg-muted))]">Tipo evento</label><Input value={eventKind} onChange={(e) => setEventKind(e.target.value)} placeholder="matrimonio, battesimo…" /></div>
        <div><label className="text-xs text-[rgb(var(--fg-muted))]">Riferimento cliente</label><Input value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} placeholder="Es. Rossi / 12 lug" /></div>
      </div>
      <Input className="mt-2" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nota (facoltativa)" />
      <Button variant="gold" className="mt-3" onClick={() => void submit()} disabled={saving || !picked}>Registra segnalazione</Button>
    </Card>
  )
}
