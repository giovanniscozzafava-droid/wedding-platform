import { Link } from 'react-router-dom'

// Footer globale Planfully — usato in AppShell (WP/Forn/Location) e CoupleDashboard.
export function AppFooter() {
  return (
    <footer className="mt-auto border-t" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10 mb-6">
          <Link to="/" className="inline-flex items-center gap-2 shrink-0">
            <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-8 w-8" />
            <div>
              <div className="font-display text-base leading-tight">Planfully</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--fg-subtle))]">
                Network indipendente
              </div>
            </div>
          </Link>
          <p className="text-xs text-[rgb(var(--fg-muted))] max-w-md leading-relaxed">
            Lo strumento dei wedding planner italiani per organizzare matrimoni in rete, senza marketplace e senza commissioni.
            Un progetto <strong>Fuyue Srl</strong>.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t text-xs"
          style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-subtle))' }}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link to="/privacy" className="hover:text-[rgb(var(--fg))] transition-colors">Privacy</Link>
            <Link to="/cookie" className="hover:text-[rgb(var(--fg))] transition-colors">Cookie</Link>
            <a href="mailto:hello@planfully.it" className="hover:text-[rgb(var(--fg))] transition-colors">Contatti</a>
            <a href="https://planfully.it" target="_blank" rel="noreferrer" className="hover:text-[rgb(var(--fg))] transition-colors">planfully.it</a>
          </div>
          <p>© {new Date().getFullYear()} Fuyue Srl · Planfully è un marchio Fuyue Srl</p>
        </div>
      </div>
    </footer>
  )
}
