import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

/** Landing del link nell'email. Chiama la RPC di conferma (idempotente: ri-cliccare
 *  il link non rompe niente e non falsa il conteggio) e manda al benvenuto. */
export default function WaitlistConfirmPage() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setErr('Link non valido.'); return }
    void (async () => {
      const { data, error } = await supabase.rpc('maestranze_waitlist_confirm', { p_token: token })
      if (error) { setErr('Questo link non è valido o è scaduto.'); return }
      const row = (data ?? [])[0] as { nome: string; gia_confermata: boolean } | undefined
      nav(`/maestranze/benvenuto?nome=${encodeURIComponent(row?.nome ?? '')}&stato=confermata`, { replace: true })
    })()
  }, [params, nav])

  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: 'rgb(var(--bg))' }}>
      <div className="text-center max-w-sm">
        <img src="/brand/planfully-logo.svg" alt="Planfully" className="h-7 mx-auto mb-8" />
        {err
          ? <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>{err}</p>
          : <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>Confermiamo la tua email…</p>}
      </div>
    </div>
  )
}
