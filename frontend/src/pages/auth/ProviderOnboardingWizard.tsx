import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {  ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ComuneInput } from '@/components/ComuneInput'
import { CodiceFiscaleInput } from '@/components/CodiceFiscaleInput'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { SUPPLIER_SUBROLES_WITH_PLACEHOLDER as SUBROLES } from '@/lib/supplierSubroles'
import { ProfessionPicker } from '@/components/professione/ProfessionPicker'
import { PackImportPicker } from '@/components/professione/PackImportPicker'
import { useProfessioniList } from '@/hooks/useProfessione'

type LegalForm = 'INDIVIDUAL' | 'SRL' | 'SRLS' | 'SPA' | 'SAS' | 'SNC' | 'COOPERATIVE' | 'ASSOCIATION' | 'OTHER' | ''
type ModalitaIncasso = 'INTERO' | 'SEGNALAZIONE' | ''

type ProviderForm = {
  full_name: string
  business_name: string
  business_legal_name: string
  legal_form: LegalForm
  subrole: string
  professione_id: string | null
  phone: string
  vat_number: string
  fiscal_code: string
  address: string
  city: string
  zip: string
  province: string
  country: string
  website: string
  instagram: string
  facebook: string
  tiktok: string
  bio: string
  service_radius_km: number | ''
  service_regions: string[]
  years_active: number | ''
  modalita_incasso_default: ModalitaIncasso
  parcella_default: number | ''
  applica_ricarico_default: boolean
}

const LEGAL_FORM_OPTIONS: Array<{ v: LegalForm; label: string; hint?: string }> = [
  { v: '',             label: 'Seleziona…' },
  { v: 'INDIVIDUAL',   label: 'Ditta individuale / Libero professionista' },
  { v: 'SRL',          label: 'SRL' },
  { v: 'SRLS',         label: 'SRLS' },
  { v: 'SPA',          label: 'SPA' },
  { v: 'SAS',          label: 'SAS' },
  { v: 'SNC',          label: 'SNC' },
  { v: 'COOPERATIVE',  label: 'Cooperativa' },
  { v: 'ASSOCIATION',  label: 'Associazione / ASD', hint: 'La P.IVA è facoltativa' },
  { v: 'OTHER',        label: 'Altro' },
]

const STEPS_BASE = ['Identità', 'Professione', 'Azienda', 'Contatti', 'Immagine', 'Pronto'] as const
const STEPS_WP_LOC = ['Identità', 'Professione', 'Azienda', 'Contatti', 'Modus operandi', 'Immagine', 'Pronto'] as const

const ITALIAN_REGIONS = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana',
  "Trentino-Alto Adige", 'Umbria', "Valle d'Aosta", 'Veneto',
]

export function ProviderOnboardingWizard() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoUrlPreview] = useState<string | null>(null)
  const [form, setForm] = useState<ProviderForm>({
    full_name: '', business_name: '', business_legal_name: '', legal_form: '', subrole: '',
    professione_id: null,
    phone: '',
    vat_number: '', fiscal_code: '', address: '', city: '', zip: '', province: '', country: 'Italia',
    website: '', instagram: '', facebook: '', tiktok: '', bio: '',
    service_radius_km: '', service_regions: [], years_active: '',
    modalita_incasso_default: '', parcella_default: '', applica_ricarico_default: true,
  })
  const [showPackPicker, setShowPackPicker] = useState(false)

  const isWpOrLocation = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION'
  const STEPS: readonly string[] = isWpOrLocation ? STEPS_WP_LOC : STEPS_BASE
  const { data: professioniList } = useProfessioniList()
  const professioneNome = useMemo(
    () => professioniList?.find((p) => p.id === form.professione_id)?.nome ?? null,
    [professioniList, form.professione_id],
  )

  useEffect(() => {
    if (!profile) return
    const p = profile as any
    setForm((f) => ({
      ...f,
      full_name: profile.full_name ?? '',
      business_name: profile.business_name ?? '',
      business_legal_name: p.business_legal_name ?? '',
      legal_form: (p.legal_form ?? '') as LegalForm,
      subrole: profile.subrole ?? '',
      phone: profile.phone ?? '',
      modalita_incasso_default: (p.modalita_incasso_default ?? '') as ModalitaIncasso,
      parcella_default: p.parcella_default == null ? '' : Number(p.parcella_default),
      applica_ricarico_default: p.applica_ricarico_default ?? true,
      professione_id: p.professione_id ?? f.professione_id ?? null,
    }))
  }, [profile])

  const totalSteps = STEPS.length
  const progress = useMemo(() => Math.round(((step + 1) / totalSteps) * 100), [step, totalSteps])

  function patch<K extends keyof ProviderForm>(k: K, v: ProviderForm[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function uploadAsset(file: File, kind: 'logo' | 'cover'): Promise<string | null> {
    if (!user) return null
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/${kind}.${ext}`
    const { error } = await supabase.storage.from('brand-assets').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (error) { toast.error(`Upload ${kind}: ${error.message}`); return null }
    const { data } = supabase.storage.from('brand-assets').getPublicUrl(path)
    return data.publicUrl
  }

  async function save(complete: boolean) {
    if (!user) return
    setBusy(true)
    try {
      let logoUrl: string | undefined
      let coverUrl: string | undefined
      if (logoFile) { const u = await uploadAsset(logoFile, 'logo'); if (u) logoUrl = u }
      if (coverFile) { const u = await uploadAsset(coverFile, 'cover'); if (u) coverUrl = u }
      const payload = {
        full_name: form.full_name,
        business_name: form.business_name || null,
        business_legal_name: form.business_legal_name || null,
        legal_form: form.legal_form || null,
        subrole: form.subrole || null,
        phone: form.phone || null,
        vat_number: form.vat_number || null,
        fiscal_code: form.fiscal_code || null,
        address: form.address || null,
        city: form.city || null,
        zip: form.zip || null,
        province: form.province || null,
        country: form.country || null,
        website: form.website || null,
        instagram: form.instagram || null,
        facebook: form.facebook || null,
        tiktok: form.tiktok || null,
        bio: form.bio || null,
        service_radius_km: form.service_radius_km === '' ? null : form.service_radius_km,
        service_regions: form.service_regions.length ? form.service_regions : null,
        years_active: form.years_active === '' ? null : form.years_active,
        ...(isWpOrLocation ? {
          modalita_incasso_default: form.modalita_incasso_default || null,
          parcella_default: form.parcella_default === '' ? null : form.parcella_default,
          applica_ricarico_default: form.applica_ricarico_default,
        } : {}),
        // Pacchetti professione FASE 1: salva la professione scelta (opzionale).
        // Se NULL, il trigger lascia il profilo invariato ed e' il backfill che
        // ha gia' messo 'generico' come fallback.
        ...(form.professione_id ? { professione_id: form.professione_id } : {}),
        ...(logoUrl ? { brand_logo_url: logoUrl } : logoUrlPreview ? { brand_logo_url: logoUrlPreview } : {}),
        ...(coverUrl ? { cover_image_url: coverUrl } : {}),
        ...(complete ? { onboarding_complete: true, onboarding_completato_il: new Date().toISOString() } : {}),
      }
      const { error } = await (supabase.from('profiles') as any).update(payload).eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      if (complete) {
        toast.success('Profilo completato')
        // Fornitore: portalo subito a creare la prima offerta (con possibilità di skip).
        // Tutorial card si attiveranno in dashboard se chiude.
        if (profile?.role === 'FORNITORE') {
          nav('/catalog?firstOffer=1', { replace: true })
        } else {
          nav('/', { replace: true })
        }
      }
      else toast.success('Salvato')
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  function next() {
    if (step === 0 && !form.full_name.trim()) { toast.error('Nome obbligatorio'); return }
    if (step === 0 && !isWpOrLocation && !form.subrole) { toast.error('Seleziona il tipo di servizio'); return }
    if (STEPS[step] === 'Professione' && !form.professione_id) {
      toast.error('Seleziona la tua professione')
      return
    }
    setStep((s) => Math.min(s + 1, totalSteps - 1))
  }
  function prev() { setStep((s) => Math.max(s - 1, 0)) }

  return (
    <div className="min-h-screen aurora py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-6 flex items-center gap-3" style={{ color: 'rgb(var(--fg))' }}>
          <img src="/brand/planfully-symbol.svg" alt="" className="h-9 w-9" />
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">
              {profile?.role === 'WEDDING_PLANNER' ? 'Onboarding wedding planner'
                : profile?.role === 'LOCATION' ? 'Onboarding location'
                : 'Onboarding fornitore'}
            </p>
            <h1 className="font-display text-2xl">Costruiamo il tuo profilo</h1>
          </div>
        </header>

        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-[rgb(var(--fg-muted))] mb-2">
            <span>Step {step + 1} di {totalSteps} · {STEPS[step]}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${progress}%`, background: 'rgb(var(--gold-500))' }} />
          </div>
        </div>

        <motion.div className="surface surface-lift overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }} className="space-y-4">
                {STEPS[step] === 'Identità' && (
                  <>
                    <h2 className="font-display text-xl mb-2">Chi sei</h2>
                    <Field label="Nome pubblico *">
                      <Input value={form.full_name} onChange={(e) => patch('full_name', e.target.value)} required
                        placeholder="Mario Rossi · Black Mamba · Villa Klopè · DaisyLab21" />
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">
                        Come ti chiamano i clienti: nome e cognome, nome d&apos;arte, nome della band o della villa. I dati legali (ragione sociale, P.IVA) li chiediamo dopo.
                      </p>
                    </Field>
                    {!isWpOrLocation && (
                      <Field label="Tipo di servizio *">
                        <Select value={form.subrole} onChange={(e) => patch('subrole', e.target.value)}>
                          {SUBROLES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                        </Select>
                      </Field>
                    )}
                    <Field label="Anni di attività">
                      <Input type="number" min={0} value={form.years_active}
                        onChange={(e) => patch('years_active', e.target.value === '' ? '' : Number(e.target.value))} />
                    </Field>
                  </>
                )}

                {STEPS[step] === 'Professione' && (
                  <>
                    <h2 className="font-display text-xl mb-2">La tua professione</h2>
                    <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">
                      Scegli la tua professione: vestiremo il prodotto con le tue parole
                      (servizi-tipo, etichette, consigli e clausole). Puoi sempre cambiarla.
                    </p>
                    <ProfessionPicker
                      value={form.professione_id}
                      onChange={(id) => {
                        patch('professione_id', id)
                      }}
                    />
                    {form.professione_id && professioneNome && professioneNome !== 'Generico' && (
                      <div className="mt-4 rounded-lg border p-3 sm:p-4 bg-[rgb(var(--bg-sunken))]" style={{ borderColor: 'rgb(var(--border))' }}>
                        <div className="flex items-start gap-3 flex-wrap">
                          <div className="flex-1 min-w-[200px]">
                            <p className="text-sm font-medium">Vuoi partire dai servizi tipici del tuo mestiere?</p>
                            <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                              Importa il pacchetto starter di {professioneNome}. Modificherai tutto quando vuoi.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="gold"
                            className="min-h-[44px]"
                            onClick={async () => {
                              // Salviamo subito la professione cosi` PackImportPicker la legge dal profilo.
                              if (!user) return
                              const { error } = await (supabase.from('profiles') as any)
                                .update({ professione_id: form.professione_id })
                                .eq('id', user.id)
                              if (error) { toast.error(error.message); return }
                              await refreshProfile()
                              setShowPackPicker(true)
                            }}
                          >
                            Importa starter pack
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {STEPS[step] === 'Azienda' && (
                  <>
                    <h2 className="font-display text-xl mb-2">Dati legali</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Forma giuridica">
                        <Select value={form.legal_form} onChange={(e) => patch('legal_form', e.target.value as LegalForm)}>
                          {LEGAL_FORM_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
                        </Select>
                        {form.legal_form === 'ASSOCIATION' && (
                          <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">Le associazioni/ASD possono lasciare la P.IVA vuota se non sono tenute a tenerne una.</p>
                        )}
                      </Field>
                      <Field label="Ragione sociale">
                        <Input value={form.business_legal_name}
                          onChange={(e) => patch('business_legal_name', e.target.value)}
                          placeholder={form.legal_form === 'ASSOCIATION'
                            ? 'es. ASD Black Mamba'
                            : form.legal_form === 'INDIVIDUAL'
                              ? 'es. Mario Rossi · Ditta individuale'
                              : 'es. Black Mamba SRLS'} />
                      </Field>
                    </div>
                    <Field label="Nome pubblico mostrato">
                      <Input value={form.business_name}
                        onChange={(e) => patch('business_name', e.target.value)}
                        placeholder="Lascia vuoto per usare il nome di Step 1" />
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">
                        È il nome che compare sui preventivi e sulla vetrina. Se diverso dalla ragione sociale (es. brand o nome d&apos;arte), specificalo qui.
                      </p>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label={form.legal_form === 'ASSOCIATION' ? 'Partita IVA (opzionale)' : 'Partita IVA'}>
                        <Input value={form.vat_number} onChange={(e) => patch('vat_number', e.target.value)} />
                      </Field>
                      <Field label="Codice fiscale">
                        <CodiceFiscaleInput
                          value={form.fiscal_code}
                          onChange={(v) => patch('fiscal_code', v)}
                          variant={form.legal_form && form.legal_form !== 'INDIVIDUAL' ? 'company' : 'person'}
                        />
                      </Field>
                    </div>
                    <Field label="Indirizzo">
                      <Input value={form.address} onChange={(e) => patch('address', e.target.value)} placeholder="Via, numero civico" />
                    </Field>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <Field label="Comune">
                        <ComuneInput
                          value={form.city}
                          onChange={({ city, cap, province }) => {
                            patch('city', city)
                            if (cap) patch('zip', cap)
                            if (province) patch('province', province)
                          }}
                          placeholder="es. Botricello"
                        />
                      </Field>
                      <Field label="CAP">
                        <Input value={form.zip} onChange={(e) => patch('zip', e.target.value)} placeholder="88070" />
                      </Field>
                      <Field label="Provincia">
                        <Input value={form.province} onChange={(e) => patch('province', e.target.value.toUpperCase())} maxLength={2} placeholder="CZ" />
                      </Field>
                      <Field label="Nazione">
                        <Input value={form.country} onChange={(e) => patch('country', e.target.value)} />
                      </Field>
                    </div>
                    <Field label="In quale regione vorresti lavorare?">
                      <div className="space-y-2">
                        <button type="button"
                          onClick={() => patch('service_regions',
                            form.service_regions.length === ITALIAN_REGIONS.length ? [] : [...ITALIAN_REGIONS])}
                          className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                            form.service_regions.length === ITALIAN_REGIONS.length
                              ? 'bg-[rgb(var(--gold-500))] text-white border-[rgb(var(--gold-500))]'
                              : 'border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                          🇮🇹 Tutta Italia
                        </button>
                        <div className="flex flex-wrap gap-1.5">
                          {ITALIAN_REGIONS.map((r) => {
                            const active = form.service_regions.includes(r)
                            return (
                              <button key={r} type="button"
                                onClick={() => patch('service_regions',
                                  active ? form.service_regions.filter((x) => x !== r) : [...form.service_regions, r])}
                                className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
                                  active
                                    ? 'bg-[rgb(var(--rose-100))] border-[rgb(var(--rose-500))]'
                                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                                {r}
                              </button>
                            )
                          })}
                        </div>
                        <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Scegli una o più regioni, oppure “Tutta Italia”.</p>
                      </div>
                    </Field>
                  </>
                )}

                {STEPS[step] === 'Contatti' && (
                  <>
                    <h2 className="font-display text-xl mb-2">Contatti & social</h2>
                    <Field label="Telefono"><Input type="tel" value={form.phone} onChange={(e) => patch('phone', e.target.value)} /></Field>
                    <Field label="Sito web"><Input type="url" value={form.website} onChange={(e) => patch('website', e.target.value)} placeholder="https://..." /></Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Instagram"><Input value={form.instagram} onChange={(e) => patch('instagram', e.target.value)} placeholder="@handle" /></Field>
                      <Field label="Facebook"><Input value={form.facebook} onChange={(e) => patch('facebook', e.target.value)} /></Field>
                      <Field label="TikTok"><Input value={form.tiktok} onChange={(e) => patch('tiktok', e.target.value)} placeholder="@handle" /></Field>
                    </div>
                  </>
                )}

                {STEPS[step] === 'Modus operandi' && (
                  <>
                    <h2 className="font-display text-xl mb-2">Modus operandi</h2>
                    <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">
                      Come gestisci di solito gli incassi? Lo applichiamo come default sui nuovi eventi: potrai sempre cambiarlo evento per evento.
                    </p>
                    <Field label="Modalità di incasso predefinita">
                      <Select value={form.modalita_incasso_default}
                        onChange={(e) => patch('modalita_incasso_default', e.target.value as ModalitaIncasso)}>
                        <option value="">Seleziona…</option>
                        <option value="INTERO">Intero — incasso tutto io, pago io i fornitori</option>
                        <option value="SEGNALAZIONE">Segnalazione — incasso solo la mia parcella, il fornitore lo paga il cliente</option>
                      </Select>
                    </Field>
                    <Field label="Parcella di coordinamento/segnalazione (€)">
                      <Input type="number" min={0} step="0.01" inputMode="decimal"
                        value={form.parcella_default}
                        onChange={(e) => patch('parcella_default', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Es. 1500" />
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1">
                        È l&apos;importo che richiedi tipicamente per coordinare o segnalare. Lo useremo come suggerimento sui nuovi eventi.
                      </p>
                    </Field>
                    <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
                      <input id="applica_ricarico_default" type="checkbox"
                        checked={form.applica_ricarico_default}
                        onChange={(e) => patch('applica_ricarico_default', e.target.checked)}
                        className="mt-1 h-5 w-5 min-w-[44px] sm:min-w-0 sm:h-4 sm:w-4 accent-[rgb(var(--gold-500))]" />
                      <label htmlFor="applica_ricarico_default" className="text-sm leading-snug">
                        Applica di default il mio ricarico ai preventivi
                        <span className="block text-[11px] text-[rgb(var(--fg-subtle))]">
                          Se disattivato, ogni nuovo preventivo parte senza ricarico (lo aggiungi a mano quando serve).
                        </span>
                      </label>
                    </div>
                  </>
                )}

                {STEPS[step] === 'Immagine' && (
                  <>
                    <h2 className="font-display text-xl mb-2">Immagine & racconto</h2>
                    <Field label="Bio breve (max 600 caratteri)">
                      <Textarea rows={5} maxLength={600} value={form.bio} onChange={(e) => patch('bio', e.target.value)}
                        placeholder="Racconta in poche righe la tua filosofia, i punti di forza, lo stile..." />
                      <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">{form.bio.length}/600</p>
                    </Field>
                    <FileField label="Logo (PNG/JPG)" file={logoFile} setFile={setLogoFile} />
                    <FileField label="Cover (1600x900 consigliato)" file={coverFile} setFile={setCoverFile} />
                  </>
                )}

                {STEPS[step] === 'Pronto' && (
                  <>
                    <h2 className="font-display text-xl mb-2">Tutto pronto</h2>
                    <p className="text-sm text-[rgb(var(--fg-muted))]">
                      Stai per attivare il profilo <strong>{form.business_name || form.full_name}</strong>.
                      Puoi sempre tornare alle impostazioni per aggiornare.
                    </p>
                    <div className="rounded-lg border p-4 text-sm space-y-1" style={{ borderColor: 'rgb(var(--border))' }}>
                      <p><strong>Tipo:</strong> {SUBROLES.find((s) => s.v === form.subrole)?.l ?? '—'}</p>
                      <p><strong>Professione:</strong> {professioneNome ?? '—'}</p>
                      <p><strong>Città:</strong> {form.city || '—'}</p>
                      <p><strong>Sito:</strong> {form.website || '—'}</p>
                      <p><strong>P.IVA:</strong> {form.vat_number || '—'}</p>
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
              <Button type="button" variant="gold" onClick={() => save(true)} disabled={busy}>
                {busy ? 'Salvataggio...' : (<><Check size={16} /> Completa profilo</>)}
              </Button>
            )}
          </footer>
        </motion.div>

        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-4">
          Puoi anche <button onClick={() => save(false)} className="underline hover:text-[rgb(var(--fg))]">salvare in bozza</button> e completare dopo.
        </p>
      </div>

      {showPackPicker && (
        <PackImportPicker
          onClose={() => setShowPackPicker(false)}
          onImported={() => setShowPackPicker(false)}
        />
      )}
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

function FileField({ label, file, setFile }: { label: string; file: File | null; setFile: (f: File | null) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[rgb(var(--bg-sunken))] file:px-3 file:py-2 file:text-xs file:font-medium" />
        {file && <span className="text-xs text-[rgb(var(--fg-muted))]">{file.name}</span>}
      </div>
    </div>
  )
}
