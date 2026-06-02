import { type ReactNode, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  PackageSearch,
  CalendarDays,
  FileText,
  Palette,
  UserRound,
  Users as UsersIcon,
  Heart,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Calculator,
  Wallet,
  PiggyBank,
  ShieldCheck,
  FileSignature,
  Contact,
  HelpCircle,
  Sparkles,
  PenSquare,
  Newspaper,
  Inbox,
  Gift,
  Code2,
  Coins,
  CheckSquare,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppFooter } from '@/components/layout/AppFooter'
import { CandidacyInbox } from '@/components/social/CandidacyInbox'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { BetaBanner } from '@/components/BetaBanner'
import { ConflictAlertsBanner } from '@/components/ConflictAlertsBanner'
import { SupplierTutorialCards } from '@/components/SupplierTutorialCards'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  WEDDING_PLANNER: 'Wedding Planner',
  LOCATION: 'Location',
  FORNITORE: 'Fornitore',
  ADMIN: 'Admin',
}

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; badge?: string }
type NavGroup = { section: string | null; items: NavItem[] }

// ── Menu CAPOSTIPITE (WP / LOCATION / ADMIN) ──────────────────────────────
// Ordine = flusso di lavoro reale: Lead → Evento → Preventivo → Contratto.
// I gruppi raccontano "dove sei" nel ciclo: prima vendi, poi gestisci la
// tua rete e cresci, infine le impostazioni.
const NAV_CAPOSTIPITE_GROUPS: NavGroup[] = [
  { section: null, items: [
    { to: '/',          label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Pipeline', items: [
    { to: '/leads',     label: 'Lead',       icon: Inbox },
    { to: '/weddings',  label: 'Eventi',     icon: Heart },
    { to: '/quotes',    label: 'Preventivi', icon: FileText },
    { to: '/contracts', label: 'Contratti',  icon: FileSignature },
  ]},
  { section: 'Catalogo & rete', items: [
    { to: '/catalog',   label: 'Catalogo',       icon: PackageSearch },
    { to: '/suppliers', label: 'Rete fornitori', icon: UsersIcon },
    { to: '/scopri',    label: 'Scopri',         icon: Sparkles },
  ]},
  { section: 'Crescita', items: [
    { to: '/feed',       label: 'Feed',    icon: Newspaper },
    { to: '/blog/admin', label: 'Blog',    icon: PenSquare },
    { to: '/rewards',    label: 'Rewards', icon: Gift },
  ]},
  { section: 'Gestione', items: [
    { to: '/calendar', label: 'Calendario', icon: CalendarDays },
    { to: '/team',     label: 'Team',       icon: UsersIcon },
    { to: '/bilancio', label: 'Bilancio',   icon: PiggyBank },
  ]},
  { section: 'Impostazioni', items: [
    { to: '/settings/brand',   label: 'Brand',            icon: Palette },
    { to: '/integrazione-sito', label: 'Integrazione sito', icon: Code2 },
    { to: '/profile',          label: 'Profilo',          icon: UserRound },
    { to: '/faq',              label: 'FAQ',              icon: HelpCircle },
  ]},
  { section: 'Prodotti (presto)', items: [
    { to: '/finanziamento', label: 'Finanziamento', icon: Wallet,      badge: 'SOON' },
    { to: '/assicurazione', label: 'Assicurazione', icon: ShieldCheck, badge: 'SOON' },
  ]},
]

// ── Menu FORNITORE ────────────────────────────────────────────────────────
// Stesso principio: prima i clienti/capostipiti e la vendita, poi catalogo e
// disponibilità, infine crescita e impostazioni.
const NAV_FORNITORE_GROUPS: NavGroup[] = [
  { section: null, items: [
    { to: '/',           label: 'Dashboard', icon: LayoutDashboard },
  ]},
  { section: 'Pipeline', items: [
    { to: '/richieste',   label: 'Richieste',   icon: Inbox },
    { to: '/capostipiti', label: 'Capostipiti', icon: UsersIcon },
    { to: '/clienti',     label: 'Clienti',     icon: Contact },
    { to: '/quotes',      label: 'Preventivi',  icon: FileText },
    { to: '/lavori-da-confermare', label: 'Da confermare', icon: CheckSquare },
    { to: '/my-contracts', label: 'Contratti',  icon: FileSignature },
  ]},
  { section: 'Catalogo & lavoro', items: [
    { to: '/catalog',      label: 'Catalogo',      icon: PackageSearch },
    { to: '/team',         label: 'Team',          icon: UsersIcon },
    { to: '/calcolatore',  label: 'Calcolatore',   icon: Calculator },
  ]},
  { section: 'Crescita', items: [
    { to: '/feed', label: 'Feed', icon: Newspaper },
    { to: '/scopri', label: 'Scopri fornitori', icon: Sparkles },
    { to: '/crediti', label: 'Crediti rete', icon: Coins },
  ]},
  { section: 'Gestione', items: [
    { to: '/calendar', label: 'Calendario', icon: CalendarDays },
    { to: '/bilancio', label: 'Bilancio',   icon: PiggyBank },
  ]},
  { section: 'Impostazioni', items: [
    { to: '/settings/brand',   label: 'Brand',            icon: Palette },
    { to: '/integrazione-sito', label: 'Integrazione sito', icon: Code2 },
    { to: '/profile',          label: 'Profilo',          icon: UserRound },
    { to: '/faq',              label: 'FAQ',              icon: HelpCircle },
  ]},
]

// Fallback (ruolo non noto): solo l'essenziale.
const NAV_FALLBACK_GROUPS: NavGroup[] = [
  { section: null, items: [
    { to: '/',        label: 'Dashboard', icon: LayoutDashboard },
    { to: '/feed',    label: 'Feed',      icon: Newspaper },
    { to: '/catalog', label: 'Catalogo',  icon: PackageSearch },
  ]},
  { section: 'Impostazioni', items: [
    { to: '/profile', label: 'Profilo', icon: UserRound },
    { to: '/faq',     label: 'FAQ',     icon: HelpCircle },
  ]},
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = useNavigate()

  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'
  const isFornitore = profile?.role === 'FORNITORE'
  const NAV_GROUPS = isCapostipite
    ? NAV_CAPOSTIPITE_GROUPS
    : isFornitore
    ? NAV_FORNITORE_GROUPS
    : NAV_FALLBACK_GROUPS

  const initials =
    (profile?.full_name ?? user?.email ?? '?')
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join('') || '?'

  const avatarUrl = profile?.brand_logo_url ?? null

  async function handleLogout() {
    await signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: 'rgb(var(--bg))' }}>
      {/* Sidebar desktop — fissa, no scroll con la pagina */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r h-screen sticky top-0" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2" style={{ color: 'rgb(var(--fg))' }}>
            <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" style={{ color: 'rgb(var(--fg))' }} />
            <span className="font-display text-lg tracking-tight">Planfully</span>
          </Link>
          <NotificationBell align="start" />
          <CandidacyInbox placement="beside" />
        </div>

        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <NavGroups groups={NAV_GROUPS} />
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden shrink-0 p-0.5"
              style={{ background: avatarUrl ? 'white' : 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="max-h-full max-w-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--fg))' }}>
                {profile?.full_name ?? user?.email}
              </p>
              <p className="text-xs truncate" style={{ color: 'rgb(var(--fg-subtle))' }}>
                {ROLE_LABEL[profile?.role ?? ''] ?? '...'}
              </p>
            </div>
          </div>
          <div className="mt-1 flex items-center gap-1">
            <button onClick={toggle} aria-label="Toggle theme"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors hover:bg-[rgb(var(--bg-sunken))]"
              style={{ color: 'rgb(var(--fg-muted))' }}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
              <span>{theme === 'light' ? 'Scuro' : 'Chiaro'}</span>
            </button>
            <button onClick={handleLogout} aria-label="Esci" data-testid="logout-btn"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-colors hover:bg-[rgb(var(--rose-100))]"
              style={{ color: 'rgb(var(--fg-muted))' }}>
              <LogOut size={14} />
              <span>Esci</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 z-50 flex"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 24, stiffness: 240 }}
              className="relative w-72 flex flex-col"
              style={{ background: 'rgb(var(--bg-elev))', borderRight: '1px solid rgb(var(--border))' }}>
              <div className="px-6 pt-6 pb-4 flex items-center justify-between" style={{ color: 'rgb(var(--fg))' }}>
                <span className="font-display text-lg flex items-center gap-2">
                  <img src="/brand/planfully-symbol.svg" alt="" className="h-7 w-7" />
                  Planfully
                </span>
                <button onClick={() => setMobileOpen(false)} aria-label="Chiudi">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 px-3 py-2 overflow-y-auto">
                <NavGroups groups={NAV_GROUPS} onNavigate={() => setMobileOpen(false)} />
              </nav>
              {/* Mobile drawer footer: user + logout */}
              <div className="p-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="flex items-center gap-3 px-2 py-2 mb-2">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden shrink-0 p-0.5"
                    style={{ background: avatarUrl ? 'white' : 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : (<span>{initials}</span>)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--fg))' }}>
                      {profile?.full_name ?? user?.email}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'rgb(var(--fg-subtle))' }}>
                      {ROLE_LABEL[profile?.role ?? ''] ?? '...'}
                    </p>
                  </div>
                </div>
                <button onClick={() => { setMobileOpen(false); void handleLogout() }} data-testid="mobile-logout-btn"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium hover:bg-[rgb(var(--rose-100))]"
                  style={{ color: 'rgb(var(--rose-500))' }}>
                  <LogOut size={14} />
                  <span>Esci</span>
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area — scrollabile indipendentemente dalla sidebar fissa */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 h-14 border-b backdrop-blur"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev) / 0.85)' }}>
          <button onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <Link to="/" className="font-display text-base flex items-center gap-2" style={{ color: 'rgb(var(--fg))' }}>
            <img src="/brand/planfully-symbol.svg" alt="" className="h-6 w-6" />
            Planfully
          </Link>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <CandidacyInbox />
            <button onClick={toggle} aria-label="Toggle theme">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0 flex flex-col">
          <BetaBanner />
          <ConflictAlertsBanner />
          <div className="flex-1">
            {children}
          </div>
          <AppFooter />
        </main>
      </div>
      <SupplierTutorialCards />
    </div>
  )
}

function NavGroups({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div key={g.section ?? `g${gi}`} className="space-y-0.5">
          {g.section && (
            <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[rgb(var(--fg-subtle))]">
              {g.section}
            </p>
          )}
          {g.items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg))]'
                    : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] hover:text-[rgb(var(--fg))]',
                )
              }
            >
              <n.icon size={18} strokeWidth={1.8} />
              <span className="flex-1">{n.label}</span>
              {n.badge && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] tracking-widest">{n.badge}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  )
}
