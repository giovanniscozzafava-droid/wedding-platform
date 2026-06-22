import { Suspense, useEffect } from 'react'
import { lazyWithRetry } from '@/lib/lazyWithRetry'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import { HelpModeProvider } from '@/lib/helpMode'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { CookieBanner } from '@/components/CookieBanner'
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary'

// Eager: pagine sul critical path (auth + home pubblica + dashboard interna).
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import PublicHomePage from '@/pages/public/PublicHomePage'

// Lazy: tutto il resto (60+ pagine). Scaricate on-demand.
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/auth/ResetPasswordPage'))
const OnboardingPage = lazyWithRetry(() => import('@/pages/auth/OnboardingPage'))
const ProfilePage = lazyWithRetry(() => import('@/pages/auth/ProfilePage'))
const CatalogPage = lazyWithRetry(() => import('@/pages/CatalogPage'))
const FoodCostPage = lazyWithRetry(() => import('@/pages/FoodCostPage'))
const ProvaMenuVote = lazyWithRetry(() => import('@/pages/ProvaMenuVote'))
const SupplierAssetsPage = lazyWithRetry(() => import('@/pages/SupplierAssetsPage'))
const CalendarPage = lazyWithRetry(() => import('@/pages/CalendarPage'))
const SuppliersPage = lazyWithRetry(() => import('@/pages/SuppliersPage'))
const SupplierDetailPage = lazyWithRetry(() => import('@/pages/SupplierDetailPage'))
const QuotesPage = lazyWithRetry(() => import('@/pages/QuotesPage'))
const QuoteEditorPage = lazyWithRetry(() => import('@/pages/QuoteEditorPage'))
const ContractsPage = lazyWithRetry(() => import('@/pages/ContractsPage'))
const SupplierContractsPage = lazyWithRetry(() => import('@/pages/SupplierContractsPage'))
const FinancePage = lazyWithRetry(() => import('@/pages/FinancePage'))
const BilancioPage = lazyWithRetry(() => import('@/pages/BilancioPage'))
const InsurancePage = lazyWithRetry(() => import('@/pages/InsurancePage'))
const BrandSettingsPage = lazyWithRetry(() => import('@/pages/BrandSettingsPage'))
const QuotePreviewPage = lazyWithRetry(() => import('@/pages/public/QuotePreviewPage'))
const QuoteAcceptPage = lazyWithRetry(() => import('@/pages/public/QuoteAcceptPage'))
const QuoteRejectPage = lazyWithRetry(() => import('@/pages/public/QuoteRejectPage'))
const ContractSignPage = lazyWithRetry(() => import('@/pages/public/ContractSignPage'))
const AddendumSignPage = lazyWithRetry(() => import('@/pages/public/AddendumSignPage'))
const WeddingSitePage = lazyWithRetry(() => import('@/pages/public/WeddingSitePage'))
const WeddingsPage = lazyWithRetry(() => import('@/pages/WeddingsPage'))
const WeddingDashboard = lazyWithRetry(() => import('@/pages/wedding/WeddingDashboard'))
const CoupleDashboard = lazyWithRetry(() => import('@/pages/couple/CoupleDashboard'))
const CoupleAcceptPage = lazyWithRetry(() => import('@/pages/couple/CoupleAcceptPage'))
const SupplierInviteAcceptPage = lazyWithRetry(() => import('@/pages/public/SupplierInviteAcceptPage'))
const CapostipiteInviteAcceptPage = lazyWithRetry(() => import('@/pages/public/CapostipiteInviteAcceptPage'))
const CoupleInviteAcceptPage = lazyWithRetry(() => import('@/pages/public/CoupleInviteAcceptPage'))
const PrivacyPage = lazyWithRetry(() => import('@/pages/public/PrivacyPage'))
const CookiePage = lazyWithRetry(() => import('@/pages/public/CookiePage'))
const DiscoverPage = lazyWithRetry(() => import('@/pages/public/DiscoverPage'))
const PublicSupplierPage = lazyWithRetry(() => import('@/pages/public/PublicSupplierPage'))
const BlogListPage = lazyWithRetry(() => import('@/pages/public/BlogListPage'))
const BlogPostPage = lazyWithRetry(() => import('@/pages/public/BlogPostPage'))
const BlogAdminPage = lazyWithRetry(() => import('@/pages/BlogAdminPage'))
const BlogEditorPage = lazyWithRetry(() => import('@/pages/BlogEditorPage'))
const HomeFeedPage = lazyWithRetry(() => import('@/pages/HomeFeedPage'))
const PublicWpPage = lazyWithRetry(() => import('@/pages/public/PublicWpPage'))
const EmbedLeadPage = lazyWithRetry(() => import('@/pages/public/EmbedLeadPage'))
const IntegrationsPage = lazyWithRetry(() => import('@/pages/IntegrationsPage'))
const ClientPortalPage = lazyWithRetry(() => import('@/pages/client/ClientPortalPage'))
const ClientAccessPage = lazyWithRetry(() => import('@/pages/client/ClientAccessPage'))
const SupplierTeamPage = lazyWithRetry(() => import('@/pages/SupplierTeamPage'))
const AlbumDesignerPage = lazyWithRetry(() => import('@/pages/AlbumDesignerPage'))
const VideoReviewPage = lazyWithRetry(() => import('@/pages/VideoReviewPage'))
const SupplierLeadsPage = lazyWithRetry(() => import('@/pages/SupplierLeadsPage'))
const SupplierPendingPage = lazyWithRetry(() => import('@/pages/SupplierPendingPage'))
const SupplierReviewItemsPage = lazyWithRetry(() => import('@/pages/SupplierReviewItemsPage'))
const SupplierCreditsPage = lazyWithRetry(() => import('@/pages/SupplierCreditsPage'))
const PublicSlugResolver = lazyWithRetry(() => import('@/pages/public/PublicSlugResolver'))
const GuestGalleryPage = lazyWithRetry(() => import('@/pages/GuestGalleryPage'))
const WpLeadsPage = lazyWithRetry(() => import('@/pages/WpLeadsPage'))
const DiscoverProsPage = lazyWithRetry(() => import('@/pages/public/DiscoverProsPage'))
const FeedArticlePage = lazyWithRetry(() => import('@/pages/public/FeedArticlePage'))
const FeedArticleEditorPage = lazyWithRetry(() => import('@/pages/FeedArticleEditorPage'))
const NetworkRewardsPage = lazyWithRetry(() => import('@/pages/NetworkRewardsPage'))
const NetworkOutreachPage = lazyWithRetry(() => import('@/pages/NetworkOutreachPage'))
const CompositionCalculatorPage = lazyWithRetry(() => import('@/pages/CompositionCalculatorPage'))
const SupplierClientsPage = lazyWithRetry(() => import('@/pages/SupplierClientsPage'))
const SupplierCapostipitiPage = lazyWithRetry(() => import('@/pages/SupplierCapostipitiPage'))
const FaqPage = lazyWithRetry(() => import('@/pages/FaqPage'))
const SupportPage = lazyWithRetry(() => import('@/pages/SupportPage'))
const AdminSupportPage = lazyWithRetry(() => import('@/pages/AdminSupportPage'))
const AdminPage = lazyWithRetry(() => import('@/pages/AdminPage'))
const AdminFinancePage = lazyWithRetry(() => import('@/pages/AdminFinancePage'))

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
        <HelpModeProvider>
        <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/prova-menu/:token" element={<ProvaMenuVote />} />
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
          <Route path="/food-cost" element={<RequireAuth roles={['LOCATION', 'ADMIN']}><FoodCostPage /></RequireAuth>} />
          <Route path="/stili" element={<RequireAuth roles={['FORNITORE', 'WEDDING_PLANNER', 'LOCATION', 'ADMIN']}><SupplierAssetsPage /></RequireAuth>} />
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
              <RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'FORNITORE', 'ADMIN']}>
                <WeddingsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/weddings/:id"
            element={
              <RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'FORNITORE', 'ADMIN']}>
                <WeddingDashboard />
              </RequireAuth>
            }
          />
          <Route path="/p/preview/:token" element={<QuotePreviewPage />} />
          <Route path="/p/accept/:token" element={<QuoteAcceptPage />} />
          <Route path="/p/reject/:token" element={<QuoteRejectPage />} />
          <Route path="/p/contract/:token" element={<ContractSignPage />} />
          <Route path="/p/addendum/:token" element={<AddendumSignPage />} />
          <Route path="/w/:slug" element={<WeddingSitePage />} />
          <Route path="/couple/accept/:token" element={
            <RequireAuth bare><CoupleAcceptPage /></RequireAuth>
          } />
          <Route path="/invito-fornitore/:token" element={<SupplierInviteAcceptPage />} />
          <Route path="/invito-capostipite/:token" element={<CapostipiteInviteAcceptPage />} />
          <Route path="/invito-coppia/:token" element={<CoupleInviteAcceptPage />} />
          <Route path="/galleria/:galleryId" element={<GuestGalleryPage />} />
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
          <Route path="/recruiting" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN']}><NetworkOutreachPage /></RequireAuth>} />
          <Route path="/blog" element={<BlogListPage />} />
          <Route path="/blog/admin" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN']}><BlogAdminPage /></RequireAuth>} />
          <Route path="/blog/nuovo" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN']}><BlogEditorPage /></RequireAuth>} />
          <Route path="/blog/modifica/:id" element={<RequireAuth roles={['WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN']}><BlogEditorPage /></RequireAuth>} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/calcolatore" element={<RequireAuth><CompositionCalculatorPage /></RequireAuth>} />
          {/* Disponibilità accorpata nel Calendario (gestione appuntamenti/blocchi). */}
          <Route path="/disponibilita" element={<Navigate to="/calendar" replace />} />
          <Route path="/clienti" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierClientsPage /></RequireAuth>} />
          <Route path="/capostipiti" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierCapostipitiPage /></RequireAuth>} />
          <Route path="/team" element={<RequireAuth roles={['FORNITORE', 'WEDDING_PLANNER', 'LOCATION', 'ADMIN']}><SupplierTeamPage /></RequireAuth>} />
          {/* Impaginatore album: fotografo (owner galleria), sposi e admin — gating via RLS */}
          <Route path="/album/:entryId" element={<RequireAuth roles={['FORNITORE', 'WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'COUPLE']}><AlbumDesignerPage /></RequireAuth>} />
          {/* Revisione video del videomaker: consegna + post-it temporizzati del cliente */}
          <Route path="/video/:entryId" element={<RequireAuth roles={['FORNITORE', 'WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'COUPLE']}><VideoReviewPage /></RequireAuth>} />
          <Route path="/crediti" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierCreditsPage /></RequireAuth>} />
          <Route path="/richieste" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierLeadsPage /></RequireAuth>} />
          <Route path="/lavori-da-confermare" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierPendingPage /></RequireAuth>} />
          <Route path="/voci-da-rivedere" element={<RequireAuth roles={['FORNITORE', 'ADMIN']}><SupplierReviewItemsPage /></RequireAuth>} />
          <Route path="/integrazione-sito" element={<RequireAuth roles={['WEDDING_PLANNER', 'LOCATION', 'FORNITORE', 'ADMIN']}><IntegrationsPage /></RequireAuth>} />
          <Route path="/faq" element={<RequireAuth><FaqPage /></RequireAuth>} />
          <Route path="/assistenza" element={<RequireAuth><SupportPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="/admin/assistenza" element={<RequireAuth><AdminSupportPage /></RequireAuth>} />
          <Route path="/admin/finance" element={<RequireAuth><AdminFinancePage /></RequireAuth>} />
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
        </RouteErrorBoundary>
        <CookieBanner />
        </HelpModeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

function HomeOrPublicHome() {
  const { user, profile, loading } = useAuth()
  const isGuest = profile?.role === 'GUEST'
  // L'OSPITE che esce dal suo perimetro (clic sul logo/home) viene DISCONNESSO e finisce
  // sulla landing pubblica. Per rientrare torna sul link della galleria e riscrive nome+email.
  useEffect(() => { if (isGuest) void supabase.auth.signOut() }, [isGuest])
  if (loading) return null
  if (!user || isGuest) return <PublicHomePage />
  return (
    <RequireAuth>
      <HomePage />
    </RequireAuth>
  )
}
