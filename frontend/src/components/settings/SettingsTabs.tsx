import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

// Barra tab unica delle Impostazioni: dà l'esperienza "pagina a tab" senza toccare le rotte esistenti.
// La sidebar tiene UNA sola voce "Impostazioni"; qui si passa da un'area all'altra.
// show(role, photo): photo = subrole fotografo/video → gli strumenti album/stampe sono solo per loro.
type Tab = { to: string; label: string; show?: (role: string, photo: boolean) => boolean }
const TABS: Tab[] = [
  { to: '/settings/brand', label: 'Brand' },
  { to: '/settings/incassi', label: 'Incassi' },
  { to: '/settings/maggiorazioni', label: 'Maggiorazioni' },
  { to: '/settings/funnel', label: 'Funnel', show: (r) => r === 'FORNITORE' || r === 'WEDDING_PLANNER' || r === 'LOCATION' || r === 'ADMIN' },
  // Listino album SOLO per fotografi/videomaker (un fiorista non ne fa nulla) o admin.
  { to: '/settings/album-prezzi', label: 'Listino album', show: (r, photo) => (r === 'FORNITORE' && photo) || r === 'ADMIN' },
  { to: '/integrazione-sito', label: 'Integrazione sito' },
  { to: '/team', label: 'Team' },
  { to: '/profile', label: 'Profilo' },
  { to: '/assistenza', label: 'Assistenza' },
  { to: '/faq', label: 'FAQ' },
]

export function SettingsTabs() {
  const { profile } = useAuth()
  const role = profile?.role ?? ''
  const photo = /fotograf|video/.test((profile?.subrole ?? '').toLowerCase())
  const tabs = TABS.filter((t) => !t.show || t.show(role, photo))
  return (
    <div className="border-b border-[rgb(var(--border))] mb-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto -mb-px" aria-label="Impostazioni">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end
              className={({ isActive }) =>
                `shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-[44px] inline-flex items-center ${
                  isActive
                    ? 'border-[rgb(var(--gold-600))] text-[rgb(var(--fg))]'
                    : 'border-transparent text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'
                }`}>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
