// Accept page per inviti WP/LOCATION ricevuti da un altro capostipite.
// Token in URL: /invito-capostipite/:token
// Sul signup, handle_new_auth_user (DB trigger) onorera' target_role e
// creera' la riga in referrals per il rewards system.

import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AlertCircle, CheckCircle2, Award } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type InviteInfo = {
  email: string
  target_role: 'WEDDING_PLANNER' | 'LOCATION'
  subrole_hint: string | null
  message: string | null
  expires_at: string
  capo_name: string
  error?: string
}

export default function CapostipiteInviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const nav = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) return
    void (async () => {
      const { data, error } = await (supabase.rpc as any)('resolve_capostipite_invite', { p_token: token })
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
      const { error: signErr } = await supabase.auth.signUp({
        email: info.email,
        password,
        options: {
          data: {
            role: info.target_role,
            subrole: info.subrole_hint ?? null,
            full_name: fullName,
            invite_token: token,
          },
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      })
      if (signErr) throw signErr
      setDone(true)
      toast.success('Registrazione completata! Controlla la tua email.')
      setTimeout(() => nav('/login'), 2500)
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setBusy(false) }
  }

  if (loadErr || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <AlertCircle size={28} className="mx-auto mb-3 text-[rgb(var(--rose-500))]" />
          <h1 className="font-display text-2xl mb-2">Invito non valido</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">{loadErr ?? 'Caricamento…'}</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="surface surface-lift p-8 max-w-md text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-500" />
          <h1 className="font-display text-2xl mb-2">Benvenuta nella rete!</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Conferma l'email per completare l'accesso. Tra poco ti porto al login.
          </p>
        </motion.div>
      </div>
    )
  }

  const roleLabel = info.target_role === 'LOCATION' ? 'Location' : 'Wedding Planner'

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift p-8 w-full max-w-md">
        <header className="text-center mb-6">
          <div className="text-xs uppercase tracking-[0.25em] text-[rgb(var(--gold-600))] mb-2">
            Invito da {info.capo_name}
          </div>
          <h1 className="font-display text-3xl tracking-tight mb-2">
            Entra nel network Planfully
          </h1>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Ti registriamo come <strong>{roleLabel}</strong>. Sarai parte della rete di {info.capo_name} —
            ogni lead generato attiva rewards condivisi.
          </p>
        </header>

        {info.message && (
          <div className="p-3 mb-5 rounded-lg text-sm italic" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
            "{info.message}"
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input value={info.email} disabled readOnly />
          </div>
          <div>
            <Label htmlFor="cap-name">Nome e cognome</Label>
            <Input id="cap-name" required value={fullName}
              onChange={(e) => setFullName(e.target.value)} placeholder="Rosella Elia" />
          </div>
          <div>
            <Label htmlFor="cap-pass">Password</Label>
            <Input id="cap-pass" type="password" required minLength={8}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="almeno 8 caratteri" />
          </div>

          <div className="flex items-start gap-2 text-xs p-3 rounded-md"
            style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
            <Award size={14} className="shrink-0 mt-0.5 text-[rgb(var(--gold-600))]" />
            <div>
              Entrando ora con questo link verrai automaticamente collegata a {info.capo_name} nel sistema
              Network Rewards.
            </div>
          </div>

          <Button type="submit" variant="gold" disabled={busy || !fullName || password.length < 8}>
            {busy ? 'Creazione account…' : `Registrati come ${roleLabel}`}
          </Button>
        </form>

        <p className="text-[11px] text-center text-[rgb(var(--fg-subtle))] mt-4">
          Invito valido fino al {new Date(info.expires_at).toLocaleDateString('it-IT')}.
        </p>
      </motion.div>
    </div>
  )
}
