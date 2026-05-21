import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setSent(true)
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
          <CardTitle>Reimposta password</CardTitle>
          <CardDescription>Ti invieremo un link per scegliere una nuova password.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3" data-testid="forgot-sent">
              <p className="text-sm text-green-700">
                Email inviata a <strong>{email}</strong>. Controlla la posta (in locale: http://127.0.0.1:54324).
              </p>
              <Link to="/login" className="text-sm text-slate-900 hover:underline">
                Torna al login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="forgot-form">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Invio...' : 'Invia link reset'}
              </Button>
              <Link to="/login" className="block text-sm text-center text-slate-600 hover:underline">
                Torna al login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
