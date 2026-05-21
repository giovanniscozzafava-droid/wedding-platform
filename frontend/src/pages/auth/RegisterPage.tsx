import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import type { AppRole } from '@/lib/auth'

const ROLES: Array<{ value: AppRole; label: string; description: string }> = [
  { value: 'WEDDING_PLANNER', label: 'Wedding Planner', description: 'Coordini matrimoni per clienti tuoi.' },
  { value: 'LOCATION',        label: 'Location',        description: 'Sei una struttura/villa che ospita eventi.' },
  { value: 'FORNITORE',       label: 'Fornitore',       description: 'Offri servizi (fiori, foto, catering, ecc.).' },
]

const SUBROLE_BY_ROLE: Record<AppRole, string[]> = {
  WEDDING_PLANNER: [],
  LOCATION: [],
  FORNITORE: ['fioraio', 'fotografo', 'catering', 'musicisti', 'altro'],
  ADMIN: [],
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
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    email: '',
    password: '',
    role: 'WEDDING_PLANNER' as AppRole,
    subrole: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  const subroles = SUBROLE_BY_ROLE[form.role]

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
      const { error: err } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            role: form.role,
            subrole: form.subrole || null,
            full_name: form.full_name,
            business_name: form.business_name || null,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })
      if (err) throw err
      nav('/onboarding', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Crea il tuo account</CardTitle>
          <CardDescription>Scegli il tuo ruolo per personalizzare l&apos;esperienza.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="register-form">
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <div className="grid gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r.value}
                    className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer ${
                      form.role === r.value ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={() => setForm((f) => ({ ...f, role: r.value, subrole: '' }))}
                      className="mt-1"
                    />
                    <div>
                      <div className="font-medium">{r.label}</div>
                      <div className="text-sm text-slate-500">{r.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {subroles.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="subrole">Tipo di fornitore</Label>
                <select
                  id="subrole"
                  value={form.subrole}
                  onChange={(e) => setForm((f) => ({ ...f, subrole: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="">&mdash; Seleziona &mdash;</option>
                  {subroles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Nome e cognome</Label>
                <Input
                  id="full_name"
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business_name">Ragione sociale (opzionale)</Label>
                <Input
                  id="business_name"
                  value={form.business_name}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert" data-testid="register-error">
                {error}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Creazione...' : 'Crea account'}
            </Button>
            <p className="text-sm text-center text-slate-600">
              Hai gia&apos; un account?{' '}
              <Link to="/login" className="font-medium text-slate-900 hover:underline">
                Accedi
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
