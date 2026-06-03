import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

// Modalità "Aiuto" globale: quando attiva, ogni elemento dotato di <HelpDot/>
// mostra un pallino "?" che apre una spiegazione "a cosa serve / cosa farci".
// Persistita in localStorage così resta com'era tra una pagina e l'altra.

type HelpCtx = { enabled: boolean; toggle: () => void; set: (v: boolean) => void }
const Ctx = createContext<HelpCtx>({ enabled: false, toggle: () => {}, set: () => {} })

const KEY = 'pf_help_mode'

export function HelpModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(KEY, enabled ? '1' : '0') } catch { /* no-op */ }
  }, [enabled])
  const toggle = useCallback(() => setEnabled((v) => !v), [])
  const set = useCallback((v: boolean) => setEnabled(v), [])
  return <Ctx.Provider value={{ enabled, toggle, set }}>{children}</Ctx.Provider>
}

export function useHelpMode(): HelpCtx {
  return useContext(Ctx)
}
