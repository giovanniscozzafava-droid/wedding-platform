// Builder clausola-per-clausola — Fase D workflow.
// WP sceglie quali clausole standard includere nel contratto cliente.
// Le clausole selezionate diventano `sections` jsonb per il contract.

import { useEffect, useState } from 'react'
import { Check, FileSignature, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export type ModalitaIncasso = 'INTERO' | 'SEGNALAZIONE'

export type StandardClause = {
  id: string
  category: string
  slug: string
  title: string
  body: string
  placeholders: string[]
  sort_order: number
  is_default: boolean
  per_modalita: ModalitaIncasso | null
}

const CATEGORY_LABELS: Record<string, string> = {
  OGGETTO: 'Oggetto',
  CORRISPETTIVI: 'Corrispettivi',
  PAGAMENTI: 'Pagamenti',
  RECESSO: 'Recesso',
  FORZA_MAGGIORE: 'Forza maggiore',
  RESPONSABILITA: 'Responsabilità',
  PROPRIETA_INTELLETTUALE: 'Diritti d\'immagine',
  PRIVACY_GDPR: 'Privacy/GDPR',
  FORO: 'Foro competente',
  ALTRE: 'Altre',
}

export type ContractSection = { heading: string; body: string; slug?: string }

export function StandardClausesBuilder({
  onClose, onComposed,
  placeholders = {},
  modalita,
}: {
  onClose: () => void
  onComposed: (sections: ContractSection[]) => void
  placeholders?: Record<string, string>
  /**
   * Modalita di incasso target. Se valorizzata, il builder filtra le clausole
   * con per_modalita = quella specifica o NULL (universali). Default: tutte.
   */
  modalita?: ModalitaIncasso
}) {
  const [clauses, setClauses] = useState<StandardClause[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ModalitaIncasso | 'ALL'>(modalita ?? 'ALL')

  useEffect(() => {
    void (async () => {
      const { data, error } = await (supabase as any).rpc('list_standard_clauses')
      if (error) { toast.error(error.message); setLoading(false); return }
      const list = (data ?? []) as StandardClause[]
      setClauses(list)
      // preselect defaults compatibili col filtro corrente
      const initialFilter = modalita ?? 'ALL'
      const compatible = (c: StandardClause) =>
        initialFilter === 'ALL' || c.per_modalita == null || c.per_modalita === initialFilter
      setSelected(new Set(list.filter((c) => c.is_default && compatible(c)).map((c) => c.id)))
      setLoading(false)
    })()
  }, [modalita])

  // Applica filtro modalita: clausole universali (NULL) + clausole della modalita corrente.
  const visibleClauses = clauses.filter((c) =>
    filter === 'ALL' ? true : c.per_modalita == null || c.per_modalita === filter,
  )

  const grouped = visibleClauses.reduce<Record<string, StandardClause[]>>((acc, c) => {
    (acc[c.category] = acc[c.category] ?? []).push(c)
    return acc
  }, {})

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function applyPlaceholders(body: string): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_, key) => placeholders[key] ?? `{{${key}}}`)
  }

  function compose() {
    if (selected.size === 0) return toast.error('Seleziona almeno una clausola')
    // Considera tutte le clausole selezionate (anche se attualmente filtrate
    // out: il WP puo` aver scelto prima di cambiare filtro).
    const ordered = clauses
      .filter((c) => selected.has(c.id))
      .sort((a, b) => a.sort_order - b.sort_order)
    const sections: ContractSection[] = ordered.map((c) => ({
      heading: c.title,
      body: applyPlaceholders(c.body),
      slug: c.slug,
    }))
    onComposed(sections)
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,15,0.65)' }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="surface w-full max-w-3xl max-h-[90vh] flex flex-col">
        <header className="px-6 py-4 border-b flex items-start justify-between gap-3"
          style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--gold-600))]">Libreria clausole</div>
            <h3 className="font-display text-xl mt-1">Componi contratto clausola per clausola</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
              Le clausole con ★ sono consigliate di default. Puoi modificarle o sostituirle nel passo successivo.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Chiudi">
            <X size={16} />
          </Button>
        </header>

        {/* Filtro modalita_incasso: INTERO | SEGNALAZIONE | TUTTE */}
        <div className="px-6 pt-3 pb-1 flex flex-wrap items-center gap-2 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <span className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--fg-muted))]">Modalita</span>
          {(['ALL', 'INTERO', 'SEGNALAZIONE'] as const).map((m) => {
            const label = m === 'ALL' ? 'Tutte' : m === 'INTERO' ? 'Incasso intero' : 'Segnalazione'
            const active = filter === m
            return (
              <button key={m} type="button" onClick={() => setFilter(m)}
                className={`min-h-[36px] px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${active ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-[rgb(var(--fg))]' : 'border-[rgb(var(--border-strong))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && <p className="text-xs text-[rgb(var(--fg-subtle))]">Caricamento clausole…</p>}
          {!loading && clauses.length === 0 && (
            <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessuna clausola disponibile.</p>
          )}
          {!loading && Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mb-5">
              <h4 className="text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--gold-600))] mb-2">
                {CATEGORY_LABELS[cat] ?? cat}
              </h4>
              <div className="space-y-2">
                {list.map((c) => {
                  const isSel = selected.has(c.id)
                  return (
                    <Card key={c.id} className={`p-3 cursor-pointer transition ${isSel ? 'ring-2' : ''}`}
                      style={{ ['--tw-ring-color' as any]: 'rgb(var(--gold-600))' }}
                      onClick={() => toggle(c.id)}>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          <div className={`h-5 w-5 rounded border flex items-center justify-center transition`}
                            style={{
                              borderColor: isSel ? 'rgb(var(--gold-600))' : 'rgb(var(--border))',
                              background: isSel ? 'rgb(var(--gold-600))' : 'transparent',
                              color: isSel ? 'white' : 'transparent',
                            }}>
                            {isSel && <Check size={12} />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{c.title}</p>
                            {c.is_default && <span className="text-[10px] text-[rgb(var(--gold-600))]">★</span>}
                          </div>
                          <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-3 whitespace-pre-line">
                            {applyPlaceholders(c.body)}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </section>
          ))}
        </div>

        <footer className="px-6 py-3 border-t flex items-center justify-between"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
          <p className="text-xs text-[rgb(var(--fg-muted))]">
            {selected.size} clausole selezionate · si possono modificare dopo
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annulla</Button>
            <Button variant="gold" onClick={compose} disabled={selected.size === 0}>
              <FileSignature size={14} /> Componi
            </Button>
          </div>
        </footer>
      </div>
    </div>
  )
}
