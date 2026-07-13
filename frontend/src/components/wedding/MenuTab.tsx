import { useEffect, useState, useRef } from 'react'
import { Plus, Trash2, Pencil, Utensils, Leaf, AlertCircle, Save, X as XIcon, BookOpen, Sparkles, CalendarClock, Star, Check, Wallet, Lock, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useMenu, useMenuMutations } from '@/hooks/useWedding'
import { SectionRings } from '@/components/event/SectionRings'
import { PackagesPanel } from './PackagesPanel'

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

// Portata (fb) → sezione "Menù evento": i piatti della proposta scendono nella loro sezione.
const COURSE_TO_SECTION: Record<string, string> = {
  APERITIVO: 'BENVENUTO', ANTIPASTO: 'ANTIPASTO', PRIMO: 'PRIMO', SECONDO: 'SECONDO',
  CONTORNO: 'CONTORNO', DOLCE: 'DOLCE', FRUTTA: 'FRUTTA', BEVANDE: 'BEVANDA',
}
const COURSE_OPTIONS = ['APERITIVO', 'ANTIPASTO', 'PRIMO', 'SECONDO', 'CONTORNO', 'DOLCE', 'FRUTTA', 'BEVANDE']
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const mese = (m: number) => MESI[(m - 1) % 12] ?? ''
type DishSeason = { from: number; to: number } | null
type ProposalDish = { menu_item_id: string; portata: string; piatto: string; confermato: boolean; voti: { media: number | null; n: number } | null; menu_nome: string; season?: DishSeason; disponibile?: boolean; descrizione?: string | null; foto?: string | null; costo?: number | null }

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

  // Proposta della location scomposta piatto-per-piatto: voto 1-5 + conferma → food cost/dispensa.
  const [choice, setChoice] = useState<any>(null)
  const [choiceReload, setChoiceReload] = useState(0)
  const [busyDish, setBusyDish] = useState('')
  const [fc, setFc] = useState<any>(null)
  const [unlocked, setUnlocked] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: cv } = await (supabase as any).rpc('fb_event_choice_view', { p_entry: entryId })
      const { data: f } = await (supabase as any).rpc('fb_event_foodcost', { p_entry: entryId })
      const { data: ul } = await (supabase as any).rpc('fb_menu_unlocked', { p_entry: entryId })
      if (alive) { setChoice(cv && cv.ok ? cv : null); setFc(f && f.ok ? f : null); setUnlocked(ul === true) }
    })()
    return () => { alive = false }
  }, [entryId, choiceReload])

  const dishesBySection: Record<string, ProposalDish[]> = {}
  for (const m of choice?.proposte ?? []) {
    for (const p of m.piatti ?? []) {
      const sec = COURSE_TO_SECTION[p.portata] ?? 'ANTIPASTO'
      ;(dishesBySection[sec] = dishesBySection[sec] || []).push({ ...p, menu_nome: m.nome })
    }
  }
  const confermatiN = Object.values(dishesBySection).flat().filter((d) => d.confermato).length
  const allDishes = (choice?.proposte ?? []).flatMap((m: any) => (m.piatti ?? []).map((p: any) => ({ menu_item_id: p.menu_item_id, piatto: p.piatto, portata: p.portata })))
  const coperti = (fc?.coperti ?? choice?.coperti ?? 0) as number
  // Vincoli per portata (min/max) dal paniere + stato composizione per il tasto "Genera menù".
  const vincoli: Record<string, { min: number; max: number }> = {}
  for (const m of choice?.proposte ?? []) for (const [c, v] of Object.entries(m.vincoli ?? {})) vincoli[c] = v as { min: number; max: number }
  const selByCourse: Record<string, number> = {}
  for (const d of Object.values(dishesBySection).flat()) if (d.confermato) selByCourse[d.portata] = (selByCourse[d.portata] || 0) + 1
  const mancanti = Object.entries(vincoli).filter(([c, v]) => (selByCourse[c] || 0) < v.min).map(([c]) => c)
  const composizioneCompleta = Object.keys(vincoli).length > 0 && mancanti.length === 0
  const [genBusy, setGenBusy] = useState(false)
  async function generaMenu() {
    setGenBusy(true)
    try {
      const { data: r, error } = await (supabase as any).rpc('fb_generate_event_menu', { p_entry: entryId })
      if (error || r?.error) throw new Error()
      toast.success(`Menù ufficiale generato (${r.inseriti} portate) — ora è pronto nella stampa`)
      setChoiceReload((x) => x + 1)
    } catch { toast.error('Generazione menù non riuscita') } finally { setGenBusy(false) }
  }
  // Foto piatto (lato location): upload nel bucket fb-dish-photos + salva l'URL sul piatto.
  const photoInput = useRef<HTMLInputElement>(null)
  const photoTarget = useRef<string>('')
  async function uploadDishPhoto(mi: string, file: File) {
    setBusyDish(mi + ':p')
    try {
      const { data: u } = await supabase.auth.getUser()
      const uid = u?.user?.id; if (!uid) throw new Error()
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${uid}/${mi}.${ext}`
      const up = await supabase.storage.from('fb-dish-photos').upload(path, file, { upsert: true, cacheControl: '3600' })
      if (up.error) throw up.error
      const { data: pub } = supabase.storage.from('fb-dish-photos').getPublicUrl(path)
      const url = `${pub.publicUrl}?v=${Date.now()}`
      const { data: r, error } = await (supabase as any).rpc('fb_dish_set_photo', { p_menu_item_id: mi, p_url: url })
      if (error || r?.error) throw new Error()
      toast.success('Foto del piatto caricata')
      setChoiceReload((x) => x + 1)
    } catch { toast.error('Foto non caricata') } finally { setBusyDish('') }
  }

  async function voteDish(mi: string, n: number) {
    setBusyDish(mi + ':v')
    try {
      const { data: r, error } = await (supabase as any).rpc('fb_dish_vote', { p_entry: entryId, p_menu_item_id: mi, p_score: n })
      if (error || r?.error) throw new Error()
      setChoiceReload((x) => x + 1)
    } catch { toast.error('Voto non riuscito') } finally { setBusyDish('') }
  }
  async function confirmDish(mi: string, on: boolean) {
    setBusyDish(mi + ':c')
    try {
      const { data: r, error } = await (supabase as any).rpc('fb_dish_confirm', { p_entry: entryId, p_menu_item_id: mi, p_on: on })
      if (error || r?.error) throw new Error()
      toast.success(on ? 'Piatto confermato — entra nel food cost e nella dispensa' : 'Selezione annullata')
      setChoiceReload((x) => x + 1)
    } catch { toast.error('Operazione non riuscita') } finally { setBusyDish('') }
  }

  const [dishEdit, setDishEdit] = useState<{ mi: string; name: string; course: string; from: number; to: number } | null>(null)
  async function saveDishEdit() {
    if (!dishEdit) return
    setBusyDish(dishEdit.mi + ':e')
    try {
      const { data: r, error } = await (supabase as any).rpc('fb_dish_update', {
        p_menu_item_id: dishEdit.mi,
        p_name: dishEdit.name.trim() || null,
        p_course: dishEdit.course,
        p_season_from: dishEdit.from === 0 ? 0 : dishEdit.from,
        p_season_to: dishEdit.from === 0 ? 0 : dishEdit.to,
      })
      if (error || r?.error) throw new Error()
      toast.success('Piatto aggiornato')
      setDishEdit(null)
      setChoiceReload((x) => x + 1)
    } catch { toast.error('Modifica non riuscita') } finally { setBusyDish('') }
  }

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

  if (readOnly && unlocked === false) {
    const provaWhen = choice?.prova?.quando ? new Date(choice.prova.quando).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : null
    return (
      <div className="space-y-6">
        <SectionRings entryId={entryId} keys={['menu']} />
        <Card className="p-8 text-center max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] grid place-items-center mx-auto mb-4"><Lock size={26} /></div>
          <h2 className="font-display text-xl mb-2">La scelta del menu si sblocca dopo la prova menu</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Avete ricevuto un invito alla degustazione: controllate <span className="font-medium">email</span> e <span className="font-medium">WhatsApp</span> e confermate la data. Appena confermate, qui si attiva la degustazione e la scelta del vostro menu.</p>
          {provaWhen && <p className="text-sm mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]"><CalendarClock size={15} /> {provaWhen}{choice?.prova?.sala ? ` · ${choice.prova.sala}` : ''}</p>}
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionRings entryId={entryId} keys={['menu']} />
      {choice?.prova && (
        <div className="flex items-start gap-3 rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))] px-4 py-3">
          <CalendarClock size={18} className="text-[rgb(var(--gold-700))] shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Prova menu{choice.prova.status === 'SVOLTA' || choice.prova.status === 'CONCLUSA' ? ' · svolta' : ''}</p>
            <p className="text-[rgb(var(--fg-muted))]">
              {choice.prova.quando ? new Date(choice.prova.quando).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : 'Data da definire'}
              {choice.prova.sala ? ` · ${choice.prova.sala}` : ''} — votate ogni piatto qui sotto (1–5) e confermate quelli scelti.
            </p>
          </div>
        </div>
      )}
      {confermatiN > 0 && fc && (
        <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--sage-100))] px-4 py-3">
          <Wallet size={18} className="text-[rgb(var(--sage-700))] shrink-0" />
          <p className="text-sm">
            <span className="font-medium">{confermatiN} piatti confermati</span> · food cost stimato{' '}
            <span className="font-semibold">€ {Number(fc.cost_per_cover).toFixed(2)}/coperto</span> su {fc.coperti} coperti
            {' '}(€ {Number(fc.total_cost).toFixed(2)} totali). Alimenta fabbisogno e dispensa.
          </p>
        </div>
      )}
      {(Object.keys(vincoli).length > 0 || confermatiN > 0) && (
        <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--gold-200))] bg-[rgb(var(--gold-50,250_246_237))] px-4 py-3 flex-wrap">
          <Utensils size={18} className="text-[rgb(var(--gold-700))] shrink-0" />
          <p className="text-sm flex-1 min-w-[12rem]">
            <span className="font-medium">Menù dell'evento</span>{' '}
            {Object.keys(vincoli).length > 0 ? (
              composizioneCompleta
                ? <span className="text-[rgb(var(--sage-700))]">composizione completa — puoi generarlo per la stampa.</span>
                : <span className="text-[rgb(var(--fg-muted))]">mancano ancora: {mancanti.map((c) => SECTIONS.find((s) => s.key === COURSE_TO_SECTION[c])?.label ?? c).join(', ')}.</span>
            ) : <span className="text-[rgb(var(--fg-muted))]">{confermatiN} piatti scelti.</span>}
          </p>
          <Button variant="gold" size="sm" disabled={genBusy || (Object.keys(vincoli).length > 0 ? !composizioneCompleta : confermatiN === 0)} onClick={generaMenu}>
            <BookOpen size={14} /> {genBusy ? 'Genero…' : 'Genera menù'}
          </Button>
        </div>
      )}
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
          <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadDishPhoto(photoTarget.current, f) }} />
          {grouped.map((sec) => (
            (sec.items.length > 0 || (dishesBySection[sec.key]?.length ?? 0) > 0 || !readOnly) && (
              <section key={sec.key}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-lg flex items-baseline gap-2" style={{ color: 'rgb(var(--gold-700))' }}>
                    {sec.label}
                    {(() => { const c = COURSE_OPTIONS.find((k) => COURSE_TO_SECTION[k] === sec.key); const v = c ? vincoli[c] : undefined; if (!v) return null; const n = c ? (selByCourse[c] || 0) : 0
                      return <span className="text-[11px] font-normal text-[rgb(var(--fg-muted))]">scegli {v.min === v.max ? v.min : `${v.min}–${v.max}`} · {n} scelt{n === 1 ? 'o' : 'i'}</span> })()}
                  </h3>
                  {!readOnly && (
                    <Button variant="ghost" size="sm" onClick={() => openCreate(sec.key)}>
                      <Plus size={14} /> Aggiungi
                    </Button>
                  )}
                </div>
                {sec.items.length === 0 && (dishesBySection[sec.key]?.length ?? 0) === 0 ? (
                  <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna voce inserita</p>
                ) : (
                  <ul className="space-y-2">
                    {(dishesBySection[sec.key] ?? []).map((d) => {
                      const fuori = d.disponibile === false
                      return (
                      <li key={d.menu_item_id}>
                        <Card className={`p-3.5 ${d.confermato ? 'ring-1 ring-[rgb(var(--sage-500))] bg-[rgb(var(--sage-100))]/40' : ''} ${fuori ? 'opacity-60' : ''}`}>
                          <div className="flex items-start gap-3">
                            {d.foto && <img src={d.foto} alt={d.piatto} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-[rgb(var(--border))]" />}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{d.piatto}</span>
                                {d.confermato && (
                                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--sage-500))', color: 'white' }}>
                                    <Check size={10} /> Scelto
                                  </span>
                                )}
                                {d.season && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                                    {mese(d.season.from)}–{mese(d.season.to)}
                                  </span>
                                )}
                                {fuori && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-700))' }}>
                                    fuori stagione
                                  </span>
                                )}
                              </div>
                              {d.descrizione && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{d.descrizione}</p>}
                              {fuori ? (
                                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1.5 italic">Non disponibile per la data del matrimonio{d.season ? ` (solo ${mese(d.season.from)}–${mese(d.season.to)})` : ''}.</p>
                              ) : (
                                <div className="flex items-center gap-1 mt-1.5">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button key={n} disabled={busyDish === d.menu_item_id + ':v'} onClick={() => voteDish(d.menu_item_id, n)} className="p-0.5 disabled:opacity-50" aria-label={`${n} stelle`}>
                                      <Star size={18} className={Math.round(d.voti?.media ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
                                    </button>
                                  ))}
                                  {d.voti?.n ? (
                                    <span className="ml-1 text-xs text-[rgb(var(--fg-muted))]">{d.voti.media}/5 · {d.voti.n} {d.voti.n === 1 ? 'voto' : 'voti'}</span>
                                  ) : (
                                    <span className="ml-1 text-xs text-[rgb(var(--fg-subtle))]">da votare</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 flex items-center gap-1">
                              {!readOnly && (
                                <Button variant="ghost" size="icon" aria-label="Foto piatto" disabled={busyDish === d.menu_item_id + ':p'}
                                  onClick={() => { photoTarget.current = d.menu_item_id; photoInput.current?.click() }}>
                                  <ImagePlus size={14} />
                                </Button>
                              )}
                              {!readOnly && (
                                <Button variant="ghost" size="icon" aria-label="Modifica piatto"
                                  onClick={() => setDishEdit({ mi: d.menu_item_id, name: d.piatto, course: d.portata || 'ANTIPASTO', from: d.season?.from ?? 0, to: d.season?.to ?? d.season?.from ?? 9 })}>
                                  <Pencil size={14} />
                                </Button>
                              )}
                              {!fuori && (d.confermato ? (
                                <Button variant="ghost" size="sm" disabled={busyDish === d.menu_item_id + ':c'} onClick={() => confirmDish(d.menu_item_id, false)}>Annulla</Button>
                              ) : (
                                <Button variant="gold" size="sm" disabled={busyDish === d.menu_item_id + ':c'} onClick={() => confirmDish(d.menu_item_id, true)}><Check size={13} /> Conferma</Button>
                              ))}
                            </div>
                          </div>
                        </Card>
                      </li>
                    )})}
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

      {(allDishes.length > 0 || !readOnly) && (
        <PackagesPanel entryId={entryId} dishes={allDishes} coperti={coperti} readOnly={readOnly} />
      )}

      {dishEdit && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setDishEdit(null)}>
          <div className="surface surface-elev max-w-md w-full p-6 rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl">Modifica piatto</h3>
              <Button variant="ghost" size="icon" onClick={() => setDishEdit(null)} aria-label="Chiudi"><XIcon size={16} /></Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="de-name">Nome piatto</Label>
                <Input id="de-name" value={dishEdit.name} onChange={(e) => setDishEdit({ ...dishEdit, name: e.target.value })} placeholder="Es. Risotto nduja e gambero rosso" />
              </div>
              <div>
                <Label htmlFor="de-course">Portata</Label>
                <select id="de-course" value={dishEdit.course} onChange={(e) => setDishEdit({ ...dishEdit, course: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                  {COURSE_OPTIONS.map((c) => <option key={c} value={c}>{SECTIONS.find((s) => s.key === COURSE_TO_SECTION[c])?.label ?? c}</option>)}
                </select>
              </div>
              <div>
                <Label>Stagionalità (proposto solo per matrimoni in questo periodo)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <select value={dishEdit.from} onChange={(e) => setDishEdit({ ...dishEdit, from: Number(e.target.value) })}
                    className="h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                    <option value={0}>Tutto l'anno</option>
                    {MESI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                  {dishEdit.from !== 0 && (
                    <>
                      <span className="text-sm text-[rgb(var(--fg-muted))]">→</span>
                      <select value={dishEdit.to} onChange={(e) => setDishEdit({ ...dishEdit, to: Number(e.target.value) })}
                        className="h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
                        {MESI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1">Ricorrente ogni anno. Es. giu → set = disponibile solo in estate. Se il periodo scavalca l'anno (es. nov → feb) copre l'inverno.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <Button variant="ghost" onClick={() => setDishEdit(null)}>Annulla</Button>
                <Button variant="gold" onClick={saveDishEdit} disabled={busyDish === dishEdit.mi + ':e'}><Save size={14} /> Salva</Button>
              </div>
            </div>
          </div>
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
