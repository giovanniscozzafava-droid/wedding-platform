import { useT, type Lang } from '@/lib/i18n'

// Interruttore lingua IT/EN. Compatto, per la sidebar/topbar.
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useT()
  const opt = (l: Lang, label: string) => (
    <button key={l} type="button" onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors ${lang === l ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'}`}>
      {label}
    </button>
  )
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-md border border-[rgb(var(--border))] p-0.5 ${className}`} title="Lingua / Language">
      {opt('it', 'IT')}
      {opt('en', 'EN')}
    </div>
  )
}
