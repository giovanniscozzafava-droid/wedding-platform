import { useEffect, useState } from 'react'
import { Palette as PaletteIcon, Sparkles, Save, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import {
  PRESET_PALETTES,
  suggestPalette,
  isValidHex,
  normalizeHex,
  type PaletteSwatch,
} from '@/lib/colorPalette'

type Props = {
  entryId: string
  readOnly?: boolean
}

const SUGGEST_KINDS: Array<{ v: Parameters<typeof suggestPalette>[1]; label: string; hint: string }> = [
  { v: 'monochrome',      label: 'Monocromatica',  hint: 'Varianti dello stesso colore' },
  { v: 'analogous',       label: 'Analoga',        hint: 'Colori vicini sulla ruota' },
  { v: 'complementary',   label: 'Complementare',  hint: 'Colore + opposto' },
  { v: 'triadic',         label: 'Triadica',       hint: 'Tre punti equidistanti' },
  { v: 'split-complement', label: 'Split-complementare', hint: 'Compl. attenuata' },
  { v: 'warm-earth',      label: 'Earth tones',    hint: 'Terra calda · rustic' },
  { v: 'cool-fresh',      label: 'Cool fresh',     hint: 'Blu polvere · coastal' },
]

export function PaletteSection({ entryId, readOnly = false }: Props) {
  const [colors, setColors] = useState<string[]>([])
  const [baseColor, setBaseColor] = useState<string>('#c49a5c')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const { data } = await (supabase.from('couple_preferences') as any)
          .select('preferred_palette')
          .eq('entry_id', entryId)
          .maybeSingle()
        const arr = (data?.preferred_palette as string[] | null) ?? []
        const hexes = arr.filter(isValidHex).map(normalizeHex)
        setColors(hexes)
        if (hexes.length > 0) setBaseColor(hexes[Math.min(2, hexes.length - 1)]!)
      } finally { setLoading(false) }
    })()
  }, [entryId])

  async function persist(next: string[]) {
    setSaving(true)
    try {
      // Upsert in couple_preferences (vincolo unique su entry_id)
      const { error } = await (supabase.from('couple_preferences') as any)
        .upsert({ entry_id: entryId, preferred_palette: next }, { onConflict: 'entry_id' })
      if (error) throw error
      setColors(next)
      toast.success('Palette salvata')
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setSaving(false) }
  }

  function applyPreset(presetColors: PaletteSwatch[]) {
    const hexes = presetColors.map((c) => c.hex)
    if (!readOnly) void persist(hexes)
  }

  function applySuggested(kind: Parameters<typeof suggestPalette>[1]) {
    const hexes = suggestPalette(baseColor, kind)
    if (!readOnly) void persist(hexes)
  }

  function updateColor(idx: number, hex: string) {
    const cleaned = normalizeHex(hex)
    if (!isValidHex(cleaned)) return
    const next = colors.slice()
    next[idx] = cleaned
    setColors(next)
  }

  function removeColor(idx: number) {
    const next = colors.filter((_, i) => i !== idx)
    setColors(next)
  }

  function addColor() {
    if (colors.length >= 6) {
      toast.error('Massimo 6 colori per palette')
      return
    }
    setColors([...colors, baseColor])
  }

  if (loading) return null

  return (
    <Card className="p-5 mb-6">
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <PaletteIcon size={18} className="text-[rgb(var(--gold-600))] mt-0.5" />
          <div>
            <h3 className="font-display text-lg">Palette colori</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              I colori scelti compariranno nel PDF della moodboard e guideranno fiorai, allestitori e stampe.
            </p>
          </div>
        </div>
        {colors.length > 0 && !readOnly && (
          <Button variant="gold" size="sm" disabled={saving} onClick={() => void persist(colors)}>
            <Save size={12} /> {saving ? 'Salvo…' : 'Salva'}
          </Button>
        )}
      </header>

      {/* Palette attuale */}
      <div className="flex items-stretch gap-2 mb-5 flex-wrap">
        {colors.length === 0 && (
          <p className="text-sm text-[rgb(var(--fg-subtle))]">
            Nessun colore ancora. Scegli un preset o usa il suggeritore qui sotto.
          </p>
        )}
        {colors.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="relative">
              <input
                type="color"
                disabled={readOnly}
                value={c}
                onChange={(e) => updateColor(i, e.target.value)}
                className="h-16 w-16 rounded-lg cursor-pointer border-2 disabled:cursor-not-allowed"
                style={{ borderColor: 'rgb(var(--border))', padding: 0, background: c }}
                aria-label={`Colore ${i + 1}`}
              />
              {!readOnly && (
                <button
                  onClick={() => removeColor(i)}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[rgb(var(--rose-500))] text-white text-xs flex items-center justify-center hover:scale-110 transition-transform"
                  title="Rimuovi"
                >×</button>
              )}
            </div>
            <code className="text-[10px] text-[rgb(var(--fg-subtle))]">{c.toUpperCase()}</code>
          </div>
        ))}
        {colors.length > 0 && colors.length < 6 && !readOnly && (
          <button onClick={addColor}
            className="h-16 w-16 rounded-lg border-2 border-dashed flex items-center justify-center text-[rgb(var(--fg-subtle))] hover:bg-[rgb(var(--bg-sunken))]"
            style={{ borderColor: 'rgb(var(--border-strong))' }}>
            +
          </button>
        )}
      </div>

      {!readOnly && (
        <>
          {/* Preset wedding */}
          <div className="mb-5">
            <Label className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Preset wedding</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {PRESET_PALETTES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p.colors)}
                  className="text-left p-2 rounded-lg border hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                  style={{ borderColor: 'rgb(var(--border))' }}>
                  <div className="flex h-7 rounded overflow-hidden mb-1.5">
                    {p.colors.map((c, i) => (
                      <div key={i} className="flex-1" style={{ background: c.hex }} />
                    ))}
                  </div>
                  <p className="font-medium text-xs">{p.name}</p>
                  {p.mood && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">{p.mood}</p>}
                </button>
              ))}
            </div>
          </div>

          {/* Suggeritore armonico */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Suggerisci una palette</Label>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1 mb-2">
              Parti da un colore base e genera 5 colori armonici con teoria del colore.
            </p>
            <div className="flex items-center gap-3 mb-3">
              <input type="color" value={baseColor} onChange={(e) => setBaseColor(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer border-2" style={{ borderColor: 'rgb(var(--border))', padding: 0 }} />
              <Input
                value={baseColor}
                onChange={(e) => { const v = e.target.value; if (isValidHex(v)) setBaseColor(normalizeHex(v)) }}
                className="font-mono text-sm max-w-[110px]"
              />
              <span className="text-xs text-[rgb(var(--fg-subtle))]">colore base</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SUGGEST_KINDS.map((k) => (
                <button
                  key={k.v}
                  onClick={() => applySuggested(k.v)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                  style={{ borderColor: 'rgb(var(--border))' }}
                  title={k.hint}>
                  <Sparkles size={10} className="text-[rgb(var(--gold-600))]" />
                  {k.label}
                </button>
              ))}
              <button
                onClick={() => applySuggested('analogous')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border-dashed border text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]"
                style={{ borderColor: 'rgb(var(--border))' }}
                title="Ri-suggerisci">
                <RefreshCw size={10} />
                Riprova
              </button>
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
