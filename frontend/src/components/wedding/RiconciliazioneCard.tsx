// FASE 4.2 — Card riconciliazione menu vs ospiti.
// Mostra: totale ospiti YES, totale PENDING, conteggio voci menu PER_GUEST sul preventivo,
// delta, importi. Pulsante "Allinea menu al conteggio" che richiama la RPC
// `riconciliazione_allinea_menu(p_entry_id)`.
// Mobile-first: colonna singola < sm, touch target >= 44px, una azione primaria.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Users, Utensils, Scale, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type RecRow = {
  entry_id: string
  totale_ospiti_yes: number
  totale_ospiti_pending: number
  count_menu_for_guest: number
  delta: number
  importo_menu_per_guest: number
  importo_totale_quote: number
}

export function RiconciliazioneCard({ entryId }: { entryId: string }) {
  const [row, setRow] = useState<RecRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [aligning, setAligning] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await (supabase.from as any)('v_riconciliazione_evento')
        .select('*')
        .eq('entry_id', entryId)
        .maybeSingle()
      if (error) throw error
      setRow(
        data
          ? {
              entry_id: data.entry_id,
              totale_ospiti_yes: Number(data.totale_ospiti_yes ?? 0),
              totale_ospiti_pending: Number(data.totale_ospiti_pending ?? 0),
              count_menu_for_guest: Number(data.count_menu_for_guest ?? 0),
              delta: Number(data.delta ?? 0),
              importo_menu_per_guest: Number(data.importo_menu_per_guest ?? 0),
              importo_totale_quote: Number(data.importo_totale_quote ?? 0),
            }
          : null,
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    void load()
  }, [entryId])

  async function align() {
    setAligning(true)
    try {
      const { data, error } = await (supabase as any).rpc('riconciliazione_allinea_menu', {
        p_entry_id: entryId,
      })
      if (error) throw error
      const updated = Number(data?.updated ?? 0)
      toast.success(
        updated > 0
          ? `Aggiornate ${updated} voci menu al conteggio ospiti`
          : 'Nessuna voce da aggiornare',
      )
      setConfirm(false)
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setAligning(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-xs text-[rgb(var(--fg-subtle))]">Caricamento riconciliazione…</p>
      </Card>
    )
  }

  if (!row) {
    return (
      <Card className="p-6 text-center">
        <Scale size={28} className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" />
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Nessun dato di riconciliazione disponibile per questo evento.
        </p>
      </Card>
    )
  }

  const delta = row.delta
  const deltaAbs = Math.abs(delta)
  const deltaSign = delta === 0 ? 'ok' : delta > 0 ? 'eccesso' : 'difetto'
  const deltaColor =
    deltaSign === 'ok'
      ? 'rgb(22 163 74)'
      : deltaSign === 'eccesso'
        ? 'rgb(217 119 6)'
        : 'rgb(220 38 38)'
  const deltaBg =
    deltaSign === 'ok'
      ? 'rgb(34 197 94 / 0.14)'
      : deltaSign === 'eccesso'
        ? 'rgb(245 158 11 / 0.14)'
        : 'rgb(220 38 38 / 0.14)'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.16em]"
            style={{ color: 'rgb(var(--gold-600))' }}
          >
            Coerenza ospiti / menu
          </div>
          <h2 className="font-display text-xl mt-1">Riconciliazione</h2>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
            Confronto fra invitati confermati e coperti previsti dal preventivo.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => void load()}
          className="min-h-[44px]"
          aria-label="Ricarica riconciliazione"
        >
          <RefreshCw size={14} /> Ricarica
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">
            <Users size={12} /> Ospiti confermati
          </div>
          <div className="font-display text-2xl tabular-nums mt-1">
            {row.totale_ospiti_yes}
          </div>
          {row.totale_ospiti_pending > 0 && (
            <div className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">
              + {row.totale_ospiti_pending} in attesa
            </div>
          )}
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">
            <Utensils size={12} /> Coperti su preventivo
          </div>
          <div className="font-display text-2xl tabular-nums mt-1">
            {row.count_menu_for_guest}
          </div>
          <div className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">
            voci con basis PER_GUEST
          </div>
        </Card>

        <Card className="p-3" style={{ background: deltaBg }}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">
            <Scale size={12} /> Delta
          </div>
          <div className="font-display text-2xl tabular-nums mt-1" style={{ color: deltaColor }}>
            {delta === 0 ? '0' : delta > 0 ? `+${delta}` : `${delta}`}
          </div>
          <div className="text-[11px] mt-1" style={{ color: deltaColor }}>
            {deltaSign === 'ok'
              ? 'Allineato'
              : deltaSign === 'eccesso'
                ? `${deltaAbs} coperti in piu`
                : `${deltaAbs} coperti mancanti`}
          </div>
        </Card>
      </div>

      {/* Importi */}
      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">
              Importo medio per ospite
            </div>
            <div className="font-display text-lg tabular-nums mt-1">
              € {row.importo_menu_per_guest.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">
              Totale preventivo
            </div>
            <div className="font-display text-lg tabular-nums mt-1">
              € {row.importo_totale_quote.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </Card>

      {/* Azione primaria */}
      {delta !== 0 && row.count_menu_for_guest > 0 && (
        <Card
          className="p-4 border-2"
          style={{ borderColor: 'rgb(var(--gold-500))' }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={18}
                className="shrink-0 mt-0.5"
                style={{ color: 'rgb(var(--gold-700))' }}
              />
              <div>
                <p className="text-sm font-medium">Allinea il menu al conteggio ospiti</p>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                  Imposta la quantita` di tutte le voci PER_GUEST del preventivo a{' '}
                  <span className="font-semibold">{row.totale_ospiti_yes}</span> (ospiti
                  confermati). Operazione reversibile dalla pagina preventivo.
                </p>
              </div>
            </div>
            {!confirm ? (
              <Button
                variant="gold"
                onClick={() => setConfirm(true)}
                className="w-full sm:w-auto sm:self-end min-h-[44px]"
              >
                Allinea menu al conteggio
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="ghost"
                  onClick={() => setConfirm(false)}
                  disabled={aligning}
                  className="min-h-[44px]"
                >
                  Annulla
                </Button>
                <Button
                  variant="gold"
                  onClick={() => void align()}
                  disabled={aligning}
                  className="min-h-[44px]"
                >
                  {aligning ? 'Allineamento…' : 'Conferma allineamento'}
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}

      {delta === 0 && row.count_menu_for_guest > 0 && (
        <Card className="p-4 text-center" style={{ background: 'rgb(34 197 94 / 0.08)' }}>
          <p className="text-sm" style={{ color: 'rgb(22 163 74)' }}>
            Coperti e ospiti confermati sono allineati.
          </p>
        </Card>
      )}
    </div>
  )
}
