import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {  Heart, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type InviteInfo = {
  email: string
  subrole_hint: string | null
  message: string | null
  expires_at: string
  capo_name: string
  error?: string
}

export default function SupplierInviteAcceptPage() {
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
    void (async () => {
      const { data, error } = await (supabase.rpc as any)('resolve_supplier_invite', { p_token: token })
      if (error) { setLoadErr(error.message); return }
      const j = data as InviteInfo
      if (j.error) { setLoadErr(j.error); return }
      setInfo(j)
    })()
  }, [token])

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    if (!info || !token) return
    setBusy(true)
    try {
      // 1. signup user con metadata FORNITORE + invite_token
      const { error: signErr } = await supabase.auth.signUp({
        email: info.email, password,
        options: {
          data: {
            role: 'FORNITORE',
            subrole: info.subrole_hint ?? null,
            full_name: fullName,
            invite_token: token,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })
      if (signErr) throw signErr
      // 2. login immediato (locale: email-confirm disabled; cloud: gia confermato auto se Supabase Auto Confirm e' attivo, altrimenti email)
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: info.email, password })
      if (loginErr) {
        // Email non ancora confermata su cloud → mostra messaggio
        setDone(true)
        toast.success('Account creato. Controlla la tua email per confermare.')
        return
      }
      // 3. claim invite via RPC
      const { data: claimed } = await (supabase.rpc as any)('claim_supplier_invite', { p_token: token })
      if (claimed !== true) {
        toast.error('Account creato ma invito non collegato. Contatta il tuo wedding planner.')
      } else {
        toast.success(`Sei collegato/a a ${info.capo_name}`)
      }
      nav('/onboarding', { replace: true })
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
      const { data: claimed } = await (supabase.rpc as any)('claim_supplier_invite', { p_token: token })
      if (claimed === true) {
        toast.success(`Collegato/a a ${info.capo_name}`)
        nav('/', { replace: true })
      } else {
        toast.error('Login OK ma invito non collegato (email diverse?). Contatta il tuo wedding planner.')
      }
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
          <CheckCircle2 size={32} className="mx-auto mb-3 text-[rgb(var(--gold-500))]" />
          <h1 className="font-display text-2xl mb-2">Quasi fatto</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Abbiamo inviato una email di conferma a <strong>{info.email}</strong>. Clicca il link nella mail per attivare l'account.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xl surface surface-lift overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-2 mb-3">
            <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" style={{ color: 'rgb(var(--fg))' }} />
            <span className="font-display text-lg">Planfully</span>
          </div>
          <h1 className="font-display text-2xl tracking-tight">
            <Heart size={20} className="inline mr-2 text-[rgb(var(--rose-500))]" />
            {info.capo_name} ti ha invitato come fornitore
          </h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
            {info.message ?? 'Crea un account per gestire i tuoi servizi e coordinarti sui matrimoni.'}
            {info.subrole_hint && (
              <> Tipo servizio suggerito: <strong>{info.subrole_hint}</strong>.</>
            )}
          </p>
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
            <Label>Email (dall'invito)</Label>
            <Input type="email" value={info.email} disabled />
            <p className="text-[11px] text-[rgb(var(--fg-subtle))]">L'email deve corrispondere all'invito per essere collegato/a.</p>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1">
              <Label htmlFor="fullName">Nome e cognome</Label>
              <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Es. Mario Rossi" />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Minimo 6 caratteri' : 'La tua password'} />
          </div>

          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            {busy ? '…' : mode === 'signup' ? 'Crea account e accetta invito' : 'Accedi e accetta invito'}
          </Button>

          <p className="text-[11px] text-[rgb(var(--fg-subtle))] text-center">
            Scade il {new Date(info.expires_at).toLocaleDateString('it-IT')}.
          </p>
        </form>
      </motion.div>
    </div>
  )
}
