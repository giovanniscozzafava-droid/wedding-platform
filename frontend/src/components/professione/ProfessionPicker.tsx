// ProfessionPicker — card-grid selezionatore della professione per onboarding
// fornitore. Layout mobile-first: 1 colonna sotto 380px, 2 colonne >=640px.
//
// Le card mostrano nome + icona + etichetta servizio_label (es. "Reportage e
// pacchetti" per il fotografo) cosi` il fornitore capisce subito come verra`
// vestito il prodotto.

import { useMemo } from 'react'
import * as Icons from 'lucide-react'
import { Check } from 'lucide-react'
import { useProfessioniList, type Professione } from '@/hooks/useProfessione'

type Props = {
  value: string | null
  onChange: (id: string, p: Professione) => void
  // Mostra solo professioni del gruppo specificato; null = tutte
  gruppoFilter?: string | null
}

export function ProfessionPicker({ value, onChange, gruppoFilter }: Props) {
  const { data, isLoading } = useProfessioniList()

  const list = useMemo(() => {
    if (!data) return []
    // mostra sempre prima le non-FALLBACK, poi 'Generico'
    let arr = data.slice()
    if (gruppoFilter) arr = arr.filter((p) => p.gruppo === gruppoFilter)
    return arr.sort((a, b) => {
      const aIsFallback = a.gruppo === 'FALLBACK' ? 1 : 0
      const bIsFallback = b.gruppo === 'FALLBACK' ? 1 : 0
      if (aIsFallback !== bIsFallback) return aIsFallback - bIsFallback
      return a.sort_order - b.sort_order
    })
  }, [data, gruppoFilter])

  if (isLoading) {
    return <p className="text-xs text-[rgb(var(--fg-subtle))]">Caricamento professioni…</p>
  }
  if (list.length === 0) {
    return <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessuna professione disponibile.</p>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
      {list.map((p) => {
        const isSel = value === p.id
        const IconName = (p.icona ?? p.etichette?.icona ?? 'Briefcase') as keyof typeof Icons
        const Cmp = (Icons[IconName] ?? Icons.Briefcase) as React.ComponentType<{ size?: number }>
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id, p)}
            className={`flex items-start gap-3 rounded-lg border p-3 sm:p-4 text-left transition min-h-[72px] ${
              isSel
                ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-100))]'
                : 'border-[rgb(var(--border))] hover:border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--bg-sunken))]'
            }`}
            aria-pressed={isSel}
          >
            <div
              className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: isSel ? 'rgb(var(--gold-600))' : 'rgb(var(--bg-sunken))',
                color: isSel ? 'white' : 'rgb(var(--fg-muted))',
              }}
            >
              <Cmp size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{p.nome}</p>
                {isSel && (
                  <span className="text-[10px] text-[rgb(var(--gold-700))] inline-flex items-center gap-0.5">
                    <Check size={12} /> selezionato
                  </span>
                )}
              </div>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                {p.etichette?.servizio_label ?? 'Catalogo servizi'}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mt-1">
                {p.gruppo}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
