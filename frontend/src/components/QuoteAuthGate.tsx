import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/**
 * Blinda preventivo/contratto: si vedono cifre e si accetta/firma SOLO da
 * cliente autenticato. Niente importi o azioni su link pubblici/WhatsApp.
 * Se non loggato → invito ad accedere/registrarsi, poi redirect alla pagina.
 */
export function QuoteAuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return null
  if (user) return <>{children}</>

  const next = encodeURIComponent(loc.pathname + loc.search)
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#FDFBF6', color: '#1A1714', colorScheme: 'light' }}>
      <div className="w-full max-w-md rounded-2xl border p-7 text-center" style={{ borderColor: '#E4DED2', background: '#fff' }}>
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4" style={{ background: 'rgba(37,64,47,.14)', color: '#25402F' }}>
          <Lock size={26} />
        </span>
        <h1 className="font-display text-2xl mb-2">Accedi per vedere il preventivo</h1>
        <p className="text-sm mb-6" style={{ color: '#6E6E6E' }}>
          Per riservatezza, importi e accettazione sono visibili solo nella tua area personale.
          Registrati o accedi con l’email a cui hai ricevuto l’invito: atterrerai direttamente qui.
        </p>
        <Link to={`/area-cliente/accedi?next=${next}`}>
          <span className="block w-full py-3 rounded-lg text-white font-semibold" style={{ background: '#1A1714' }}>
            Accedi / Registrati
          </span>
        </Link>
        <p className="text-[11px] mt-4" style={{ color: '#9a9182' }}>Nessuna password: ti inviamo un link sicuro via email.</p>
      </div>
    </div>
  )
}
