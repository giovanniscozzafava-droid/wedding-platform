import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Gift, Plus, Trash2, Users, Euro, Package } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useGiftsSummary, useGuestsForGifts, useGiftMutations, GROUP_KINDS, type GiftGroup, type GuestRow } from '@/hooks/useGifts'

const eur = (n: number) => (n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const kindLabel = (k: string) => GROUP_KINDS.find((g) => g.key === k)?.label ?? k

export function GiftsTab({ entryId }: { entryId: string }) {
  const { data: sum } = useGiftsSummary(entryId)
  const { data: guests } = useGuestsForGifts(entryId)
  const mut = useGiftMutations(entryId)
  const [name, setName] = useState(''); const [kind, setKind] = useState('FAMIGLIA')
  async function create() {
    if (name.trim().length < 2) { toast.error('Nome insieme'); return }
    try { await mut.createGroup.mutateAsync({ name: name.trim(), kind }); setName('') } catch (e) { toast.error((e as Error).message) }
  }
  if (sum?.error) return <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Non hai accesso ai regali di questo evento.</Card>
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 grid grid-cols-3 gap-3" style={{ background: 'rgb(var(--gold-100))' }}>
        <Stat icon={<Euro size={18} />} label="Raccolto in denaro" value={eur(sum?.totale_soldi ?? 0)} />
        <Stat icon={<Gift size={18} />} label="Regali registrati" value={String(sum?.totale_regali ?? 0)} />
        <Stat icon={<Users size={18} />} label="Insiemi" value={String(sum?.insiemi?.length ?? 0)} />
      </div>

      <Card className="p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Nuovo insieme<Input value={name} onChange={(e) => setName(e.target.value)} className="w-52 mt-0.5" placeholder="Es. Famiglia Rossi" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Tipo<Select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-0.5">{GROUP_KINDS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</Select></label>
        <Button size="sm" onClick={create}><Plus size={14} /> Crea insieme</Button>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] w-full">Raggruppa gli invitati (famiglie, coppie, gruppi di amici): il regalo si registra per insieme, non per singolo.</p>
      </Card>

      {(sum?.insiemi ?? []).map((g) => <GroupCard key={g.id} g={g} guests={guests ?? []} mut={mut} />)}
      {(sum?.insiemi ?? []).length === 0 && <Card className="p-8 text-center text-[rgb(var(--fg-subtle))]">Nessun insieme. Creane uno per iniziare a registrare i regali.</Card>}

      {(sum?.senza_insieme ?? []).length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium text-sm mb-2">Regali senza insieme</h4>
          {sum!.senza_insieme.map((gi) => (
            <div key={gi.id} className="flex items-center gap-2 text-sm py-1 border-b border-[rgb(var(--border))] last:border-0">
              <span className="flex-1">{gi.kind === 'MONEY' ? `${eur(gi.amount ?? 0)}` : `${gi.descrizione || 'regalo'}`}{gi.note ? ` · ${gi.note}` : ''}</span>
              <button onClick={() => mut.delGift.mutate(gi.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1">{icon} {label}</p><p className="font-display text-2xl mt-0.5">{value}</p></div>
}

function GroupCard({ g, guests, mut }: { g: GiftGroup; guests: GuestRow[]; mut: ReturnType<typeof useGiftMutations> }) {
  const members = useMemo(() => guests.filter((x) => x.gift_group_id === g.id), [guests, g.id])
  const free = useMemo(() => guests.filter((x) => !x.gift_group_id), [guests])
  const [gk, setGk] = useState<'MONEY' | 'THING'>('MONEY'); const [amount, setAmount] = useState(''); const [desc, setDesc] = useState(''); const [note, setNote] = useState('')
  const [assign, setAssign] = useState('')
  async function addGift() {
    if (gk === 'MONEY' && !(parseFloat(amount.replace(',', '.')) > 0)) { toast.error('Importo'); return }
    if (gk === 'THING' && desc.trim().length < 2) { toast.error('Descrizione regalo'); return }
    try {
      await mut.addGift.mutateAsync({ group_id: g.id, kind: gk, amount: gk === 'MONEY' ? parseFloat(amount.replace(',', '.')) : null, description: gk === 'THING' ? desc.trim() : null, note: note.trim() || null })
      setAmount(''); setDesc(''); setNote('')
    } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div><h3 className="font-display text-lg">{g.nome}</h3><p className="text-[11px] text-[rgb(var(--fg-subtle))]">{kindLabel(g.tipo)} · {g.invitati} invitati · raccolto {eur(g.soldi)}</p></div>
        <button onClick={() => { if (confirm('Eliminare l’insieme? (i regali restano senza insieme)')) mut.delGroup.mutate(g.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={15} /></button>
      </div>

      {/* membri */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {members.map((x) => (
          <span key={x.id} className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--bg-sunken))] inline-flex items-center gap-1">{x.full_name || 'Invitato'}
            <button onClick={() => mut.assignGuest.mutate({ guest_id: x.id, group_id: null })} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]">×</button>
          </span>
        ))}
        {free.length > 0 && (
          <Select value={assign} onChange={(e) => { if (e.target.value) { mut.assignGuest.mutate({ guest_id: e.target.value, group_id: g.id }); setAssign('') } }} className="h-7 text-xs w-44">
            <option value="">+ aggiungi invitato…</option>
            {free.map((x) => <option key={x.id} value={x.id}>{x.full_name || 'Invitato'}</option>)}
          </Select>
        )}
      </div>

      {/* regali dell'insieme */}
      <div className="space-y-1 mb-3">
        {g.regali.map((gi) => (
          <div key={gi.id} className="flex items-center gap-2 text-sm py-1 border-b border-[rgb(var(--border))] last:border-0">
            <span className="flex-1">{gi.kind === 'MONEY' ? <><Euro size={12} className="inline" /> <strong>{eur(gi.amount ?? 0)}</strong></> : <><Package size={12} className="inline" /> {gi.descrizione || 'regalo'}</>}{gi.note ? <span className="text-[rgb(var(--fg-subtle))]"> · {gi.note}</span> : ''}</span>
            <button onClick={() => mut.delGift.mutate(gi.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button>
          </div>
        ))}
        {g.regali.length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessun regalo ancora.</p>}
      </div>

      {/* aggiungi regalo */}
      <div className="flex flex-wrap items-end gap-2 border-t border-[rgb(var(--border))] pt-3">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Regalo<Select value={gk} onChange={(e) => setGk(e.target.value as 'MONEY' | 'THING')} className="mt-0.5"><option value="MONEY">Soldi</option><option value="THING">Oggetto</option></Select></label>
        {gk === 'MONEY'
          ? <label className="text-[11px] text-[rgb(var(--fg-muted))]">Importo €<Input value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 mt-0.5" placeholder="200" /></label>
          : <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1 min-w-[160px]">Cosa<Input value={desc} onChange={(e) => setDesc(e.target.value)} className="mt-0.5" placeholder="Es. servizio di piatti" /></label>}
        <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1 min-w-[120px]">Nota<Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-0.5" placeholder="facoltativa" /></label>
        <Button size="sm" onClick={addGift}><Plus size={14} /> Aggiungi</Button>
      </div>
    </Card>
  )
}
