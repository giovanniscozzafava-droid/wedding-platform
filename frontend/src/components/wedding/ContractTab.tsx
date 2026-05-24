import { useState } from 'react'
import { FileSignature, Send, Plus, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useContractMutations, useContracts } from '@/hooks/useWedding'

const STANDARD_SECTIONS = [
  { heading: 'Oggetto del contratto', body: 'Organizzazione e coordinamento dell\'evento matrimoniale come specificato nel preventivo allegato.', type: 'CLAUSULE' },
  { heading: 'Corrispettivo e modalita\' di pagamento', body: '30% alla firma, 40% 60 giorni prima dell\'evento, 30% il giorno dell\'evento.', type: 'PRICE' },
  { heading: 'Cancellazione', body: 'In caso di disdetta entro 90 giorni dall\'evento, viene trattenuto il 50% dell\'acconto. Oltre tale termine il 100%.', type: 'TERMS' },
  { heading: 'Forza maggiore', body: 'Le parti convengono di rinegoziare termini in caso di eventi imprevedibili (pandemia, calamita\').', type: 'TERMS' },
]

export function ContractTab({ wedding }: { wedding: any }) {
  const { data: contracts } = useContracts(wedding.quote?.id ?? null)
  const { create, update, send } = useContractMutations()
  const [editing, setEditing] = useState<any | null>(null)

  async function createFromQuote() {
    try {
      const c = await create.mutateAsync({
        title: `Contratto ${wedding.title}`,
        quote_id: wedding.quote?.id,
        entry_id: wedding.id,
        client_name: wedding.client_name,
        client_email: wedding.client_email,
        event_date: wedding.date_from,
        total_amount: wedding.quote?.total_client ?? 0,
        sections: STANDARD_SECTIONS as any,
      })
      setEditing(c)
      toast.success('Bozza contratto creata')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function sendContract(id: string) {
    try {
      const token = await send.mutateAsync(id)
      await navigator.clipboard.writeText(`${window.location.origin}/p/contract/${token}`).catch(() => {})
      toast.success('Link firma copiato negli appunti')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl">Contratto</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Genera il contratto dal preventivo e inviane il link per la firma.</p>
        </div>
        <Button variant="gold" onClick={createFromQuote} disabled={create.isPending}><Plus /> Nuova bozza</Button>
      </header>

      <div className="space-y-4">
        {(contracts ?? []).length === 0 && (
          <Card className="p-10 text-center">
            <FileSignature size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <p className="text-[rgb(var(--fg-muted))]">Nessun contratto ancora.</p>
          </Card>
        )}
        {(contracts ?? []).map((c: any) => (
          <Card key={c.id} className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-display text-lg">{c.title}</h3>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">
                  {c.client_name ?? '—'} · € {Number(c.total_amount).toLocaleString('it-IT')}
                  {c.signed_at && ` · firmato il ${new Date(c.signed_at).toLocaleDateString('it-IT')}`}
                </p>
              </div>
              <Badge tone={c.status === 'FIRMATO' ? 'emerald' : c.status === 'INVIATO' ? 'amber' : 'neutral'}>{c.status}</Badge>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {c.status === 'FIRMATO' ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}><Lock size={13} /> Visualizza (immutabile)</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setEditing(c)}>Modifica sezioni</Button>
              )}
              {c.status === 'BOZZA' && <Button variant="gold" size="sm" onClick={() => sendContract(c.id)}><Send /> Invia per firma</Button>}
              {c.access_token && (
                <a href={`/p/contract/${c.access_token}`} target="_blank" rel="noreferrer"
                  className="text-sm self-center text-[rgb(var(--fg-muted))] hover:underline">link firma cliente</a>
              )}
              {c.status === 'FIRMATO' && (
                <span className="inline-flex items-center gap-1 text-xs text-[rgb(var(--fg-subtle))]" title="Un contratto firmato non puo essere modificato">
                  <Lock size={11} /> firmato e bloccato
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl">Sezioni contratto</h3>
              {editing.status === 'FIRMATO' && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]">
                  <Lock size={11} /> Firmato — sola lettura
                </span>
              )}
            </div>
            {editing.status === 'FIRMATO' && (
              <div className="mb-4 p-3 rounded-lg text-xs" style={{ background: 'rgb(var(--bg-sunken))', borderLeft: '3px solid rgb(var(--gold-500))' }}>
                Questo contratto è stato firmato dal cliente il <strong>{new Date(editing.signed_at).toLocaleString('it-IT')}</strong>.
                Per legge non è più modificabile. In caso di modifiche, crea un addendum o un nuovo contratto.
              </div>
            )}
            {(editing.sections ?? []).map((sec: any, i: number) => (
              <div key={i} className="mb-4 border-b pb-4" style={{ borderColor: 'rgb(var(--border))' }}>
                <Input value={sec.heading} className="mb-2 font-medium"
                  disabled={editing.status === 'FIRMATO'}
                  onChange={(e) => {
                    const ns = [...editing.sections]; ns[i] = { ...sec, heading: e.target.value }
                    setEditing({ ...editing, sections: ns })
                  }} />
                <Textarea rows={3} value={sec.body}
                  disabled={editing.status === 'FIRMATO'}
                  onChange={(e) => {
                    const ns = [...editing.sections]; ns[i] = { ...sec, body: e.target.value }
                    setEditing({ ...editing, sections: ns })
                  }} />
              </div>
            ))}
            <div className="flex justify-between">
              {editing.status !== 'FIRMATO' && (
                <Button variant="ghost" onClick={() => {
                  const ns = [...(editing.sections ?? []), { heading: 'Nuova clausola', body: '', type: 'CLAUSULE' }]
                  setEditing({ ...editing, sections: ns })
                }}><Plus size={14} /> Aggiungi clausola</Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setEditing(null)}>Chiudi</Button>
                {editing.status !== 'FIRMATO' && (
                  <Button variant="gold" onClick={async () => {
                    try {
                      await update.mutateAsync({ id: editing.id, patch: { sections: editing.sections } })
                      toast.success('Salvato')
                      setEditing(null)
                    } catch (e) { toast.error((e as Error).message) }
                  }}>Salva</Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
