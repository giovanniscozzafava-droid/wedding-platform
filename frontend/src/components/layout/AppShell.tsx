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
  CalendarCheck,
  Wallet,
  ShieldCheck,
  FileSignature,
  Contact,
  HelpCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppFooter } from '@/components/layout/AppFooter'
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

const NAV_BASE: NavItem[] = [
  { to: '/',           label: 'Dashboard', icon: LayoutDashboard },
  { to: '/catalog',    label: 'Catalogo',  icon: PackageSearch },
]

const NAV_CAPOSTIPITE: NavItem[] = [
  { to: '/weddings',   label: 'Matrimoni', icon: Heart },
  { to: '/suppliers',  label: 'Rete fornitori', icon: UsersIcon },
]

// Voci di coda comuni a tutti i ruoli
const NAV_TAIL_COMMON: NavItem[] = [
  { to: '/calendar',   label: 'Calendario', icon: CalendarDays },
  { to: '/quotes',     label: 'Preventivi', icon: FileText },
  { to: '/contracts',  label: 'Contratti',  icon: FileSignature },
  { to: '/settings/brand', label: 'Brand', icon: Palette },
  { to: '/profile',    label: 'Profilo',  icon: UserRound },
  { to: '/faq',        label: 'FAQ',       icon: HelpCircle },
]

// Voci esclusive WP/LOCATION (riservate al cliente finale, non ai fornitori)
const NAV_TAIL_CLIENT_PRODUCTS: NavItem[] = [
  { to: '/finanziamento', label: 'Finanziamento', icon: Wallet, badge: 'SOON' },
  { to: '/assicurazione', label: 'Assicurazione', icon: ShieldCheck, badge: 'SOON' },
]

const NAV_FORN: NavItem[] = [
  { to: '/clienti', label: 'Clienti', icon: Contact },
  { to: '/disponibilita', label: 'Disponibilità', icon: CalendarCheck },
  { to: '/calcolatore', label: 'Calcolatore', icon: Calculator },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = useNavigate()

  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'
  const isFornitore = profile?.role === 'FORNITORE'
  const NAV = isCapostipite
    ? [...NAV_BASE, ...NAV_CAPOSTIPITE, ...NAV_TAIL_COMMON, ...NAV_TAIL_CLIENT_PRODUCTS]
    : isFornitore
    ? [...NAV_BASE, ...NAV_FORN, ...NAV_TAIL_COMMON]
    : [...NAV_BASE, ...NAV_TAIL_COMMON]

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
        <Link to="/" className="px-6 pt-6 pb-4 flex items-center gap-2" style={{ color: 'rgb(var(--fg))' }}>
          <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8" style={{ color: 'rgb(var(--fg))' }} />
          <span className="font-display text-lg tracking-tight">Planfully</span>
        </Link>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
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
              <nav className="flex-1 px-3 py-2 space-y-0.5">
                {NAV.map((n) => (
                  <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                        isActive ? 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg-muted))]',
                      )
                    }>
                    <n.icon size={18} strokeWidth={1.8} />
                    <span className="flex-1">{n.label}</span>
                    {n.badge && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] tracking-widest">{n.badge}</span>}
                  </NavLink>
                ))}
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
          <button onClick={toggle} aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
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
