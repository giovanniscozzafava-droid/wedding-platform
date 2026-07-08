import { type ReactNode, useState, useEffect } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard,
  PackageSearch,
  CalendarDays,
  Printer,
  FileText,
  Palette,
  Images,
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
  Carrot,
  NotebookPen,
  BarChart3,
  ShieldCheck,
  FileSignature,
  Contact,
  HelpCircle,
  LifeBuoy,
  Sparkles,
  PenSquare,
  Newspaper,
  Inbox,
  Gift,
  PhoneCall,
  Code2,
  Coins,
  CheckSquare,
  TicketPercent,
  Boxes,
  BookImage,
  BadgeEuro,
} from 'lucide-react'
import { AppFooter } from '@/components/layout/AppFooter'
import { CandidacyInbox } from '@/components/social/CandidacyInbox'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { HelpModeToggle } from '@/components/help/HelpDot'
import { ImpersonationBanner } from '@/components/ImpersonationBanner'
import { BetaBanner } from '@/components/BetaBanner'
import { ConflictAlertsBanner } from '@/components/ConflictAlertsBanner'
import { Filo } from '@/components/filo/Filo'
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
    { to: '/stili',     label: 'Portfolio',  icon: Images },
    { to: '/suppliers', label: 'Rete fornitori', icon: UsersIcon },
    { to: '/scopri',    label: 'Scopri',         icon: Sparkles },
  ]},
  { section: 'Crescita', items: [
    { to: '/feed',       label: 'Feed',    icon: Newspaper },
    { to: '/blog/admin', label: 'Blog',    icon: PenSquare },
    { to: '/recruiting', label: 'Recruiting', icon: PhoneCall },
    { to: '/rewards',    label: 'Rewards', icon: Gift },
  ]},
  { section: 'Gestione', items: [
    { to: '/calendar', label: 'Calendario', icon: CalendarDays },
    { to: '/richieste-stampa', label: 'Richieste stampa', icon: Printer },
    { to: '/team',     label: 'Team',       icon: UsersIcon },
    { to: '/bilancio', label: 'Bilancio',   icon: PiggyBank },
  ]},
  { section: 'Impostazioni', items: [
    { to: '/settings/brand',   label: 'Brand',            icon: Palette },
    { to: '/settings/incassi', label: 'Incassi',          icon: BadgeEuro },
    { to: '/integrazione-sito', label: 'Integrazione sito', icon: Code2 },
    { to: '/profile',          label: 'Profilo',          icon: UserRound },
    { to: '/assistenza',       label: 'Assistenza',       icon: LifeBuoy },
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
    { to: '/suggerimenti-ricevuti', label: 'Suggerimenti', icon: Gift },
    { to: '/capostipiti', label: 'Capostipiti', icon: UsersIcon },
    { to: '/clienti',     label: 'Clienti',     icon: Contact },
    { to: '/quotes',      label: 'Preventivi',  icon: FileText },
    { to: '/lavori-da-confermare', label: 'Da confermare', icon: CheckSquare },
    { to: '/voci-da-rivedere', label: 'Da rivedere', icon: TicketPercent },
    { to: '/my-contracts', label: 'Contratti',  icon: FileSignature },
    { to: '/weddings',    label: 'Eventi',      icon: Heart },
  ]},
  { section: 'Catalogo & lavoro', items: [
    { to: '/catalog',        label: 'Catalogo',       icon: PackageSearch },
    { to: '/album-catalogo', label: 'Catalogo album', icon: FileText },
    { to: '/stili',          label: 'Portfolio', icon: Images },
    { to: '/team',           label: 'Team',          icon: UsersIcon },
    { to: '/calcolatore',    label: 'Calcolatore',   icon: Calculator },
  ]},
  { section: 'Crescita', items: [
    { to: '/feed', label: 'Feed', icon: Newspaper },
    { to: '/blog/admin', label: 'Blog', icon: PenSquare },
    { to: '/scopri', label: 'Scopri fornitori', icon: Sparkles },
    { to: '/recruiting', label: 'Recruiting', icon: PhoneCall },
    { to: '/crediti', label: 'Crediti rete', icon: Coins },
  ]},
  { section: 'Gestione', items: [
    { to: '/calendar', label: 'Calendario', icon: CalendarDays },
    { to: '/richieste-stampa', label: 'Richieste stampa', icon: Printer },
    { to: '/bilancio', label: 'Bilancio',   icon: PiggyBank },
  ]},
  { section: 'Impostazioni', items: [
    { to: '/settings/brand',   label: 'Brand',            icon: Palette },
    { to: '/settings/incassi', label: 'Incassi',          icon: BadgeEuro },
    { to: '/settings/album-prezzi', label: 'Listino album', icon: BookImage },
    { to: '/integrazione-sito', label: 'Integrazione sito', icon: Code2 },
    { to: '/profile',          label: 'Profilo',          icon: UserRound },
    { to: '/assistenza',       label: 'Assistenza',       icon: LifeBuoy },
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
    { to: '/assistenza', label: 'Assistenza', icon: LifeBuoy },
    { to: '/faq',     label: 'FAQ',     icon: HelpCircle },
  ]},
]

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadDots, setUnreadDots] = useState<Set<string>>(new Set())
  const location = useLocation()

  // Pallino rosso accanto alla voce di menu che ha notifiche non lette: mappa il
  // `link` di ogni notifica non letta sulla voce di nav col prefisso più lungo.
  useEffect(() => {
    let alive = true
    async function loadDots() {
      try {
        const { data } = await (supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown }>)('list_notifications', { p_limit: 50 })
        const notifs = (data as Array<{ link: string | null; read_at: string | null }>) ?? []
        const tos = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.to)).filter((t) => t !== '/')
        const dots = new Set<string>()
        for (const n of notifs) {
          if (n.read_at || !n.link) continue
          const match = tos.filter((t) => n.link!.startsWith(t)).sort((a, b) => b.length - a.length)[0]
          if (match) dots.add(match)
        }
        // Promemoria recruiting: richiami scaduti → pallino su /recruiting
        try {
          const { data: due } = await (supabase.rpc as unknown as (f: string) => Promise<{ data: unknown }>)('network_recall_due_count')
          if (typeof due === 'number' && due > 0) dots.add('/recruiting')
        } catch { /* non bloccante */ }
        if (alive) setUnreadDots(dots)
      } catch { /* non bloccante */ }
    }
    void loadDots()
    const id = setInterval(loadDots, 60000)
    return () => { alive = false; clearInterval(id) }
  }, [location.pathname])
  // Mobile: chiudi SEMPRE il drawer quando cambia pagina (su Safari l'onClick del
  // link a volte non basta → il menu restava aperto e copriva la pagina).
  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  const nav = useNavigate()

  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'
  const isFornitore = profile?.role === 'FORNITORE'
  const isStaff = (profile as any)?.is_support_staff || profile?.role === 'ADMIN'
  const baseGroupsRaw0 = isCapostipite
    ? NAV_CAPOSTIPITE_GROUPS
    : isFornitore
    ? NAV_FORNITORE_GROUPS
    : NAV_FALLBACK_GROUPS
  // "Richieste stampa" è una funzione da FOTOGRAFI: via per location e ogni altro fornitore.
  const isPhotographer = isFornitore && /fotograf|video/.test((profile?.subrole ?? '').toLowerCase())
  const baseGroupsRaw = baseGroupsRaw0.map((g) => ({ ...g, items: g.items.filter((i) => i.to !== '/richieste-stampa' || isPhotographer) }))
  // Food cost: strumento gestionale SOLO per le Location (PRP-4 Fase A).
  const baseGroups = profile?.role === 'LOCATION'
    ? baseGroupsRaw.map((g) => g.section === 'Gestione'
        ? { ...g, items: [...g.items, { to: '/prima-nota', label: 'Prima nota', icon: NotebookPen }, { to: '/food-cost', label: 'Food cost', icon: Carrot }, { to: '/prove-menu', label: 'Prove menu', icon: CalendarDays }, { to: '/magazzino', label: 'Magazzino', icon: Boxes }, { to: '/ragioniere', label: 'Ragioniere', icon: Calculator }] }
        : g)
    : baseGroupsRaw
  // Studio disegno: strumento per chi fa grafica/progettazione (tutti i professionisti).
  const baseGroupsStudio = (isCapostipite || isFornitore)
    ? baseGroups.map((g, i) => (i === 0 ? { ...g, items: [...g.items, { to: '/studio', label: 'Studio disegno', icon: Palette }] } : g))
    : baseGroups
  // Gruppo riservato a staff/admin (gestione piattaforma + ticket).
  const NAV_GROUPS: NavGroup[] = isStaff
    ? [...baseGroupsStudio, { section: 'Staff', items: [
        { to: '/admin', label: 'Pannello Admin', icon: LifeBuoy },
        ...(profile?.role === 'ADMIN' ? [{ to: '/admin/osservatorio', label: 'Osservatorio', icon: BarChart3 }] : []),
        { to: '/admin/finance', label: 'Finance', icon: Wallet },
        { to: '/admin/assistenza', label: 'Ticket assistenza', icon: LifeBuoy },
      ] }]
    : baseGroupsStudio

  const initials =
    (profile?.business_name ?? profile?.full_name ?? user?.email ?? '?')
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
        <div className="px-4 pb-2"><HelpModeToggle /></div>

        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <NavGroups groups={NAV_GROUPS} dots={unreadDots} />
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
                {profile?.business_name ?? profile?.full_name ?? user?.email}
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

      {/* Mobile sidebar — SEMPRE montato, toggle via CSS. Da chiuso ha
          pointer-events-none: non può MAI restare a bloccare la pagina (niente
          race di mount/unmount delle animazioni su Safari). */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-50 transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <aside
          className={cn(
            'absolute left-0 top-0 h-full w-72 flex flex-col transition-transform duration-200 ease-out',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
          style={{ background: 'rgb(var(--bg-elev))', borderRight: '1px solid rgb(var(--border))' }}
        >
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
            <NavGroups groups={NAV_GROUPS} dots={unreadDots} onNavigate={() => setMobileOpen(false)} />
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
                  {profile?.business_name ?? profile?.full_name ?? user?.email}
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
        </aside>
      </div>

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
            <HelpModeToggle compact />
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
          {/* Niente footer marketing sui TOOL a tutta pagina (impaginatore, copertina 3D): creava
              un footer enorme con spazio vuoto sotto lo strumento. */}
          {!/^\/(album|album-copertina)\//.test(location.pathname) && <AppFooter />}
        </main>
      </div>
      <ImpersonationBanner />
      <Filo />
    </div>
  )
}

function NavGroups({ groups, onNavigate, dots }: { groups: NavGroup[]; onNavigate?: () => void; dots?: Set<string> }) {
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
              {dots?.has(n.to) && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#dc2626' }} aria-label="Nuove notifiche" />}
              {n.badge && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] tracking-widest">{n.badge}</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </div>
  )
}
