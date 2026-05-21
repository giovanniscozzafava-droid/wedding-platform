import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicMode, setMagicMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: { pathname?: string } } }
  const next = loc.state?.from?.pathname ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (magicMode) {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/` },
        })
        if (err) throw err
        setInfo('Ti abbiamo inviato un link via email. Controlla la posta.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        nav(next, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Accedi</CardTitle>
          <CardDescription>
            Wedding Platform &mdash; entra con le tue credenziali o ricevi un magic link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@esempio.it"
              />
            </div>
            {!magicMode && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required={!magicMode}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600" role="alert" data-testid="login-error">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-green-700" role="status" data-testid="login-info">
                {info}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Attendi...' : magicMode ? 'Invia magic link' : 'Accedi'}
            </Button>
            <div className="flex justify-between text-sm text-slate-600">
              <button
                type="button"
                className="hover:underline"
                onClick={() => {
                  setMagicMode((m) => !m)
                  setError(null)
                  setInfo(null)
                }}
              >
                {magicMode ? 'Usa password' : 'Usa magic link'}
              </button>
              <Link to="/forgot-password" className="hover:underline">
                Password dimenticata?
              </Link>
            </div>
            <p className="text-sm text-center text-slate-600">
              Non hai un account?{' '}
              <Link to="/register" className="font-medium text-slate-900 hover:underline">
                Registrati
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
