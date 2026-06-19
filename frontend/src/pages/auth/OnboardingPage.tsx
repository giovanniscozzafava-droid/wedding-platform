import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ProviderOnboardingWizard } from './ProviderOnboardingWizard'
import { GenericOnboardingForm } from './GenericOnboardingForm'

export default function OnboardingPage() {
  const { profile } = useAuth()
  if (!profile) return null
  const role = profile.role
  // GUARD DURO: la profilazione/onboarding è SOLO per i professionisti. Un cliente (COUPLE) o un
  // cliente diretto (CLIENT) non deve MAI vedere un wizard di profilazione: i suoi dati sono già
  // raccolti in fase di lead. Lo rimandiamo subito alla sua area. (Difesa in profondità: anche se
  // RequireAuth lo lasciasse passare su /onboarding, qui non vede comunque nulla.)
  if (role === 'COUPLE') return <Navigate to="/couple" replace />
  if (role === 'CLIENT') return <Navigate to="/area-cliente" replace />
  if (role === 'GUEST') return <Navigate to="/" replace />
  if (role === 'WEDDING_PLANNER' || role === 'LOCATION' || role === 'FORNITORE') {
    return <ProviderOnboardingWizard />
  }
  // ADMIN / ruoli residui: form minimale (nome + telefono).
  return <GenericOnboardingForm />
}
