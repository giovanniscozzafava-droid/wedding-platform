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
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const ROLE_LABEL: Record<string, string> = {
  WEDDING_PLANNER: 'Wedding Planner',
  LOCATION: 'Location',
  FORNITORE: 'Fornitore',
  ADMIN: 'Admin',
}

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard }

const NAV_BASE: NavItem[] = [
  { to: '/',           label: 'Dashboard', icon: LayoutDashboard },
  { to: '/catalog',    label: 'Catalogo',  icon: PackageSearch },
]

const NAV_CAPOSTIPITE: NavItem[] = [
  { to: '/weddings',   label: 'Matrimoni', icon: Heart },
  { to: '/suppliers',  label: 'Rete fornitori', icon: UsersIcon },
]

const NAV_TAIL: NavItem[] = [
  { to: '/calendar',   label: 'Calendario', icon: CalendarDays },
  { to: '/quotes',     label: 'Preventivi', icon: FileText },
  { to: '/settings/brand', label: 'Brand', icon: Palette },
  { to: '/profile',    label: 'Profilo',  icon: UserRound },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const nav = useNavigate()

  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'
  const NAV = isCapostipite ? [...NAV_BASE, ...NAV_CAPOSTIPITE, ...NAV_TAIL] : [...NAV_BASE, ...NAV_TAIL]

  const initials =
    (profile?.full_name ?? user?.email ?? '?')
      .split(/\s+|@/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]!.toUpperCase())
      .join('') || '?'

  const avatarUrl = user
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/brand-assets/${user.id}/avatar.jpg`
    : null

  async function handleLogout() {
    await signOut()
    nav('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'rgb(var(--bg))' }}>
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <Link to="/" className="px-6 pt-6 pb-4 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
            <Sparkles size={16} strokeWidth={2.5} />
          </span>
          <span className="font-display text-lg tracking-tight" style={{ color: 'rgb(var(--fg))' }}>Planfully</span>
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
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold overflow-hidden shrink-0"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover"
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
              <div className="px-6 pt-6 pb-4 flex items-center justify-between">
                <span className="font-display text-lg">Planfully</span>
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
                    <span>{n.label}</span>
                  </NavLink>
                ))}
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar mobile */}
        <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-4 h-14 border-b backdrop-blur"
          style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev) / 0.85)' }}>
          <button onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu size={20} />
          </button>
          <Link to="/" className="font-display text-base">Planfully</Link>
          <button onClick={toggle} aria-label="Toggle theme">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </header>

        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
