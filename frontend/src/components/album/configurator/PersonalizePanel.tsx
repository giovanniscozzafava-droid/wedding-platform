import { ImagePlus, Sparkles, Square, Type, Palette } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Cover } from '../albumCatalog'
import {
  COVER_BORDERS, COVER_DECORATIONS, COVER_FONTS, COVER_INK_SWATCHES, COVER_TEXT_LAYOUTS,
} from '../albumCoverPersonalization'
import { Chip, SectionLabel, ringOn, ringOff } from './ui'

// Pannello PERSONALIZZA: nomi/data/monogramma, font (anteprima reale), posizione testo,
// ghirigori, cornici/greche, colore testo/decoro, colore cover libero, foto in copertina.
export function PersonalizePanel({
  cover, set, onPhoto,
}: {
  cover: Cover
  set: (patch: Partial<Cover>) => void
  onPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const pickInk = (text?: string, accent?: string) => set({ textColor: text, accentColor: accent })

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Testi in copertina</SectionLabel>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-xs text-[rgb(var(--fg-muted))] sm:col-span-2">Nomi
            <Input value={cover.title ?? ''} onChange={(e) => set({ title: e.target.value })} className="mt-1.5" placeholder="Marco & Anna" />
          </label>
          <label className="text-xs text-[rgb(var(--fg-muted))]">Monogramma
            <Input value={cover.monogram ?? ''} maxLength={4} onChange={(e) => set({ monogram: e.target.value.toUpperCase() })} className="mt-1.5" />
          </label>
          <label className="text-xs text-[rgb(var(--fg-muted))] sm:col-span-3">Data o frase breve
            <Input value={cover.subtitle ?? ''} onChange={(e) => set({ subtitle: e.target.value })} placeholder="23 giugno 2026" className="mt-1.5" />
          </label>
        </div>
      </div>

      <div>
        <SectionLabel><Type size={12} className="inline -mt-0.5 mr-1" />Font</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {COVER_FONTS.map((f) => (
            <button key={f.key} type="button" onClick={() => set({ fontKey: f.key })}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${cover.fontKey === f.key ? ringOn : ringOff}`}>
              <span className="block text-base leading-tight text-[rgb(var(--fg))]" style={{ fontFamily: f.css }}>{f.label}</span>
              <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{f.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Posizione del testo</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {COVER_TEXT_LAYOUTS.map((l) => (
            <Chip key={l.key} active={cover.textLayout === l.key || (!cover.textLayout && l.key === 'model')} onClick={() => set({ textLayout: l.key })}>
              {l.label} <span className="opacity-55">{l.hint}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <SectionLabel><Sparkles size={12} className="inline -mt-0.5 mr-1" />Ghirigori</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {COVER_DECORATIONS.map((d) => (
              <button key={d.key} type="button" onClick={() => set({ decorationKey: d.key })}
                className={`rounded-xl border px-2.5 py-2 text-left transition-all duration-150 ${cover.decorationKey === d.key || (!cover.decorationKey && d.key === 'none') ? ringOn : ringOff}`}>
                <span className="block text-xs font-medium text-[rgb(var(--fg))]">{d.label}</span>
                <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{d.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel><Square size={12} className="inline -mt-0.5 mr-1" />Greche e cornici</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {COVER_BORDERS.map((b) => (
              <button key={b.key} type="button" onClick={() => set({ borderKey: b.key })}
                className={`rounded-xl border px-2.5 py-2 text-left transition-all duration-150 ${cover.borderKey === b.key || (!cover.borderKey && b.key === 'none') ? ringOn : ringOff}`}>
                <span className="block text-xs font-medium text-[rgb(var(--fg))]">{b.label}</span>
                <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{b.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <SectionLabel><Palette size={12} className="inline -mt-0.5 mr-1" />Colore testo / decoro</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {COVER_INK_SWATCHES.map((s) => {
              const active = s.text ? cover.textColor === s.text && cover.accentColor === s.accent : !cover.textColor && !cover.accentColor
              return (
                <Chip key={s.key} active={active} onClick={() => pickInk(s.text, s.accent)}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: s.accent ?? 'linear-gradient(135deg,#fff,#222)' }} />
                    {s.label}
                  </span>
                </Chip>
              )
            })}
          </div>
        </div>
        <div>
          <SectionLabel hint="oltre la palette">Colore cover libero</SectionLabel>
          <input type="color" value={cover.color || '#e8d8c4'} onChange={(e) => set({ color: e.target.value, colorKey: undefined })}
            className="block h-11 w-full rounded-xl border border-[rgb(var(--border-strong))] cursor-pointer bg-transparent" />
        </div>
      </div>

      <div>
        <SectionLabel>Foto in copertina</SectionLabel>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] cursor-pointer hover:border-[rgb(var(--gold-300))] transition-colors">
            <ImagePlus size={16} /> Carica una foto
            <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
          </label>
          {cover.photo_url && (
            <button type="button" onClick={() => set({ photo_url: null })} className="text-xs text-[rgb(var(--rose-700))] underline">rimuovi</button>
          )}
        </div>
      </div>
    </div>
  )
}
