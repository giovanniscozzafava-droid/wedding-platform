import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, BookImage } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { ALBUM_FORMATS } from '@/lib/albumFormats'
import { type AlbumPriceList, type AlbumFormatPrice, emptyPriceList, DEFAULT_FORMAT_PRICE, DEFAULT_MODEL_DELTA, euroA } from '@/lib/albumPricing'
import type { Tier } from '@/components/album/albumCatalog'

const TIERS: { key: Tier; label: string; hint: string }[] = [
  { key: 'BASIC', label: 'Base', hint: 'modelli standard' },
  { key: 'ROYAL', label: 'Royal', hint: 'materiali superiori' },
  { key: 'PRIME', label: 'Prime', hint: 'linea premium' },
  { key: 'TOP', label: 'Top', hint: 'top di gamma / Swarovski' },
]

const formatLabel = (key: string) => ALBUM_FORMATS.find((f) => f.key === key)?.label ?? key

// campo numerico con etichetta compatta
function NumField({ label, suffix, value, onChange, step = 1 }: { label: string; suffix?: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-muted))]">{label}</span>
      <div className="flex items-center gap-1 mt-0.5">
        <Input type="number" min={0} step={step} value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} className="h-9" />
        {suffix && <span className="text-xs text-[rgb(var(--fg-muted))] w-10">{suffix}</span>}
      </div>
    </label>
  )
}

export default function AlbumPricingSettingsPage() {
  const [list, setList] = useState<AlbumPriceList>(emptyPriceList())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [addKey, setAddKey] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase.from as any)('album_price_settings').select('config').maybeSingle()
        const cfg = (data?.config ?? null) as AlbumPriceList | null
        if (cfg && cfg.formats) setList({ formats: cfg.formats ?? {}, modelDelta: { ...DEFAULT_MODEL_DELTA, ...(cfg.modelDelta ?? {}) } })
      } catch { /* nessun listino ancora */ }
      finally { setLoading(false) }
    })()
  }, [])

  const usedKeys = useMemo(() => new Set(Object.keys(list.formats)), [list.formats])
  const available = ALBUM_FORMATS.filter((f) => !usedKeys.has(f.key) && f.category !== 'Proof')

  const setFormat = (key: string, patch: Partial<AlbumFormatPrice>) =>
    setList((l) => ({ ...l, formats: { ...l.formats, [key]: { ...DEFAULT_FORMAT_PRICE, ...l.formats[key], ...patch } } }))
  const addFormat = () => {
    const key = addKey || available[0]?.key
    if (!key) return
    setList((l) => ({ ...l, formats: { ...l.formats, [key]: { ...DEFAULT_FORMAT_PRICE } } }))
    setAddKey('')
  }
  const removeFormat = (key: string) =>
    setList((l) => { const f = { ...l.formats }; delete f[key]; return { ...l, formats: f } })
  const setDelta = (tier: Tier, n: number) =>
    setList((l) => ({ ...l, modelDelta: { ...l.modelDelta, [tier]: Math.max(0, n) } }))

  async function save() {
    setBusy(true)
    try {
      const { data, error } = await (supabase.rpc as any)('album_price_settings_save', { p_config: list })
      if (error || (data as { error?: string } | null)?.error) throw new Error((data as { error?: string } | null)?.error ?? error?.message)
      toast.success('Listino album salvato')
    } catch (e) { toast.error(`Salvataggio non riuscito: ${(e as Error).message}`) }
    finally { setBusy(false) }
  }

  const rows = Object.keys(list.formats)

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Album"
          title="Listino album"
          description="I tuoi prezzi di vendita: base per formato, pagine incluse, costo pagina extra, box e album famiglia. Ogni evento eredita questo listino e resta modificabile sul singolo album."
        />

        <Card className="p-6 mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-display text-lg flex items-center gap-2"><BookImage size={18} /> Formati e prezzi</h3>
            {available.length > 0 && (
              <div className="flex items-center gap-2">
                <select value={addKey} onChange={(e) => setAddKey(e.target.value)} className="h-9 rounded-md border border-[rgb(var(--border))] bg-transparent px-2 text-sm max-w-[16rem]">
                  <option value="">Aggiungi formato…</option>
                  {available.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <Button size="sm" variant="outline" onClick={addFormat}><Plus size={14} /> Aggiungi</Button>
              </div>
            )}
          </div>

          {loading ? <p className="text-sm text-[rgb(var(--fg-muted))]">Carico…</p>
            : rows.length === 0 ? (
              <p className="text-sm text-[rgb(var(--fg-muted))]">Nessun formato ancora. Aggiungine uno (es. 25×35) e imposta i tuoi prezzi.</p>
            ) : rows.map((key) => {
              const fp = list.formats[key]
              if (!fp) return null
              return (
                <div key={key} className="rounded-lg border border-[rgb(var(--border))] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{formatLabel(key)}</span>
                    <button onClick={() => removeFormat(key)} className="text-[rgb(var(--fg-muted))] hover:text-red-500" title="Rimuovi formato"><Trash2 size={16} /></button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <NumField label="Prezzo base" suffix="€" value={fp.base} step={10} onChange={(n) => setFormat(key, { base: n })} />
                    <NumField label="Pagine incluse" value={fp.includedPages} onChange={(n) => setFormat(key, { includedPages: n })} />
                    <NumField label="Pagina extra" suffix="€/pag" value={fp.extraPageRate} onChange={(n) => setFormat(key, { extraPageRate: n })} />
                    <NumField label="Box / custodia" suffix="€" value={fp.boxPrice} step={5} onChange={(n) => setFormat(key, { boxPrice: n })} />
                    <NumField label="Album famiglia" suffix="€ cad." value={fp.familyBase} step={10} onChange={(n) => setFormat(key, { familyBase: n })} />
                    <NumField label="Famiglia · pag. extra" suffix="€/pag" value={fp.familyExtraPageRate} onChange={(n) => setFormat(key, { familyExtraPageRate: n })} />
                  </div>
                </div>
              )
            })}
        </Card>

        <Card className="p-6 mt-6 space-y-4">
          <div>
            <h3 className="font-display text-lg">Upgrade modello</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Quanto aggiunge la scelta di un modello dal catalogo, in base alla sua fascia. Si somma alla base.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TIERS.map((t) => (
              <div key={t.key}>
                <NumField label={t.label} suffix="€" step={5} value={Number(list.modelDelta[t.key] ?? DEFAULT_MODEL_DELTA[t.key] ?? 0)} onChange={(n) => setDelta(t.key, n)} />
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1">{t.hint}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3 mt-6">
          <Button onClick={save} disabled={busy}><Save size={16} /> {busy ? 'Salvo…' : 'Salva listino'}</Button>
          {rows[0] && list.formats[rows[0]] && <span className="text-sm text-[rgb(var(--fg-muted))]">Es. {formatLabel(rows[0])}: base {euroA(list.formats[rows[0]]!.base)} · {list.formats[rows[0]]!.includedPages} pag.</span>}
        </div>
      </div>
    </div>
  )
}
