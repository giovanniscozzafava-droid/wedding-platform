import { type FormEvent, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { z } from 'zod'
import {  Heart, Building2, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleButton } from '@/components/auth/GoogleButton'
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
  WEDDING_PLANNER: [], LOCATION: [], ADMIN: [], COUPLE: [],
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
})

export default function RegisterPage() {
  const [params] = useSearchParams()
  const refFromUrl = params.get('ref') ?? ''
  const [form, setForm] = useState({
    full_name: '', business_name: '', email: '', password: '',
    role: 'WEDDING_PLANNER' as AppRole, subrole: '',
    referral_code: refFromUrl.toUpperCase(),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    setBusy(true)
    try {
      const { data: signupData, error: err } = await supabase.auth.signUp({
        email: form.email, password: form.password,
        options: {
          data: {
            role: form.role, subrole: form.subrole || null,
            full_name: form.full_name, business_name: form.business_name || null,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })
      if (err) throw err
      // Se l'auth è già stabilito (no email confirm flow), prova subito a redimere il codice
      const code = form.referral_code.trim().toUpperCase()
      if (code && signupData.session) {
        try {
          await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
            .rpc('referral_redeem_code', { p_code: code })
        } catch { /* il redeem può fallire silenziosamente, non blocca il signup */ }
      } else if (code) {
        // Email confirmation pending → memorizza per dopo conferma
        try { localStorage.setItem('pending_ref_code', code) } catch { /* ignore */ }
      }
      nav('/onboarding', { replace: true })
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

          <details open={!!form.referral_code} className="text-sm">
            <summary className="cursor-pointer text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]">
              Hai un codice invito? <span className="text-[rgb(var(--gold-600))]">(opzionale)</span>
            </summary>
            <div className="space-y-1 mt-2">
              <Label htmlFor="referral_code">Codice invito</Label>
              <Input id="referral_code" value={form.referral_code} maxLength={16}
                onChange={(e) => setForm((f) => ({ ...f, referral_code: e.target.value.toUpperCase() }))}
                placeholder="Es. ABC123"
                className="uppercase tracking-widest" />
              {form.referral_code && (
                <p className="text-[10px] text-[rgb(var(--fg-subtle))]">
                  Sarai collegato a chi ti ha invitato e farai parte della sua rete.
                </p>
              )}
            </div>
          </details>

          {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert" data-testid="register-error">{error}</p>}

          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            {busy ? 'Creazione...' : 'Crea account'}
          </Button>
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-[rgb(var(--border))]" />
            <span className="text-xs text-[rgb(var(--fg-subtle))]">oppure</span>
            <div className="flex-1 h-px bg-[rgb(var(--border))]" />
          </div>
          <GoogleButton label="Registrati con Google" />
          <p className="text-sm text-center text-[rgb(var(--fg-muted))]">
            Hai già un account? <Link to="/login" className="font-medium text-[rgb(var(--fg))] hover:underline">Accedi</Link>
          </p>
        </form>
      </motion.div>
    </div>
  )
}
