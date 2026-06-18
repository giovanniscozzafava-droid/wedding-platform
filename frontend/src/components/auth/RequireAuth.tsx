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
  // Onboarding gate: utente autenticato ma profile non completato → forza wizard.
  // SOLO per i professionisti: COUPLE e CLIENT NON fanno il wizard (il questionario
  // è già stato raccolto in fase di lead) e atterrano direttamente nella loro area.
  // OSPITE (GUEST): non è un professionista né un cliente. Non può registrarsi né entrare
  // nelle aree riservate: fa solo le sue cose sulla galleria pubblica dell'evento. Qualsiasi
  // rotta protetta → torna alla landing pubblica (mai onboarding/registrazione).
  if (profile?.role === 'GUEST') {
    return <Navigate to="/" replace />
  }
  if (profile && !profile.onboarding_complete
    && profile.role !== 'COUPLE' && profile.role !== 'CLIENT'
    && location.pathname !== '/onboarding'
    && !location.pathname.startsWith('/couple/accept')) {
    return <Navigate to="/onboarding" replace />
  }
  // Questionario-once: se il timestamp e` valorizzato, non riapriamo mai il wizard.
  if (profile?.onboarding_completato_il && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />
  }
  // COUPLE: forziamo accesso a /couple (no sidebar capostipite, no /weddings, no /quotes)
  // Eccezioni: /profile, /onboarding, /feed (community), /scopri, /fornitore (vetrine pubbliche), /faq, /area-cliente
  if (profile?.role === 'COUPLE'
    && !location.pathname.startsWith('/couple')
    && !location.pathname.startsWith('/area-cliente')
    && location.pathname !== '/profile'
    && location.pathname !== '/onboarding'
    && location.pathname !== '/feed'
    && !location.pathname.startsWith('/feed/')
    && !location.pathname.startsWith('/scopri')
    && !location.pathname.startsWith('/fornitore/')
    // album impaginato dal fotografo e revisione video: la coppia ci accede dal suo cruscotto
    // (link in EventGalleryTab → /album/:id e /video/:id, target=_blank). Senza queste eccezioni
    // il confinamento la rimbalzava su /couple → "l'album non si apre".
    && !location.pathname.startsWith('/album/')
    && !location.pathname.startsWith('/video/')
    && !location.pathname.startsWith('/faq')) {
    return <Navigate to="/couple" replace />
  }
  // CLIENT (cliente diretto di fornitori): area dedicata aggregata. Niente
  // sidebar professionista, niente onboarding wizard.
  if (profile?.role === 'CLIENT'
    && !location.pathname.startsWith('/area-cliente')
    && location.pathname !== '/profile'
    && !location.pathname.startsWith('/faq')
    && !location.pathname.startsWith('/p/')
    && !location.pathname.startsWith('/fornitore/')) {
    return <Navigate to="/area-cliente" replace />
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
  if (profile?.role === 'COUPLE' || profile?.role === 'CLIENT') return <>{children}</>
  return <AppShell>{children}</AppShell>
}
