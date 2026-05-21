import { useState } from 'react'
import { Plus, Trash2, BedDouble, MapPin, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAccommodations, useAccommodationMutations } from '@/hooks/useWedding'

const KINDS = ['HOTEL', 'BNB', 'AIRBNB', 'VILLA_PRIVATA', 'APPARTAMENTO', 'RESORT']

export function AccommodationsTab({ entryId }: { entryId: string }) {
  const { data } = useAccommodations(entryId)
  const { add, update, remove } = useAccommodationMutations(entryId)
  const [draft, setDraft] = useState({
    kind: 'HOTEL', name: '', city: '', address: '', url: '',
    checkin_date: '', checkout_date: '', rate_per_night: '', rooms_blocked: '',
  })

  async function handleAdd() {
    if (!draft.name.trim()) return
    try {
      await add.mutateAsync({
        ...draft,
        rate_per_night: draft.rate_per_night ? Number(draft.rate_per_night) : null,
        rooms_blocked: draft.rooms_blocked ? Number(draft.rooms_blocked) : 0,
        checkin_date: draft.checkin_date || null,
        checkout_date: draft.checkout_date || null,
      })
      setDraft({ kind: 'HOTEL', name: '', city: '', address: '', url: '', checkin_date: '', checkout_date: '', rate_per_night: '', rooms_blocked: '' })
      toast.success('Alloggio aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  const totalRooms = (data ?? []).reduce((s: number, a: any) => s + (a.rooms_blocked ?? 0), 0)
  const totalUsed = (data ?? []).reduce((s: number, a: any) => s + (a.rooms_used ?? 0), 0)

  return (
    <div>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Alloggi ospiti</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Hotel, B&B, ville o appartamenti per chi viene da fuori. Specialmente utile per destination wedding.</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Strutture" value={data?.length ?? 0} />
          <Stat label="Camere bloccate" value={totalRooms} />
          <Stat label="Occupate" value={totalUsed} />
        </div>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
          <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
          <Input placeholder="Nome struttura" className="sm:col-span-2" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <Input placeholder="Città" value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <Input className="sm:col-span-2" placeholder="Indirizzo / URL Google Maps" value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} />
          <Input placeholder="Sito web" value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} />
          <Input type="date" placeholder="Check-in" value={draft.checkin_date} onChange={(e) => setDraft((d) => ({ ...d, checkin_date: e.target.value }))} />
          <Input type="date" placeholder="Check-out" value={draft.checkout_date} onChange={(e) => setDraft((d) => ({ ...d, checkout_date: e.target.value }))} />
          <Input type="number" placeholder="€ a notte" value={draft.rate_per_night} onChange={(e) => setDraft((d) => ({ ...d, rate_per_night: e.target.value }))} />
        </div>
        <div className="flex justify-end mt-3 gap-2">
          <Input type="number" placeholder="Camere bloccate" className="max-w-[160px]" value={draft.rooms_blocked} onChange={(e) => setDraft((d) => ({ ...d, rooms_blocked: e.target.value }))} />
          <Button variant="gold" onClick={handleAdd}><Plus /> Aggiungi</Button>
        </div>
      </Card>

      {(data ?? []).length === 0 && (
        <Card className="p-10 text-center">
          <BedDouble size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessun alloggio. Aggiungi hotel, B&B o ville per ospiti.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data ?? []).map((a: any) => (
          <Card key={a.id} className="p-5 relative overflow-hidden">
            <div className="flex items-start justify-between mb-3 gap-2">
              <div className="flex-1 min-w-0">
                <Badge tone="sage">{a.kind}</Badge>
                <h3 className="font-display text-lg mt-1.5">{a.name}</h3>
                {a.city && (
                  <p className="text-xs text-[rgb(var(--fg-subtle))] flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {a.city}{a.country ? `, ${a.country}` : ''}
                    {a.distance_km && ` · ${a.distance_km} km dalla location`}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(a.id)}><Trash2 size={14} /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              {a.rate_per_night && <Field k="Tariffa" v={`€ ${a.rate_per_night}/notte`} />}
              {a.checkin_date && <Field k="Check-in" v={new Date(a.checkin_date).toLocaleDateString('it-IT')} />}
              {a.checkout_date && <Field k="Check-out" v={new Date(a.checkout_date).toLocaleDateString('it-IT')} />}
              {a.rooms_blocked > 0 && <Field k="Camere bloccate" v={`${a.rooms_used ?? 0} / ${a.rooms_blocked}`} />}
            </div>
            {a.promo_code && <Badge tone="gold">Codice: {a.promo_code}</Badge>}
            <div className="flex items-center justify-between mt-3 text-xs">
              {a.url && (
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[rgb(var(--fg-muted))] hover:underline">
                  Sito <ExternalLink size={12} />
                </a>
              )}
              <Input type="number" defaultValue={a.rooms_used ?? 0} className="h-8 w-24 text-xs"
                onBlur={(e) => { const n = Number(e.target.value); if (n !== a.rooms_used) update.mutate({ id: a.id, patch: { rooms_used: n } }) }} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="surface px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-display text-xl tabular-nums">{value}</p>
    </div>
  )
}
function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{k}</p>
      <p className="font-medium">{v}</p>
    </div>
  )
}
