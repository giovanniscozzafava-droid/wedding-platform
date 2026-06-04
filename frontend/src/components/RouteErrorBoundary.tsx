import { Component, type ReactNode } from 'react'
import { reportError } from '@/lib/errorReporting'

type Props = { children: ReactNode }
type State = { hasError: boolean; isChunkError: boolean }

// Cattura gli errori di rendering/caricamento di una pagina e mostra un
// fallback con "Ricarica" invece di lasciare la pagina BIANCA. Per gli errori
// di chunk (deploy nuovo) tenta un reload automatico una sola volta.
const RELOAD_KEY = 'pf_chunk_reloaded'

function looksLikeChunkError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? '')
  return /chunk|dynamically imported module|failed to fetch|importing a module script|Load failed/i.test(msg)
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false }

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, isChunkError: looksLikeChunkError(err) }
  }

  componentDidCatch(err: unknown) {
    // Segnala al monitoraggio (escludi i chunk-error da deploy, sono rumore).
    if (!looksLikeChunkError(err)) void reportError(err, 'REACT')
    if (looksLikeChunkError(err)) {
      let already = false
      try { already = sessionStorage.getItem(RELOAD_KEY) === '1' } catch { /* no-op */ }
      if (!already) {
        try { sessionStorage.setItem(RELOAD_KEY, '1') } catch { /* no-op */ }
        location.reload()
      }
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'rgb(var(--bg))' }}>
        <div className="surface surface-lift max-w-md w-full p-8 text-center">
          <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-9 w-9 mx-auto mb-3" />
          <h1 className="font-display text-2xl mb-2">
            {this.state.isChunkError ? 'Aggiornamento in corso…' : 'Qualcosa è andato storto'}
          </h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">
            {this.state.isChunkError
              ? "È disponibile una nuova versione. Ricarica la pagina per continuare."
              : 'La pagina non si è caricata correttamente. Ricaricala per riprovare.'}
          </p>
          <button onClick={() => { try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* no-op */ } location.reload() }}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium"
            style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
            Ricarica
          </button>
        </div>
      </div>
    )
  }
}
