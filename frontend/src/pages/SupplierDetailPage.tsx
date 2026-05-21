import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Phone, FileText, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useServicesBySupplier } from '@/hooks/useCatalog'
import { useSupplier } from '@/hooks/useSuppliers'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: supplier, isLoading: lsup } = useSupplier(id ?? null)
  const { data: services, isLoading: lsvc } = useServicesBySupplier(id ?? null)

  const grouped = useMemo(() => {
    const out = new Map<string, NonNullable<typeof services>>()
    for (const s of services ?? []) {
      const k = s.service_categories?.name ?? 'Altro'
      const arr = out.get(k) ?? []
      arr.push(s)
      out.set(k, arr)
    }
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [services])

  const gallery = useMemo(() => {
    const photos: Array<{ id: string; url: string; service: string }> = []
    for (const s of services ?? []) {
      for (const p of s.service_photos) {
        photos.push({ id: p.id, url: p.thumbnail_url, service: s.name })
      }
    }
    return photos.slice(0, 12)
  }, [services])

  if (lsup) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>
  if (!supplier) return <div className="p-10 text-[rgb(var(--rose-500))]">Fornitore non trovato</div>

  const headerBg = supplier.brand_primary_color ?? 'rgb(var(--gold-500))'

  return (
    <div className="min-h-full">
      {/* Header hero */}
      <div className="relative overflow-hidden" style={{ background: headerBg }}>
        <div className="absolute inset-0 dotted opacity-20" />
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 relative z-10">
          <Link to="/suppliers" className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white mb-4">
            <ArrowLeft size={14} /> Tutti i fornitori
          </Link>
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white/30 shrink-0 bg-white/10">
              <img src={supplier.avatar_url} alt=""
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
            </div>
            <div className="flex-1 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70 mb-1">Fornitore</p>
              <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
                {supplier.business_name ?? supplier.full_name}
              </h1>
              <p className="text-white/80 mt-1">{supplier.full_name}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {supplier.subrole && (
                  <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/15 text-white">
                    {supplier.subrole}
                  </span>
                )}
                {supplier.phone && (
                  <a href={`tel:${supplier.phone}`} className="text-xs px-2.5 py-1 rounded-full bg-white/15 text-white inline-flex items-center gap-1">
                    <Phone size={12} /> {supplier.phone}
                  </a>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="default" className="bg-white text-[rgb(var(--fg))] hover:bg-white/90" asChild>
                <Link to={`/quotes`}>
                  <FileText /> Nuovo preventivo
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 space-y-10">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Servizi attivi" value={services?.length ?? 0} />
          <StatBox label="Categorie" value={grouped.length} />
          <StatBox label="Foto" value={gallery.length} />
          <StatBox label="Stato" value="ACTIVE" tone="emerald" />
        </div>

        {/* Gallery */}
        {gallery.length > 0 && (
          <section>
            <h2 className="font-display text-xl mb-3">Portfolio</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {gallery.map((g) => (
                <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="aspect-square rounded-lg overflow-hidden bg-[rgb(var(--bg-sunken))]">
                  <img src={g.url} alt={g.service} className="h-full w-full object-cover" />
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Catalog per categoria */}
        <section>
          <h2 className="font-display text-xl mb-4">Catalogo</h2>
          {lsvc && <p className="text-[rgb(var(--fg-subtle))]">Caricamento servizi...</p>}
          {grouped.length === 0 && !lsvc && (
            <Card className="p-8 text-center">
              <p className="text-sm text-[rgb(var(--fg-muted))]">Nessun servizio attivo per questo fornitore.</p>
            </Card>
          )}
          <div className="space-y-8">
            {grouped.map(([category, items]) => (
              <div key={category}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-display text-lg">{category}</h3>
                  <span className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                    {items.length} {items.length === 1 ? 'voce' : 'voci'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((s) => (
                    <Card key={s.id} className="overflow-hidden hover:shadow-[var(--shadow-lift)] transition-shadow">
                      <div className="aspect-[16/10] bg-[rgb(var(--bg-sunken))] overflow-hidden relative">
                        {s.service_photos[0] ? (
                          <img src={s.service_photos[0].thumbnail_url} alt={s.name}
                            className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[rgb(var(--fg-subtle))]">
                            <ImageIcon size={28} />
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h4 className="font-medium leading-snug">{s.name}</h4>
                        {s.description && (
                          <p className="text-sm text-[rgb(var(--fg-muted))] line-clamp-2">{s.description}</p>
                        )}
                        <div className="flex items-baseline gap-1 pt-1">
                          <span className="font-display text-xl tabular-nums">€ {Number(s.base_price).toLocaleString('it-IT')}</span>
                          <span className="text-xs text-[rgb(var(--fg-subtle))] uppercase tracking-wide">
                            /{s.unit.toLowerCase()}
                          </span>
                        </div>
                        {s.service_modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {s.service_modifiers.slice(0, 3).map((m) => (
                              <Badge key={m.id} tone="sage">{m.name}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatBox({ label, value, tone }: { label: string; value: number | string; tone?: 'emerald' }) {
  return (
    <div className="surface p-4">
      <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`font-display text-2xl mt-1 tabular-nums ${
        tone === 'emerald' ? 'text-[rgb(var(--emerald-500))]' : ''
      }`}>
        {value}
      </p>
    </div>
  )
}
