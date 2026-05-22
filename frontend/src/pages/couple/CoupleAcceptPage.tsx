import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { acceptCoupleInvite } from '@/hooks/useCouple'
import { useAuth } from '@/lib/auth'

export default function CoupleAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const { session, loading } = useAuth()
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!session) {
      // Redirect a register con back-to invite
      nav(`/register?next=/couple/accept/${token}`, { replace: true })
      return
    }
    if (!token) return
    acceptCoupleInvite(token)
      .then((ok) => {
        if (ok) setState('ok')
        else { setState('err'); setMsg('Invito non valido o gia` usato.') }
      })
      .catch((e) => { setState('err'); setMsg(e?.message ?? 'Errore') })
  }, [token, session, loading, nav])

  return (
    <div className="min-h-screen flex items-center justify-center aurora px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="w-full max-w-md p-10 text-center">
          {state === 'idle' && (
            <>
              <Loader2 className="mx-auto mb-4 animate-spin" style={{ color: 'rgb(var(--fg-muted))' }} />
              <h1 className="font-display text-2xl">Verifica invito...</h1>
            </>
          )}
          {state === 'ok' && (
            <>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
                style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
                <Heart size={28} fill="currentColor" />
              </span>
              <h1 className="font-display text-3xl tracking-tight">Benvenuti!</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-2 mb-6">
                Sei stato/a aggiunto/a al matrimonio. Ora puoi vedere tutto quello che riguarda il tuo grande giorno.
              </p>
              <Button asChild variant="gold">
                <Link to="/couple">Vai al tuo matrimonio</Link>
              </Button>
            </>
          )}
          {state === 'err' && (
            <>
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
                style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-500))' }}>
                <AlertCircle size={28} />
              </span>
              <h1 className="font-display text-2xl">Non e&apos; andata</h1>
              <p className="text-sm text-[rgb(var(--rose-500))] mt-2">{msg}</p>
            </>
          )}
        </Card>
      </motion.div>
    </div>
  )
}
