import { useState } from 'react'
import { Plus, Trash2, Pencil, Utensils, Leaf, AlertCircle, Save, X as XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useMenu, useMenuMutations } from '@/hooks/useWedding'

const SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'BENVENUTO', label: 'Aperitivo di benvenuto' },
  { key: 'ANTIPASTO', label: 'Antipasti' },
  { key: 'PRIMO', label: 'Primi piatti' },
  { key: 'SECONDO', label: 'Secondi piatti' },
  { key: 'CONTORNO', label: 'Contorni' },
  { key: 'FRUTTA', label: 'Frutta' },
  { key: 'DOLCE', label: 'Dolci' },
  { key: 'TORTA', label: 'Taglio torta' },
  { key: 'CAFFE', label: 'Caffè' },
  { key: 'BEVANDA', label: 'Bevande' },
  { key: 'OPEN_BAR', label: 'Open bar' },
  { key: 'CONFETTATA', label: 'Confettata' },
]

const DIETARY_TAGS = ['vegano', 'vegetariano', 'celiaco', 'no_lattosio', 'kosher', 'halal', 'pesce_friendly', 'kid_friendly']
const ALLERGENS = [
  'glutine', 'crostacei', 'uova', 'pesce', 'arachidi', 'soia',
  'lattosio', 'frutta_a_guscio', 'sedano', 'senape', 'sesamo',
  'solfiti', 'lupini', 'molluschi',
]

type FormState = {
  section: string
  title: string
  description: string
  dietary_tags: string[]
  allergens: string[]
  price_per_guest: string
  notes: string
  is_optional: boolean
}

const EMPTY: FormState = {
  section: 'ANTIPASTO',
  title: '',
  description: '',
  dietary_tags: [],
  allergens: [],
  price_per_guest: '',
  notes: '',
  is_optional: false,
}

export function MenuTab({ entryId, readOnly = false }: { entryId: string; readOnly?: boolean }) {
  const { data, isLoading } = useMenu(entryId)
  const { add, update, remove } = useMenuMutations(entryId)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)

  const grouped = SECTIONS.map((s) => ({
    ...s,
    items: ((data as any[] | undefined) ?? []).filter((it) => it.section === s.key),
  }))

  function openCreate(section: string) {
    setEditing(null)
    setForm({ ...EMPTY, section })
    setOpen(true)
  }

  function openEdit(item: any) {
    setEditing(item.id)
    setForm({
      section: item.section,
      title: item.title ?? '',
      description: item.description ?? '',
      dietary_tags: item.dietary_tags ?? [],
      allergens: item.allergens ?? [],
      price_per_guest: item.price_per_guest?.toString() ?? '',
      notes: item.notes ?? '',
      is_optional: !!item.is_optional,
    })
    setOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast.error('Titolo voce richiesto')
      return
    }
    const payload = {
      section: form.section,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dietary_tags: form.dietary_tags,
      allergens: form.allergens,
      price_per_guest: form.price_per_guest ? Number(form.price_per_guest) : null,
      notes: form.notes.trim() || undefined,
      is_optional: form.is_optional,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing, patch: payload })
        toast.success('Voce aggiornata')
      } else {
        await add.mutateAsync(payload as any)
        toast.success('Voce aggiunta')
      }
      setOpen(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminare questa voce dal menu?')) return
    try {
      await remove.mutateAsync(id)
      toast.success('Voce rimossa')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  function toggleTag(field: 'dietary_tags' | 'allergens', value: string) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((t) => t !== value) : [...f[field], value],
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2">
            <Utensils size={20} /> Menu matrimonio
          </h2>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
            {readOnly
              ? 'Il menu viene definito da WP / location. Usa "Suggerisci modifica" per richiedere variazioni.'
              : 'Definisci ogni portata con diete e allergeni (Reg. UE 1169/2011). Gli sposi vedono il menu in sola lettura.'}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((sec) => (
            (sec.items.length > 0 || !readOnly) && (
              <section key={sec.key}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-lg" style={{ color: 'rgb(var(--gold-700))' }}>{sec.label}</h3>
                  {!readOnly && (
                    <Button variant="ghost" size="sm" onClick={() => openCreate(sec.key)}>
                      <Plus size={14} /> Aggiungi
                    </Button>
                  )}
                </div>
                {sec.items.length === 0 ? (
                  <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna voce inserita</p>
                ) : (
                  <ul className="space-y-2">
                    {sec.items.map((it: any) => (
                      <li key={it.id}>
                        <Card className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <h4 className="font-medium">{it.title}</h4>
                                {it.is_optional && <Badge tone="amber">opzionale</Badge>}
                                {it.price_per_guest && (
                                  <span className="text-xs text-[rgb(var(--fg-muted))]">€ {Number(it.price_per_guest).toFixed(2)}/pax</span>
                                )}
                              </div>
                              {it.description && <p className="text-sm text-[rgb(var(--fg-muted))] mt-1 whitespace-pre-line">{it.description}</p>}
                              {(it.dietary_tags?.length > 0 || it.allergens?.length > 0) && (
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {(it.dietary_tags ?? []).map((t: string) => (
                                    <span key={t} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--sage-100))', color: 'rgb(var(--sage-700))' }}>
                                      <Leaf size={9} /> {t}
                                    </span>
                                  ))}
                                  {(it.allergens ?? []).map((a: string) => (
                                    <span key={a} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-700))' }}>
                                      <AlertCircle size={9} /> {a}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {it.notes && <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2 italic">{it.notes}</p>}
                            </div>
                            {!readOnly && (
                              <div className="flex flex-col gap-1 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(it)} aria-label="Modifica">
                                  <Pencil size={14} />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(it.id)} aria-label="Elimina">
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          ))}
        </div>
      )}

      {open && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="surface surface-elev max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl">{editing ? 'Modifica voce' : 'Nuova voce menu'}</h3>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Chiudi"><XIcon size={16} /></Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="menu-section">Sezione</Label>
                <select id="menu-section" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                  {SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label htmlFor="menu-title">Titolo voce *</Label>
                <Input id="menu-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Es. Tagliatelle ai funghi porcini" />
              </div>
              <div>
                <Label htmlFor="menu-desc">Descrizione</Label>
                <Textarea id="menu-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ingredienti, preparazione, accompagnamento..." />
              </div>
              <div>
                <Label>Diete compatibili</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {DIETARY_TAGS.map((t) => (
                    <button key={t} type="button" onClick={() => toggleTag('dietary_tags', t)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        background: form.dietary_tags.includes(t) ? 'rgb(var(--sage-500))' : 'rgb(var(--bg-elev))',
                        color: form.dietary_tags.includes(t) ? 'white' : 'rgb(var(--fg-muted))',
                        borderColor: 'rgb(var(--border))',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Allergeni (Reg. UE 1169/2011)</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {ALLERGENS.map((a) => (
                    <button key={a} type="button" onClick={() => toggleTag('allergens', a)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
                      style={{
                        background: form.allergens.includes(a) ? 'rgb(var(--rose-500))' : 'rgb(var(--bg-elev))',
                        color: form.allergens.includes(a) ? 'white' : 'rgb(var(--fg-muted))',
                        borderColor: 'rgb(var(--border))',
                      }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="menu-price">Prezzo €/persona</Label>
                  <Input id="menu-price" type="number" min="0" step="0.5" value={form.price_per_guest} onChange={(e) => setForm({ ...form, price_per_guest: e.target.value })} />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_optional} onChange={(e) => setForm({ ...form, is_optional: e.target.checked })} />
                    Voce opzionale (alternativa)
                  </label>
                </div>
              </div>
              <div>
                <Label htmlFor="menu-notes">Note (solo WP/Location)</Label>
                <Textarea id="menu-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Note interne, fornitore, preparazione anticipata..." />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
                <Button variant="gold" onClick={handleSave} disabled={add.isPending || update.isPending}>
                  <Save size={14} /> {editing ? 'Aggiorna' : 'Crea'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
