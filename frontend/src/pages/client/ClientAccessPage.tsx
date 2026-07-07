import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, Mail, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { trackQuoteOpen, quoteTokenFromPath } from '@/lib/trackQuoteOpen'

// ============================================================================
// Accesso area cliente: EMAIL + PASSWORD (come i professionisti). Niente magic
// link. Chi non ha ancora una password (o l'ha dimenticata) usa "Imposta /
// recupera la password" → riceve via email il link per crearla (/reset-password).
// Il primo accesso vero arriva dall'invito del professionista quando manda il
// preventivo: anche quello porta a impostare la password sulla propria email.
// ============================================================================

export default function ClientAccessPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const nextParam = params.get('next')
  const dest = nextParam && nextParam.startsWith('/') ? nextParam : '/area-cliente'
  // Se il cliente arriva qui dal link del preventivo (?next=/p/preview|accept/<token>),
  // l'apertura conta SUBITO — anche se non completa il login. È il punto d'ingresso reale.
  useEffect(() => { trackQuoteOpen(quoteTokenFromPath(nextParam)) }, [nextParam])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())

  async function login() {
    setErr('')
    if (!emailOk(email)) { setErr('Email non valida'); return }
    if (password.length < 6) { setErr('Inserisci la password (almeno 6 caratteri)'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      if (error) {
        if (/invalid login credentials/i.test(error.message)) setErr('Email o password non corretti. È la prima volta? Usa "Imposta / recupera la password" qui sotto.')
        else setErr(error.message)
        return
      }
      nav(dest)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Accesso non riuscito') } finally { setBusy(false) }
  }

  async function sendReset() {
    setErr('')
    if (!emailOk(email)) { setErr('Inserisci prima la tua email, poi premi qui'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw error
      setResetSent(true)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Invio non riuscito') } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'rgb(var(--bg))' }}>
      <Card className="w-full max-w-md p-7">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={20} className="text-[rgb(var(--gold-500))]" />
          <span className="font-display text-xl">La mia area cliente</span>
        </div>

        {resetSent ? (
          <div className="text-center py-4">
            <Mail size={36} className="mx-auto mb-3 text-[rgb(var(--gold-500))]" />
            <h2 className="font-display text-lg mb-1">Controlla la posta</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Ti abbiamo inviato un link a <strong>{email}</strong> per impostare la password. Aprilo, scegli la
              password, poi torna qui per accedere.
            </p>
            <button onClick={() => setResetSent(false)} className="text-sm mt-4 hover:underline text-[rgb(var(--fg-muted))]">← Torna al login</button>
          </div>
        ) : (
          <>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">
              Accedi con l’email a cui hai ricevuto il preventivo e la tua password. Qui trovi, in un unico posto,
              tutti i tuoi professionisti, preventivi e contratti.
            </p>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <Input type="email" autoComplete="email" value={email} placeholder="tua@email.it"
              onChange={(e) => setEmail(e.target.value)} />
            <label className="block text-sm font-medium mb-1.5 mt-3">Password</label>
            <Input type="password" autoComplete="current-password" value={password} placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void login() }} />
            {err && <p className="text-xs mt-2" style={{ color: '#dc2626' }}>{err}</p>}
            <Button className="w-full mt-4" onClick={() => void login()} disabled={busy}>
              {busy ? 'Accesso…' : <>Accedi <ArrowRight size={16} className="ml-1" /></>}
            </Button>

            <div className="mt-5 pt-4 border-t border-[rgb(var(--border))] text-center">
              <button onClick={() => void sendReset()} disabled={busy} className="text-sm text-[rgb(var(--fg))] hover:underline font-medium">Imposta / recupera la password</button>
              <p className="mt-2 text-xs text-[rgb(var(--fg-subtle))]">Prima volta qui o password dimenticata? Inserisci l’email qui sopra e premi questo tasto: ti mandiamo il link per crearla.</p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
