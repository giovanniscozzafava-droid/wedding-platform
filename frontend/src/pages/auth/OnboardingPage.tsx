import { useAuth } from '@/lib/auth'
import { ProviderOnboardingWizard } from './ProviderOnboardingWizard'
import { CoupleOnboardingWizard } from './CoupleOnboardingWizard'
import { GenericOnboardingForm } from './GenericOnboardingForm'

export default function OnboardingPage() {
  const { profile } = useAuth()
  if (!profile) return null
  const role = profile.role
  if (role === 'WEDDING_PLANNER' || role === 'LOCATION' || role === 'FORNITORE') {
    return <ProviderOnboardingWizard />
  }
  if (role === 'COUPLE') {
    return <CoupleOnboardingWizard />
  }
  return <GenericOnboardingForm />
}
