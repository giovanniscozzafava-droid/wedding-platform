import { useState } from 'react'
import { Briefcase, ClipboardCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// ────────────────────────────────────────────────────────────────────────────
// REVISIONE C.3 — Modale "Che tipo di incarico hai?"
//
// Si apre automaticamente sul WeddingDashboard quando un evento entra in
// stato INCARICO_FIRMATO e `ambito_capostipite` e' ancora NULL. Salva la
// scelta su calendar_entries e chiude.
//
// Mobile-first: bottom-sheet su mobile (rounded-t-2xl, sm:rounded-2xl),
// card 100% width fino a max-w-md, una azione primaria per card,
// touch target >=44px.
// ────────────────────────────────────────────────────────────────────────────

export type Ambito = 'COMPLETO' | 'SOLO_COORDINAMENTO' | 'SOLO_PROPRI_SERVIZI'

type Props = {
  entryId: string
  onSaved: (ambito: Ambito) => void
  onSkip?: () => void
}

const OPTIONS: Array<{
  key: Ambito
  title: string
  desc: string
  icon: typeof Briefcase
  accent: string
}> = [
  {
    key: 'COMPLETO',
    title: 'Incarico completo',
    desc:
      'Gestisci tutto: raccogli preventivi dai fornitori, prepari contratto, pianifichi e coordini.',
    icon: Briefcase,
    accent: 'rgb(var(--gold-600))',
  },
  {
    key: 'SOLO_COORDINAMENTO',
    title: 'Solo coordinamento',
    desc:
      'Niente preventivi ne contratto economico: passi direttamente alla pianificazione (tavoli, invitati, timeline, checklist).',
    icon: ClipboardCheck,
    accent: 'rgb(var(--rose-500))',
  },
  {
    key: 'SOLO_PROPRI_SERVIZI',
    title: 'Solo propri servizi',
    desc:
      'Stai erogando solo servizi tuoi: componi menu e gestisci il tuo catalogo, senza raccogliere preventivi esterni.',
    icon: Sparkles,
    accent: 'rgb(var(--gold-700))',
  },
]

export function AmbitoIncaricoModal({ entryId, onSaved, onSkip }: Props) {
  const [busy, setBusy] = useState<Ambito | null>(null)

  async function choose(ambito: Ambito) {
    setBusy(ambito)
    try {
      const { error } = await supabase
        .from('calendar_entries')
        .update({ ambito_capostipite: ambito } as any)
        .eq('id', entryId)
      if (error) throw error
      toast.success('Ambito incarico salvato')
      onSaved(ambito)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ambito-incarico-title"
    >
      <div
        className="bg-[rgb(var(--bg-elev))] w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border p-5 sm:p-6"
        style={{ borderColor: 'rgb(var(--border))' }}
      >
        <h3 id="ambito-incarico-title" className="font-display text-lg sm:text-xl mb-1">
          Che tipo di incarico hai?
        </h3>
        <p className="text-xs sm:text-sm text-[rgb(var(--fg-muted))] mb-4">
          Imposta l'ambito: il workflow "prossima mossa" si adattera automaticamente.
        </p>
        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon
            const isBusy = busy === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => void choose(opt.key)}
                disabled={busy !== null}
                className="text-left p-4 rounded-xl border-2 transition-colors hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                style={{ borderColor: 'rgb(var(--border))' }}
                aria-label={opt.title}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="inline-flex items-center justify-center h-10 w-10 shrink-0 rounded-full"
                    style={{ background: 'rgb(var(--gold-100))', color: opt.accent }}
                  >
                    <Icon size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[15px]">{opt.title}</p>
                    <p className="text-xs sm:text-sm text-[rgb(var(--fg-muted))] mt-1">
                      {opt.desc}
                    </p>
                  </div>
                  {isBusy && (
                    <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                      Salvo…
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
        {onSkip && (
          <div className="mt-4 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={busy !== null}
              className="min-h-[44px]"
            >
              Decido piu` tardi
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AmbitoIncaricoModal
