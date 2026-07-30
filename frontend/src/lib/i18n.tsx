import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

// Fondazione multilingue (IT/EN). Approccio "stringa sorgente": avvolgi la stringa italiana in
// t('...') e aggiungi la traduzione in EN qui sotto. Nessuna chiave da inventare: l'italiano è la
// chiave. Regola d'ora in avanti: ogni nuova stringa utente passa da t() e ha la sua voce EN.
export type Lang = 'it' | 'en'
const KEY = 'planfully_lang'

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'it' || saved === 'en') return saved
  } catch { /* ignore */ }
  const n = (typeof navigator !== 'undefined' ? navigator.language : 'it').toLowerCase()
  return n.startsWith('it') ? 'it' : 'en'
}

// Dizionario IT → EN. Aggiungi qui le traduzioni delle stringhe avvolte in t().
const EN: Record<string, string> = {
  // — Navigazione —
  'Dashboard': 'Dashboard',
  'Richieste': 'Requests',
  'Eventi': 'Events',
  'Preventivi': 'Quotes',
  'Contratti': 'Contracts',
  'Suggerimenti ricevuti': 'Referrals received',
  'Suggerimenti inviati': 'Referrals sent',
  'Calendario': 'Calendar',
  'Catalogo': 'Catalog',
  'Rete': 'Network',
  'Strumenti': 'Tools',
  'Impostazioni': 'Settings',
  'Lead': 'Leads',
  'Profilo': 'Profile',
  'Assistenza': 'Support',
  'Esci': 'Log out',
  // — Azioni comuni —
  'Salva': 'Save',
  'Annulla': 'Cancel',
  'Elimina': 'Delete',
  'Conferma': 'Confirm',
  'Aggiungi': 'Add',
  'Modifica': 'Edit',
  'Chiudi': 'Close',
  'Indietro': 'Back',
  'Avanti': 'Next',
  'Cerca': 'Search',
  'Nuovo preventivo': 'New quote',
  'Ordine cronologico': 'Chronological order',
  'Più recenti': 'Most recent',
}

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (it: string, vars?: Record<string, string | number>) => string }
const I18nCtx = createContext<Ctx | null>(null)

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? String(vars[k]) : `{{${k}}}`))
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect)
  useEffect(() => { try { document.documentElement.lang = lang } catch { /* ignore */ } }, [lang])
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  }, [])
  const t = useCallback((it: string, vars?: Record<string, string | number>) => {
    const base = lang === 'en' ? (EN[it] ?? it) : it
    return interpolate(base, vars)
  }, [lang])
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>
}

export function useT() {
  const ctx = useContext(I18nCtx)
  // Fallback fuori dal provider: nessuna traduzione (identità), per non rompere componenti isolati.
  if (!ctx) return { lang: 'it' as Lang, setLang: () => {}, t: (it: string, vars?: Record<string, string | number>) => interpolate(it, vars) }
  return ctx
}
