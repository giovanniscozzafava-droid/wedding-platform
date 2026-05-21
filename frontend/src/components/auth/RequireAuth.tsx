import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth, type AppRole } from '@/lib/auth'

type Props = {
  children: ReactNode
  roles?: AppRole[]
}

export function RequireAuth({ children, roles }: Props) {
  const { loading, session, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Caricamento sessione...
      </div>
    )
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (roles && profile && !roles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-700">
        Accesso non consentito al tuo ruolo ({profile.role}).
      </div>
    )
  }
  return <>{children}</>
}
