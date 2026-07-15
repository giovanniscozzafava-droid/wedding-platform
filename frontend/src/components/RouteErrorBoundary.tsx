import { Component, type ReactNode } from 'react'
import { reportError } from '@/lib/errorReporting'
import { hardReloadOnce, clearReloadGuard } from '@/lib/lazyWithRetry'

type Props = { children: ReactNode }
type State = { hasError: boolean; recovering: boolean }

// Cattura gli errori di rendering/caricamento di una pagina. Il PRIMO inciampo (es.
// chunk dopo un deploy, blip di rete) NON mostra un errore spaventoso: mostra un
// piccolo caricamento e ricarica da solo, in silenzio. Solo se l'errore RICAPITA
// dopo il reload mostriamo il messaggio con "Ricarica".
const RELOAD_KEY = 'pf_chunk_reloaded'

function looksLikeChunkError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '')
  return /chunk|dynamically imported module|failed to fetch|importing a module script|Load failed/i.test(msg)
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, recovering: false }
  private clearTimer?: ReturnType<typeof setTimeout>

  static getDerivedStateFromError(): State {
    let retried = false
    try { retried = sessionStorage.getItem(RELOAD_KEY) === '1' } catch { /* no-op */ }
    // primo errore → "recovering" (spinner + auto-reload); se già ritentato → messaggio
    return { hasError: true, recovering: !retried }
  }

  componentDidMount() {
    // caricata bene: dopo qualche secondo azzera il guard, così un futuro inciampo
    // transitorio può di nuovo auto-recuperare in silenzio.
    this.clearTimer = setTimeout(() => clearReloadGuard(), 4000)
  }
  componentWillUnmount() { if (this.clearTimer) clearTimeout(this.clearTimer) }

  componentDidCatch(err: unknown) {
    if (!looksLikeChunkError(err)) void reportError(err, 'REACT')
    // Primo inciampo → hard-reload una volta (cache-bust); se già fatto, resta il messaggio.
    hardReloadOnce()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // Inciampo transitorio: piccolo caricamento (si ricarica da solo).
    if (this.state.recovering) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
          <div className="flex flex-col items-center gap-3 text-[rgb(var(--fg-muted))]">
            <span className="inline-block h-7 w-7 rounded-full border-2 border-[rgb(var(--gold-500))] border-t-transparent animate-spin" />
            <p className="text-sm">Un attimo…</p>
          </div>
        </div>
      )
    }

    // L'errore persiste anche dopo il reload: messaggio chiaro con azione.
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'rgb(var(--bg))' }}>
        <div className="surface surface-lift max-w-md w-full p-8 text-center">
          <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-9 w-9 mx-auto mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <h1 className="font-display text-2xl mb-2">Riproviamo</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">La pagina non si è caricata. Ricaricala per continuare.</p>
          <button onClick={() => { clearReloadGuard(); hardReloadOnce() }}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
            style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
            Ricarica
          </button>
        </div>
      </div>
    )
  }
}
