import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
            <Sparkles size={16} strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg">Planfully</span>
        </div>
        <h1 className="font-display text-2xl">Nuova password</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1 mb-5">
          Scegli una password sicura per accedere al tuo account.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
              <Input id="password" type="password" required minLength={6}
                className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert">{error}</p>}
          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            {busy ? 'Aggiornamento...' : 'Aggiorna password'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
