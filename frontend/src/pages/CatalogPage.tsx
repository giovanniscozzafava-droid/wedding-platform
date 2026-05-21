import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { ServiceForm } from '@/components/catalog/ServiceForm'
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
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-sm text-slate-500 hover:underline">← Home</Link>
            <h1 className="text-2xl font-semibold">Catalogo servizi</h1>
            <p className="text-sm text-slate-500">
              {isProvider && 'I servizi che offri ai capostipiti collaboranti.'}
              {isCapostipite && 'Servizi visibili dai tuoi fornitori collaboranti.'}
            </p>
          </div>
          {isProvider && (
            <Button onClick={() => setCreating(true)} data-testid="new-service-btn">
              + Nuovo servizio
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          <Input placeholder="Filtra per nome o categoria..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>

        {isLoading && <p className="text-slate-500">Caricamento...</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Card key={s.id} data-testid={`service-card-${s.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {s.service_categories?.name ?? '—'} {!s.is_active && '· INATTIVO'}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {s.service_photos[0] && (
                  <img src={s.service_photos[0].thumbnail_url} alt="" className="w-full h-32 object-cover rounded-md" />
                )}
                <p className="text-sm text-slate-600 line-clamp-2">{s.description}</p>
                <p className="text-lg font-semibold">
                  € {s.base_price.toLocaleString('it-IT')} <span className="text-sm font-normal text-slate-500">/{s.unit.toLowerCase()}</span>
                </p>
                {isProvider && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(s)} data-testid={`edit-${s.id}`}>
                      Modifica
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => {
                      if (confirm(`Eliminare "${s.name}"?`)) del.mutate(s.id)
                    }}>
                      Elimina
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && !isLoading && (
          <p className="text-center text-slate-500 py-12" data-testid="empty-catalog">
            Nessun servizio trovato.
          </p>
        )}
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
