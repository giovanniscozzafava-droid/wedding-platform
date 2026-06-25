import { FORMATS, sizesForFormat, type Cover, type Format } from '../albumCatalog'
import { Chip, SectionLabel } from './ui'

// Formato (selettore visivo con proporzioni reali) + misura (chip).
export function FormatPicker({
  cover, onPickFormat, onPickSize,
}: {
  cover: Cover
  onPickFormat: (f: Format) => void
  onPickSize: (key: string) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Formato</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {FORMATS.map((f) => {
            const active = cover.format === f.key
            const ar = f.key === 'portrait' ? '3 / 4' : f.key === 'landscape' ? '4 / 3' : '1 / 1'
            return (
              <button key={f.key} type="button" onClick={() => onPickFormat(f.key)}
                className={`rounded-2xl border p-4 flex flex-col items-center gap-2.5 transition-all duration-150
                  ${active ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] ring-2 ring-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))] bg-[rgb(var(--bg-elev))]'}`}>
                <span className="grid place-items-center h-14">
                  <span className={`rounded-sm shadow-inner ${active ? 'bg-[rgb(var(--gold-500))]' : 'bg-[rgb(var(--fg-subtle))]'}`}
                    style={{ aspectRatio: ar, width: f.key === 'landscape' ? 48 : 34 }} />
                </span>
                <span className="text-sm font-medium text-[rgb(var(--fg))]">{f.label}</span>
                <span className="text-[10px] text-[rgb(var(--fg-subtle))] text-center leading-tight">{f.hint}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <SectionLabel hint="cm">Misura</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {sizesForFormat(cover.format, cover.model).map((s) => (
            <Chip key={s.key} active={cover.sizeKey === s.key} onClick={() => onPickSize(s.key)}>{s.label}</Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
