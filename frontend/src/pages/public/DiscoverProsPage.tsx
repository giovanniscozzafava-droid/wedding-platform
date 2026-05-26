import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { Search, MapPin, ArrowLeft, Briefcase, Users, Sparkles } from 'lucide-react'
import { Input, Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type Pro = {
  id: string
  slug: string
  full_name: string | null
  business_name: string | null
  brand_logo_url: string | null
  role: 'WEDDING_PLANNER' | 'LOCATION'
  city: string | null
  province: string | null
  tagline: string | null
  service_radius_km: number | null
  suppliers_count: number
  posts_count: number
}

export default function DiscoverProsPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [city, setCity] = useState(params.get('city') ?? '')
  const [role, setRole] = useState<'' | 'WEDDING_PLANNER' | 'LOCATION'>('')
  const [search, setSearch] = useState('')
  const [list, setList] = useState<Pro[]>([])
  const [loading, setLoading] = useState(true)
  const eventFilter = params.get('event') ?? ''

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('discover_wp_and_locations', {
            p_city:   city.trim() || null,
            p_role:   role || null,
            p_search: search.trim() || null,
            p_limit:  48,
            p_offset: 0,
          })
        if (error) throw error
        if (!cancelled) setList((data as Pro[]) ?? [])
      } catch {
        if (!cancelled) setList([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [city, role, search])

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>Wedding planner, location, event planner italiani · Planfully</title>
        <meta name="description" content="Trova wedding planner, location ed event planner italiani per ogni tipo di evento. Network indipendente, professionisti verificati." />
        <link rel="canonical" href="https://planfully.it/scopri-pro" />
        <meta property="og:title" content="Trova wedding planner, location e event planner italiani" />
        <meta property="og:url" content="https://planfully.it/scopri-pro" />
      </Helmet>

      {/* Hero */}
      <section className="border-b" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-6 sm:py-8">
          <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}
            className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-6">
            <ArrowLeft size={14} /> Indietro
          </button>
          <p className="text-xs uppercase tracking-[0.25em] mb-3" style={{ color: 'rgb(var(--gold-600))' }}>
            <Sparkles size={12} className="inline mr-1" /> Professionisti
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-tight mb-3">
            Wedding planner, location ed event planner italiani.
          </h1>
          <p className="text-base sm:text-lg text-[rgb(var(--fg-muted))] max-w-2xl">
            Tutti i professionisti che organizzano eventi in Italia.
            {eventFilter && (
              <> Filtrati per <strong>{eventFilter}</strong>.</>
            )}
          </p>
        </div>
      </section>

      {/* Filtri */}
      <section className="sticky top-0 z-20 border-b backdrop-blur-md"
        style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev) / 0.92)' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-9" placeholder="Cerca per nome..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-9" placeholder="Città (es. Cosenza, Milano...)"
              value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <Select value={role} onChange={(e) => setRole(e.target.value as '' | 'WEDDING_PLANNER' | 'LOCATION')}
            className="sm:max-w-xs">
            <option value="">Tutti</option>
            <option value="WEDDING_PLANNER">Wedding planner</option>
            <option value="LOCATION">Location</option>
          </Select>
        </div>
      </section>

      {/* Lista */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        <p className="text-sm text-[rgb(var(--fg-muted))] mb-6">
          {loading ? 'Caricamento...' : `${list.length} professionisti trovati`}
        </p>

        {!loading && list.length === 0 && (
          <div className="text-center py-16">
            <Briefcase className="mx-auto mb-3 opacity-30" size={40} />
            <p className="text-[rgb(var(--fg-muted))]">Nessun risultato con questi filtri.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((wp, i) => (
            <motion.div key={wp.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <Link to={`/p/wp/${wp.slug}`}
                className="block surface surface-elev p-5 hover:surface-lift transition-all h-full">
                <div className="flex items-start gap-3 mb-3">
                  {wp.brand_logo_url ? (
                    <img src={wp.brand_logo_url} alt="" className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center font-display text-xl"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {(wp.business_name ?? wp.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.2em] mb-0.5" style={{ color: 'rgb(var(--gold-600))' }}>
                      {wp.role === 'LOCATION' ? 'Location' : 'Wedding Planner'}
                    </p>
                    <h3 className="font-display text-lg leading-tight truncate">
                      {wp.business_name ?? wp.full_name}
                    </h3>
                  </div>
                </div>
                {wp.tagline && <p className="text-sm italic line-clamp-2 mb-3">"{wp.tagline}"</p>}
                <div className="flex flex-wrap gap-3 text-xs text-[rgb(var(--fg-muted))] pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                  {wp.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {wp.city}{wp.province && ` (${wp.province})`}
                    </span>
                  )}
                  {wp.suppliers_count > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> Rete di {wp.suppliers_count}
                    </span>
                  )}
                  {wp.posts_count > 0 && (
                    <span>{wp.posts_count} post</span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
