import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    phone: '',
    subrole: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        business_name: profile.business_name ?? '',
        phone: profile.phone ?? '',
        subrole: profile.subrole ?? '',
      })
    }
  }, [profile])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setBusy(true)
    try {
      const { error: err } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          business_name: form.business_name || null,
          phone: form.phone || null,
          subrole: form.subrole || null,
        })
        .eq('id', user.id)
      if (err) throw err
      await refreshProfile()
      nav('/', { replace: true })
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
          <CardTitle>Completa il tuo profilo</CardTitle>
          <CardDescription>
            Ruolo: <strong>{profile?.role ?? '...'}</strong>. Aggiungi i dati di base per iniziare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="onboarding-form">
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
              <Label htmlFor="business_name">Ragione sociale</Label>
              <Input
                id="business_name"
                value={form.business_name}
                onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            {profile?.role === 'FORNITORE' && (
              <div className="space-y-2">
                <Label htmlFor="subrole">Tipo fornitore</Label>
                <Input
                  id="subrole"
                  value={form.subrole}
                  placeholder="fioraio / fotografo / catering / ..."
                  onChange={(e) => setForm((f) => ({ ...f, subrole: e.target.value }))}
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Salvataggio...' : 'Salva e prosegui'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
