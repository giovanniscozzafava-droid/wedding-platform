import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Palette, Images, BookImage, Carrot, CalendarDays, Boxes, Calculator, PiggyBank, NotebookPen,
  Newspaper, PenSquare, Sparkles, PhoneCall, Gift, Coins, Users as UsersIcon, Contact, Printer,
  CheckSquare, TicketPercent, Search,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/layout/PageHeader'

// Registro strumenti: ogni voce dichiara a quali ruoli è visibile. La sidebar tiene solo il flusso
// quotidiano; tutto il resto vive qui, raggruppato per mestiere. Rotte invariate.
type Tool = { to: string; label: string; desc: string; icon: typeof Palette; show: (r: string, sub: string, photo: boolean) => boolean }
type Group = { key: string; title: string; tools: Tool[] }

const cap = (r: string) => r === 'WEDDING_PLANNER' || r === 'LOCATION' || r === 'ADMIN'
const forn = (r: string) => r === 'FORNITORE'
const loc = (r: string) => r === 'LOCATION' || r === 'ADMIN'

const GROUPS: Group[] = [
  { key: 'progettazione', title: 'Progettazione', tools: [
    { to: '/studio', label: 'Studio disegno', desc: 'Disegna a mano libera su tavola grafica a livelli.', icon: Palette, show: (r) => cap(r) || forn(r) },
    { to: '/stili', label: 'Portfolio', desc: 'Cura la vetrina dei tuoi lavori per i clienti.', icon: Images, show: (r) => cap(r) || forn(r) },
    { to: '/album-catalogo', label: 'Catalogo album', desc: 'Carica i PDF dei modelli album e marcali per i clienti.', icon: BookImage, show: (r, _s, p) => forn(r) && p },
  ]},
  { key: 'cucina', title: 'Cucina & sala', tools: [
    { to: '/food-cost', label: 'Food cost', desc: 'Calcola il costo piatto e i margini del menu.', icon: Carrot, show: (r) => loc(r) },
    { to: '/prove-menu', label: 'Prove menu', desc: 'Pianifica e annota le degustazioni con gli sposi.', icon: CalendarDays, show: (r) => loc(r) },
    { to: '/magazzino', label: 'Magazzino', desc: 'Giacenze e movimenti della dispensa.', icon: Boxes, show: (r) => loc(r) },
  ]},
  { key: 'amministrazione', title: 'Amministrazione', tools: [
    { to: '/bilancio', label: 'Bilancio', desc: 'Entrate, uscite e margine dei tuoi eventi.', icon: PiggyBank, show: (r) => cap(r) || forn(r) },
    { to: '/prima-nota', label: 'Prima nota', desc: 'Registra i movimenti di cassa giorno per giorno.', icon: NotebookPen, show: (r) => loc(r) },
    { to: '/ragioniere', label: 'Ragioniere', desc: 'Legge bolle e scontrini e concilia i conti.', icon: Calculator, show: (r) => loc(r) },
    { to: '/calcolatore', label: 'Calcolatore', desc: 'Preventiva al volo servizi e supplementi.', icon: Calculator, show: (r) => forn(r) },
  ]},
  { key: 'rete', title: 'Rete & clienti', tools: [
    { to: '/suppliers', label: 'Rete fornitori', desc: 'I fornitori che segui e con cui collabori.', icon: UsersIcon, show: (r) => cap(r) },
    { to: '/team', label: 'Team', desc: 'Le persone del tuo studio e i loro accessi.', icon: UsersIcon, show: (r) => cap(r) || forn(r) },
    { to: '/capostipiti', label: 'Committenti', desc: 'I capostipiti che ti hanno ingaggiato.', icon: UsersIcon, show: (r) => forn(r) },
    { to: '/clienti', label: 'Clienti', desc: 'La tua anagrafica clienti diretti.', icon: Contact, show: (r) => forn(r) },
    { to: '/suggerimenti-ricevuti', label: 'Suggerimenti', desc: 'Le segnalazioni che hai ricevuto dai colleghi.', icon: Gift, show: (r) => forn(r) },
  ]},
  { key: 'consegne', title: 'Consegne & controlli', tools: [
    { to: '/richieste-stampa', label: 'Richieste stampa', desc: 'Ordini di stampa album e fotografie.', icon: Printer, show: (r, _s, p) => (cap(r) || forn(r)) && p },
    { to: '/lavori-da-confermare', label: 'Da confermare', desc: 'Voci in attesa della tua conferma.', icon: CheckSquare, show: (r) => forn(r) },
    { to: '/voci-da-rivedere', label: 'Da rivedere', desc: 'Voci con maggiorazioni da controllare.', icon: TicketPercent, show: (r) => forn(r) },
  ]},
  { key: 'crescita', title: 'Crescita', tools: [
    { to: '/feed', label: 'Feed', desc: 'La community di chi organizza matrimoni.', icon: Newspaper, show: () => true },
    { to: '/blog/admin', label: 'Blog', desc: 'Scrivi articoli per farti trovare.', icon: PenSquare, show: (r) => cap(r) || forn(r) },
    { to: '/scopri', label: 'Scopri', desc: 'Trova nuovi fornitori e colleghi.', icon: Sparkles, show: (r) => cap(r) || forn(r) },
    { to: '/recruiting', label: 'Recruiting', desc: 'Invita colleghi e segui i richiami.', icon: PhoneCall, show: (r) => cap(r) || forn(r) },
    { to: '/rewards', label: 'Rewards', desc: 'I riconoscimenti che hai maturato.', icon: Gift, show: (r) => cap(r) },
    { to: '/crediti', label: 'Crediti rete', desc: 'I crediti maturati dalle tue segnalazioni.', icon: Coins, show: (r) => forn(r) },
  ]},
]

const RECENT_KEY = 'pf_tools_recent_v1'

export default function StrumentiHubPage() {
  const { profile } = useAuth()
  const role = profile?.role ?? ''
  const sub = (profile?.subrole ?? '').toLowerCase()
  const photo = /fotograf|video/.test(sub)
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')) } catch { setRecent([]) } }, [])
  function remember(to: string) {
    try {
      const next = [to, ...recent.filter((x) => x !== to)].slice(0, 6)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next)); setRecent(next)
    } catch { /* no-op */ }
  }

  const visibleGroups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return GROUPS
      .map((g) => ({ ...g, tools: g.tools.filter((t) => t.show(role, sub, photo) && (!needle || `${t.label} ${t.desc}`.toLowerCase().includes(needle))) }))
      .filter((g) => g.tools.length > 0)
  }, [role, sub, photo, q])

  const total = visibleGroups.reduce((n, g) => n + g.tools.length, 0)
  const allVisible = useMemo(() => GROUPS.flatMap((g) => g.tools).filter((t) => t.show(role, sub, photo)), [role, sub, photo])
  const recentTools = recent.map((to) => allVisible.find((t) => t.to === to)).filter(Boolean) as Tool[]

  return (
    <div>
      <PageHeader eyebrow="Cassetta degli attrezzi" title="Strumenti" description={`${total} strumenti per il tuo lavoro`} />
      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-5xl">
        <div className="relative mb-6 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" strokeWidth={1.5} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca uno strumento…"
            className="w-full h-11 pl-9 pr-3 rounded-xl border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--gold-600))]" />
        </div>

        {recentTools.length > 0 && !q && (
          <section className="mb-8">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[rgb(var(--gold-600))] mb-2">Recenti</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {recentTools.map((t) => <ToolCard key={t.to} t={t} onGo={remember} />)}
            </div>
          </section>
        )}

        {visibleGroups.map((g) => (
          <section key={g.key} className="mb-8">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[rgb(var(--gold-600))] mb-2">{g.title}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {g.tools.map((t) => <ToolCard key={t.to} t={t} onGo={remember} />)}
            </div>
          </section>
        ))}
        {total === 0 && <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuno strumento trovato.</p>}
      </div>
    </div>
  )
}

function ToolCard({ t, onGo }: { t: Tool; onGo: (to: string) => void }) {
  return (
    <Link to={t.to} onClick={() => onGo(t.to)}
      className="group flex items-start gap-3 rounded-xl border p-3.5 transition-colors border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] hover:border-[rgb(var(--gold-400))] min-h-[76px]">
      <span className="mt-0.5 shrink-0 text-[rgb(var(--gold-700))]"><t.icon size={20} strokeWidth={1.5} /></span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[rgb(var(--fg))]">{t.label}</span>
        <span className="block text-xs text-[rgb(var(--fg-muted))] leading-snug mt-0.5">{t.desc}</span>
      </span>
    </Link>
  )
}
