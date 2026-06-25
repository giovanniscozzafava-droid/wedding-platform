import { Check } from 'lucide-react'
import { COLORS, type ColorDef, type Cover, type Material } from '../albumCatalog'
import { Chip, SectionLabel } from './ui'

// Materiale (chip con campione texture), palette colori (pallini con campione reale),
// e foto vera del tessuto nel riquadro → "per non sbagliare".
export function MaterialPicker({
  materials, palette, cover, onPickMaterial, onPickColor,
}: {
  materials: Material[]
  palette: ColorDef[]
  cover: Cover
  onPickMaterial: (key: string) => void
  onPickColor: (c: ColorDef) => void
}) {
  const colorLabel = (cover.colorKey && COLORS[cover.colorKey]?.label) || 'personalizzato'
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Materiale</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {materials.map((m) => (
            <Chip key={m.key} active={cover.fabric === m.key} onClick={() => onPickMaterial(m.key)}>
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border border-black/15 shadow-inner" style={{ background: m.swatch }} />
                {m.label}
              </span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel hint={colorLabel}>Colore</SectionLabel>
        <div className="flex flex-wrap gap-2.5">
          {palette.map((c) => {
            const active = cover.colorKey === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onPickColor(c)}
                title={c.label}
                aria-label={c.label}
                className={`relative w-11 h-11 rounded-full border-2 transition-all duration-150 bg-cover bg-center
                  ${active ? 'border-[rgb(var(--gold-600))] scale-110 ring-2 ring-[rgb(var(--gold-300))]' : 'border-white shadow hover:scale-105'}`}
                style={{ backgroundColor: c.hex, backgroundImage: `url(/textures/swatches/colors/${c.key.replace(':', '__')}.jpg)` }}
              >
                {active && (
                  <span className="absolute inset-0 grid place-items-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.6)]">
                    <Check size={16} strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <SectionLabel hint="foto vere del campionario">Campionario reale</SectionLabel>
        <img
          key={cover.fabric}
          src={`/textures/swatches/${cover.fabric || 'alcantara'}.jpg`}
          alt={`Campioni reali ${cover.fabric}`}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
          className="w-full max-h-64 object-contain rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))]"
        />
      </div>
    </div>
  )
}
