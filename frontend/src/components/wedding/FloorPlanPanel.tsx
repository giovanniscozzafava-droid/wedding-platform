import { useRef, useState } from 'react'
import { Upload, Loader2, Trash2, ImageIcon, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEventFloorPlan, useFloorPlanLibrary, useFloorPlanMutations } from '@/hooks/useWedding'
import { uploadFloorPlan } from '@/lib/floorPlan'

// Pannello "Piantina sala": la location/venue (o chi gestisce l'evento) carica la
// piantina da FOTO o PDF; viene letta e proiettata come sfondo del tableau. Le
// piantine restano in libreria e si riusano su altri eventi. Senza piantina → sala
// generica con le forme preimpostate.
export function FloorPlanPanel({ entryId }: { entryId: string }) {
  const { data: current } = useEventFloorPlan(entryId)
  const { data: library } = useFloorPlanLibrary()
  const { setForEvent, clearForEvent, addToLibrary, removeFromLibrary } = useFloorPlanMutations(entryId)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onPick(file: File | null) {
    if (!file) return
    setBusy(true)
    try {
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Piantina'
      const { image_url, ratio } = await uploadFloorPlan(file, Date.now())
      const lib = await addToLibrary.mutateAsync({ image_url, ratio, name })
      await setForEvent.mutateAsync({ image_url, ratio, name, floor_plan_id: (lib as { id?: string } | null)?.id ?? null })
      toast.success('Piantina caricata e proiettata')
    } catch (e) {
      toast.error('Piantina non caricata: ' + (e as Error).message)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const lib = library ?? []

  return (
    <Card className="p-3 mb-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-[rgb(var(--fg-muted))] inline-flex items-center gap-1"><ImageIcon size={13} /> Piantina sala (proiettata sotto i tavoli)</span>
        <div className="flex items-center gap-2">
          {current && <Button variant="ghost" size="sm" onClick={() => clearForEvent.mutate()} title="Torna alla sala generica"><Trash2 size={13} /> Rimuovi</Button>}
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
          <Button variant="gold" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Carica foto / PDF
          </Button>
        </div>
      </div>

      {current ? (
        <div className="flex items-center gap-3">
          <img src={current.image_url} alt="" className="h-16 w-24 object-contain rounded border border-[rgb(var(--border))] bg-white" />
          <div className="text-xs text-[rgb(var(--fg-muted))]">
            <p className="font-medium text-[rgb(var(--fg))]">{current.name ?? 'Piantina'}</p>
            <p>Proiettata come sfondo. Trascina i tavoli sopra la piantina reale.</p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessuna piantina: la sala usa le forme generiche (rettangolare, quadrata, a L…). Carica la piantina reale della location da foto o PDF per posizionare i tavoli sulla mappa vera.</p>
      )}

      {/* Libreria piantine riutilizzabili */}
      {lib.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[rgb(var(--border))]">
          <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1.5">Le tue piantine</p>
          <div className="flex flex-wrap gap-2">
            {lib.map((p) => {
              const active = current?.image_url === p.image_url
              return (
                <div key={p.id} className={`relative group rounded-lg border overflow-hidden ${active ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>
                  <button onClick={() => setForEvent.mutate({ image_url: p.image_url, ratio: p.ratio, name: p.name, floor_plan_id: p.id })} title={`Usa "${p.name}"`} className="block">
                    <img src={p.image_url} alt={p.name} className="h-14 w-20 object-contain bg-white" />
                    <span className="block px-1.5 py-0.5 text-[10px] truncate max-w-[80px]">{p.name}</span>
                  </button>
                  {active && <span className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[rgb(var(--gold-500))] text-white flex items-center justify-center"><Check size={10} /></span>}
                  <button onClick={() => { if (confirm(`Eliminare la piantina "${p.name}" dalla libreria?`)) removeFromLibrary.mutate(p.id) }} title="Elimina dalla libreria"
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/55 text-white items-center justify-center hidden group-hover:flex"><Trash2 size={9} /></button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}
