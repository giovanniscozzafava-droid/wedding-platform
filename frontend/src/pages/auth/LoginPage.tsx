import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    setError(null); setInfo(null); setBusy(true)
    try {
      if (magicMode) {
        const { error: err } = await supabase.auth.signInWithOtp({
          email, options: { emailRedirectTo: `${window.location.origin}/` },
        })
        if (err) throw err
        setInfo('Ti abbiamo inviato un link via email.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        nav(next, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:col-span-3 aurora dotted relative overflow-hidden p-12">
        <div className="absolute inset-0 dotted opacity-30" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="relative z-10 flex flex-col justify-between w-full">
          <Link to="/" className="inline-flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--gold-500))' }}>
              <Sparkles size={18} className="text-[rgb(var(--bg))]" strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl">Wedding</span>
          </Link>

          <div className="max-w-md">
            <p className="text-xs uppercase tracking-[0.2em] mb-3" style={{ color: 'rgb(var(--gold-700))' }}>
              Network &middot; Italia
            </p>
            <h1 className="font-display text-4xl xl:text-5xl leading-tight mb-4">
              Una piattaforma per&nbsp;chi orchestra matrimoni.
            </h1>
            <p className="text-[rgb(var(--fg-muted))] text-base max-w-md">
              Catalogo fornitori, calendari sincronizzati, preventivi con un solo invio.
              Lavora come una squadra anche se sei un solo studio.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 max-w-lg text-sm">
            <li className="surface p-3"><strong>23</strong> servizi seed pronti per provare</li>
            <li className="surface p-3"><strong>10+</strong> trigger DB testati in produzione</li>
            <li className="surface p-3"><strong>PDF</strong> brandizzato per i tuoi clienti</li>
            <li className="surface p-3"><strong>iCal</strong> per Apple, Google, Outlook</li>
          </ul>
        </motion.div>
      </div>

      {/* Form panel */}
      <div className="lg:col-span-2 flex items-center justify-center p-6 sm:p-10" style={{ background: 'rgb(var(--bg-elev))' }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-6">
          <div className="lg:hidden flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
              <Sparkles size={18} strokeWidth={2.5} />
            </span>
            <span className="font-display text-xl">Wedding</span>
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-tight">Bentornat*</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Accedi con le tue credenziali o un magic link.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                <Input id="email" type="email" autoComplete="email" required value={email}
                  className="pl-9" onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" />
              </div>
            </div>
            {!magicMode && (
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                  <Input id="password" type="password" autoComplete="current-password" required={!magicMode} value={password}
                    className="pl-9" onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
            )}
            {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert" data-testid="login-error">{error}</p>}
            {info && <p className="text-sm text-[rgb(var(--emerald-500))]" role="status" data-testid="login-info">{info}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? 'Attendi...' : magicMode ? 'Invia magic link' : 'Accedi'}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:underline"
                onClick={() => { setMagicMode((m) => !m); setError(null); setInfo(null) }}>
                {magicMode ? 'Usa password' : 'Usa magic link'}
              </button>
              <Link to="/forgot-password" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:underline">
                Password dimenticata?
              </Link>
            </div>
            <p className="text-sm text-center text-[rgb(var(--fg-muted))] pt-2">
              Non hai un account?{' '}
              <Link to="/register" className="font-medium text-[rgb(var(--fg))] hover:underline">Registrati</Link>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  )
}
