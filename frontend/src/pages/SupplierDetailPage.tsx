import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Phone, FileText, ImageIcon, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useServicesBySupplier } from '@/hooks/useCatalog'
import { useSupplier } from '@/hooks/useSuppliers'

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: supplier, isLoading: lsup } = useSupplier(id ?? null)
  const { data: services, isLoading: lsvc } = useServicesBySupplier(id ?? null)
  const [openSvc, setOpenSvc] = useState<any | null>(null)
  const [photoIdx, setPhotoIdx] = useState(0)

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
                    <Card key={s.id} onClick={() => { setOpenSvc(s); setPhotoIdx(0) }}
                      className="overflow-hidden hover:shadow-[var(--shadow-lift)] transition-shadow cursor-pointer">
                      <div className="aspect-[16/10] bg-[rgb(var(--bg-sunken))] overflow-hidden relative">
                        {s.service_photos[0] ? (
                          <img src={s.service_photos[0].thumbnail_url} alt={s.name}
                            className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[rgb(var(--fg-subtle))]">
                            <ImageIcon size={28} />
                          </div>
                        )}
                        {s.service_photos.length > 1 && (
                          <span className="absolute bottom-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                            +{s.service_photos.length - 1}
                          </span>
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

      {/* Service detail modal/lightbox */}
      {openSvc && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setOpenSvc(null)}>
          <div onClick={(e) => e.stopPropagation()}
            className="surface surface-lift w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-[rgb(var(--bg-elev))]" style={{ borderColor: 'rgb(var(--border))' }}>
              <div className="min-w-0">
                <Badge tone="gold">{openSvc.service_categories?.name ?? 'Servizio'}</Badge>
                <h2 className="font-display text-xl mt-1 truncate">{openSvc.name}</h2>
              </div>
              <button onClick={() => setOpenSvc(null)} aria-label="Chiudi"
                className="h-9 w-9 rounded-md hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center shrink-0">
                <X size={18} />
              </button>
            </div>

            {/* Carosello foto */}
            {openSvc.service_photos.length > 0 && (
              <div className="relative bg-black aspect-[16/10] overflow-hidden">
                <img src={openSvc.service_photos[photoIdx]?.original_url ?? openSvc.service_photos[photoIdx]?.thumbnail_url}
                  alt="" className="h-full w-full object-cover" />
                {openSvc.service_photos.length > 1 && (
                  <>
                    <button onClick={() => setPhotoIdx((i) => (i - 1 + openSvc.service_photos.length) % openSvc.service_photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                      <ChevronLeft size={18} />
                    </button>
                    <button onClick={() => setPhotoIdx((i) => (i + 1) % openSvc.service_photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">
                      <ChevronRight size={18} />
                    </button>
                    <span className="absolute bottom-2 right-2 text-xs px-2 py-0.5 rounded bg-black/60 text-white">
                      {photoIdx + 1} / {openSvc.service_photos.length}
                    </span>
                  </>
                )}
              </div>
            )}

            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="font-display text-3xl tabular-nums">€ {Number(openSvc.base_price).toLocaleString('it-IT')}</span>
                <span className="text-sm text-[rgb(var(--fg-subtle))] uppercase tracking-wide">/{openSvc.unit.toLowerCase()}</span>
              </div>

              {openSvc.description && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Descrizione</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{openSvc.description}</p>
                </div>
              )}

              {openSvc.service_modifiers.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Modificatori applicabili</p>
                  <div className="space-y-2">
                    {openSvc.service_modifiers.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
                        style={{ borderColor: 'rgb(var(--border))' }}>
                        <span>{m.name}</span>
                        <Badge tone={Number(m.value) < 0 ? 'emerald' : 'amber'}>
                          {m.modifier_type === 'PERCENT' ? `${m.value}%` : `${m.value} €`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Thumbnails strip */}
              {openSvc.service_photos.length > 1 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Galleria</p>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {openSvc.service_photos.map((p: any, i: number) => (
                      <button key={p.id} onClick={() => setPhotoIdx(i)}
                        className={`aspect-square rounded-md overflow-hidden ${i === photoIdx ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`}>
                        <img src={p.thumbnail_url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
