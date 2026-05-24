import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/lib/auth'
import { RequireAuth } from '@/components/auth/RequireAuth'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import OnboardingPage from '@/pages/auth/OnboardingPage'
import ProfilePage from '@/pages/auth/ProfilePage'
import CatalogPage from '@/pages/CatalogPage'
import CalendarPage from '@/pages/CalendarPage'
import SuppliersPage from '@/pages/SuppliersPage'
import SupplierDetailPage from '@/pages/SupplierDetailPage'
import QuotesPage from '@/pages/QuotesPage'
import QuoteEditorPage from '@/pages/QuoteEditorPage'
import FinancePage from '@/pages/FinancePage'
import InsurancePage from '@/pages/InsurancePage'
import BrandSettingsPage from '@/pages/BrandSettingsPage'
import QuotePreviewPage from '@/pages/public/QuotePreviewPage'
import QuoteAcceptPage from '@/pages/public/QuoteAcceptPage'
import QuoteRejectPage from '@/pages/public/QuoteRejectPage'
import ContractSignPage from '@/pages/public/ContractSignPage'
import WeddingSitePage from '@/pages/public/WeddingSitePage'
import WeddingsPage from '@/pages/WeddingsPage'
import WeddingDashboard from '@/pages/wedding/WeddingDashboard'
import CoupleDashboard from '@/pages/couple/CoupleDashboard'
import CoupleAcceptPage from '@/pages/couple/CoupleAcceptPage'
import SupplierInviteAcceptPage from '@/pages/public/SupplierInviteAcceptPage'
import CoupleInviteAcceptPage from '@/pages/public/CoupleInviteAcceptPage'
import PrivacyPage from '@/pages/public/PrivacyPage'
import CookiePage from '@/pages/public/CookiePage'
import CompositionCalculatorPage from '@/pages/CompositionCalculatorPage'
import SupplierAvailabilityPage from '@/pages/SupplierAvailabilityPage'
import { CookieBanner } from '@/components/CookieBanner'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <OnboardingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/catalog"
            element={
              <RequireAuth>
                <CatalogPage />
              </RequireAuth>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'ADMIN']}>
                <SuppliersPage />
              </RequireAuth>
            }
          />
          <Route
            path="/suppliers/:id"
            element={
              <RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'ADMIN']}>
                <SupplierDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/calendar"
            element={
              <RequireAuth>
                <CalendarPage />
              </RequireAuth>
            }
          />
          <Route
            path="/quotes"
            element={
              <RequireAuth>
                <QuotesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/quotes/:id"
            element={
              <RequireAuth>
                <QuoteEditorPage />
              </RequireAuth>
            }
          />
          <Route
            path="/settings/brand"
            element={
              <RequireAuth>
                <BrandSettingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/weddings"
            element={
              <RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'ADMIN']}>
                <WeddingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/weddings/:id"
            element={
              <RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'ADMIN']}>
                <WeddingDashboard />
              </RequireAuth>
            }
          />
          <Route path="/p/preview/:token" element={<QuotePreviewPage />} />
          <Route path="/p/accept/:token" element={<QuoteAcceptPage />} />
          <Route path="/p/reject/:token" element={<QuoteRejectPage />} />
          <Route path="/p/contract/:token" element={<ContractSignPage />} />
          <Route path="/w/:slug" element={<WeddingSitePage />} />
          <Route path="/couple/accept/:token" element={
            <RequireAuth bare><CoupleAcceptPage /></RequireAuth>
          } />
          <Route path="/invito-fornitore/:token" element={<SupplierInviteAcceptPage />} />
          <Route path="/invito-coppia/:token" element={<CoupleInviteAcceptPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/cookie" element={<CookiePage />} />
          <Route path="/calcolatore" element={<RequireAuth><CompositionCalculatorPage /></RequireAuth>} />
          <Route path="/disponibilita" element={<RequireAuth><SupplierAvailabilityPage /></RequireAuth>} />
          <Route path="/finanziamento" element={<RequireAuth><FinancePage /></RequireAuth>} />
          <Route path="/assicurazione" element={<RequireAuth><InsurancePage /></RequireAuth>} />
          <Route path="/couple" element={
            <RequireAuth bare roles={['COUPLE', 'ADMIN']}><CoupleDashboard /></RequireAuth>
          } />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <CookieBanner />
      </AuthProvider>
    </BrowserRouter>
  )
}
