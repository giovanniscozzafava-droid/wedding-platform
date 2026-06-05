import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, Reorder } from 'framer-motion'
import { Plus, Search, Sparkles, Image as ImageIcon, SlidersHorizontal, X as XIcon, GripVertical, ArrowDownUp, Check, PackageCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { ServiceForm } from '@/components/catalog/ServiceForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDeleteService, useReorderServices, useServices, type ServiceWithExtras } from '@/hooks/useCatalog'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useProfessione } from '@/hooks/useProfessione'
import { PackImportPicker } from '@/components/professione/PackImportPicker'

type Filters = {
  q: string
  unit: '' | 'PEZZO' | 'PERSONA' | 'ORA' | 'EVENTO'
  hasPhoto: boolean
  hasModifier: boolean
  priceMin: string
  priceMax: string
  supplierId: string
}

export default function CatalogPage() {
  const { profile } = useAuth()
  const { data, isLoading, error } = useServices({ onlyActive: false })
  const { data: suppliers } = useSuppliers()
  const { data: professione } = useProfessione()
  const del = useDeleteService()
  const [editing, setEditing] = useState<ServiceWithExtras | null>(null)
  const [viewing, setViewing] = useState<ServiceWithExtras | null>(null)
  const [creating, setCreating] = useState(false)
  const [showPackPicker, setShowPackPicker] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [reorderList, setReorderList] = useState<ServiceWithExtras[]>([])
  const reorder = useReorderServices()
  const [searchParams, setSearchParams] = useSearchParams()

  // Onboarding fornitore: ?firstOffer=1 apre direttamente il modal Nuovo servizio
  useEffect(() => {
    if (searchParams.get('firstOffer') === '1' && profile?.role === 'FORNITORE') {
      setCreating(true)
      const params = new URLSearchParams(searchParams)
      params.delete('firstOffer')
      setSearchParams(params, { replace: true })
    }
  }, [searchParams, profile?.role, setSearchParams])
  const [filters, setFilters] = useState<Filters>({
    q: '', unit: '', hasPhoto: false, hasModifier: false, priceMin: '', priceMax: '', supplierId: '',
  })
  const [filtersOpen, setFiltersOpen] = useState(false)

  // WP e LOCATION possono emettere propri servizi (organizzazione/coordinamento)
  // oltre a vedere il catalogo di rete. Fornitore solo i propri.
  const isProvider = profile?.role === 'FORNITORE' || profile?.role === 'LOCATION' || profile?.role === 'WEDDING_PLANNER'
  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'ADMIN'

  const filtered = useMemo(() => {
    if (!data) return []
    const t = filters.q.trim().toLowerCase()
    const min = filters.priceMin ? Number(filters.priceMin) : -Infinity
    const max = filters.priceMax ? Number(filters.priceMax) : Infinity
    return data.filter((s) => {
      if (t && !(
        s.name.toLowerCase().includes(t) ||
        (s.description ?? '').toLowerCase().includes(t) ||
        (s.service_categories?.name ?? '').toLowerCase().includes(t) ||
        (((s as { tags?: string[] }).tags) ?? []).some((tag) => tag.toLowerCase().includes(t))
      )) return false
      if (filters.unit && s.unit !== filters.unit) return false
      if (filters.hasPhoto && s.service_photos.length === 0) return false
      if (filters.hasModifier && s.service_modifiers.length === 0) return false
      if (s.base_price < min || s.base_price > max) return false
      if (filters.supplierId && s.fornitore_id !== filters.supplierId) return false
      return true
    })
  }, [data, filters])

  // Raggruppa per fornitore SOLO per capostipite (lo provider vede solo i suoi)
  const grouped = useMemo(() => {
    if (!isCapostipite) return null
    const out = new Map<string, ServiceWithExtras[]>()
    for (const s of filtered) {
      const arr = out.get(s.fornitore_id) ?? []
      arr.push(s)
      out.set(s.fornitore_id, arr)
    }
    return [...out.entries()]
  }, [filtered, isCapostipite])

  // Per fornitore: raggruppa per categoria
  const groupedByCategory = useMemo(() => {
    if (isCapostipite) return null
    const out = new Map<string, ServiceWithExtras[]>()
    for (const s of filtered) {
      const k = s.service_categories?.name ?? 'Altro'
      const arr = out.get(k) ?? []
      arr.push(s)
      out.set(k, arr)
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered, isCapostipite])

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow={professione?.nome ?? 'Catalogo'}
          title={
            isProvider
              ? (professione?.etichette.catalogo_label ?? 'I tuoi servizi')
              : 'Catalogo di rete'
          }
          description={
            isProvider
              ? (professione?.etichette.servizio_label
                  ? `${professione.etichette.servizio_label}. Aggiorna prezzi e foto in qualsiasi momento.`
                  : 'Servizi raggruppati per categoria. Aggiorna prezzi e foto in qualsiasi momento.')
              : `${filtered.length} servizi visibili dai tuoi ${suppliers?.length ?? 0} fornitori collaboranti.`
          }
          actions={
            isProvider && (
              <div className="flex flex-wrap gap-2">
                {!reorderMode ? (
                  <Button variant="outline" onClick={() => {
                    setReorderList([...filtered].sort((a, b) => {
                      const ao = (a as ServiceWithExtras & { display_order?: number }).display_order ?? 0
                      const bo = (b as ServiceWithExtras & { display_order?: number }).display_order ?? 0
                      return ao - bo
                    }))
                    setReorderMode(true)
                  }} data-testid="reorder-btn">
                    <ArrowDownUp /> Riordina
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setReorderMode(false)}>
                      Annulla
                    </Button>
                    <Button variant="gold" disabled={reorder.isPending} onClick={async () => {
                      try {
                        await reorder.mutateAsync(reorderList.map((s) => s.id))
                        toast.success('Ordine salvato')
                        setReorderMode(false)
                      } catch (e) {
                        toast.error((e as Error).message)
                      }
                    }}>
                      <Check /> {reorder.isPending ? 'Salvataggio…' : 'Salva ordine'}
                    </Button>
                  </>
                )}
                {professione && professione.slug !== 'generico' && (
                  <Button variant="outline" onClick={() => setShowPackPicker(true)} data-testid="import-pack-btn">
                    <PackageCheck /> Starter pack
                  </Button>
                )}
                <Button variant="gold" onClick={() => setCreating(true)} data-testid="new-service-btn">
                  <Plus /> Nuovo servizio
                </Button>
              </div>
            )
          }
        />

        {/* Filtri */}
        <div className="mb-6 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-9" placeholder="Cerca per nome, categoria o descrizione..."
              value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </div>
          <Button variant="outline" onClick={() => setFiltersOpen((x) => !x)}>
            <SlidersHorizontal /> Filtri
          </Button>
        </div>

        {filtersOpen && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="surface p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Unità</label>
              <select className="mt-1 w-full h-9 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-sm"
                value={filters.unit} onChange={(e) => setFilters((f) => ({ ...f, unit: e.target.value as Filters['unit'] }))}>
                <option value="">Tutte</option>
                <option value="PEZZO">Pezzo</option>
                <option value="PERSONA">Persona</option>
                <option value="ORA">Ora</option>
                <option value="EVENTO">Evento</option>
              </select>
            </div>
            {isCapostipite && (
              <div>
                <label className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))]">Fornitore</label>
                <select className="mt-1 w-full h-9 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-sm"
                  value={filters.supplierId} onChange={(e) => setFilters((f) => ({ ...f, supplierId: e.target.value }))}>
                  <option value="">Tutti</option>
                  {(suppliers ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.business_name ?? s.full_name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <Input type="number" placeholder="€ min" value={filters.priceMin}
                onChange={(e) => setFilters((f) => ({ ...f, priceMin: e.target.value }))} />
              <Input type="number" placeholder="€ max" value={filters.priceMax}
                onChange={(e) => setFilters((f) => ({ ...f, priceMax: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1 pt-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                  checked={filters.hasPhoto} onChange={(e) => setFilters((f) => ({ ...f, hasPhoto: e.target.checked }))} />
                Solo con foto
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                  checked={filters.hasModifier} onChange={(e) => setFilters((f) => ({ ...f, hasModifier: e.target.checked }))} />
                Solo con modificatori
              </label>
            </div>
          </motion.div>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="surface overflow-hidden">
                <div className="skeleton h-40" />
                <div className="p-5 space-y-3"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-full" /></div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-[rgb(var(--rose-500))]">{(error as Error).message}</p>}

        {!isLoading && filtered.length === 0 && (
          <EmptyState
            isProvider={isProvider}
            onCreate={() => setCreating(true)}
            emptyLabel={professione?.etichette.empty_state ?? null}
            onImport={professione && professione.slug !== 'generico' ? () => setShowPackPicker(true) : undefined}
          />
        )}

        {/* In cima: I MIEI SERVIZI (tutti i servizi che il capostipite offre) */}
        {isCapostipite && profile?.id && (() => {
          const mine = (grouped ?? []).find(([sid]) => sid === profile.id)?.[1] ?? []
          if (mine.length === 0) return null
          return (
            <section className="mb-12">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[rgb(var(--gold-500))]">⭐</span>
                <h3 className="font-display text-xl">I miei servizi</h3>
                <span className="text-xs text-[rgb(var(--fg-subtle))]">{mine.length} {mine.length === 1 ? 'voce' : 'voci'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {mine.map((s) => (
                  <ServiceCard key={s.id} s={s} isProvider
                    onEdit={() => setEditing(s)}
                    onDelete={async () => {
                      if (!confirm(`Eliminare "${s.name}"?`)) return
                      try { await del.mutateAsync(s.id); toast.success('Eliminato') }
                      catch (e) { toast.error((e as Error).message) }
                    }} />
                ))}
              </div>
            </section>
          )
        })()}

        {/* Vista capostipite: raggruppa per fornitore (esclusi i miei) */}
        {isCapostipite && grouped && grouped.filter(([sid]) => sid !== profile?.id).length > 0 && (
          <div className="space-y-12">
            {grouped.filter(([sid]) => sid !== profile?.id).map(([supId, items]) => {
              const sup = suppliers?.find((s) => s.id === supId)
              return (
                <section key={supId}>
                  <Link to={`/suppliers/${supId}`} className="flex items-center gap-3 mb-4 group">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-white border flex items-center justify-center p-0.5"
                      style={{ borderColor: 'rgb(var(--border))' }}>
                      <img src={sup?.avatar_url ?? ''} alt=""
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-lg group-hover:underline">{sup?.business_name ?? sup?.full_name ?? 'Fornitore'}</h3>
                      <p className="text-xs text-[rgb(var(--fg-subtle))]">
                        {sup?.subrole ?? ''} · {items.length} {items.length === 1 ? 'voce' : 'voci'}
                      </p>
                    </div>
                  </Link>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items.map((s) => <ServiceCard key={s.id} s={s} isProvider={false} onView={() => setViewing(s)} />)}
                  </div>
                </section>
              )
            })}
          </div>
        )}

        {/* Modalità riordina: lista flat con drag-and-drop */}
        {isProvider && reorderMode && (
          <div className="surface p-4">
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
              Trascina le card per riordinarle. L'ordine sarà visibile a te e ai capostipiti della tua rete.
            </p>
            <Reorder.Group axis="y" values={reorderList} onReorder={setReorderList} className="space-y-2">
              {reorderList.map((s) => (
                <Reorder.Item
                  key={s.id}
                  value={s}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-[rgb(var(--bg-elev))] cursor-grab active:cursor-grabbing"
                  style={{ borderColor: 'rgb(var(--border))' }}
                  whileDrag={{ scale: 1.02, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
                  <GripVertical size={16} className="text-[rgb(var(--fg-subtle))] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.name}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">
                      {s.service_categories?.name ?? 'Senza categoria'} · € {Number(s.base_price).toLocaleString('it-IT')}
                    </p>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )}

        {/* Vista fornitore: raggruppa per categoria */}
        {!isCapostipite && !reorderMode && groupedByCategory && groupedByCategory.length > 0 && (
          <div className="space-y-10">
            {groupedByCategory.map(([category, items]) => (
              <section key={category}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-display text-xl">{category}</h3>
                  <span className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                    {items.length} {items.length === 1 ? 'voce' : 'voci'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((s) => (
                    <ServiceCard key={s.id} s={s} isProvider={isProvider}
                      onEdit={() => setEditing(s)}
                      onDelete={async () => {
                        if (!confirm(`Eliminare "${s.name}"?`)) return
                        try { await del.mutateAsync(s.id); toast.success('Eliminato') }
                        catch (e) { toast.error((e as Error).message) }
                      }} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ServiceForm
          subrole={profile?.subrole ?? (profile?.role === 'WEDDING_PLANNER' ? 'wedding_planner' : profile?.role === 'LOCATION' ? 'location' : null)}
          service={editing}
          onClose={() => { setEditing(null); setCreating(false) }}
        />
      )}

      {viewing && <ServiceDetailModal s={viewing} onClose={() => setViewing(null)} />}

      {showPackPicker && (
        <PackImportPicker
          onClose={() => setShowPackPicker(false)}
          onImported={() => setShowPackPicker(false)}
        />
      )}
    </div>
  )
}

function ServiceDetailModal({ s, onClose }: { s: ServiceWithExtras; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="surface surface-elev max-w-3xl w-full max-h-[90vh] flex flex-col rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-xl truncate">{s.name}</h2>
              {!s.is_active && <Badge tone="rose">Inattivo</Badge>}
            </div>
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
              € {Number(s.base_price).toLocaleString('it-IT')} / {s.unit.toLowerCase()}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi"><XIcon size={18} /></Button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {s.service_photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {s.service_photos.map((ph) => (
                <a key={ph.id} href={ph.original_url} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-[rgb(var(--bg-sunken))]">
                  <img src={ph.thumbnail_url} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform" />
                </a>
              ))}
            </div>
          )}
          {s.description && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Descrizione</p>
              <p className="text-sm whitespace-pre-line leading-relaxed">{s.description}</p>
            </div>
          )}
          {s.service_modifiers.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Modificatori prezzo</p>
              <ul className="space-y-2">
                {s.service_modifiers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-[rgb(var(--fg-muted))]">
                      {m.modifier_type === 'PERCENT' ? `${m.value}%` : `€ ${m.value}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ServiceCard({ s, isProvider, onEdit, onDelete, onView }: {
  s: ServiceWithExtras
  isProvider: boolean
  onEdit?: () => void
  onDelete?: () => void
  onView?: () => void
}) {
  // La card intera è cliccabile: per fornitore apre l'edit, per WP apre dettaglio read-only.
  const handleCardClick = () => {
    if (isProvider && onEdit) onEdit()
    else if (onView) onView()
  }
  const clickable = isProvider ? !!onEdit : !!onView
  return (
    <motion.article data-testid={`service-card-${s.id}`}
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
      onClick={clickable ? handleCardClick : undefined}
      className={`surface surface-elev overflow-hidden group transition-all ${clickable ? 'cursor-pointer hover:shadow-[var(--shadow-lift)] hover:border-[rgb(var(--gold-500))]' : 'hover:shadow-[var(--shadow-lift)]'}`}>
      <div className="relative aspect-[16/10] bg-[rgb(var(--bg-sunken))] overflow-hidden">
        {s.service_photos[0] ? (
          <img src={s.service_photos[0].thumbnail_url} alt={s.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--fg-subtle))]">
            <ImageIcon size={28} strokeWidth={1.4} />
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {!s.is_active && <Badge tone="rose">Inattivo</Badge>}
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <h3 className="font-medium text-base leading-snug">{s.name}</h3>
          {s.description && (
            <p className="text-sm text-[rgb(var(--fg-muted))] line-clamp-2 mt-1">{s.description}</p>
          )}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl tabular-nums">€ {Number(s.base_price).toLocaleString('it-IT')}</span>
          <span className="text-xs text-[rgb(var(--fg-subtle))] uppercase tracking-wide">
            /{s.unit.toLowerCase()}
          </span>
        </div>
        {s.service_modifiers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {s.service_modifiers.slice(0, 3).map((m) => (
              <Badge key={m.id} tone="sage">{m.name}</Badge>
            ))}
            {s.service_modifiers.length > 3 && <Badge tone="neutral">+{s.service_modifiers.length - 3}</Badge>}
          </div>
        )}
        {isProvider && onEdit && onDelete && (
          <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`edit-${s.id}`}>Modifica</Button>
            <Button variant="ghost" size="sm" onClick={onDelete}>Elimina</Button>
          </div>
        )}
      </div>
    </motion.article>
  )
}

function EmptyState({ isProvider, onCreate, emptyLabel, onImport }: {
  isProvider: boolean
  onCreate: () => void
  emptyLabel?: string | null
  onImport?: () => void
}) {
  return (
    <div className="surface surface-elev p-8 sm:p-12 text-center max-w-xl mx-auto">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
        style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
        <Sparkles size={20} />
      </span>
      <h3 className="font-display text-xl mb-1">
        {emptyLabel ?? 'Nessun servizio'}
      </h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        {isProvider
          ? 'Inizia aggiungendo il tuo primo servizio o importa lo starter pack della tua professione.'
          : 'Aggiungi fornitori dalla pagina Rete per vedere i loro cataloghi.'}
      </p>
      {isProvider && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {onImport && (
            <Button variant="outline" onClick={onImport} className="min-h-[44px]">
              <PackageCheck /> Importa starter pack
            </Button>
          )}
          <Button variant="gold" onClick={onCreate} className="min-h-[44px]">
            <Plus /> Crea il primo servizio
          </Button>
        </div>
      )}
    </div>
  )
}
