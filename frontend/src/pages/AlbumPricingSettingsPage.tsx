import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Save, BookImage, ListPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { supabase } from '@/lib/supabase'
import { ALBUM_FORMATS } from '@/lib/albumFormats'
import { type AlbumPriceList, type AlbumFormatPrice, type AlbumPackage, emptyPriceList, DEFAULT_FORMAT_PRICE, DEFAULT_MODEL_DELTA, euroA } from '@/lib/albumPricing'
import { getCatalogModels } from '@/hooks/useAlbumCatalog'
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
  const [models, setModels] = useState<{ label: string; price: number | null }[]>([]) // modelli dal catalogo PDF
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [addKey, setAddKey] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const { data } = await (supabase.from as any)('album_price_settings').select('config').maybeSingle()
        const cfg = (data?.config ?? null) as AlbumPriceList | null
        if (cfg && cfg.formats) setList({ formats: cfg.formats ?? {}, modelDelta: { ...DEFAULT_MODEL_DELTA, ...(cfg.modelDelta ?? {}) }, packages: cfg.packages ?? [] })
      } catch { /* nessun listino ancora */ }
      finally { setLoading(false) }
      try { setModels(await getCatalogModels()) } catch { /* nessun catalogo */ }
    })()
  }, [])

  const packages = list.packages ?? []
  const addPackage = () => setList((l) => ({ ...l, packages: [...(l.packages ?? []), { id: crypto.randomUUID(), label: `Pacchetto ${(l.packages?.length ?? 0) + 1}`, base: 390, includedPages: 50 }] }))
  const setPackage = (id: string, patch: Partial<AlbumPackage>) =>
    setList((l) => ({ ...l, packages: (l.packages ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const removePackage = (id: string) => setList((l) => ({ ...l, packages: (l.packages ?? []).filter((p) => p.id !== id) }))
  const pickIncludedModel = (id: string, label: string) => {
    const m = models.find((x) => x.label === label)
    setPackage(id, { includedModelLabel: label || undefined, includedModelPrice: m?.price ?? undefined })
  }

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

  // PUBBLICA NEL CATALOGO PREVENTIVI: crea/aggiorna in `services` una voce per ogni formato e
  // pacchetto del listino, così le ritrovi nel preventivo (categoria «Album»). Idempotente via
  // album_ref (fmt:<key> / pkg:<id>): ri-pubblicando aggiorna prezzo e descrizione, niente doppioni.
  const [publishing, setPublishing] = useState(false)
  async function ensureAlbumCategory(uid: string): Promise<string> {
    // categoria "Album" già visibile (mia o standard)?
    const { data: cats } = await (supabase.from as any)('service_categories').select('id, created_by').ilike('name', 'album')
    const rows = ((cats as { id: string; created_by: string | null }[] | null) ?? [])
    const mine = rows.find((c) => c.created_by === uid)
    if (mine) return mine.id
    if (rows[0]) return rows[0].id
    // creane una mia
    let subrole: string | null = null
    try { const { data: p } = await (supabase.from as any)('profiles').select('subrole').eq('id', uid).maybeSingle(); subrole = (p?.subrole as string | null) ?? null } catch { /* subrole opzionale */ }
    const slug = `album-${uid.slice(0, 8)}`
    const { data, error } = await (supabase.from as any)('service_categories')
      .insert({ name: 'Album', slug, subrole, created_by: uid, is_standard: false }).select('id').single()
    if (error) { // slug già preso (ri-tentativo): rileggi
      const { data: again } = await (supabase.from as any)('service_categories').select('id').eq('slug', slug).maybeSingle()
      if (again?.id) return again.id
      throw error
    }
    return data.id as string
  }
  async function publishToCatalog() {
    setPublishing(true)
    try {
      const { data: me } = await supabase.auth.getUser()
      const uid = me.user?.id
      if (!uid) throw new Error('Utente non autenticato')
      // salva prima il listino, così il catalogo riflette ciò che vedi a schermo
      await (supabase.rpc as any)('album_price_settings_save', { p_config: list })

      const items: { album_ref: string; name: string; description: string; base_price: number }[] = []
      for (const [key, fp] of Object.entries(list.formats)) {
        if (!fp) continue
        const extra = fp.extraPageRate > 0 ? ` · € ${fp.extraPageRate}/pagina extra` : ''
        const box = fp.boxPrice > 0 ? ` · box € ${fp.boxPrice}` : ''
        items.push({ album_ref: `fmt:${key}`, name: `Album ${formatLabel(key)}`, description: `${fp.includedPages} pagine incluse${extra}${box}`, base_price: fp.base })
      }
      for (const p of (list.packages ?? [])) {
        const model = p.includedModelLabel ? ` · modello ${p.includedModelLabel}` : ''
        items.push({ album_ref: `pkg:${p.id}`, name: p.label?.trim() || 'Pacchetto album', description: `Album · ${p.includedPages} pagine incluse${model}`, base_price: p.base })
      }
      if (!items.length) { toast.error('Aggiungi almeno un formato o un pacchetto prima di pubblicare'); return }

      const catId = await ensureAlbumCategory(uid)
      let created = 0, updated = 0
      for (const it of items) {
        const { data: ex } = await (supabase.from as any)('services').select('id').eq('fornitore_id', uid).eq('album_ref', it.album_ref).maybeSingle()
        if (ex?.id) {
          // aggiorna solo prezzo + descrizione: NOME e CATEGORIA restano come li hai personalizzati nel catalogo
          const { error } = await (supabase.from as any)('services').update({ base_price: it.base_price, description: it.description, is_active: true }).eq('id', ex.id)
          if (error) throw error
          updated++
        } else {
          const { error } = await (supabase.from as any)('services').insert({ fornitore_id: uid, category_id: catId, name: it.name, description: it.description, base_price: it.base_price, unit: 'PEZZO', is_active: true, album_ref: it.album_ref, tags: ['album'] })
          if (error) throw error
          created++
        }
      }
      const parts = [created ? `${created} nuove` : '', updated ? `${updated} aggiornate` : ''].filter(Boolean).join(' · ')
      toast.success(`Catalogo preventivi aggiornato (${parts}). Le trovi nel preventivo, categoria «Album».`)
    } catch (e) { toast.error(`Pubblicazione non riuscita: ${(e as Error).message}`) }
    finally { setPublishing(false) }
  }

  const rows = Object.keys(list.formats)

  return (
    <div className="min-h-full">
      <SettingsTabs />
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
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display text-lg">Pacchetti base</h3>
              <p className="text-sm text-[rgb(var(--fg-muted))]">I pacchetti che vendi nel preventivo (es. 290/390/490). Ognuno include un modello: se il cliente dal catalogo ne sceglie uno più caro, paga solo la differenza.</p>
            </div>
            <Button size="sm" variant="outline" onClick={addPackage}><Plus size={14} /> Pacchetto</Button>
          </div>
          {models.length === 0 && (
            <p className="text-[13px] text-[rgb(var(--fg-muted))] rounded-lg bg-[rgb(var(--bg-sunken))] p-3">Per collegare il <strong>modello incluso</strong>, carica il catalogo PDF e metti un prezzo a ogni modello in <a href="/album-catalogo" className="underline">Gestisci catalogo</a>.</p>
          )}
          {packages.length === 0 ? (
            <p className="text-sm text-[rgb(var(--fg-muted))]">Nessun pacchetto. Aggiungine uno con la base che hai già preventivato.</p>
          ) : packages.map((p) => (
            <div key={p.id} className="rounded-lg border border-[rgb(var(--border))] p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <input value={p.label} onChange={(e) => setPackage(p.id, { label: e.target.value })} className="h-9 rounded-md border border-[rgb(var(--border))] bg-transparent px-2 text-sm font-medium max-w-[16rem]" placeholder="Nome pacchetto" />
                <button onClick={() => removePackage(p.id)} className="text-[rgb(var(--fg-muted))] hover:text-red-500" title="Rimuovi pacchetto"><Trash2 size={16} /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <NumField label="Base" suffix="€" step={10} value={p.base} onChange={(n) => setPackage(p.id, { base: n })} />
                <NumField label="Pagine incluse" value={p.includedPages} onChange={(n) => setPackage(p.id, { includedPages: n })} />
                <label className="block md:col-span-2">
                  <span className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-muted))]">Modello incluso</span>
                  <select value={p.includedModelLabel ?? ''} onChange={(e) => pickIncludedModel(p.id, e.target.value)} className="mt-0.5 h-9 w-full rounded-md border border-[rgb(var(--border))] bg-transparent px-2 text-sm">
                    <option value="">— nessuno —</option>
                    {models.map((m) => <option key={m.label} value={m.label}>{m.label}{m.price != null ? ` · ${euroA(m.price)}` : ''}</option>)}
                  </select>
                </label>
              </div>
              {p.includedModelLabel && p.includedModelPrice == null && <p className="text-[11px] text-amber-600 mt-1.5">Questo modello non ha un prezzo nel catalogo: mettilo in Gestisci catalogo, poi riseleziona.</p>}
            </div>
          ))}
        </Card>

        <Card className="p-6 mt-6 space-y-4">
          <div>
            <h3 className="font-display text-lg">Upgrade modello (fascia)</h3>
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

        <div className="flex items-center gap-3 mt-6 flex-wrap">
          <Button onClick={save} disabled={busy || publishing}><Save size={16} /> {busy ? 'Salvo…' : 'Salva listino'}</Button>
          <Button variant="outline" onClick={publishToCatalog} disabled={publishing || busy || rows.length + packages.length === 0}
            title="Crea/aggiorna nel Catalogo servizi una voce per ogni formato e pacchetto, così le ritrovi quando componi un preventivo (categoria «Album»). Ri-pubblicando aggiorni i prezzi.">
            <ListPlus size={16} /> {publishing ? 'Pubblico…' : 'Pubblica nel catalogo preventivi'}
          </Button>
          {rows[0] && list.formats[rows[0]] && <span className="text-sm text-[rgb(var(--fg-muted))]">Es. {formatLabel(rows[0])}: base {euroA(list.formats[rows[0]]!.base)} · {list.formats[rows[0]]!.includedPages} pag.</span>}
        </div>
        <p className="text-[13px] text-[rgb(var(--fg-muted))] mt-3">
          <strong>Pubblica nel catalogo preventivi</strong> porta i tuoi formati e pacchetti tra i servizi selezionabili nel preventivo
          (prezzo base con le pagine incluse; le pagine extra si conteggiano poi nell'album). Aggiorni il listino? Ri-pubblica per allineare i prezzi.
        </p>
      </div>
    </div>
  )
}
