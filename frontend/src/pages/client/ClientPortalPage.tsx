import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useMyWeddings } from '@/hooks/useCouple'
import { ClientProfessionalsView } from '@/components/client/ClientProfessionalsView'

// ============================================================================
// Area cliente diretto (/area-cliente): il cliente che NON ha un evento gestito
// da un wedding planner vede qui, raggruppati per professionista, i propri
// preventivi e contratti. Chi ha un evento viene reindirizzato a /couple (vedi
// App.tsx), così non esistono due "case" diverse per lo stesso cliente.
// ============================================================================

export default function ClientPortalPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { data: weddings } = useMyWeddings()

  // Se il cliente ha un evento gestito (è membro di una coppia), la sua unica
  // casa è /couple: lì trova tutto, inclusa la tab "I miei fornitori".
  useEffect(() => {
    if (weddings && weddings.length > 0) navigate('/couple', { replace: true })
  }, [weddings, navigate])

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg))' }}>
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <Sparkles size={18} className="text-[rgb(var(--gold-500))]" />
          <span className="font-display text-lg">La mia area</span>
          <span className="ml-auto text-xs text-[rgb(var(--fg-muted))] hidden sm:block">{user?.email}</span>
          <Link to="/faq" className="text-xs text-[rgb(var(--fg-muted))] hover:underline">FAQ</Link>
          <button onClick={() => void signOut()} className="text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] inline-flex items-center gap-1">
            <LogOut size={13} /> Esci
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="font-display text-2xl mb-1">I tuoi professionisti</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mb-6">
          Tutti i preventivi, i contratti e le informazioni che hai ricevuto, ordinati per professionista.
        </p>
        <ClientProfessionalsView emptyEmail={user?.email} />
      </div>
    </div>
  )
}
