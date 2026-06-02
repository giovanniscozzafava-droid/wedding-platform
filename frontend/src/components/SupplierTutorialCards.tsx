import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, ChevronRight, ChevronLeft, Lightbulb, Camera, Calendar, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

type TutorialState = {
  dismissed: boolean
  completed_steps: string[]
  first_offer_created: boolean
  started_at?: string | null
  completed_at?: string | null
}

const STEPS = [
  {
    key: 'welcome',
    icon: Sparkles,
    title: 'Benvenuto su Planfully',
    body: 'Tre passi semplici per partire. Ti accompagneremo con messaggi grandi e chiari. Non sbagli niente: tutto si può cambiare in qualunque momento.',
    cta: 'Cominciamo',
    path: null,
  },
  {
    key: 'create-offer',
    icon: FileText,
    title: 'Passo 1 — Crea la tua prima offerta',
    body: 'Vai su "Catalogo" e clicca il bottone giallo "Nuovo servizio". Scrivi il nome (es. "Servizio fotografico full day"), il prezzo e una breve descrizione. Hai dei suggerimenti pronti per il tuo mestiere.',
    cta: 'Apri il Catalogo',
    path: '/catalog?firstOffer=1',
  },
  {
    key: 'add-photo',
    icon: Camera,
    title: 'Passo 2 — Aggiungi le tue foto',
    body: 'Quando hai creato l\'offerta, dalla stessa schermata puoi caricare fino a 10 foto. Le foto venderanno per te. Anche solo 2 o 3 belle foto bastano per iniziare.',
    cta: 'Capito',
    path: null,
  },
  {
    key: 'availability',
    icon: Calendar,
    title: 'Passo 3 — Le tue date disponibili',
    body: 'Vai su "Disponibilità" e clicca sui giorni in cui sei già impegnato (matrimoni, prove). Diventeranno rossi. Tutti gli altri giorni resteranno verdi: i wedding planner potranno proporti per quelle date.',
    cta: 'Apri Disponibilità',
    path: '/disponibilita',
  },
  {
    key: 'business-card',
    icon: Lightbulb,
    title: 'Suggerimento — Il tuo brand',
    body: 'Vai su "Brand" per caricare il logo della tua attività e scegliere i colori. Verranno usati automaticamente sui preventivi PDF che mandi ai clienti.',
    cta: 'Apri Brand',
    path: '/settings/brand',
  },
  {
    key: 'ready',
    icon: CheckCircle2,
    title: 'Sei pronto/a',
    body: 'Quando ricevi un invito a far parte di un matrimonio, riceverai una mail. Da quel momento i wedding planner potranno aggiungere i tuoi servizi ai loro preventivi. Per qualsiasi dubbio, riapri questo tutorial dal tuo Profilo.',
    cta: 'Chiudi',
    path: null,
  },
]

// Gate SINCRONO su localStorage (chiave globale): letto al PRIMO render, prima
// che profilo/auth si risolvano. Una volta premuto "Non mostrarlo più", la card
// non può più riapparire — nemmeno al reload, nemmeno se il DB fallisce
// (sessione scaduta) o se l'auth ricarica un profilo "stale".
const DISMISS_KEY = 'pf_tutorial_dismissed_v2'
function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}
function writeDismissed() {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* no-op */ }
}

export function SupplierTutorialCards() {
  const { profile, user } = useAuth()
  const [state, setState] = useState<TutorialState | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [collapsed, setCollapsed] = useState(false)
  // Sincrono: se già chiuso, è true dal primissimo render → niente flash, niente ritorno.
  const [killed, setKilled] = useState<boolean>(() => readDismissed())

  useEffect(() => {
    if (!profile || !user) return
    if (profile.role !== 'FORNITORE') return
    const s = (profile as any).tutorial_state as TutorialState | null
    const base = s ?? { dismissed: false, completed_steps: [], first_offer_created: false }
    // Sincronizza: se il DB dice "chiuso", ricordalo anche localmente.
    if (base.dismissed) { writeDismissed(); setKilled(true) }
    setState(base)
  }, [profile, user])

  async function persist(patch: Partial<TutorialState>) {
    if (!user || !state) return
    const next = { ...state, ...patch }
    setState(next)
    await supabase.from('profiles').update({ tutorial_state: next as any }).eq('id', user.id)
  }

  function dismiss() {
    writeDismissed()      // sincrono: chiuso PER SEMPRE, indipendente da rete/DB
    setKilled(true)       // nasconde subito e non torna
    void persist({ dismissed: true, completed_at: new Date().toISOString() }) // best effort
  }

  async function markCompleted(stepKey: string) {
    if (!state) return
    if (!state.completed_steps.includes(stepKey)) {
      await persist({ completed_steps: [...state.completed_steps, stepKey] })
    }
  }

  if (killed) return null
  if (!profile || profile.role !== 'FORNITORE') return null
  if (!state) return null
  if (state.dismissed) return null

  const step = STEPS[stepIdx]!
  const isLast = stepIdx === STEPS.length - 1
  const Icon = step.icon

  return (
    <div className="fixed bottom-6 right-6 z-[60] max-w-md w-[calc(100vw-3rem)]">
      <AnimatePresence>
        {!collapsed ? (
          <motion.div
            key="card"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            className="rounded-2xl shadow-2xl border overflow-hidden"
            style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--gold-500))' }}
          >
            <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ background: 'rgb(var(--gold-100) / 0.6)' }}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0" style={{ background: 'rgb(var(--gold-500))', color: 'white' }}>
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">Tutorial · {stepIdx + 1} di {STEPS.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setCollapsed(true)} aria-label="Riduci" className="p-1 rounded hover:bg-black/5">
                  <span className="block w-3 h-0.5 bg-current opacity-60" />
                </button>
                <button onClick={dismiss} aria-label="Chiudi" className="p-1 rounded hover:bg-black/5">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <h3 className="font-display text-xl leading-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
                {step.body}
              </p>
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                  disabled={stepIdx === 0}
                  aria-label="Indietro"
                >
                  <ChevronLeft size={14} /> Indietro
                </Button>
                {step.path ? (
                  <Link
                    to={step.path}
                    onClick={() => { void markCompleted(step.key); setCollapsed(true) }}
                    className="inline-flex items-center gap-1.5 px-4 h-9 rounded-md text-sm font-medium"
                    style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}
                  >
                    {step.cta} <ChevronRight size={14} />
                  </Link>
                ) : (
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => {
                      void markCompleted(step.key)
                      if (isLast) { void dismiss() } else { setStepIdx((i) => i + 1) }
                    }}
                  >
                    {step.cta} {!isLast && <ChevronRight size={14} />}
                  </Button>
                )}
              </div>
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStepIdx(i)}
                    aria-label={`Passo ${i + 1}`}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === stepIdx ? 24 : 8,
                      background: i === stepIdx ? 'rgb(var(--gold-500))' : 'rgb(var(--border-strong))',
                    }}
                  />
                ))}
              </div>
              <div className="text-center pt-2">
                <button onClick={() => void dismiss()} className="text-[11px] text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg-muted))] underline">
                  Non mostrarlo più
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="pill"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setCollapsed(false)}
            className="ml-auto block rounded-full shadow-lg px-4 h-10 inline-flex items-center gap-2 text-sm font-medium"
            style={{ background: 'rgb(var(--gold-500))', color: 'white' }}
          >
            <Sparkles size={14} /> Riprendi tutorial · {stepIdx + 1}/{STEPS.length}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
