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

type ProviderForm = {
  full_name: string
  business_name: string
  subrole: string
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
  years_active: number | ''
}

const STEPS = ['Identità', 'Azienda', 'Contatti', 'Immagine', 'Pronto'] as const

export function ProviderOnboardingWizard() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [form, setForm] = useState<ProviderForm>({
    full_name: '', business_name: '', subrole: '', phone: '',
    vat_number: '', fiscal_code: '', address: '', city: '', zip: '', province: '', country: 'Italia',
    website: '', instagram: '', facebook: '', tiktok: '', bio: '',
    service_radius_km: '', years_active: '',
  })

  useEffect(() => {
    if (!profile) return
    setForm((f) => ({
      ...f,
      full_name: profile.full_name ?? '',
      business_name: profile.business_name ?? '',
      subrole: profile.subrole ?? '',
      phone: profile.phone ?? '',
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
        years_active: form.years_active === '' ? null : form.years_active,
        ...(logoUrl ? { brand_logo_url: logoUrl } : {}),
        ...(coverUrl ? { cover_image_url: coverUrl } : {}),
        ...(complete ? { onboarding_complete: true } : {}),
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
    if (step === 0 && !form.subrole) { toast.error('Seleziona il tipo di servizio'); return }
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
                {step === 0 && (
                  <>
                    <h2 className="font-display text-xl mb-2">Chi sei</h2>
                    <Field label="Nome e cognome *">
                      <Input value={form.full_name} onChange={(e) => patch('full_name', e.target.value)} required />
                    </Field>
                    <Field label="Tipo di servizio *">
                      <Select value={form.subrole} onChange={(e) => patch('subrole', e.target.value)}>
                        {SUBROLES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                      </Select>
                    </Field>
                    <Field label="Anni di attività">
                      <Input type="number" min={0} value={form.years_active}
                        onChange={(e) => patch('years_active', e.target.value === '' ? '' : Number(e.target.value))} />
                    </Field>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2 className="font-display text-xl mb-2">Dati azienda</h2>
                    <Field label="Ragione sociale">
                      <Input value={form.business_name} onChange={(e) => patch('business_name', e.target.value)} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Partita IVA">
                        <Input value={form.vat_number} onChange={(e) => patch('vat_number', e.target.value)} />
                      </Field>
                      <Field label="Codice fiscale">
                        <CodiceFiscaleInput
                          value={form.fiscal_code}
                          onChange={(v) => patch('fiscal_code', v)}
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
                    <Field label="Raggio di servizio (km)">
                      <Input type="number" min={0} value={form.service_radius_km}
                        onChange={(e) => patch('service_radius_km', e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Es. 200" />
                    </Field>
                  </>
                )}

                {step === 2 && (
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

                {step === 3 && (
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

                {step === 4 && (
                  <>
                    <h2 className="font-display text-xl mb-2">Tutto pronto</h2>
                    <p className="text-sm text-[rgb(var(--fg-muted))]">
                      Stai per attivare il profilo <strong>{form.business_name || form.full_name}</strong>.
                      Puoi sempre tornare alle impostazioni per aggiornare.
                    </p>
                    <div className="rounded-lg border p-4 text-sm space-y-1" style={{ borderColor: 'rgb(var(--border))' }}>
                      <p><strong>Tipo:</strong> {SUBROLES.find((s) => s.v === form.subrole)?.l ?? '—'}</p>
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
