import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, CheckCircle2, AlertTriangle } from '@/components/icons/lucide'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Pagina "Nuova password". Ci si arriva dal link di recupero (edge password-reset
// → Resend). Il link stabilisce una sessione di RECOVERY: solo con quella
// updateUser({password}) funziona. Qui NON diamo per scontato che ci sia già:
//   • ascoltiamo l'evento PASSWORD_RECOVERY / getSession (flow implicit, token nell'hash)
//   • gestiamo il flow token_hash (?token_hash=...&type=recovery → verifyOtp)
//   • intercettiamo i link scaduti/già usati (?error / #error) con messaggio chiaro
//   • se dopo qualche secondo non arriva nessuna sessione → link non valido, con
//     l'invito a richiederne un altro (niente "updateUser" al buio con errore criptico).
// ============================================================================

type Phase = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    let settled = false
    const ok = () => { if (!settled) { settled = true; setPhase('ready') } }
    const bad = () => { if (!settled) { settled = true; setPhase('invalid') } }

    // 1) Link scaduto o già usato: Supabase mette error/error_description nel
    //    fragment (o in query). Intercettalo subito per un messaggio giusto.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    if (params.get('error') || hash.get('error')) { bad(); return }

    // 2) Flow token_hash (PKCE / verifyOtp): stabilisci tu la sessione recovery.
    const tokenHash = params.get('token_hash')
    const type = params.get('type')
    if (tokenHash && (type === 'recovery' || type === null)) {
      supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
        .then(({ error: e }) => (e ? bad() : ok()))
      return
    }

    // 3) Flow implicit (token nell'hash): detectSessionInUrl stabilisce la sessione
    //    e fa scattare PASSWORD_RECOVERY. Ascoltiamo + controllo immediato.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) ok()
    })
    supabase.auth.getSession().then(({ data }) => { if (data.session) ok() })
    // Rete di sicurezza: nessuna sessione dopo 4s → il link non è valido.
    const t = window.setTimeout(bad, 4000)
    return () => { sub.subscription.unsubscribe(); window.clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) { setError('La password deve avere almeno 8 caratteri.'); return }
    if (password !== confirm) { setError('Le due password non coincidono.'); return }
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        // Sessione recovery scaduta mentre compilava → torna allo stato "invalido".
        if (/session|jwt|token|expired|not.*authenticated/i.test(err.message)) { setPhase('invalid'); return }
        throw err
      }
      setPhase('done')
      window.setTimeout(() => nav('/', { replace: true }), 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6" style={{ color: 'rgb(var(--fg))' }}>
          <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-lg">Planfully</span>
        </div>

        {phase === 'checking' && (
          <div className="py-6 text-center text-sm text-[rgb(var(--fg-muted))]">
            Verifica del link in corso…
          </div>
        )}

        {phase === 'invalid' && (
          <div className="text-center py-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--rose-100, 254 226 226))', color: 'rgb(var(--rose-500))' }}>
              <AlertTriangle size={26} />
            </span>
            <h1 className="font-display text-2xl">Link non più valido</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
              Questo link per reimpostare la password è scaduto o è già stato usato. I link valgono un'ora
              e una volta sola. Richiedine uno nuovo: arriva subito via email.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Link to="/area-cliente"><Button variant="gold" className="w-full">Richiedi un nuovo link (area cliente)</Button></Link>
              <Link to="/forgot-password" className="text-sm text-[rgb(var(--fg-muted))] hover:underline">Sono un professionista</Link>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="text-center py-2">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
              <CheckCircle2 size={28} />
            </span>
            <h1 className="font-display text-2xl">Password aggiornata</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">Ti stiamo portando dentro…</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <h1 className="font-display text-2xl">Nuova password</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-1 mb-5">
              Scegli una password sicura (almeno 8 caratteri) per accedere al tuo account.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="password">Nuova password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                  <Input id="password" type="password" required minLength={8} autoComplete="new-password"
                    className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirm">Ripeti la password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                  <Input id="confirm" type="password" required minLength={8} autoComplete="new-password"
                    className="pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                </div>
              </div>
              {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert">{error}</p>}
              <Button type="submit" variant="gold" className="w-full" disabled={busy}>
                {busy ? 'Aggiornamento...' : 'Aggiorna password'}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}
