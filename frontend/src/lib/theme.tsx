import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark'

type Ctx = {
  theme: Theme
  toggle: () => void
  set: (t: Theme) => void
}

const ThemeCtx = createContext<Ctx | null>(null)
const STORAGE_KEY = 'wp:theme'

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  return (
    <ThemeCtx.Provider value={{
      theme,
      toggle: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
      set: setTheme,
    }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  const c = useContext(ThemeCtx)
  if (!c) throw new Error('useTheme must be inside ThemeProvider')
  return c
}
