import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Heart, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { eventTerm } from '@/lib/eventKind'

type InviteInfo = {
  email: string
  full_name: string | null
  role: string
  wedding_title: string
  wedding_date: string
  planner_name: string
  event_kind?: string | null
  error?: string
}

export default function CoupleInviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const nav = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'signup' | 'login'>('signup')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    // Il cliente ha aperto davvero il preventivo (anche se nuovo): traccialo.
    void (supabase.rpc as any)('track_quote_open_by_invite', { p_invite_token: token })
    void (async () => {
      const { data, error } = await (supabase.rpc as any)('resolve_couple_invite', { p_token: token })
      if (error) { setLoadErr(error.message); return }
      const j = data as InviteInfo
      if (j.error) { setLoadErr(j.error); return }
      setInfo(j)
      if (j.full_name) setFullName(j.full_name)
      if ((j as { already?: boolean }).already) setMode('login') // già registrata/o → rientro

    })()
  }, [token])

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    if (!info || !token) return
    setBusy(true)
    try {
      const { error: signErr } = await supabase.auth.signUp({
        email: info.email, password,
        options: {
          data: { role: 'COUPLE', full_name: fullName },
          // IMPORTANT: il redirect di conferma deve tornare al flusso COPPIA, non a
          // /couple/accept (che, senza sessione, dirottava su /register PRO → role WP).
          emailRedirectTo: `${window.location.origin}/invito-coppia/${token}`,
        },
      })
      if (signErr) throw signErr
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: info.email, password })
      if (loginErr) {
        setDone(true)
        toast.success('Account creato. Controlla la tua email per confermare.')
        return
      }
      const { data: claimed } = await supabase.rpc('couple_accept_invite', { p_token: token })
      if (claimed !== true) {
        toast.error('Account creato ma invito non collegato. Contatta la wedding planner.')
      } else {
        toast.success(`Benvenut*: ${info.wedding_title}`)
      }
      // Il cliente arriva da un lead: ha già dato i suoi dati. NON rifargli
      // compilare il questionario di onboarding → dritto al suo matrimonio,
      // dove trova subito il preventivo.
      nav('/couple', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore registrazione')
    } finally { setBusy(false) }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!info || !token) return
    setBusy(true)
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: info.email, password })
      if (loginErr) throw loginErr
      await supabase.rpc('couple_accept_invite', { p_token: token }) // best-effort: collega se non già collegato
      toast.success('Bentornata/o nel vostro evento')
      nav('/couple', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore login')
    } finally { setBusy(false) }
  }

  if (loadErr) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora p-4">
        <div className="surface surface-lift p-8 max-w-md text-center">
          <AlertCircle size={32} className="mx-auto mb-3 text-[rgb(var(--rose-500))]" />
          <h1 className="font-display text-2xl mb-2">Invito non valido</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">{loadErr}</p>
        </div>
      </div>
    )
  }
  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora">
        <div className="skeleton h-6 w-48" />
      </div>
    )
  }
  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center aurora p-4">
        <div className="surface surface-lift p-8 max-w-md text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-[rgb(var(--rose-500))]" />
          <h1 className="font-display text-2xl mb-2">Quasi fatto</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Abbiamo inviato una email di conferma a <strong>{info.email}</strong>. Cliccala per attivare l'account e accedere al tuo evento.
          </p>
        </div>
      </div>
    )
  }

  const weddingDate = new Date(info.wedding_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  const term = eventTerm(info.event_kind ?? 'matrimonio')
  const headline = term.hasCoupleConcept
    ? `Il vostro ${term.label} sta prendendo forma`
    : `Il tuo ${term.label} sta prendendo forma`

  return (
    <div className="min-h-screen flex items-center justify-center aurora py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl surface surface-lift overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--rose-500))', color: 'rgb(var(--bg))' }}>
              <Heart size={16} strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg">Planfully</span>
          </div>
          <h1 className="font-display text-2xl tracking-tight">
            <Sparkles size={20} className="inline mr-2 text-[rgb(var(--gold-500))]" />
            {headline}
          </h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
            <strong>{info.planner_name}</strong> ti invita a partecipare a:
          </p>
          <p className="font-display text-xl mt-1">{info.wedding_title}</p>
          <p className="text-sm text-[rgb(var(--fg-subtle))]">{weddingDate}</p>
        </div>

        <div className="px-8 py-4 border-b flex gap-2 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
          <button onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-md ${mode === 'signup' ? 'bg-[rgb(var(--bg-sunken))] font-medium' : 'text-[rgb(var(--fg-muted))]'}`}>
            Nuovo account
          </button>
          <button onClick={() => setMode('login')}
            className={`flex-1 py-2 rounded-md ${mode === 'login' ? 'bg-[rgb(var(--bg-sunken))] font-medium' : 'text-[rgb(var(--fg-muted))]'}`}>
            Ho già un account
          </button>
        </div>

        <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="p-8 space-y-4">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={info.email} disabled />
          </div>

          {mode === 'signup' && (
            <div className="space-y-1">
              <Label htmlFor="fullName">Il tuo nome</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Es. Giulia" />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Minimo 6 caratteri' : 'La tua password'} />
          </div>

          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            {busy ? '…' : mode === 'signup' ? 'Crea account e accetta' : 'Accedi e accetta'}
          </Button>
        </form>
      </motion.div>
    </div>
  )
}
