// Veste «catalogo Planfully» del configuratore copertina: capitoli numerati con filetto,
// scelte a pillola (una sola), scheda riassuntiva con le miniature di ciò che la coppia ha scelto.
import type { ReactNode } from 'react'
import { Check } from '@/components/icons/lucide'
import type { Opt } from '@/components/album/catalog/coverOptions'

/** Capitolo del catalogo: numerale romano in oro, titolo Bodoni, nota, filetto sotto. */
export function Chapter({ n, title, hint, aside, children }: { n: string; title: string; hint?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="pt-5 first:pt-0">
      <div className="flex items-end justify-between gap-3 border-b border-[rgb(var(--border))] pb-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[13px] tracking-[0.18em] text-[rgb(var(--gold-700))]">{n}</span>
            <h2 className="font-display text-xl leading-none text-[rgb(var(--fg))]">{title}</h2>
          </div>
          {hint && <p className="mt-1 text-[12px] leading-snug text-[rgb(var(--fg-muted))]">{hint}</p>}
        </div>
        {aside && <div className="shrink-0 text-[11px] text-[rgb(var(--fg-subtle))]">{aside}</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/** Etichetta piccola di una voce dentro un capitolo, con l'eventuale «vedi a pag. N». */
export function Voice({ label, page, onSee, children }: { label: string; page?: number; onSee?: (p?: number) => void; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--fg-subtle))]">{label}</span>
        {page && onSee && <button type="button" onClick={() => onSee(page)} className="text-[11px] text-[rgb(var(--gold-700))] hover:underline">vedi a pag. {page}</button>}
      </div>
      {children}
    </div>
  )
}

/** Scelta a pillole: una sola attiva (oro), come i tab del resto di Planfully. */
export function PillChoice({ options, value, onChange, small }: { options: Opt[]; value?: string | null; onChange: (k: string) => void; small?: boolean }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup">
      {options.map((o) => {
        const on = o.key === value
        return (
          <button key={o.key} type="button" role="radio" aria-checked={on} title={o.hint} onClick={() => onChange(o.key)}
            className={`rounded-full border transition-colors ${small ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]'} ${on ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:border-[rgb(var(--gold-300))] hover:text-[rgb(var(--fg))]'}`}>
            {on && <Check size={12} className="inline -mt-0.5 mr-1" />}{o.label}
          </button>
        )
      })}
    </div>
  )
}

export type SheetRow = { label: string; value?: string; img?: string; hex?: string; fit?: 'cover' | 'contain'; missing?: boolean }

/** La scheda della copertina: una riga per caratteristica, con la miniatura del campione. */
export function ChoiceSheet({ rows, title = 'La tua copertina' }: { rows: SheetRow[]; title?: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] overflow-hidden">
      <div className="px-4 pt-3 pb-2 border-b border-[rgb(var(--border))] flex items-baseline justify-between">
        <p className="font-display text-lg">{title}</p>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))]">è ciò che arriva all'azienda</p>
      </div>
      <ul className="divide-y divide-[rgb(var(--border))]">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 px-4 py-2">
            <span className={`relative h-9 w-12 shrink-0 overflow-hidden rounded-md border border-[rgb(var(--border))] ${r.fit === 'contain' ? 'bg-white' : 'bg-[rgb(var(--bg-muted))]'}`} style={{ backgroundColor: r.hex }}>
              {r.img && <img src={r.img} alt="" className={`absolute inset-0 h-full w-full ${r.fit === 'contain' ? 'object-contain' : 'object-cover'}`} />}
            </span>
            <span className="w-28 shrink-0 text-[11px] uppercase tracking-[0.12em] text-[rgb(var(--fg-subtle))]">{r.label}</span>
            <span className={`min-w-0 flex-1 truncate text-sm ${r.value ? 'text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg-subtle))] italic'}`}>{r.value ?? (r.missing ? 'da scegliere' : '—')}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
