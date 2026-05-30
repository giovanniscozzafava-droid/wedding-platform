// PackImportPicker — mostra al fornitore i servizi-tipo della sua professione
// (servizio_template) con checkbox + bottone "Importa selezionati".
// Crea righe in `services` riusando il proprio fornitore_id e una category
// del proprio subrole (best-effort: la prima disponibile).
//
// Mobile-first: layout a colonna singola sotto 380px, touch target >=44px,
// una sola azione primaria (Importa).

import { useEffect, useMemo, useState } from 'react'
import { Check, PackageCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  useProfessione,
  useServizioTemplate,
  type ServizioTemplate,
} from '@/hooks/useProfessione'
import { useCategories } from '@/hooks/useCatalog'
import { useQueryClient } from '@tanstack/react-query'

type Props = {
  onClose: () => void
  onImported?: (count: number) => void
}

export function PackImportPicker({ onClose, onImported }: Props) {
  const { user, profile } = useAuth()
  const qc = useQueryClient()
  const { data: professione, isLoading: loadingPro } = useProfessione()
  const { data: templates, isLoading: loadingTpl } = useServizioTemplate(professione?.id)
  // Categorie disponibili per il subrole dell'utente: useremo la prima
  // come fallback di category_id se l'utente non ne ha ancora di sue.
  const { data: cats } = useCategories(profile?.subrole ?? null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // pre-seleziona i template marcati is_default_pack
  useEffect(() => {
    if (!templates) return
    setSelected(new Set(templates.filter((t) => t.is_default_pack).map((t) => t.id)))
  }, [templates])

  const allSelected = useMemo(
    () => !!templates && templates.length > 0 && selected.size === templates.length,
    [templates, selected],
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!templates) return
    setSelected(allSelected ? new Set() : new Set(templates.map((t) => t.id)))
  }

  async function importSelected() {
    if (!user) return
    if (selected.size === 0) {
      toast.error('Seleziona almeno un servizio da importare')
      return
    }
    if (!cats || cats.length === 0) {
      toast.error('Nessuna categoria disponibile per il tuo profilo: imposta prima la professione')
      return
    }
    setBusy(true)
    try {
      const defaultCatId = cats[0]!.id
      const chosen: ServizioTemplate[] = (templates ?? []).filter((t) => selected.has(t.id))
      const payload = chosen.map((t) => ({
        fornitore_id: user.id,
        category_id: defaultCatId,
        name: t.nome,
        description: t.descrizione,
        base_price: Number(t.prezzo_base ?? 0),
        unit: (t.service_unit ?? professione?.unita_default.service_unit_default ?? 'EVENTO') as
          | 'PEZZO' | 'PERSONA' | 'ORA' | 'EVENTO',
        is_active: true,
      }))
      const { error } = await (supabase as any).from('services').insert(payload)
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['services'] })
      toast.success(`Importati ${chosen.length} ${chosen.length === 1 ? 'servizio' : 'servizi'}`)
      onImported?.(chosen.length)
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const loading = loadingPro || loadingTpl
  const proLabel = professione?.etichette.servizio_label ?? 'Servizi tipici della tua professione'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4"
      style={{ background: 'rgba(15,15,15,0.65)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface w-full max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl"
      >
        <header
          className="px-4 sm:px-6 py-4 border-b flex items-start justify-between gap-3"
          style={{ borderColor: 'rgb(var(--border))' }}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--gold-600))]">
              {professione?.nome ?? 'Professione'}
            </div>
            <h3 className="font-display text-lg sm:text-xl mt-1 leading-snug">
              {proLabel}
            </h3>
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
              Parti dai servizi tipici del tuo mestiere. Li potrai modificare in qualsiasi momento.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Chiudi"
            className="min-h-[44px] min-w-[44px]"
          >
            <X size={18} />
          </Button>
        </header>

        <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <span className="text-xs text-[rgb(var(--fg-muted))]">
            {selected.size} su {templates?.length ?? 0} selezionati
          </span>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs underline text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] min-h-[36px] px-2"
          >
            {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          {loading && (
            <p className="text-xs text-[rgb(var(--fg-subtle))]">Caricamento servizi tipici…</p>
          )}
          {!loading && (!templates || templates.length === 0) && (
            <div className="text-center py-12">
              <PackageCheck size={32} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
              <p className="text-sm text-[rgb(var(--fg-muted))]">
                Per questa professione non ci sono ancora servizi-tipo: parti da zero.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {(templates ?? []).map((t) => {
              const isSel = selected.has(t.id)
              return (
                <Card
                  key={t.id}
                  className={`p-3 cursor-pointer transition ${isSel ? 'ring-2' : ''}`}
                  style={{ ['--tw-ring-color' as any]: 'rgb(var(--gold-600))' }}
                  onClick={() => toggle(t.id)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-6 w-6 rounded border flex items-center justify-center transition shrink-0 mt-0.5"
                      style={{
                        borderColor: isSel ? 'rgb(var(--gold-600))' : 'rgb(var(--border))',
                        background: isSel ? 'rgb(var(--gold-600))' : 'transparent',
                        color: isSel ? 'white' : 'transparent',
                      }}
                    >
                      {isSel && <Check size={14} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <p className="font-medium text-sm leading-snug">{t.nome}</p>
                        {t.is_default_pack && (
                          <span className="text-[10px] text-[rgb(var(--gold-600))] mt-0.5">★ consigliato</span>
                        )}
                      </div>
                      {t.descrizione && (
                        <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-2 whitespace-pre-line">
                          {t.descrizione}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {t.prezzo_base != null && (
                          <span className="font-display text-base tabular-nums">
                            € {Number(t.prezzo_base).toLocaleString('it-IT')}
                          </span>
                        )}
                        {t.service_unit && (
                          <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                            /{t.service_unit.toLowerCase()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        <footer
          className="px-4 sm:px-6 py-3 border-t flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}
        >
          <Button
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] w-full sm:w-auto"
          >
            Annulla
          </Button>
          <Button
            variant="gold"
            onClick={importSelected}
            disabled={busy || selected.size === 0}
            className="min-h-[44px] w-full sm:w-auto"
          >
            <Check size={14} />
            {busy
              ? 'Importazione…'
              : `Importa ${selected.size} ${selected.size === 1 ? 'servizio' : 'servizi'}`}
          </Button>
        </footer>
      </div>
    </div>
  )
}
