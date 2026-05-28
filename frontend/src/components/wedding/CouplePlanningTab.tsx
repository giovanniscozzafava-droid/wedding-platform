import { useEffect, useState } from 'react'
import { ClipboardList, Save, Plus, X, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Stage = 'JUST_ENGAGED' | 'EXPLORING' | 'COMPARING' | 'MOSTLY_BOOKED' | 'FINAL_DETAILS'
type Urgency = 'RELAXED' | 'NORMAL' | 'TIGHT' | 'URGENT'

const STAGES: Array<{ v: Stage; label: string; hint: string }> = [
  { v: 'JUST_ENGAGED',   label: 'Appena fidanzati',  hint: 'Ancora niente di concreto, raccogliamo idee' },
  { v: 'EXPLORING',      label: 'Stiamo esplorando', hint: 'Cerchiamo location e ispirazioni' },
  { v: 'COMPARING',      label: 'Confrontiamo',      hint: 'Abbiamo preventivi da diversi fornitori' },
  { v: 'MOSTLY_BOOKED',  label: 'Quasi tutto prenotato', hint: 'Mancano solo pochi pezzi' },
  { v: 'FINAL_DETAILS',  label: 'Dettagli finali',   hint: 'Solo aggiustamenti dell\'ultimo minuto' },
]

const URGENCIES: Array<{ v: Urgency; label: string; tone: string }> = [
  { v: 'RELAXED', label: 'Abbiamo tempo',      tone: 'rgb(34 197 94)' },
  { v: 'NORMAL',  label: 'Tempi normali',       tone: 'rgb(var(--gold-600))' },
  { v: 'TIGHT',   label: 'La data è vicina',    tone: 'rgb(var(--amber-500))' },
  { v: 'URGENT',  label: 'Urgentissimo',        tone: 'rgb(var(--rose-500))' },
]

const CATEGORIES = [
  'Location', 'Catering', 'Fotografo', 'Videomaker', 'Fiori', 'Musica/DJ/Band',
  'Wedding planner', 'Make-up', 'Hairstylist', 'Abito sposa', 'Abito sposo',
  'Auto sposi', 'Cerimonia (chiesa/celebrante)', 'Cake design', 'Bomboniere', 'Altro',
]

type Booking = {
  category: string
  supplier_name: string
  status: 'IDEA' | 'OPTIONED' | 'CONFIRMED' | 'PAID'
  notes?: string
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  IDEA: 'Solo idea',
  OPTIONED: 'Opzionato',
  CONFIRMED: 'Confermato',
  PAID: 'Acconto versato',
}

export function CouplePlanningTab({ entryId, readOnly = false }: { entryId: string; readOnly?: boolean }) {
  const qc = useQueryClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [stage, setStage] = useState<Stage | ''>('')
  const [urgency, setUrgency] = useState<Urgency | ''>('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [notes, setNotes] = useState('')
  const [completedAt, setCompletedAt] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data, error } = await (supabase.from('couple_preferences') as any)
          .select('planning_stage, urgency, already_booked, additional_notes, questionnaire_completed_at')
          .eq('entry_id', entryId)
          .maybeSingle()
        if (error) throw error
        if (data) {
          setStage((data.planning_stage as Stage) ?? '')
          setUrgency((data.urgency as Urgency) ?? '')
          const arr = Array.isArray(data.already_booked) ? data.already_booked : []
          setBookings(arr as Booking[])
          setNotes(data.additional_notes ?? '')
          setCompletedAt(data.questionnaire_completed_at ?? null)
        }
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [entryId])

  function addBooking() {
    setBookings((b) => [...b, { category: CATEGORIES[0]!, supplier_name: '', status: 'IDEA', notes: '' }])
  }

  function patchBooking(i: number, patch: Partial<Booking>) {
    setBookings((b) => b.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))
  }

  function removeBooking(i: number) {
    setBookings((b) => b.filter((_, idx) => idx !== i))
  }

  async function save() {
    if (!stage) { toast.error('Indica a che punto siete della pianificazione'); return }
    setSaving(true)
    try {
      const cleaned = bookings.filter((b) => b.supplier_name.trim() || b.category)
      const { error } = await (supabase as any).rpc('couple_save_planning', {
        p_entry_id: entryId,
        p_planning_stage: stage,
        p_urgency: urgency || null,
        p_already_booked: cleaned,
        p_additional_notes: notes,
      })
      if (error) throw error
      toast.success('Risposte salvate')
      setCompletedAt(new Date().toISOString())
      qc.invalidateQueries({ queryKey: ['wedding', entryId] })
      qc.invalidateQueries({ queryKey: ['couple_preferences', entryId] })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-[rgb(var(--fg-subtle))]">Caricamento…</p>

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl">Questionario di pianificazione</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {readOnly
              ? 'Quello che la coppia ha già condiviso. Aggiorna il modo in cui imposti il preventivo.'
              : 'Aiutaci a capire dove sei e cosa hai già deciso. Il tuo wedding planner ne terrà conto.'}
          </p>
        </div>
        {completedAt && (
          <span className="text-xs text-[rgb(var(--fg-subtle))] shrink-0">
            Ultima compilazione: {new Date(completedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
          </span>
        )}
      </header>

      {/* Stato pianificazione */}
      <Card className="p-6">
        <h3 className="font-display text-lg mb-3 flex items-center gap-2">
          <ClipboardList size={18} className="text-[rgb(var(--gold-600))]" />
          A che punto siete?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {STAGES.map((s) => {
            const active = stage === s.v
            return (
              <button
                key={s.v}
                disabled={readOnly}
                onClick={() => setStage(s.v)}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  active
                    ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--bg-sunken))]'
                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <p className="font-medium text-sm">{s.label}</p>
                <p className="text-[10px] text-[rgb(var(--fg-muted))] mt-1">{s.hint}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Urgenza */}
      <Card className="p-6">
        <h3 className="font-display text-lg mb-3">Quanto preme la data?</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {URGENCIES.map((u) => {
            const active = urgency === u.v
            return (
              <button
                key={u.v}
                disabled={readOnly}
                onClick={() => setUrgency(u.v)}
                className={`p-3 rounded-lg border-2 transition-colors text-sm font-medium ${
                  active ? 'bg-[rgb(var(--bg-sunken))]' : 'hover:bg-[rgb(var(--bg-sunken))]'
                } disabled:opacity-50`}
                style={{ borderColor: active ? u.tone : 'rgb(var(--border))' }}
              >
                <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ background: u.tone }} />
                {u.label}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Already booked */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-lg">Cosa avete già prenotato o opzionato?</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              Aggiungi una riga per ciascun fornitore o elemento già definito.
            </p>
          </div>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={addBooking}>
              <Plus size={14} /> Aggiungi
            </Button>
          )}
        </div>

        {bookings.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center" style={{ borderColor: 'rgb(var(--border))' }}>
            <AlertCircle className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" size={20} />
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              {readOnly ? 'Nessun fornitore ancora segnalato.' : 'Nessuna prenotazione segnalata. Aggiungi cosa hai già deciso.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {bookings.map((b, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_1fr_auto] gap-2 items-start p-3 rounded-lg border" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">Categoria</Label>
                  <Select
                    disabled={readOnly}
                    value={b.category}
                    onChange={(e) => patchBooking(i, { category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">Nome / dettagli</Label>
                  <Input
                    disabled={readOnly}
                    value={b.supplier_name}
                    onChange={(e) => patchBooking(i, { supplier_name: e.target.value })}
                    placeholder="es. Tenuta del Sole / Mario Rossi Photographer"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase">Stato</Label>
                  <Select
                    disabled={readOnly}
                    value={b.status}
                    onChange={(e) => patchBooking(i, { status: e.target.value as Booking['status'] })}
                  >
                    {(Object.entries(STATUS_LABEL) as Array<[Booking['status'], string]>).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </Select>
                </div>
                {!readOnly && (
                  <div className="flex items-end h-full">
                    <Button variant="ghost" size="icon" onClick={() => removeBooking(i)} title="Rimuovi">
                      <X size={14} />
                    </Button>
                  </div>
                )}
                <div className="space-y-1 sm:col-span-4">
                  <Label className="text-[10px] uppercase">Note (importo, contatto, scadenza…)</Label>
                  <Input
                    disabled={readOnly}
                    value={b.notes ?? ''}
                    onChange={(e) => patchBooking(i, { notes: e.target.value })}
                    placeholder="es. acconto 1500€ versato il 12/04"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Note libere */}
      <Card className="p-6">
        <h3 className="font-display text-lg mb-3">Altro che dovremmo sapere?</h3>
        <Textarea
          rows={4}
          disabled={readOnly}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Vincoli, sogni, paure, parenti complicati, allergie strane, qualunque cosa ci aiuti a curarti meglio."
        />
      </Card>

      {!readOnly && (
        <div className="flex justify-end">
          <Button variant="gold" onClick={() => void save()} disabled={saving}>
            <Save size={14} /> {saving ? 'Salvataggio…' : 'Salva le mie risposte'}
          </Button>
        </div>
      )}
    </div>
  )
}
