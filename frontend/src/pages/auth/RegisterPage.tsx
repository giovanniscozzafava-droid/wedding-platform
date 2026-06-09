import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { z } from 'zod'
import {  Heart, Building2, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'

const ROLES: Array<{ value: AppRole; label: string; description: string; icon: typeof Heart }> = [
  { value: 'WEDDING_PLANNER', label: 'Wedding Planner', description: 'Coordini matrimoni per clienti tuoi.', icon: Heart },
  { value: 'LOCATION',        label: 'Location',        description: 'Sei una struttura che ospita eventi.', icon: Building2 },
  { value: 'FORNITORE',       label: 'Fornitore',       description: 'Offri servizi (fiori, foto, catering…)', icon: Camera },
]

const SUBROLE_BY_ROLE: Record<AppRole, { v: string; l: string }[]> = {
  WEDDING_PLANNER: [], LOCATION: [], ADMIN: [], COUPLE: [], CLIENT: [],
  // Sorgente unica: SUPPLIER_SUBROLES da lib/supplierSubroles.ts
  FORNITORE: SUPPLIER_SUBROLES,
}

const schema = z.object({
  full_name: z.string().min(2, 'Nome troppo corto'),
  business_name: z.string().optional(),
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'Almeno 6 caratteri'),
  role: z.enum(['WEDDING_PLANNER', 'LOCATION', 'FORNITORE']),
  subrole: z.string().optional(),
  // Beta: ci si iscrive solo su invito → codice obbligatorio.
  referral_code: z.string().trim().min(4, 'Inserisci il codice invito che hai ricevuto'),
})

export default function RegisterPage() {
  const [params] = useSearchParams()
  const refFromUrl = params.get('ref') ?? ''
  // Se l'utente arriva da un preventivo/invito (?next=...), dopo la registrazione
  // atterra lì (es. il preventivo) e NON sull'onboarding: il questionario è già
  // stato compilato in fase di lead, non va ripetuto.
  const nextUrl = params.get('next')
  const destAfterSignup = nextUrl && nextUrl.startsWith('/') ? nextUrl : '/onboarding'
  const [form, setForm] = useState({
    full_name: '', business_name: '', email: '', password: '',
    role: 'WEDDING_PLANNER' as AppRole, subrole: '', accept_referrals: false, platform_terms: false,
    referral_code: refFromUrl.toUpperCase(),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTerms, setShowTerms] = useState(false)
  const nav = useNavigate()

  const subroles = SUBROLE_BY_ROLE[form.role]

  useEffect(() => {
    if (refFromUrl) setForm((f) => ({ ...f, referral_code: refFromUrl.toUpperCase() }))
  }, [refFromUrl])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Dati non validi')
      return
    }
    if (!form.platform_terms) {
      setError('Devi accettare le condizioni di Planfully per registrarti')
      return
    }
    setBusy(true)
    try {
      // Beta a inviti: il codice deve corrispondere a un capostipite reale.
      const code = form.referral_code.trim().toUpperCase()
      const { data: chk } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('invite_code_valid', { p_code: code })
      if (!(chk as { valid?: boolean })?.valid) {
        setError('Codice invito non valido. In questa fase beta ci si iscrive solo su invito.')
        setBusy(false)
        return
      }
      const { data: signupData, error: err } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: {
            role: form.role, subrole: form.subrole || null,
            full_name: form.full_name, business_name: form.business_name || null,
            accept_referrals: form.role === 'FORNITORE' ? form.accept_referrals : false,
            platform_terms: form.platform_terms,
          },
          emailRedirectTo: `${window.location.origin}${destAfterSignup}`,
        },
      })
      if (err) throw err
      // Se l'auth è già stabilito (no email confirm flow), prova subito a redimere il codice
      if (code && signupData.session) {
        const rpc = (fn: string) => (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, { p_code: code })
        try { await rpc('referral_redeem_code') } catch { /* capostipite %: può fallire, non blocca */ }
        // Recruiting (tutti i professionisti): attribuisce e premia il reclutatore
        try { await rpc('recruiting_attribute') } catch { /* non blocca il signup */ }
      } else if (code) {
        // Email confirmation pending → memorizza per dopo conferma
        try { localStorage.setItem('pending_ref_code', code) } catch { /* ignore */ }
      }
      nav(destAfterSignup, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl surface surface-lift overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-2 mb-3">
            <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" style={{ color: 'rgb(var(--fg))' }} />
            <span className="font-display text-lg">Planfully</span>
          </div>
          <h1 className="font-display text-3xl tracking-tight">Crea il tuo studio</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Scegli il tuo ruolo per personalizzare l'esperienza.</p>
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-5" data-testid="register-form">
          <div className="space-y-2">
            <Label>Ruolo</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon
                const active = form.role === r.value
                return (
                  <button key={r.value} type="button"
                    onClick={() => setForm((f) => ({ ...f, role: r.value, subrole: '' }))}
                    className={cn(
                      'rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-[rgb(var(--fg))] bg-[rgb(var(--bg-sunken))]'
                        : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]',
                    )}>
                    <Icon size={18} strokeWidth={1.8} className="mb-2" style={{ color: active ? 'rgb(var(--gold-600))' : 'rgb(var(--fg-muted))' }} />
                    <p className="font-medium text-sm">{r.label}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{r.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {subroles.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="subrole">Tipo fornitore</Label>
              <Select id="subrole" value={form.subrole} required
                onChange={(e) => setForm((f) => ({ ...f, subrole: e.target.value }))}>
                <option value="">— seleziona —</option>
                {subroles.map((s) => (<option key={s.v} value={s.v}>{s.l}</option>))}
              </Select>
            </div>
          )}

          {form.role === 'FORNITORE' && (
            <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
              <input type="checkbox" checked={form.accept_referrals} className="mt-0.5 shrink-0"
                onChange={(e) => setForm((f) => ({ ...f, accept_referrals: e.target.checked }))} />
              <span className="text-xs text-[rgb(var(--fg-muted))]">
                <strong className="text-[rgb(var(--fg))]">Voglio essere suggerito da altri fornitori.</strong> Riconosco un credito di <strong>39€</strong> per ogni segnalazione che si trasforma in un contratto firmato (una commissione della piattaforma sarà definita in futuro). Potrai cambiare scelta in qualsiasi momento.
              </span>
            </label>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="full_name">Nome e cognome</Label>
              <Input id="full_name" required value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="business_name">Ragione sociale</Label>
              <Input id="business_name" value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} placeholder="Opzionale" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-1 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--gold-600))', background: 'rgb(var(--bg-sunken))' }}>
            <Label htmlFor="referral_code">Codice invito <span className="text-[rgb(var(--gold-600))]">(obbligatorio)</span></Label>
            <Input id="referral_code" value={form.referral_code} maxLength={16} required
              onChange={(e) => setForm((f) => ({ ...f, referral_code: e.target.value.toUpperCase() }))}
              placeholder="Es. ABC123"
              className="uppercase tracking-widest" />
            <p className="text-[10px] text-[rgb(var(--fg-subtle))]">
              In questa fase beta ci si iscrive solo su invito. Inserisci il codice che ti ha dato chi ti ha invitato: sarai collegato a lui e farai parte della sua rete.
            </p>
          </div>

          {/* Contratto con noi: condizioni piattaforma (spunta che si apre) */}
          <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={form.platform_terms} className="mt-0.5 shrink-0"
                onChange={(e) => setForm((f) => ({ ...f, platform_terms: e.target.checked }))} />
              <span className="text-xs text-[rgb(var(--fg-muted))]">
                <strong className="text-[rgb(var(--fg))]">Accetto il contratto di abbonamento Planfully</strong> (il contratto con noi).{' '}
                <button type="button" onClick={(ev) => { ev.preventDefault(); setShowTerms((v) => !v) }} className="underline text-[rgb(var(--gold-600))]">
                  {showTerms ? 'nascondi' : 'leggi il contratto'}
                </button>
              </span>
            </label>
            {showTerms && (
              <ul className="mt-2 space-y-1.5 text-[11px] text-[rgb(var(--fg-muted))] list-disc pl-5">
                <li><strong>Durata 12 mesi (365 giorni)</strong>, dal 1° gennaio 2027 al 31 dicembre 2027. Fino al 31/12/2026 l’uso è gratuito (beta).</li>
                {form.role === 'FORNITORE' && (
                  <li><strong>Canone 29€/anno</strong> (Fuyue Srl), da pagarsi in <strong>un’unica soluzione anticipata</strong> per l’intero periodo.</li>
                )}
                <li>Crediti tra professionisti: per ogni segnalazione che diventa un contratto firmato è riconosciuto un credito <strong>fisso di 39€</strong>.</li>
                <li>Commissioni future: Fuyue Srl si riserva il diritto di introdurre e/o modificare commissioni e condizioni. <strong>Tutto può cambiare e ci riserviamo di farlo.</strong></li>
                <li>Dati trattati da Fuyue Srl (titolare del marchio) secondo l’informativa privacy. Le condizioni potranno essere aggiornate; l’uso continuato vale accettazione.</li>
              </ul>
            )}
          </div>

          {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert" data-testid="register-error">{error}</p>}

          <Button type="submit" variant="gold" className="w-full" disabled={busy || !form.platform_terms}>
            {busy ? 'Creazione...' : 'Crea account'}
          </Button>
          <p className="text-sm text-center text-[rgb(var(--fg-muted))]">
            Hai già un account? <Link to="/login" className="font-medium text-[rgb(var(--fg))] hover:underline">Accedi</Link>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
