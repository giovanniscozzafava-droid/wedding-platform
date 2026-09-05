import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowDownLeft, ArrowUpRight, Wallet } from '@/components/icons/lucide'

// PILASTRO 2 — Cruscotto Finanze rete. Gated: il backend risponde 'disabled' finché
// il flag network_finance è spento (beta). Mostra debiti (BUNDLE: paghi i fornitori) e
// crediti (ITEMIZED: i fornitori ti girano il margine), con segna-pagato a mano.

const eur = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

type Settlement = {
  id: string; supplier: string; direction: 'CAPOSTIPITE_OWES_SUPPLIER' | 'SUPPLIER_OWES_CAPOSTIPITE'
  amount_due: number; amount_paid: number; residuo: number; status: 'MATURATO' | 'PARZIALE' | 'SALDATO'
  contract_id: string | null
  quote_title: string | null; event_date: string | null
}
type Overview = {
  ok?: boolean; error?: string
  settlements: Settlement[]
  totals: { da_pagare: number; da_incassare: number; maturato_totale: number; saldato_totale: number }
}

const STATUS_TONE: Record<string, string> = {
  MATURATO: 'rgb(var(--bg-sunken))', PARZIALE: 'rgb(var(--gold-100, 244 236 218))', SALDATO: 'rgb(var(--sage-100))',
}

export default function FinanzeRetePage() {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: d } = await (supabase.rpc as any)('network_finance_overview')
    setData(d as Overview)
    setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function segnaPagato(s: Settlement) {
    const verbo = s.direction === 'CAPOSTIPITE_OWES_SUPPLIER' ? 'pagato a' : 'incassato da'
    const raw = window.prompt(`Quanto hai ${verbo} ${s.supplier}? (residuo ${eur(s.residuo)})`, String(s.residuo))
    if (raw == null) return
    const amount = Number(raw.replace(',', '.'))
    if (!Number.isFinite(amount) || amount <= 0) { toast.error('Importo non valido'); return }
    const { data: r, error } = await (supabase.rpc as any)('mark_settlement_paid', { p_id: s.id, p_amount: amount })
    if (error) { toast.error(error.message); return }
    if ((r as any)?.error) { toast.error((r as any)?.hint || 'Non riuscito'); return }
    toast.success('Pagamento registrato')
    await load()
  }

  if (loading) {
    return <div className="p-10 flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))]"><Loader2 size={16} className="animate-spin" /> Carico…</div>
  }

  if (!data || data.error) {
    return (
      <div className="max-w-lg mx-auto p-8">
        <Card className="p-6 text-center">
          <Wallet size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <h1 className="text-lg font-semibold mb-1">Finanze rete</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {data?.error === 'disabled'
              ? 'Il cruscotto dei conti con i tuoi fornitori sarà disponibile a breve.'
              : 'Al momento non è possibile caricare i conti. Riprova.'}
          </p>
        </Card>
      </div>
    )
  }

  const t = data.totals
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Finanze rete</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))]">I conti con i tuoi fornitori: cosa devi pagare e cosa devi incassare.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[rgb(var(--fg-subtle))] text-xs uppercase tracking-wider"><ArrowUpRight size={14} /> Da pagare ai fornitori</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{eur(t.da_pagare)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[rgb(var(--fg-subtle))] text-xs uppercase tracking-wider"><ArrowDownLeft size={14} /> Da incassare dai fornitori</div>
          <div className="text-2xl font-semibold mt-1 tabular-nums">{eur(t.da_incassare)}</div>
        </Card>
      </div>

      {data.settlements.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun conto ancora. I conti nascono quando un cliente accetta un preventivo con i servizi di un fornitore.</Card>
      ) : (
        <div className="space-y-2">
          {data.settlements.map((s) => {
            const isDebt = s.direction === 'CAPOSTIPITE_OWES_SUPPLIER'
            return (
              <Card key={s.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{s.supplier}</div>
                  <div className="text-xs text-[rgb(var(--fg-subtle))] truncate">
                    {isDebt ? 'Gli devi (pacchetto)' : 'Ti deve il margine (voci separate)'}
                    {s.quote_title ? ` · ${s.quote_title}` : ''}
                    {s.contract_id && ' · collegato al mini-contratto: si aggiorna da solo quando incassi/paghi le rate'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular-nums font-medium">{eur(s.residuo)}<span className="text-[rgb(var(--fg-subtle))] text-xs"> / {eur(s.amount_due)}</span></div>
                  <span className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full mt-1" style={{ background: STATUS_TONE[s.status] ?? STATUS_TONE.MATURATO }}>{s.status}</span>
                </div>
                <Button size="sm" variant="outline" disabled={s.status === 'SALDATO' || !!s.contract_id} onClick={() => void segnaPagato(s)}>
                  {isDebt ? 'Segna pagato' : 'Segna incassato'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
