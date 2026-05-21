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
import QuotesPage from '@/pages/QuotesPage'
import QuoteEditorPage from '@/pages/QuoteEditorPage'
import BrandSettingsPage from '@/pages/BrandSettingsPage'
import QuotePreviewPage from '@/pages/public/QuotePreviewPage'
import QuoteAcceptPage from '@/pages/public/QuoteAcceptPage'
import QuoteRejectPage from '@/pages/public/QuoteRejectPage'

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
          <Route path="/p/preview/:token" element={<QuotePreviewPage />} />
          <Route path="/p/accept/:token" element={<QuoteAcceptPage />} />
          <Route path="/p/reject/:token" element={<QuoteRejectPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  )
}
