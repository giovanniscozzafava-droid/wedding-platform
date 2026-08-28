// PackDisimportPicker — inverso del PackImportPicker: mostra i servizi IMPORTATI (provenienza
// imported_template_id) del professionista e permette di "disimportarne" più di uno in blocco.
// Mobile-first: colonna singola, target >=44px, una sola azione primaria (Disimporta selezionati).

import { useMemo, useState } from 'react'
import { Check, PackageX, X } from '@/components/icons/lucide'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { useBulkDeleteServices, type ServiceWithExtras } from '@/hooks/useCatalog'

type Props = {
  services: ServiceWithExtras[]
  onClose: () => void
  onDone?: (count: number) => void
}

export function PackDisimportPicker({ services, onClose, onDone }: Props) {
  const { user } = useAuth()
  const bulkDel = useBulkDeleteServices()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Solo i MIEI servizi importati (provenienza template). I creati a mano non si "disimportano".
  const imported = useMemo(
    () => services.filter((s) => (s as any).imported_template_id && s.fornitore_id === user?.id),
    [services, user?.id],
  )
  const allSelected = imported.length > 0 && selected.size === imported.length

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(imported.map((s) => s.id)))
  }

  async function disimport() {
    if (selected.size === 0) { toast.error('Seleziona almeno un servizio da disimportare'); return }
    if (!confirm(`Disimportare ${selected.size} ${selected.size === 1 ? 'servizio' : 'servizi'}? Verranno rimossi dal tuo catalogo.`)) return
    try {
      const { deleted } = await bulkDel.mutateAsync([...selected])
      if (deleted === 0) { toast.error('Nessun servizio disimportato (potrebbero essere protetti o non tuoi)'); return }
      toast.success(`Disimportati ${deleted} ${deleted === 1 ? 'servizio' : 'servizi'}`)
      onDone?.(deleted)
      onClose()
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div role="dialog" aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(15,15,15,0.65)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="surface w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl">
        <header className="px-4 sm:px-6 py-4 border-b flex items-start justify-between gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--gold-600))]">Catalogo</div>
            <h3 className="font-display text-lg sm:text-xl mt-1 leading-snug">Disimporta i servizi che non usi</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">Togli in blocco le voci importate dallo starter pack che non ti interessano. I servizi creati a mano non compaiono qui.</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Chiudi" className="min-h-[44px] min-w-[44px]"><X size={18} /></Button>
        </header>

        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <span className="text-xs text-[rgb(var(--fg-muted))]">{selected.size} su {imported.length} selezionati</span>
          {imported.length > 0 && (
            <button type="button" onClick={toggleAll} className="text-xs underline text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] min-h-[36px] px-2">
              {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {imported.length === 0 ? (
            <div className="text-center py-12">
              <PackageX size={32} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
              <p className="text-sm text-[rgb(var(--fg-muted))]">Non hai servizi importati da disimportare.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {imported.map((s) => {
                const isSel = selected.has(s.id)
                return (
                  <Card key={s.id} className={`p-3 cursor-pointer transition ${isSel ? 'ring-2' : ''}`}
                    style={{ ['--tw-ring-color' as any]: 'rgb(var(--gold-600))' }} onClick={() => toggle(s.id)}>
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded border flex items-center justify-center transition shrink-0 mt-0.5"
                        style={{ borderColor: isSel ? 'rgb(var(--gold-600))' : 'rgb(var(--border))', background: isSel ? 'rgb(var(--gold-600))' : 'transparent', color: isSel ? 'white' : 'transparent' }}>
                        {isSel && <Check size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">
                          {s.service_categories?.name ?? 'Senza categoria'} · € {Number(s.base_price).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-3 border-t flex items-center justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
          <Button variant="ghost" onClick={onClose} className="min-h-[44px]">Annulla</Button>
          <Button variant="gold" onClick={() => void disimport()} disabled={bulkDel.isPending || selected.size === 0} className="min-h-[44px]">
            <PackageX size={16} /> Disimporta selezionati
          </Button>
        </div>
      </div>
    </div>
  )
}
