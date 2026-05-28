import { useEffect, useState } from 'react'
import { FileSignature, CheckCircle2, Clock, AlertCircle, Plus, Copy, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useWedding } from '@/hooks/useWedding'

type Row = {
  id: string
  title: string
  party_kind: 'CLIENT_WP' | 'SUPPLIER_WP' | 'SUPPLIER_CLIENT'
  status: string
  supplier_id: string | null
  supplier_name: string | null
  client_name: string | null
  signed_at: string | null
  countersign_at: string | null
  total_amount: number | null
  access_token: string
}

type Supplier = { id: string; business_name: string | null; full_name: string | null }

const KIND_LABEL: Record<Row['party_kind'], string> = {
  CLIENT_WP: 'Coppia ↔ WP',
  SUPPLIER_WP: 'Fornitore ↔ WP',
  SUPPLIER_CLIENT: 'Fornitore ↔ Coppia',
}

export function AllContractsMonitor({ entryId }: { entryId: string }) {
  const { data: wedding } = useWedding(entryId)
  const [rows, setRows] = useState<Row[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [chosenSupplier, setChosenSupplier] = useState<string>('')
  const businessModel = (wedding as any)?.business_model ?? 'GLOBAL'

  async function load() {
    setLoading(true)
    try {
      const [{ data: list }, { data: sup }] = await Promise.all([
        (supabase as any).rpc('list_contracts_for_entry', { p_entry_id: entryId }),
        (supabase as any).rpc('suppliers_in_quote', { p_entry_id: entryId }).then((r: any) => r, () => ({ data: null })),
      ])
      setRows(((list ?? []) as Row[]))
      // Fallback per i suppliers: query diretta dal quote
      if (!sup) {
        const wid = (wedding as any)?.quote_id
        if (wid) {
          const { data: items } = await (supabase as any).from('quote_items')
            .select('supplier_id, supplier:profiles!quote_items_supplier_id_fkey(id, business_name, full_name)')
            .eq('quote_id', wid)
          const map = new Map<string, Supplier>()
          for (const i of (items ?? []) as any[]) {
            if (i.supplier?.id) map.set(i.supplier.id, i.supplier)
          }
          setSuppliers(Array.from(map.values()))
        }
      } else {
        setSuppliers(sup as Supplier[])
      }
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [entryId, wedding])

  async function createSupplierContract(party: 'SUPPLIER_WP' | 'SUPPLIER_CLIENT') {
    if (!chosenSupplier) { toast.error('Scegli un fornitore'); return }
    setCreating(true)
    try {
      const { error } = await (supabase as any).rpc('create_supplier_contract', {
        p_entry_id: entryId,
        p_supplier_id: chosenSupplier,
        p_party_kind: party,
        p_template_id: null,
        p_title: null,
      })
      if (error) throw error
      toast.success('Contratto creato in bozza')
      setChosenSupplier('')
      await load()
    } catch (e) { toast.error((e as Error).message) }
    finally { setCreating(false) }
  }

  function copyLink(token: string) {
    void navigator.clipboard.writeText(`${location.origin}/p/contract/${token}`)
    toast.success('Link copiato')
  }

  const buckets = {
    CLIENT_WP: rows.filter((r) => r.party_kind === 'CLIENT_WP'),
    SUPPLIER_WP: rows.filter((r) => r.party_kind === 'SUPPLIER_WP'),
    SUPPLIER_CLIENT: rows.filter((r) => r.party_kind === 'SUPPLIER_CLIENT'),
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Tutti i contratti del wedding</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Modello business attuale: <strong>{businessModel === 'GLOBAL' ? 'WP gestisce tutto' : 'Sposi clienti diretti dei fornitori'}</strong>.
          {businessModel === 'GLOBAL'
            ? ' Il contratto principale è coppia↔WP. Tra te e ogni fornitore serve un impegno separato.'
            : ' Ogni fornitore firma direttamente con la coppia.'}
        </p>
      </header>

      {/* Crea contratto fornitore */}
      {suppliers.length > 0 && (
        <Card className="p-4 mb-5">
          <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">Crea un nuovo contratto fornitore</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Select value={chosenSupplier} onChange={(e) => setChosenSupplier(e.target.value)}>
                <option value="">Seleziona fornitore…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.business_name ?? s.full_name}</option>
                ))}
              </Select>
            </div>
            {businessModel === 'GLOBAL' ? (
              <Button variant="gold" onClick={() => createSupplierContract('SUPPLIER_WP')} disabled={creating || !chosenSupplier}>
                <Plus size={14} /> Mini-contratto WP↔fornitore
              </Button>
            ) : (
              <Button variant="gold" onClick={() => createSupplierContract('SUPPLIER_CLIENT')} disabled={creating || !chosenSupplier}>
                <Plus size={14} /> Contratto fornitore↔coppia
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Lista per categoria */}
      {(['CLIENT_WP', 'SUPPLIER_WP', 'SUPPLIER_CLIENT'] as Row['party_kind'][]).map((kind) => {
        const list = buckets[kind]
        if (list.length === 0 && kind !== 'CLIENT_WP') return null
        return (
          <section key={kind} className="mb-6">
            <h3 className="font-display text-lg mb-2 flex items-center gap-2">
              <FileSignature size={16} /> {KIND_LABEL[kind]} ({list.length})
            </h3>
            {list.length === 0 ? (
              <Card className="p-4 text-sm text-[rgb(var(--fg-muted))]">
                Nessun contratto in questa categoria.
              </Card>
            ) : (
              <div className="space-y-2">
                {list.map((r) => (
                  <Card key={r.id} className="p-4 flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-[rgb(var(--fg-muted))]">
                        {r.supplier_name && `${r.supplier_name} · `}
                        {r.client_name && `${r.client_name} · `}
                        {r.total_amount ? `€ ${Number(r.total_amount).toLocaleString('it-IT', { maximumFractionDigits: 0 })}` : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px]">
                        <StatusBadge status={r.status} />
                        {r.signed_at && (
                          <span className="inline-flex items-center gap-0.5 text-[rgb(var(--fg-subtle))]">
                            <CheckCircle2 size={10} /> firmato {new Date(r.signed_at).toLocaleDateString('it-IT')}
                          </span>
                        )}
                        {r.countersign_at && (
                          <span className="inline-flex items-center gap-0.5 text-[rgb(var(--fg-subtle))]">
                            <CheckCircle2 size={10} /> controfirmato
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => copyLink(r.access_token)}><Copy size={12} /> Link</Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/p/contract/${r.access_token}`} target="_blank"><ExternalLink size={12} /></Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {loading && <p className="text-[rgb(var(--fg-subtle))]">Caricamento…</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'FIRMATO' ? { bg: 'rgb(34 197 94 / 0.18)', fg: 'rgb(34 197 94)', icon: CheckCircle2 } :
    status === 'INVIATO' ? { bg: 'rgb(var(--gold-100))', fg: 'rgb(var(--gold-700))', icon: Clock } :
    status === 'ANNULLATO' ? { bg: 'rgb(var(--rose-100))', fg: 'rgb(var(--rose-500))', icon: AlertCircle } :
    { bg: 'rgb(var(--bg-sunken))', fg: 'rgb(var(--fg-muted))', icon: FileSignature }
  const Icon = color.icon
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold"
      style={{ background: color.bg, color: color.fg }}>
      <Icon size={10} /> {status}
    </span>
  )
}
