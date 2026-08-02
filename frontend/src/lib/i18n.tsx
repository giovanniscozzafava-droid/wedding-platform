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
// Nomi estesi per la scelta esplicita in Impostazioni (i chip IT/EN restano per barre compatte).
export const LANG_NAMES: Record<Lang, string> = {
  it: 'Italiano', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch',
}
const KEY = 'planfully_lang'
const VALID: Lang[] = ['it', 'en', 'es', 'fr', 'de']

// Rilevazione automatica: "da dove stai gestendo" = lingua del dispositivo/browser (default).
function detectAuto(): Lang {
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'it').slice(0, 2).toLowerCase()
  return (VALID as string[]).includes(n) ? (n as Lang) : 'it'
}
function hasSavedLang(): boolean {
  try { const s = localStorage.getItem(KEY); return !!s && (VALID as string[]).includes(s) } catch { return false }
}
function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY) as Lang | null
    if (saved && VALID.includes(saved)) return saved
  } catch { /* ignore */ }
  return detectAuto()
}

// isAuto = nessuna scelta esplicita salvata: la lingua segue il dispositivo. setAuto() ci torna.
type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (it: string, vars?: Record<string, string | number>) => string; isAuto: boolean; setAuto: () => void }
const I18nCtx = createContext<Ctx | null>(null)

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)
  const [isAuto, setIsAuto] = useState<boolean>(() => !hasSavedLang())
  // Applica la lingua al DOM (traduzione automatica) a ogni cambio + al primo mount.
  useEffect(() => {
    try { document.documentElement.lang = lang } catch { /* ignore */ }
    setAutoLang(lang)
  }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    setIsAuto(false)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  }, [])
  // Torna al comportamento di default: la lingua segue il dispositivo (nessuna scelta salvata).
  const setAuto = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    setIsAuto(true)
    setLangState(detectAuto())
  }, [])
  // t() = identita': la traduzione dell'intera UI e' gestita a runtime sul DOM.
  const t = useCallback((it: string, vars?: Record<string, string | number>) => interpolate(it, vars), [])
  return <I18nCtx.Provider value={{ lang, setLang, t, isAuto, setAuto }}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  if (!ctx) return { lang: 'it' as Lang, setLang: () => {}, t: (it: string, vars?: Record<string, string | number>) => interpolate(it, vars), isAuto: true, setAuto: () => {} }
  return ctx
}
