import { useState } from 'react'
import { Sparkles, Mail, ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Accesso area cliente: il cliente diretto entra con un link magico inviato
// alla SUA email (la stessa che il professionista ha usato per il preventivo).
// Nessuna password. Al primo accesso nasce un profilo con ruolo CLIENT.
// ============================================================================

export default function ClientAccessPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    setErr('')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErr('Email non valida'); return }
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          data: { role: 'CLIENT' },
          emailRedirectTo: `${window.location.origin}/area-cliente`,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Invio non riuscito')
    } finally { setSending(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: 'rgb(var(--bg))' }}>
      <Card className="w-full max-w-md p-7">
        <div className="flex items-center gap-2 mb-5">
          <Sparkles size={20} className="text-[rgb(var(--gold-500))]" />
          <span className="font-display text-xl">La mia area cliente</span>
        </div>

        {sent ? (
          <div className="text-center py-4">
            <Mail size={36} className="mx-auto mb-3 text-[rgb(var(--gold-500))]" />
            <h2 className="font-display text-lg mb-1">Controlla la posta</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Ti abbiamo inviato un link di accesso a <strong>{email}</strong>. Cliccalo per entrare nella tua area —
              niente password da ricordare.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">
              Inserisci l’email a cui hai ricevuto il preventivo. Ti invieremo un link sicuro per accedere e vedere,
              in un unico posto, tutti i tuoi professionisti, preventivi e contratti.
            </p>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <Input type="email" value={email} placeholder="tua@email.it"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send() }} />
            {err && <p className="text-xs text-[rgb(var(--danger,220_38_38))] mt-2" style={{ color: '#dc2626' }}>{err}</p>}
            <Button className="w-full mt-4" onClick={() => void send()} disabled={sending}>
              {sending ? 'Invio…' : <>Invia link di accesso <ArrowRight size={16} className="ml-1" /></>}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
