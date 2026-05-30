import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth, type AppRole } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'

type Props = {
  children: ReactNode
  roles?: AppRole[]
  bare?: boolean
}

export function RequireAuth({ children, roles, bare = false }: Props) {
  const { loading, session, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
        <div className="space-y-3 text-center">
          <div className="skeleton h-6 w-40 mx-auto" />
          <div className="skeleton h-4 w-28 mx-auto" />
        </div>
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  // Onboarding gate: utente autenticato ma profile non completato → forza wizard
  if (profile && !profile.onboarding_complete
    && location.pathname !== '/onboarding'
    && !location.pathname.startsWith('/couple/accept')) {
    return <Navigate to="/onboarding" replace />
  }
  // Questionario-once: se il timestamp e` valorizzato, non riapriamo mai il wizard.
  if (profile?.onboarding_completato_il && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  // COUPLE: forziamo accesso a /couple (no sidebar capostipite, no /weddings, no /quotes)
  // Eccezioni: /profile, /onboarding, /feed (community), /scopri, /fornitore (vetrine pubbliche), /faq
  if (profile?.role === 'COUPLE'
    && !location.pathname.startsWith('/couple')
    && location.pathname !== '/profile'
    && location.pathname !== '/onboarding'
    && location.pathname !== '/feed'
    && !location.pathname.startsWith('/feed/')
    && !location.pathname.startsWith('/scopri')
    && !location.pathname.startsWith('/fornitore/')
    && !location.pathname.startsWith('/faq')) {
    return <Navigate to="/couple" replace />
  }
  if (roles && profile && !roles.includes(profile.role)) {
    return (
      <AppShell>
        <div className="p-10 text-center">
          <p className="text-lg" style={{ color: 'rgb(var(--fg-muted))' }}>
            Accesso non consentito al tuo ruolo ({profile.role}).
          </p>
        </div>
      </AppShell>
    )
  }
  if (bare) return <>{children}</>
  // La sidebar AppShell e' progettata per WP/LOCATION/FORNITORE/ADMIN.
  // Per il ruolo COUPLE forziamo bare anche sulle pagine condivise (es. /faq)
  // cosi' la coppia non vede mai voci di menu da professionista.
  if (profile?.role === 'COUPLE') return <>{children}</>
  return <AppShell>{children}</AppShell>
}
