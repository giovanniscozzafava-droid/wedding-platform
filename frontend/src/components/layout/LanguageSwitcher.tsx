import { useT } from '@/lib/i18n'
import { LANGS } from '@/lib/i18n'

// Selettore lingua (IT/EN/ES/FR/DE). L'intera UI viene tradotta automaticamente a runtime.
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang } = useT()
  return (
    <div className={`inline-flex items-center gap-0.5 rounded-md border border-[rgb(var(--border))] p-0.5 ${className}`} title="Lingua / Language" data-notranslate>
      {LANGS.map(({ code, label }) => (
        <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={lang === code}
          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors ${lang === code ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'}`}>
          {label}
        </button>
      ))}
    </div>
  )
}
