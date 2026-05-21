import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    business_name: '',
    phone: '',
    subrole: '',
  })
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    setInfo(null)
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
      setInfo('Profilo aggiornato')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    await signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Il tuo profilo</h1>
          <Button variant="outline" onClick={handleLogout} data-testid="logout-btn">
            Esci
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Dati personali</CardTitle>
            <CardDescription>
              {user?.email} &mdash; ruolo <strong>{profile?.role}</strong> &mdash; piano{' '}
              <strong>{profile?.subscription_tier}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
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
                      onChange={(e) => setForm((f) => ({ ...f, subrole: e.target.value }))}
                    />
                  </div>
                )}
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-sm text-green-700" role="status">
                  {info}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? 'Salvataggio...' : 'Salva'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
