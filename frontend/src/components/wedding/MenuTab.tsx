import { useEffect, useState } from 'react'
import { Plus, Trash2, Pencil, Utensils, Leaf, AlertCircle, Save, X as XIcon, BookOpen, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useMenu, useMenuMutations } from '@/hooks/useWedding'
import { SectionRings } from '@/components/event/SectionRings'

const SECTIONS: Array<{ key: string; label: string; group: string }> = [
  // Menu seduta tradizionale
  { key: 'BENVENUTO',           label: 'Aperitivo di benvenuto',  group: 'Menu seduta' },
  { key: 'ANTIPASTO',           label: 'Antipasti',                group: 'Menu seduta' },
  { key: 'PRIMO',               label: 'Primi piatti',             group: 'Menu seduta' },
  { key: 'SECONDO',             label: 'Secondi piatti',           group: 'Menu seduta' },
  { key: 'CONTORNO',            label: 'Contorni',                 group: 'Menu seduta' },
  { key: 'FRUTTA',              label: 'Frutta',                   group: 'Menu seduta' },
  { key: 'DOLCE',               label: 'Dolci',                    group: 'Menu seduta' },
  { key: 'TORTA',               label: 'Taglio torta',             group: 'Menu seduta' },
  { key: 'CAFFE',               label: 'Caffè',                    group: 'Menu seduta' },
  { key: 'BEVANDA',             label: 'Bevande',                  group: 'Menu seduta' },
  // Isole pre-cena
  { key: 'ISOLA_BENVENUTO',     label: 'Isola benvenuto',          group: 'Isole pre-cena' },
  { key: 'ISOLA_PRECENA',       label: 'Isola pre-cena (generica)',group: 'Isole pre-cena' },
  { key: 'ISOLA_SALUMI',        label: 'Isola salumi e formaggi',  group: 'Isole pre-cena' },
  { key: 'ISOLA_FRITTI',        label: 'Isola fritti caldi',       group: 'Isole pre-cena' },
  { key: 'ISOLA_PIZZA',         label: 'Isola pizza',              group: 'Isole pre-cena' },
  { key: 'ISOLA_PESCE_CRUDO',   label: 'Isola pesce crudo',        group: 'Isole pre-cena' },
  { key: 'ISOLA_PASTA_LIVE',    label: 'Isola pasta fresca live',  group: 'Isole pre-cena' },
  { key: 'ISOLA_FORMAGGI',      label: 'Isola formaggi DOP',       group: 'Isole pre-cena' },
  { key: 'SHOW_COOKING',        label: 'Show cooking',             group: 'Isole pre-cena' },
  // Isole / carrelli dopocena
  { key: 'ISOLA_DOPOCENA',      label: 'Isola dopocena (gelati ecc.)', group: 'Isole dopocena' },
  { key: 'ISOLA_DOLCI',         label: 'Isola dolci',              group: 'Isole dopocena' },
  { key: 'ISOLA_FRUTTA',        label: 'Isola frutta',             group: 'Isole dopocena' },
  { key: 'ISOLA_CIOCCOLATO',    label: 'Isola cioccolato',         group: 'Isole dopocena' },
  { key: 'CARRELLO_DISTILLATI', label: 'Carrello distillati',      group: 'Isole dopocena' },
  { key: 'CARRELLO_SIGARI',     label: 'Carrello sigari',          group: 'Isole dopocena' },
  { key: 'CARRELLO_GIN_TONIC',  label: 'Gin Tonic station',        group: 'Isole dopocena' },
  { key: 'CARRELLO_CAFFE_SPECIAL', label: 'Caffè con liquori',     group: 'Isole dopocena' },
  { key: 'OPEN_BAR',            label: 'Open bar',                 group: 'Isole dopocena' },
  { key: 'CONFETTATA',          label: 'Confettata',               group: 'Isole dopocena' },
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
  included_in_package: boolean
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
  included_in_package: false,
}

type Preset = {
  id: string
  section: string
  title: string
  description: string | null
  dietary_tags: string[] | null
  allergens: string[] | null
  typical_price_per_guest: number | null
  region: string | null
}

const _CL: Record<string, string> = { APERITIVO: 'Aperitivo', ANTIPASTO: 'Antipasti', PRIMO: 'Primi', SECONDO: 'Secondi', CONTORNO: 'Contorni', DOLCE: 'Dolce', FRUTTA: 'Frutta', BEVANDE: 'Bevande' }
const _CORD = ['APERITIVO', 'ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'FRUTTA', 'BEVANDE']
// Proposte di menu della location + risultati prova → la coppia sceglie (cross-tenant via RPC).
function LocationMenuProposals({ entryId, readOnly }: { entryId: string; readOnly?: boolean }) {
  const [d, setD] = useState<any>(null)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState('')
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await (supabase as any).rpc('fb_event_choice_view', { p_entry: entryId })
      if (alive) setD(data && data.ok ? data : null)
    })()
    return () => { alive = false }
  }, [entryId, reload])
  async function choose(menuId: string) {
    setBusy(menuId)
    try {
      const { data, error } = await (supabase as any).rpc('fb_member_choose', { p_entry: entryId, p_menu_id: menuId })
      if (error || data?.error) throw new Error(data?.error || 'errore')
      toast.success('Menu scelto! La location preparerà la spesa su questo.')
      setReload((n) => n + 1)
    } catch { toast.error('Scelta non riuscita') } finally { setBusy('') }
  }
  if (!d || !d.proposte?.length) return null
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg flex items-center gap-2 mb-1"><Sparkles size={18} /> Proposte di menu della location</h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">{d.prova ? 'Dopo la prova menu, scegli il menu per il vostro evento.' : 'Scegli il menu per il vostro evento.'}{d.coperti ? ` · ${d.coperti} coperti` : ''}</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {d.proposte.map((m: any) => {
          const byCourse: Record<string, string[]> = {}
          for (const p of m.piatti || []) { const k = p.portata || 'ANTIPASTO'; (byCourse[k] = byCourse[k] || []).push(p.piatto) }
          return (
            <div key={m.menu_id} className={`rounded-xl border p-3 ${m.scelto ? 'border-emerald-400 bg-emerald-50' : 'border-[rgb(var(--border))]'}`}>
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-semibold">{m.nome}</h4>
                {m.voti?.n > 0 && <span className="text-xs text-amber-600">★ {m.voti.media} ({m.voti.n})</span>}
              </div>
              <div className="space-y-1 mb-3">
                {_CORD.filter((c) => byCourse[c]).map((c) => (
                  <div key={c} className="text-xs"><span className="uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{_CL[c]}: </span><span className="text-[rgb(var(--fg-muted))]">{(byCourse[c] || []).join(', ')}</span></div>
                ))}
              </div>
              {m.scelto ? <Badge>Menu scelto</Badge> : !readOnly && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => choose(m.menu_id)}>{busy === m.menu_id ? '…' : 'Scegli questo'}</Button>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export function MenuTab({ entryId, readOnly = false }: { entryId: string; readOnly?: boolean }) {
  const { data, isLoading } = useMenu(entryId)
  const { add, update, remove } = useMenuMutations(entryId)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [open, setOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetFilter, setPresetFilter] = useState<string>('')

  useEffect(() => {
    if (!presetsOpen || readOnly) return
    void (async () => {
      const { data } = await (supabase.from('menu_presets' as any) as any)
        .select('id, section, title, description, dietary_tags, allergens, typical_price_per_guest, region')
        .eq('is_active', true)
        .order('section')
      setPresets((data ?? []) as Preset[])
    })()
  }, [presetsOpen, readOnly])

  const grouped = SECTIONS.map((s) => ({
    ...s,
    items: ((data as any[] | undefined) ?? []).filter((it) => it.section === s.key),
  }))

  async function importPreset(p: Preset) {
    try {
      await add.mutateAsync({
        section: p.section,
        title: p.title,
        description: p.description ?? undefined,
        dietary_tags: p.dietary_tags ?? [],
        allergens: p.allergens ?? [],
        price_per_guest: p.typical_price_per_guest ?? null,
      } as any)
      toast.success(`"${p.title}" importato`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const filteredPresets = presets.filter((p) => {
    if (!presetFilter) return true
    return p.section.toLowerCase().includes(presetFilter.toLowerCase())
        || p.title.toLowerCase().includes(presetFilter.toLowerCase())
        || (p.region ?? '').toLowerCase().includes(presetFilter.toLowerCase())
  })

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
      included_in_package: !!item.included_in_package,
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
      price_per_guest: form.included_in_package ? null : (form.price_per_guest ? Number(form.price_per_guest) : null),
      notes: form.notes.trim() || undefined,
      is_optional: form.is_optional,
      included_in_package: form.included_in_package,
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
      <SectionRings entryId={entryId} keys={['menu']} />
      <LocationMenuProposals entryId={entryId} readOnly={readOnly} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display text-2xl flex items-center gap-2">
            <Utensils size={20} /> Menù evento
          </h2>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
            {readOnly
              ? 'Il menu viene definito da WP / location. Usa "Suggerisci modifica" per richiedere variazioni.'
              : 'Definisci portate seduta, isole pre-cena, show cooking, isole dolci, carrelli bar. Diete + allergeni (Reg. UE 1169/2011).'}
          </p>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" onClick={() => setPresetsOpen(true)}>
            <BookOpen size={14} /> Importa da catalogo
          </Button>
        )}
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
                                {it.included_in_package ? (
                                  <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                                    ✓ Incluso nel pacchetto
                                  </span>
                                ) : it.price_per_guest ? (
                                  <span className="text-xs text-[rgb(var(--fg-muted))]">€ {Number(it.price_per_guest).toFixed(2)}/pax</span>
                                ) : null}
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

      {presetsOpen && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setPresetsOpen(false)}>
          <div className="surface surface-elev max-w-4xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <div>
                <h3 className="font-display text-xl flex items-center gap-2"><Sparkles size={18} /> Catalogo offerte</h3>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                  {filteredPresets.length} stazioni tipiche italiane (isole, show cooking, carrelli). Click "Importa" per aggiungere al tuo menu — modificabile dopo.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPresetsOpen(false)} aria-label="Chiudi"><XIcon size={16} /></Button>
            </div>
            <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <Input placeholder="Filtra per sezione, titolo, regione (es. 'sicilia', 'sigari', 'pizza')..."
                value={presetFilter} onChange={(e) => setPresetFilter(e.target.value)} />
            </div>
            <div className="overflow-y-auto p-4 flex-1 space-y-2">
              {filteredPresets.map((p) => {
                const secLabel = SECTIONS.find((s) => s.key === p.section)?.label ?? p.section
                return (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <h4 className="font-medium">{p.title}</h4>
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                            {secLabel}
                          </span>
                          {p.region && <span className="text-[10px] text-[rgb(var(--fg-subtle))]">{p.region}</span>}
                          {p.typical_price_per_guest && (
                            <span className="text-xs text-[rgb(var(--fg-muted))]">~€ {p.typical_price_per_guest}/pax</span>
                          )}
                        </div>
                        {p.description && <p className="text-sm text-[rgb(var(--fg-muted))] mt-1.5 leading-relaxed">{p.description}</p>}
                        {((p.dietary_tags?.length ?? 0) > 0 || (p.allergens?.length ?? 0) > 0) && (
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            {(p.dietary_tags ?? []).map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--sage-100))', color: 'rgb(var(--sage-700))' }}>{t}</span>
                            ))}
                            {(p.allergens ?? []).map((a) => (
                              <span key={a} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-700))' }}>{a}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="gold" size="sm" onClick={() => importPreset(p)} disabled={add.isPending}>
                        <Plus size={13} /> Importa
                      </Button>
                    </div>
                  </Card>
                )
              })}
              {filteredPresets.length === 0 && (
                <p className="text-sm text-center text-[rgb(var(--fg-muted))] py-12">Nessun preset corrisponde al filtro.</p>
              )}
            </div>
          </div>
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
              <div>
                <label className="inline-flex items-start gap-2 text-sm cursor-pointer p-2 rounded-md border" style={{ borderColor: form.included_in_package ? 'rgb(var(--gold-500))' : 'rgb(var(--border))', background: form.included_in_package ? 'rgb(var(--bg-sunken))' : 'transparent' }}>
                  <input type="checkbox" className="mt-0.5" checked={form.included_in_package}
                    onChange={(e) => setForm({ ...form, included_in_package: e.target.checked, price_per_guest: e.target.checked ? '' : form.price_per_guest })} />
                  <span className="flex-1">
                    <span className="font-medium">Inclusa nel prezzo a persona del pacchetto</span>
                    <span className="block text-[11px] text-[rgb(var(--fg-muted))]">Se il pacchetto del preventivo è "tutto incluso", questa voce non si somma al totale.</span>
                  </span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="menu-price">Prezzo €/persona</Label>
                  <Input id="menu-price" type="number" min="0" step="0.5"
                    value={form.included_in_package ? '' : form.price_per_guest}
                    onChange={(e) => setForm({ ...form, price_per_guest: e.target.value })}
                    disabled={form.included_in_package}
                    placeholder={form.included_in_package ? 'Incluso nel pacchetto' : ''}
                  />
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
