import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { setAutoLang } from '@/lib/autoTranslate'

// Multilingue dell'INTERA app. L'italiano e' la lingua sorgente; per le altre lingue traduciamo
// automaticamente a runtime tutto cio' che e' visibile (vedi lib/autoTranslate.ts): niente chiavi da
// mantenere a mano. t() resta come identita' (torna la stringa italiana): la traduzione avviene sul DOM.
export type Lang = 'it' | 'en' | 'es' | 'fr' | 'de'
export const LANGS: { code: Lang; label: string }[] = [
  { code: 'it', label: 'IT' }, { code: 'en', label: 'EN' }, { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' }, { code: 'de', label: 'DE' },
]
const KEY = 'planfully_lang'
const VALID: Lang[] = ['it', 'en', 'es', 'fr', 'de']

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null
    if (saved && VALID.includes(saved)) return saved
  } catch { /* ignore */ }
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'it').slice(0, 2).toLowerCase()
  return (VALID as string[]).includes(n) ? (n as Lang) : 'it'
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (it: string, vars?: Record<string, string | number>) => string }
const I18nCtx = createContext<Ctx | null>(null)

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)
  // Applica la lingua al DOM (traduzione automatica) a ogni cambio + al primo mount.
  useEffect(() => {
    try { document.documentElement.lang = lang } catch { /* ignore */ }
    setAutoLang(lang)
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  }, [])
  // t() = identita': la traduzione dell'intera UI e' gestita a runtime sul DOM.
  const t = useCallback((it: string, vars?: Record<string, string | number>) => interpolate(it, vars), [])
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (!ctx) return { lang: 'it' as Lang, setLang: () => {}, t: (it: string, vars?: Record<string, string | number>) => interpolate(it, vars) }
  return ctx
}
