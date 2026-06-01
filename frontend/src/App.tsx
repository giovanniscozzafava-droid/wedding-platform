import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { CookieBanner } from '@/components/CookieBanner'

// Eager: pagine sul critical path (auth + home pubblica + dashboard interna).
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import PublicHomePage from '@/pages/public/PublicHomePage'

// Lazy: tutto il resto (60+ pagine). Scaricate on-demand.
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const OnboardingPage = lazy(() => import('@/pages/auth/OnboardingPage'))
const ProfilePage = lazy(() => import('@/pages/auth/ProfilePage'))
const CatalogPage = lazy(() => import('@/pages/CatalogPage'))
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const SuppliersPage = lazy(() => import('@/pages/SuppliersPage'))
const SupplierDetailPage = lazy(() => import('@/pages/SupplierDetailPage'))
const QuotesPage = lazy(() => import('@/pages/QuotesPage'))
const QuoteEditorPage = lazy(() => import('@/pages/QuoteEditorPage'))
const ContractsPage = lazy(() => import('@/pages/ContractsPage'))
const SupplierContractsPage = lazy(() => import('@/pages/SupplierContractsPage'))
const FinancePage = lazy(() => import('@/pages/FinancePage'))
const BilancioPage = lazy(() => import('@/pages/BilancioPage'))
const InsurancePage = lazy(() => import('@/pages/InsurancePage'))
const BrandSettingsPage = lazy(() => import('@/pages/BrandSettingsPage'))
const QuotePreviewPage = lazy(() => import('@/pages/public/QuotePreviewPage'))
const QuoteAcceptPage = lazy(() => import('@/pages/public/QuoteAcceptPage'))
const QuoteRejectPage = lazy(() => import('@/pages/public/QuoteRejectPage'))
const ContractSignPage = lazy(() => import('@/pages/public/ContractSignPage'))
const WeddingSitePage = lazy(() => import('@/pages/public/WeddingSitePage'))
const WeddingsPage = lazy(() => import('@/pages/WeddingsPage'))
const WeddingDashboard = lazy(() => import('@/pages/wedding/WeddingDashboard'))
const CoupleDashboard = lazy(() => import('@/pages/couple/CoupleDashboard'))
const CoupleAcceptPage = lazy(() => import('@/pages/couple/CoupleAcceptPage'))
const SupplierInviteAcceptPage = lazy(() => import('@/pages/public/SupplierInviteAcceptPage'))
const CapostipiteInviteAcceptPage = lazy(() => import('@/pages/public/CapostipiteInviteAcceptPage'))
const CoupleInviteAcceptPage = lazy(() => import('@/pages/public/CoupleInviteAcceptPage'))
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'))
const CookiePage = lazy(() => import('@/pages/public/CookiePage'))
const DiscoverPage = lazy(() => import('@/pages/public/DiscoverPage'))
const PublicSupplierPage = lazy(() => import('@/pages/public/PublicSupplierPage'))
const BlogListPage = lazy(() => import('@/pages/public/BlogListPage'))
const BlogPostPage = lazy(() => import('@/pages/public/BlogPostPage'))
const BlogAdminPage = lazy(() => import('@/pages/BlogAdminPage'))
const BlogEditorPage = lazy(() => import('@/pages/BlogEditorPage'))
const HomeFeedPage = lazy(() => import('@/pages/HomeFeedPage'))
const PublicWpPage = lazy(() => import('@/pages/public/PublicWpPage'))
const EmbedLeadPage = lazy(() => import('@/pages/public/EmbedLeadPage'))
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'))
const ClientPortalPage = lazy(() => import('@/pages/client/ClientPortalPage'))
const ClientAccessPage = lazy(() => import('@/pages/client/ClientAccessPage'))
const SupplierTeamPage = lazy(() => import('@/pages/SupplierTeamPage'))
const SupplierLeadsPage = lazy(() => import('@/pages/SupplierLeadsPage'))
const PublicSlugResolver = lazy(() => import('@/pages/public/PublicSlugResolver'))
const WpLeadsPage = lazy(() => import('@/pages/WpLeadsPage'))
const DiscoverProsPage = lazy(() => import('@/pages/public/DiscoverProsPage'))
const FeedArticlePage = lazy(() => import('@/pages/public/FeedArticlePage'))
const FeedArticleEditorPage = lazy(() => import('@/pages/FeedArticleEditorPage'))
const NetworkRewardsPage = lazy(() => import('@/pages/NetworkRewardsPage'))
const CompositionCalculatorPage = lazy(() => import('@/pages/CompositionCalculatorPage'))
const SupplierAvailabilityPage = lazy(() => import('@/pages/SupplierAvailabilityPage'))
const SupplierClientsPage = lazy(() => import('@/pages/SupplierClientsPage'))
const SupplierCapostipitiPage = lazy(() => import('@/pages/SupplierCapostipitiPage'))
const FaqPage = lazy(() => import('@/pages/FaqPage'))

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
      <div className="text-sm text-[rgb(var(--fg-subtle))]">Caricamento…</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
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
            path="/contracts"
            element={
              <RequireAuth>
                <ContractsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/my-contracts"
            element={
              <RequireAuth roles={['FORNITORE','ADMIN']}>
                <SupplierContractsPage />
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
          <Route path="/invito-capostipite/:token" element={<CapostipiteInviteAcceptPage />} />
          <Route path="/invito-coppia/:token" element={<CoupleInviteAcceptPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/cookie" element={<CookiePage />} />
          <Route path="/scopri" element={<DiscoverPage />} />
          <Route path="/p/fornitore/:slug" element={<PublicSupplierPage />} />
          <Route path="/feed" element={<RequireAuth><HomeFeedPage /></RequireAuth>} />
          <Route path="/feed/nuovo-articolo" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN']}><FeedArticleEditorPage /></RequireAuth>} />
          <Route path="/feed/modifica-articolo/:id" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN']}><FeedArticleEditorPage /></RequireAuth>} />
          <Route path="/feed/post/:slug" element={<FeedArticlePage />} />
          <Route path="/p/wp/:slug" element={<PublicWpPage />} />
          {/* Form lead embeddabile in <iframe> su siti terzi (Wix & co.) */}
          <Route path="/embed/lead/:slug" element={<EmbedLeadPage />} />
          <Route path="/embed/lead" element={<EmbedLeadPage />} />
          <Route path="/leads" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','ADMIN']}><WpLeadsPage /></RequireAuth>} />
          <Route path="/rewards" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','ADMIN']}><NetworkRewardsPage /></RequireAuth>} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/admin" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','ADMIN']}><BlogAdminPage /></RequireAuth>} />
          <Route path="/blog/nuovo" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','ADMIN']}><BlogEditorPage /></RequireAuth>} />
          <Route path="/blog/modifica/:id" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','ADMIN']}><BlogEditorPage /></RequireAuth>} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/calcolatore" element={<RequireAuth><CompositionCalculatorPage /></RequireAuth>} />
          <Route path="/disponibilita" element={<RequireAuth><SupplierAvailabilityPage /></RequireAuth>} />
          <Route path="/clienti" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierClientsPage /></RequireAuth>} />
          <Route path="/capostipiti" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierCapostipitiPage /></RequireAuth>} />
          <Route path="/team" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierTeamPage /></RequireAuth>} />
          <Route path="/richieste" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierLeadsPage /></RequireAuth>} />
          <Route path="/integrazione-sito" element={<RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'FORNITORE', 'ADMIN']}><IntegrationsPage /></RequireAuth>} />
          <Route path="/faq" element={<RequireAuth><FaqPage /></RequireAuth>} />
          <Route path="/bilancio" element={<RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'FORNITORE', 'ADMIN']}><BilancioPage /></RequireAuth>} />
          <Route path="/finanziamento" element={<RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'COUPLE']}><FinancePage /></RequireAuth>} />
          <Route path="/assicurazione" element={<RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'COUPLE']}><InsurancePage /></RequireAuth>} />
          <Route path="/couple" element={
            <RequireAuth bare roles={['COUPLE', 'ADMIN']}><CoupleDashboard /></RequireAuth>
          } />
          {/* Area cliente diretto: accesso con magic link, vista aggregata per professionista */}
          <Route path="/area-cliente/accedi" element={<ClientAccessPage />} />
          <Route path="/area-cliente" element={
            <RequireAuth bare><ClientPortalPage /></RequireAuth>
          } />
          <Route path="/" element={<HomeOrPublicHome />} />
          <Route path="/scopri-pro" element={<DiscoverProsPage />} />
          {/* URL pulito del professionista: planfully.it/<slug>. DEVE restare
              penultima (subito prima del catch-all) per non oscurare le route
              applicative. Risolve a landing WP o fornitore; slug ignoto → "/". */}
          <Route path="/:slug" element={<PublicSlugResolver />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <CookieBanner />
      </AuthProvider>
    </BrowserRouter>
  )
}

function HomeOrPublicHome() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <PublicHomePage />
  return (
    <RequireAuth>
      <HomePage />
    </RequireAuth>
  )
}
