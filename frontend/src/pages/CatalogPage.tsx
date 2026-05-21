import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Sparkles, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { ServiceForm } from '@/components/catalog/ServiceForm'
import { PageHeader } from '@/components/layout/PageHeader'
import { useDeleteService, useServices, type ServiceWithExtras } from '@/hooks/useCatalog'

export default function CatalogPage() {
  const { profile } = useAuth()
  const { data, isLoading, error } = useServices({ onlyActive: false })
  const del = useDeleteService()
  const [editing, setEditing] = useState<ServiceWithExtras | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState('')

  const isProvider = profile?.role === 'FORNITORE' || profile?.role === 'LOCATION'
  const isCapostipite = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'ADMIN'

  const filtered = useMemo(() => {
    const t = filter.trim().toLowerCase()
    if (!data) return []
    if (!t) return data
    return data.filter(
      (s) =>
        s.name.toLowerCase().includes(t) ||
        (s.description ?? '').toLowerCase().includes(t) ||
        (s.service_categories?.name ?? '').toLowerCase().includes(t),
    )
  }, [data, filter])

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Catalogo"
          title="Servizi e portfolio"
          description={
            isProvider
              ? 'I servizi che offri ai capostipiti collaboranti. Aggiorna prezzi e foto in qualsiasi momento.'
              : 'Servizi visibili dai tuoi fornitori collaboranti. Pesca da qui le voci dei preventivi.'
          }
          actions={
            isProvider && (
              <Button variant="gold" onClick={() => setCreating(true)} data-testid="new-service-btn">
                <Plus /> Nuovo servizio
              </Button>
            )
          }
        />

        <div className="mb-6 max-w-md relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
          <Input
            className="pl-9"
            placeholder="Cerca per nome, categoria o descrizione..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="surface overflow-hidden">
                <div className="skeleton h-40" />
                <div className="p-5 space-y-3">
                  <div className="skeleton h-4 w-2/3" />
                  <div className="skeleton h-3 w-full" />
                  <div className="skeleton h-6 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-[rgb(var(--rose-500))]">{(error as Error).message}</p>}

        {!isLoading && filtered.length === 0 && (
          <div className="surface surface-elev p-12 text-center max-w-xl mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <Sparkles size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Catalogo ancora vuoto</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              {isProvider
                ? 'Inizia aggiungendo il tuo primo servizio.'
                : 'Quando i tuoi fornitori aggiungeranno servizi compariranno qui.'}
            </p>
            {isProvider && (
              <Button variant="gold" onClick={() => setCreating(true)}>
                <Plus /> Crea il primo servizio
              </Button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((s, idx) => (
            <motion.article
              key={s.id}
              data-testid={`service-card-${s.id}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(idx * 0.02, 0.3) }}
              className="surface surface-elev overflow-hidden group hover:shadow-[var(--shadow-lift)] transition-shadow"
            >
              <div className="relative aspect-[16/10] bg-[rgb(var(--bg-sunken))] overflow-hidden">
                {s.service_photos[0] ? (
                  <img
                    src={s.service_photos[0].thumbnail_url}
                    alt={s.name}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[rgb(var(--fg-subtle))]">
                    <ImageIcon size={28} strokeWidth={1.4} />
                  </div>
                )}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  <Badge tone="ink">{s.service_categories?.name ?? '—'}</Badge>
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
                  <span className="text-xs text-[rgb(var(--fg-subtle))] uppercase tracking-wide">/{s.unit.toLowerCase()}</span>
                </div>
                {isProvider && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(s)} data-testid={`edit-${s.id}`}>
                      Modifica
                    </Button>
                    <Button variant="ghost" size="sm"
                      onClick={async () => {
                        if (!confirm(`Eliminare "${s.name}"?`)) return
                        try { await del.mutateAsync(s.id); toast.success('Servizio eliminato') }
                        catch (e) { toast.error((e as Error).message) }
                      }}>
                      Elimina
                    </Button>
                  </div>
                )}
                {isCapostipite && s.service_modifiers.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {s.service_modifiers.slice(0, 3).map((m) => (
                      <Badge key={m.id} tone="sage">{m.name}</Badge>
                    ))}
                    {s.service_modifiers.length > 3 && (
                      <Badge tone="neutral">+{s.service_modifiers.length - 3}</Badge>
                    )}
                  </div>
                )}
              </div>
            </motion.article>
          ))}
        </div>
      </div>

      {(creating || editing) && (
        <ServiceForm
          subrole={profile?.subrole ?? null}
          service={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}
