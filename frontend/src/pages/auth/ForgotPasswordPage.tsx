import { type FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {  Mail, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setBusy(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) throw err
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift w-full max-w-md p-8">
        <Link to="/login" className="inline-flex items-center gap-2 mb-6" style={{ color: 'rgb(var(--fg))' }}>
          <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-lg">Planfully</span>
        </Link>
        {sent ? (
          <div className="text-center" data-testid="forgot-sent">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
              <CheckCircle2 size={28} />
            </span>
            <h1 className="font-display text-2xl">Controlla la posta</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
              Ti abbiamo inviato un link a <strong>{email}</strong>. In locale &rarr; <a className="underline" href="http://127.0.0.1:54324" target="_blank" rel="noreferrer">Mailpit</a>.
            </p>
            <Link to="/login" className="inline-block mt-6 text-sm text-[rgb(var(--fg-muted))] hover:underline">
              Torna al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="forgot-form">
            <div>
              <h1 className="font-display text-2xl">Reimposta password</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Ti invieremo un link per sceglierne una nuova.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                <Input id="email" type="email" required value={email}
                  className="pl-9" onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert">{error}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? 'Invio...' : 'Invia link reset'}
            </Button>
            <Link to="/login" className="block text-sm text-center text-[rgb(var(--fg-muted))] hover:underline">
              Torna al login
            </Link>
          </form>
        )}
      </motion.div>
    </div>
  )
}
