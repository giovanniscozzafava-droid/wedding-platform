// FASE 5.2 — Menu kebab "cambiamenti evento" + 3 modali di conferma in lingua umana.
//
// Espone:
//  - Riprogramma evento (nuova data)
//  - Segnala dropout fornitore (voce + motivo)
//  - Annulla evento (motivo, conferma forte)
//
// Mobile-first: tap target >= 44px, una azione primaria per modale, conferme in
// linguaggio umano italiano (no jargon).

import { useEffect, useMemo, useState } from 'react'
import { MoreVertical, CalendarClock, UserX, Ban, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Props = {
  entryId: string
  onChanged?: () => void
}

export function EventoChangesMenu({ entryId, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [modal, setModal] = useState<null | 'RIPROGRAMMA' | 'DROPOUT' | 'ANNULLA'>(null)

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="Azioni evento"
        className="min-h-[44px] min-w-[44px]">
        <MoreVertical size={16} /> Azioni evento
      </Button>
      {open && (
        <>
          {/* Overlay che chiude */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 sm:left-auto sm:right-0 mt-2 z-40 w-[min(92vw,18rem)] rounded-xl border shadow-xl overflow-hidden"
            style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
            <button
              onClick={() => {
                setOpen(false)
                setModal('RIPROGRAMMA')
              }}
              className="w-full flex items-start gap-2 px-3 py-3 text-left hover:bg-[rgb(var(--bg-sunken))] min-h-[44px]">
              <CalendarClock size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Riprogramma evento</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">Sposta la data e avvisa i fornitori per riconfermare.</p>
              </div>
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setModal('DROPOUT')
              }}
              className="w-full flex items-start gap-2 px-3 py-3 text-left hover:bg-[rgb(var(--bg-sunken))] min-h-[44px] border-t"
              style={{ borderColor: 'rgb(var(--border))' }}>
              <UserX size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Segnala dropout fornitore</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">Un fornitore ha rinunciato. Annota il motivo e cerca un sostituto.</p>
              </div>
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setModal('ANNULLA')
              }}
              className="w-full flex items-start gap-2 px-3 py-3 text-left hover:bg-[rgb(var(--bg-sunken))] min-h-[44px] border-t"
              style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--rose-500))' }}>
              <Ban size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Annulla evento</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">L''evento non si fara`. Quote rifiutati, contratti annullati. Recuperabile.</p>
              </div>
            </button>
          </div>
        </>
      )}

      {modal === 'RIPROGRAMMA' && (
        <RiprogrammaModal
          entryId={entryId}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            onChanged?.()
          }}
        />
      )}
      {modal === 'DROPOUT' && (
        <DropoutModal
          entryId={entryId}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            onChanged?.()
          }}
        />
      )}
      {modal === 'ANNULLA' && (
        <AnnullaModal
          entryId={entryId}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null)
            onChanged?.()
          }}
        />
      )}
    </div>
  )
}

// ---------- Modale RIPROGRAMMA ---------------------------------------------

function RiprogrammaModal({
  entryId,
  onClose,
  onDone,
}: {
  entryId: string
  onClose: () => void
  onDone: () => void
}) {
  const [nuovaData, setNuovaData] = useState('')
  const [busy, setBusy] = useState(false)
  const [vecchiaData, setVecchiaData] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from('calendar_entries') as any)
        .select('date_from')
        .eq('id', entryId)
        .maybeSingle()
      setVecchiaData(((data as any)?.date_from as string) ?? null)
    })()
  }, [entryId])

  async function go() {
    if (!nuovaData) return toast.error('Scegli una nuova data')
    setBusy(true)
    try {
      const { data, error } = await (supabase as any).rpc('riprogramma_evento', {
        p_entry_id: entryId,
        p_nuova_data: nuovaData,
      })
      if (error) throw error
      const n = Number((data as any)?.fornitori_da_riconfermare ?? 0)
      toast.success(
        n > 0
          ? `Evento spostato. Notifica inviata a ${n} fornitori per riconferma.`
          : 'Evento spostato.',
      )
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Riprogramma evento"
      eyebrow="Cambio data"
      onClose={onClose}>
      <p className="text-sm text-[rgb(var(--fg-muted))]">
        Scegli la nuova data dell''evento. La disponibilita` dei fornitori sulla data vecchia
        viene liberata. Ogni fornitore riceve una notifica per riconfermare sulla nuova data.
      </p>
      <div className="mt-4 space-y-3">
        {vecchiaData && (
          <Card className="p-3 text-xs text-[rgb(var(--fg-muted))]">
            Data attuale: <strong>{new Date(vecchiaData).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
          </Card>
        )}
        <div>
          <Label>Nuova data</Label>
          <Input
            type="date"
            value={nuovaData}
            onChange={(e) => setNuovaData(e.target.value)}
            className="min-h-[44px]"
          />
        </div>
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={go}
        busy={busy}
        confirmLabel="Conferma riprogrammazione"
        confirmDisabled={!nuovaData}
      />
    </ModalShell>
  )
}

// ---------- Modale DROPOUT --------------------------------------------------

function DropoutModal({
  entryId,
  onClose,
  onDone,
}: {
  entryId: string
  onClose: () => void
  onDone: () => void
}) {
  type Item = { id: string; name_snapshot: string; supplier_id: string | null; supplier_name?: string | null }
  const [items, setItems] = useState<Item[]>([])
  const [voce, setVoce] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const { data: ce } = await (supabase.from('calendar_entries') as any)
          .select('quote_id')
          .eq('id', entryId)
          .maybeSingle()
        const qid = (ce as any)?.quote_id as string | null
        if (!qid) {
          setItems([])
          return
        }
        const { data, error } = await (supabase.from('quote_items') as any)
          .select(
            'id, name_snapshot, supplier_id, supplier:profiles!quote_items_supplier_id_fkey(business_name, full_name)',
          )
          .eq('quote_id', qid)
          .not('supplier_id', 'is', null)
          .order('sort_order', { ascending: true })
        if (error) throw error
        setItems(
          ((data ?? []) as any[]).map((r) => ({
            id: r.id,
            name_snapshot: r.name_snapshot,
            supplier_id: r.supplier_id,
            supplier_name: r.supplier?.business_name ?? r.supplier?.full_name ?? null,
          })),
        )
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [entryId])

  const voceLabel = useMemo(() => {
    const v = items.find((i) => i.id === voce)
    if (!v) return ''
    return `${v.name_snapshot}${v.supplier_name ? ` — ${v.supplier_name}` : ''}`
  }, [voce, items])

  async function go() {
    if (!voce) return toast.error('Scegli la voce')
    if (!motivo.trim()) return toast.error('Scrivi il motivo')
    setBusy(true)
    try {
      const { error } = await (supabase as any).rpc('dropout_fornitore', {
        p_quote_item_id: voce,
        p_motivo: motivo.trim(),
      })
      if (error) throw error
      toast.success('Dropout registrato. Notifica urgente inviata al wedding planner.')
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Segnala dropout fornitore"
      eyebrow="Rinuncia di un fornitore"
      onClose={onClose}>
      <p className="text-sm text-[rgb(var(--fg-muted))]">
        Il fornitore selezionato verra` rimosso dalla voce di preventivo. La sua disponibilita`
        per la data evento sara` liberata. Verrai notificato per cercare un sostituto.
      </p>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Voce preventivo</Label>
          {loading ? (
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Caricamento...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessun fornitore assegnato.</p>
          ) : (
            <Select value={voce} onChange={(e) => setVoce(e.target.value)}>
              <option value="">Seleziona la voce con il fornitore che ha rinunciato...</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name_snapshot}
                  {i.supplier_name ? ` — ${i.supplier_name}` : ''}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div>
          <Label>Motivo</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Es: malattia, doppia prenotazione, problemi logistici..."
            rows={3}
          />
        </div>
        {voce && (
          <Card className="p-3 text-xs text-[rgb(var(--fg-muted))]">
            Stai segnalando dropout per: <strong>{voceLabel}</strong>
          </Card>
        )}
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={go}
        busy={busy}
        confirmLabel="Registra dropout"
        confirmDisabled={!voce || !motivo.trim()}
      />
    </ModalShell>
  )
}

// ---------- Modale ANNULLA --------------------------------------------------

function AnnullaModal({
  entryId,
  onClose,
  onDone,
}: {
  entryId: string
  onClose: () => void
  onDone: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const canRun = motivo.trim().length > 0 && confirmText.trim().toUpperCase() === 'ANNULLA'

  async function go() {
    if (!canRun) return
    setBusy(true)
    try {
      const { data, error } = await (supabase as any).rpc('annulla_evento', {
        p_entry_id: entryId,
        p_motivo: motivo.trim(),
      })
      if (error) throw error
      const d = data as any
      toast.success(
        `Evento annullato. ${d?.notifiche_inviate ?? 0} persone notificate, ${d?.contracts_annullati ?? 0} contratti annullati.`,
      )
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell
      title="Annulla evento"
      eyebrow="Azione importante"
      onClose={onClose}
      tone="danger">
      <div className="rounded-lg p-3 flex items-start gap-2"
        style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-500))' }}>
        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
        <p className="text-sm">
          Stai per annullare l''evento. I preventivi saranno rifiutati, i contratti annullati e
          tutti i partecipanti riceveranno una notifica. I dati restano salvati e un amministratore
          puo` ripristinarli in futuro.
        </p>
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <Label>Motivo dell''annullamento *</Label>
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Spiega in poche righe perche` l''evento non si fara`..."
            rows={3}
          />
        </div>
        <div>
          <Label>Per confermare, scrivi <strong>ANNULLA</strong></Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="ANNULLA"
            className="min-h-[44px]"
          />
        </div>
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={go}
        busy={busy}
        confirmLabel="Conferma annullamento evento"
        confirmDisabled={!canRun}
        tone="danger"
      />
    </ModalShell>
  )
}

// ---------- Shared modal shell ----------------------------------------------

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
  tone = 'default',
}: {
  title: string
  eyebrow: string
  onClose: () => void
  children: React.ReactNode
  tone?: 'default' | 'danger'
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(15,15,15,0.65)' }}
      onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface w-full max-w-lg p-5 sm:p-7 rounded-t-2xl sm:rounded-2xl"
        style={{ borderTop: tone === 'danger' ? '3px solid rgb(var(--rose-500))' : undefined }}>
        <header className="mb-3">
          <div
            className="text-[10px] uppercase tracking-[0.18em]"
            style={{
              color:
                tone === 'danger' ? 'rgb(var(--rose-500))' : 'rgb(var(--gold-600))',
            }}>
            {eyebrow}
          </div>
          <h3 className="font-display text-xl mt-1">{title}</h3>
        </header>
        {children}
      </div>
    </div>
  )
}

function ModalFooter({
  onCancel,
  onConfirm,
  busy,
  confirmLabel,
  confirmDisabled,
  tone = 'default',
}: {
  onCancel: () => void
  onConfirm: () => unknown | Promise<unknown>
  busy: boolean
  confirmLabel: string
  confirmDisabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <footer className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      <Button
        variant="outline"
        onClick={onCancel}
        disabled={busy}
        className="min-h-[44px] w-full sm:w-auto">
        Annulla
      </Button>
      <Button
        variant={tone === 'danger' ? 'destructive' : 'gold'}
        onClick={() => { void Promise.resolve(onConfirm()) }}
        disabled={busy || confirmDisabled}
        className="min-h-[44px] w-full sm:w-auto">
        {busy ? 'Attendere...' : confirmLabel}
      </Button>
    </footer>
  )
}
