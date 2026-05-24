import { useState } from 'react'
import { MessageSquarePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/input'
import { useCreateChangeRequest, entityLabel, type EntityType, type ReqAction } from '@/hooks/useChangeRequests'

type Props = {
  weddingId: string
  entityType: EntityType
  entityId?: string | null
  defaultAction?: ReqAction
  prefillTitle?: string
  trigger?: 'button' | 'icon'
  className?: string
}

export function ChangeRequestModal({
  weddingId, entityType, entityId, defaultAction = 'UPDATE',
  prefillTitle, trigger = 'button', className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<ReqAction>(defaultAction)
  const [title, setTitle] = useState(prefillTitle ?? '')
  const [description, setDescription] = useState('')
  const create = useCreateChangeRequest(weddingId)

  async function submit() {
    if (!title.trim()) { toast.error('Titolo richiesta obbligatorio'); return }
    try {
      await create.mutateAsync({ entity_type: entityType, entity_id: entityId, action, title: title.trim(), description: description.trim() || undefined })
      toast.success('Richiesta inviata al wedding planner')
      setOpen(false); setTitle(''); setDescription('')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <>
      {trigger === 'button' ? (
        <Button variant="outline" size="sm" className={className} onClick={(e) => { e.stopPropagation(); setOpen(true) }}>
          <MessageSquarePlus size={13} /> Richiedi modifica
        </Button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); setOpen(true) }}
          className={`inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))] ${className ?? ''}`}
          title="Richiedi modifica al wedding planner">
          <MessageSquarePlus size={13} />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-[rgb(var(--bg-elev))] w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border max-h-[90vh] overflow-y-auto"
            style={{ borderColor: 'rgb(var(--border))' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-[rgb(var(--bg-elev))]" style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <h3 className="font-display text-lg">Richiedi modifica</h3>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">{entityLabel(entityType)} → invia al wedding planner</p>
              </div>
              <button onClick={() => setOpen(false)} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[rgb(var(--bg-sunken))]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={action} onChange={(e) => setAction(e.target.value as ReqAction)}>
                  <option value="UPDATE">Modificare qualcosa di esistente</option>
                  <option value="CREATE">Aggiungere qualcosa di nuovo</option>
                  <option value="DELETE">Rimuovere qualcosa</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cosa vuoi chiedere</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Cambiare posto tavolo 3 zio Mario" />
              </div>
              <div className="space-y-1">
                <Label>Dettagli (opzionale)</Label>
                <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Spiega meglio cosa vorresti che venga modificato..." />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
                <Button variant="gold" onClick={submit} disabled={create.isPending}>
                  {create.isPending ? 'Invio...' : 'Invia richiesta'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
