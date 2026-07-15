import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useMyWeddings } from '@/hooks/useCouple'
import { eventTerm } from '@/lib/eventKind'

type StyleKey =
  | 'CLASSICO' | 'MODERNO' | 'BOHO' | 'RUSTICO' | 'GLAMOUR' | 'MINIMAL'
  | 'VINTAGE' | 'INDUSTRIALE' | 'BEACH' | 'MOUNTAIN' | 'GARDEN' | 'DESTINATION'

const STYLES: Array<{ k: StyleKey; l: string }> = [
  { k: 'CLASSICO', l: 'Classico' },
  { k: 'MODERNO', l: 'Moderno' },
  { k: 'BOHO', l: 'Boho' },
  { k: 'RUSTICO', l: 'Rustico' },
  { k: 'GLAMOUR', l: 'Glamour' },
  { k: 'MINIMAL', l: 'Minimal' },
  { k: 'VINTAGE', l: 'Vintage' },
  { k: 'INDUSTRIALE', l: 'Industrial' },
  { k: 'BEACH', l: 'Beach' },
  { k: 'MOUNTAIN', l: 'Montagna' },
  { k: 'GARDEN', l: 'Garden' },
  { k: 'DESTINATION', l: 'Destination' },
]

const PALETTES = [
  { k: 'beige-sage-gold', l: 'Beige · Sage · Oro', colors: ['#d4c5a9', '#9caf88', '#c9a960'] },
  { k: 'white-blush-rose', l: 'Bianco · Blush · Rosa', colors: ['#fefefe', '#f4d9d0', '#dca0a7'] },
  { k: 'navy-cream-gold', l: 'Navy · Crema · Oro', colors: ['#1f3a5f', '#f5ead2', '#c9a960'] },
  { k: 'terracotta-rust', l: 'Terracotta · Rust', colors: ['#c87b5e', '#8b4513', '#deb887'] },
  { k: 'emerald-ivory', l: 'Smeraldo · Avorio', colors: ['#046307', '#fffff0', '#c9a960'] },
  { k: 'lilac-lavender', l: 'Lilla · Lavanda', colors: ['#b19cd9', '#e6e6fa', '#967bb6'] },
  { k: 'monochrome', l: 'Bianco & Nero', colors: ['#000000', '#ffffff', '#888888'] },
  { k: 'pastel-rainbow', l: 'Pastello arcobaleno', colors: ['#ffb3ba', '#bae1ff', '#baffc9'] },
]

const LOCATION_KINDS = [
  { v: 'villa', l: 'Villa storica' },
  { v: 'spiaggia', l: 'Spiaggia' },
  { v: 'montagna', l: 'Montagna' },
  { v: 'borgo', l: 'Borgo' },
  { v: 'campagna', l: 'Campagna' },
  { v: 'castello', l: 'Castello' },
  { v: 'agriturismo', l: 'Agriturismo' },
  { v: 'estero', l: 'Estero' },
]

const SEASONS = [
  { v: 'primavera', l: 'Primavera' },
  { v: 'estate', l: 'Estate' },
  { v: 'autunno', l: 'Autunno' },
  { v: 'inverno', l: 'Inverno' },
]

// Priorità di spesa SU MISURA per tipo evento (niente "abito" a una festa aziendale).
function prioritiesFor(kind: string): Array<{ v: string; l: string }> {
  const base = {
    cibo: 'Cibo / catering', location: 'Location', foto: 'Foto/Video',
    musica: 'Musica', intrattenimento: 'Intrattenimento', allestimento: 'Allestimento',
    torta: 'Torta', abito: 'Abito', bomboniere: 'Bomboniere',
    av: 'Audio/video & tech', branding: 'Branding / immagine',
  }
  const P = (...keys: Array<keyof typeof base>) => keys.map((k) => ({ v: k as string, l: base[k] }))
  switch (kind) {
    case 'matrimonio':   return P('cibo', 'location', 'foto', 'musica', 'allestimento', 'abito')
    case 'corporate':    return P('cibo', 'location', 'intrattenimento', 'av', 'allestimento', 'branding')
    case 'laurea':
    case 'compleanno':
    case 'anniversario': return P('cibo', 'location', 'intrattenimento', 'foto', 'allestimento', 'torta')
    case 'battesimo':
    case 'comunione':
    case 'cresima':      return P('cibo', 'location', 'foto', 'allestimento', 'torta', 'bomboniere')
    default:             return P('cibo', 'location', 'foto', 'musica', 'allestimento')
  }
}
// Esempi (placeholder) coerenti col tipo evento.
function examplesFor(kind: string): { must: string; no: string; vision: string } {
  switch (kind) {
    case 'corporate':  return { must: 'Es. open bar, speaker, premiazione, branding sul palco', no: 'Es. karaoke, giochi a premi', vision: 'Es. una serata elegante per i dipendenti, con cena placé, premiazioni e un momento di intrattenimento.' }
    case 'laurea':     return { must: 'Es. torta a tema, photobooth, dj', no: 'Es. discorsi troppo formali', vision: 'Es. una festa allegra per celebrare la laurea, con buffet, musica e tanti amici.' }
    case 'compleanno': return { must: 'Es. torta, animazione, palloncini', no: 'Es. sorprese imbarazzanti', vision: 'Es. una festa calorosa con cibo buono, musica e le persone a cui voglio bene.' }
    case 'anniversario': return { must: 'Es. cena romantica, musica dal vivo, foto', no: 'Es. troppa confusione', vision: 'Es. una cena intima per festeggiare insieme alle persone più care.' }
    case 'battesimo':
    case 'comunione':
    case 'cresima':    return { must: 'Es. pranzo, confettata, foto in chiesa', no: 'Es. musica troppo alta', vision: 'Es. un pranzo sereno in famiglia dopo la cerimonia, con un bel buffet e foto ricordo.' }
    default:           return { must: "Es. fuochi d'artificio, gelato artigianale, foto polaroid", no: 'Es. coriandoli, confusione', vision: 'Es. una festa intima, in mezzo alla natura, con musica live e buon cibo.' }
  }
}

const STEPS = ['Chi', 'Stile', 'Vision', 'Numeri', 'Pronto'] as const

type CoupleForm = {
  bride_name: string
  groom_name: string
  couple_name: string
  styles: StyleKey[]
  preferred_palette: string[]
  preferred_season: string
  location_kind: string
  vision_note: string
  must_haves: string
  no_thanks: string
  budget_min: number | ''
  budget_max: number | ''
  guests_estimate: number | ''
  budget_priority: string
}

export function CoupleOnboardingWizard() {
  const { user, refreshProfile } = useAuth()
  const nav = useNavigate()
  const { data: weddings, isLoading } = useMyWeddings()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [entryId, setEntryId] = useState<string | null>(null)
  const [form, setForm] = useState<CoupleForm>({
    bride_name: '', groom_name: '', couple_name: '',
    styles: [], preferred_palette: [], preferred_season: '', location_kind: '',
    vision_note: '', must_haves: '', no_thanks: '',
    budget_min: '', budget_max: '', guests_estimate: '', budget_priority: '',
  })

  useEffect(() => {
    if (!entryId && weddings && weddings.length > 0) {
      setEntryId(weddings[0]?.entry?.id ?? null)
    }
  }, [weddings, entryId])

  const totalSteps = STEPS.length

  // Terminologia dinamica per event_kind (matrimonio | battesimo | comunione | ...)
  const currentEntry = (weddings ?? []).find((w) => w.entry?.id === entryId)?.entry as any
  const eventKind = currentEntry?.event_kind ?? 'matrimonio'
  const term = eventTerm(eventKind)
  const priorities = prioritiesFor(eventKind)
  const ex = examplesFor(eventKind)
  const guestsLabel = eventKind === 'corporate' ? 'Partecipanti stimati' : 'Invitati stimati'
  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step, totalSteps])

  function patch<K extends keyof CoupleForm>(k: K, v: CoupleForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  function toggleStyle(k: StyleKey) {
    setForm((f) => ({
      ...f,
      styles: f.styles.includes(k) ? f.styles.filter((s) => s !== k) : [...f.styles, k].slice(0, 4),
    }))
  }
  function togglePalette(k: string) {
    setForm((f) => ({
      ...f,
      preferred_palette: f.preferred_palette.includes(k)
        ? f.preferred_palette.filter((s) => s !== k)
        : [...f.preferred_palette, k].slice(0, 2),
    }))
  }

  function next() {
    if (step === 0 && !form.couple_name && !form.bride_name && !form.groom_name) {
      toast.error('Inserisci almeno un nome'); return
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1))
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)) }

  async function save() {
    if (!user) return
    if (!entryId) { toast.error(`Nessun ${term.label} collegato — chiedi all'organizzatore di invitarti`); return }
    setBusy(true)
    try {
      const payload = {
        entry_id: entryId,
        bride_name: form.bride_name || null,
        groom_name: form.groom_name || null,
        couple_name: form.couple_name || null,
        styles: form.styles.length ? form.styles : null,
        preferred_palette: form.preferred_palette.length ? form.preferred_palette : null,
        preferred_season: form.preferred_season || null,
        location_kind: form.location_kind || null,
        vision_note: form.vision_note || null,
        must_haves: form.must_haves.split(',').map((s) => s.trim()).filter(Boolean),
        no_thanks: form.no_thanks.split(',').map((s) => s.trim()).filter(Boolean),
        budget_min: form.budget_min === '' ? null : form.budget_min,
        budget_max: form.budget_max === '' ? null : form.budget_max,
        guests_estimate: form.guests_estimate === '' ? null : form.guests_estimate,
        budget_priority: form.budget_priority || null,
      }
      const { error } = await supabase.from('couple_preferences').upsert(payload, { onConflict: 'entry_id' })
      if (error) throw error
      // Non sovrascrivere full_name dell'auth user con il couple_name: full_name è il nome del singolo.
      // Imposta full_name solo se ancora vuoto, usando bride_name o groom_name appropriato.
      const myFirstName = form.bride_name || form.groom_name || null
      await (supabase.from('profiles') as any).update({
        onboarding_complete: true,
        onboarding_completato_il: new Date().toISOString(),
        ...(myFirstName ? { full_name: myFirstName } : {}),
      }).eq('id', user.id)
      await refreshProfile()
      toast.success("Preferenze salvate — l'organizzatore le vedrà subito")
      // Dopo il questionario il cliente deve vedere il PREVENTIVO, non la dashboard.
      nav('/couple?tab=preventivo', { replace: true })
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  if (isLoading) return <div className="min-h-screen aurora flex items-center justify-center"><p className="text-sm text-[rgb(var(--fg-muted))]">Carico...</p></div>

  if (!weddings || weddings.length === 0) {
    return (
      <div className="min-h-screen aurora flex items-center justify-center p-6">
        <div className="surface surface-lift max-w-md p-8 text-center">
          <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-10 w-10 mx-auto mb-3" />
          <h1 className="font-display text-2xl mb-2">Manca solo l'invito</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
            Per iniziare, l'organizzatore deve invitarti al {term.label}.
            Quando ricevi l'email, clicca sul link e torna qui.
          </p>
          <Button variant="ghost" onClick={() => nav('/couple')}>Vai alla dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen aurora py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 flex items-center gap-3">
          <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-9 w-9" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">{term.hasCoupleConcept ? `Il vostro ${term.label}` : `Il ${term.label}`}</p>
            <h1 className="font-display text-2xl">{term.hasCoupleConcept ? 'Raccontateci la vostra visione' : 'Raccontaci come lo immagini'}</h1>
          </div>
        </header>

        {weddings.length > 1 && (
          <div className="mb-4">
            <Label>{term.hasCoupleConcept ? `Per quale ${term.label}?` : `Per quale ${term.label}?`}</Label>
            <Select value={entryId ?? ''} onChange={(e) => setEntryId(e.target.value)}>
              {weddings.map((w) => (
                <option key={w.entry?.id} value={w.entry?.id ?? ''}>{w.entry?.title}</option>
              ))}
            </Select>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[rgb(var(--fg-muted))] mb-2">
            <span>Step {step + 1} di {totalSteps} · {STEPS[step]}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'rgb(var(--rose-500))' }} />
          </div>
        </div>

        <motion.div className="surface surface-lift overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }} className="space-y-4">
                {step === 0 && (
                  <>
                    <h2 className="font-display text-xl mb-2">{term.hasCoupleConcept ? 'Chi siete' : 'Chi è il/la festeggiato/a'}</h2>
                    {term.hasCoupleConcept ? (
                      <div className="grid grid-cols-2 gap-3">
                        <Field label={`Nome (${term.honoreeFeminine} / ${term.honoreeSingular})`}>
                          <Input value={form.bride_name} onChange={(e) => patch('bride_name', e.target.value)} placeholder="Es. Giulia" />
                        </Field>
                        <Field label={`Nome (${term.honoreeFeminine} / ${term.honoreeSingular})`}>
                          <Input value={form.groom_name} onChange={(e) => patch('groom_name', e.target.value)} placeholder="Es. Marco" />
                        </Field>
                      </div>
                    ) : (
                      <Field label={`Nome ${term.honoreeNeutral}`}>
                        <Input value={form.bride_name} onChange={(e) => patch('bride_name', e.target.value)} placeholder="Es. Sofia Rossi" />
                      </Field>
                    )}
                    <Field label={term.hasCoupleConcept ? 'Come vi piace essere chiamati' : 'Come ti piace essere chiamato/a'}>
                      <Input value={form.couple_name} onChange={(e) => patch('couple_name', e.target.value)} placeholder={term.hasCoupleConcept ? 'Es. Giulia & Marco' : 'Es. Sofia'} />
                    </Field>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 className="font-display text-xl mb-2">{term.hasCoupleConcept ? 'Il vostro stile' : 'Lo stile'}</h2>
                    <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">{term.hasCoupleConcept ? 'Scegliete' : 'Scegli'} fino a 4 stili che {term.hasCoupleConcept ? 'vi' : 'ti'} rappresentano.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {STYLES.map((s) => {
                        const active = form.styles.includes(s.k)
                        return (
                          <button key={s.k} type="button" onClick={() => toggleStyle(s.k)}
                            className={`flex items-center justify-center rounded-lg border px-3 py-4 text-sm font-medium transition-colors ${active ? 'bg-[rgb(var(--rose-100))] border-[rgb(var(--rose-500))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                            <span>{s.l}</span>
                          </button>
                        )
                      })}
                    </div>

                    <Field label="Stagione preferita">
                      <Select value={form.preferred_season} onChange={(e) => patch('preferred_season', e.target.value)}>
                        <option value="">Nessuna preferenza</option>
                        {SEASONS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </Select>
                    </Field>

                    <Field label="Tipo di location">
                      <Select value={form.location_kind} onChange={(e) => patch('location_kind', e.target.value)}>
                        <option value="">Nessuna preferenza</option>
                        {LOCATION_KINDS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </Select>
                    </Field>
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2 className="font-display text-xl mb-2">Palette & vision</h2>
                    <Label>Palette colori (max 2)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {PALETTES.map((p) => {
                        const active = form.preferred_palette.includes(p.k)
                        return (
                          <button key={p.k} type="button" onClick={() => togglePalette(p.k)}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors ${active ? 'border-[rgb(var(--rose-500))] bg-[rgb(var(--rose-100))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                            <div className="flex -space-x-1">
                              {p.colors.map((c, i) => (
                                <span key={i} className="h-6 w-6 rounded-full border border-white" style={{ background: c }} />
                              ))}
                            </div>
                            <span className="text-xs">{p.l}</span>
                          </button>
                        )
                      })}
                    </div>

                    <Field label={`${term.hasCoupleConcept ? 'La vostra' : 'La tua'} vision (in 2-3 frasi)`}>
                      <Textarea rows={4} value={form.vision_note} onChange={(e) => patch('vision_note', e.target.value)}
                        placeholder={ex.vision} />
                    </Field>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Must have (separa con virgole)">
                        <Textarea rows={3} value={form.must_haves} onChange={(e) => patch('must_haves', e.target.value)}
                          placeholder={ex.must} />
                      </Field>
                      <Field label="No grazie (separa con virgole)">
                        <Textarea rows={3} value={form.no_thanks} onChange={(e) => patch('no_thanks', e.target.value)}
                          placeholder={ex.no} />
                      </Field>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <h2 className="font-display text-xl mb-2">Numeri</h2>
                    <Field label={guestsLabel}>
                      <Input type="number" min={0} value={form.guests_estimate}
                        onChange={(e) => patch('guests_estimate', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Es. 120" />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Budget min (€)">
                        <Input type="number" min={0} step={1000} value={form.budget_min}
                          onChange={(e) => patch('budget_min', e.target.value === '' ? '' : Number(e.target.value))} />
                      </Field>
                      <Field label="Budget max (€)">
                        <Input type="number" min={0} step={1000} value={form.budget_max}
                          onChange={(e) => patch('budget_max', e.target.value === '' ? '' : Number(e.target.value))} />
                      </Field>
                    </div>
                    <Field label="Priorità di spesa">
                      <Select value={form.budget_priority} onChange={(e) => patch('budget_priority', e.target.value)}>
                        <option value="">Nessuna priorità</option>
                        {priorities.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                      </Select>
                    </Field>
                  </>
                )}

                {step === 4 && (
                  <>
                    <h2 className="font-display text-xl mb-2 flex items-center gap-2">
                      <Sparkles size={20} className="text-[rgb(var(--gold-500))]" /> Tutto pronto
                    </h2>
                    <p className="text-sm text-[rgb(var(--fg-muted))]">
                      Riepilogo {term.ofIt}:
                    </p>
                    <div className="rounded-lg border p-4 text-sm space-y-1" style={{ borderColor: 'rgb(var(--border))' }}>
                      <p><strong>{term.hasCoupleConcept ? 'Coppia' : 'Festeggiato/a'}:</strong> {form.couple_name || [form.bride_name, form.groom_name].filter(Boolean).join(' & ') || '—'}</p>
                      <p><strong>Stili:</strong> {form.styles.length ? form.styles.join(', ') : '—'}</p>
                      <p><strong>Stagione:</strong> {SEASONS.find((s) => s.v === form.preferred_season)?.l ?? '—'}</p>
                      <p><strong>Location:</strong> {LOCATION_KINDS.find((s) => s.v === form.location_kind)?.l ?? '—'}</p>
                      <p><strong>{guestsLabel}:</strong> {form.guests_estimate || '—'}</p>
                      <p><strong>Budget:</strong> {form.budget_min || '—'} – {form.budget_max || '—'} €</p>
                      <p><strong>Priorità:</strong> {priorities.find((s) => s.v === form.budget_priority)?.l ?? '—'}</p>
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <footer className="border-t px-8 py-4 flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
            <Button type="button" variant="ghost" onClick={prev} disabled={step === 0 || busy}>
              <ChevronLeft size={16} /> Indietro
            </Button>
            {step < totalSteps - 1 ? (
              <Button type="button" variant="gold" onClick={next} disabled={busy}>
                Avanti <ChevronRight size={16} />
              </Button>
            ) : (
              <Button type="button" variant="gold" onClick={save} disabled={busy || !entryId}>
                {busy ? 'Salvataggio...' : (<><Check size={16} /> Conferma</>)}
              </Button>
            )}
          </footer>
        </motion.div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
