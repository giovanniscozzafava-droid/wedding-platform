import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/lib/toast'
import { ChevronLeft, Plus, Trash2, Loader2, Palette, Stamp, Package, Layers, ImageIcon } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getMyOptionCatalog, getGlobalDefaultOptions, upsertMyOption, deleteMyOption, cloneDefaultsAsMine,
  type MyOption, type OptionCategory,
} from '@/hooks/useAlbumOrder'

const CATEGORIES: { key: OptionCategory; label: string; icon: typeof Palette; hint: string }[] = [
  { key: 'COVER_COLOR', label: 'Colore copertina', icon: Palette, hint: 'Attiva "consente foto in copertina" per il colore/modello con finestra fotografica.' },
  { key: 'LOGO', label: 'Logo / impressione', icon: Stamp, hint: 'Es. nessuno, a caldo, a secco, placca.' },
  { key: 'BOX', label: 'Box / cofanetto', icon: Package, hint: 'Contenitori disponibili per l’album.' },
  { key: 'FINISH', label: 'Finitura', icon: Layers, hint: 'Una sola scelta, come per le altre caratteristiche: tieni «Nessuna» se vuoi lasciare la porta aperta.' },
]

// Le opzioni della coppia arrivano per categoria: se hai righe TUE per una categoria, quelle
// sostituiscono i default; se non ne hai, la coppia vede i default globali. Qui puoi partire
// dai default ("Personalizza") o creare le tue righe da zero.
export default function AlbumOptionCatalogManager() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState<MyOption[]>([])
  const [defaults, setDefaults] = useState<MyOption[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [m, d] = await Promise.all([getMyOptionCatalog(), getGlobalDefaultOptions() as unknown as Promise<MyOption[]>])
      setMine(m); setDefaults(d)
    } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const byCategory = useMemo(() => {
    const map: Record<OptionCategory, MyOption[]> = { COVER_COLOR: [], LOGO: [], BOX: [], FINISH: [] }
    for (const o of mine) map[o.category].push(o)
    return map
  }, [mine])

  async function personalize(cat: OptionCategory) {
    setBusy(cat)
    try { await cloneDefaultsAsMine(cat); await load(); toast.success('Opzioni copiate: ora sono tue, modificale liberamente') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  async function addRow(cat: OptionCategory) {
    const label = window.prompt('Nome della nuova opzione (es. "Champagne")')
    if (!label?.trim()) return
    setBusy(cat)
    try {
      const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `opz-${Date.now()}`
      await upsertMyOption({ category: cat, key, label: label.trim(), sort_order: (byCategory[cat]?.length ?? 0) + 1 })
      await load()
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(null) }
  }

  async function saveRow(row: MyOption) {
    try { await upsertMyOption(row) } catch (e) { toast.error((e as Error).message) }
  }
  async function removeRow(row: MyOption) {
    if (!window.confirm(`Eliminare «${row.label}»?`)) return
    try { await deleteMyOption(row.id); setMine((ms) => ms.filter((m) => m.id !== row.id)) }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
        <button onClick={() => navigate(-1)} className="text-sm text-[rgb(var(--fg-muted))] inline-flex items-center gap-1 mb-4 hover:text-[rgb(var(--fg))]">
          <ChevronLeft size={16} /> Indietro
        </button>
        <div className="mb-6">
          <h1 className="font-display text-3xl sm:text-4xl">Opzioni album</h1>
          <p className="text-[rgb(var(--fg-muted))] mt-1">Colore copertina, logo, box e finiture che i tuoi clienti scelgono nello stepper. Senza personalizzare vedono già dei default sensati.</p>
        </div>

        {loading ? (
          <div className="grid place-items-center h-72 text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((c) => {
              const rows = byCategory[c.key]
              const isMine = rows.length > 0
              return (
                <Card key={c.key} className="p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                    <h3 className="font-display text-lg flex items-center gap-2"><c.icon size={18} className="text-[rgb(var(--gold-600))]" /> {c.label}</h3>
                    {isMine
                      ? <Button variant="outline" size="sm" disabled={busy === c.key} onClick={() => addRow(c.key)}>{busy === c.key ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Aggiungi</Button>
                      : <Button variant="outline" size="sm" disabled={busy === c.key} onClick={() => personalize(c.key)}>{busy === c.key ? <Loader2 size={14} className="animate-spin" /> : null} Personalizza</Button>}
                  </div>
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))] mb-3">{c.hint}</p>

                  {!isMine ? (
                    <div className="flex flex-wrap gap-1.5">
                      {defaults.filter((d) => d.category === c.key).map((d) => (
                        <span key={d.key} className="text-xs px-2.5 py-1 rounded-full bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]">{d.label}{d.allows_cover_photo ? ' · foto in copertina' : ''}</span>
                      ))}
                      <span className="text-[11px] text-[rgb(var(--fg-subtle))] w-full mt-1">Sono i default: i tuoi clienti li vedono già così. "Personalizza" per modificarli.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {rows.map((r) => (
                        <div key={r.id} className="flex items-center gap-2">
                          <Input value={r.label} onChange={(e) => setMine((ms) => ms.map((m) => (m.id === r.id ? { ...m, label: e.target.value } : m)))}
                            onBlur={() => void saveRow(mine.find((m) => m.id === r.id)!)} className="h-8 text-sm flex-1" />
                          {c.key === 'COVER_COLOR' && (
                            <label className="flex items-center gap-1 text-[11px] text-[rgb(var(--fg-muted))] shrink-0">
                              <input type="checkbox" checked={r.allows_cover_photo}
                                onChange={(e) => { const patched = { ...r, allows_cover_photo: e.target.checked }; setMine((ms) => ms.map((m) => (m.id === r.id ? patched : m))); void saveRow(patched) }} />
                              <ImageIcon size={12} /> foto in copertina
                            </label>
                          )}
                          <button onClick={() => void removeRow(r)} className="text-[rgb(var(--fg-muted))] hover:text-red-500 shrink-0" title="Elimina"><Trash2 size={15} /></button>
                        </div>
                      ))}
                      {rows.length === 0 && <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna opzione. Aggiungine una.</p>}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
