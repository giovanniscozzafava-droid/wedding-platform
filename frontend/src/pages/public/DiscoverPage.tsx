import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Search, MapPin, Users, Sparkles, Briefcase } from 'lucide-react'
import { Input, Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'

type DiscoverSupplier = {
  id: string
  slug: string
  full_name: string | null
  business_name: string | null
  brand_logo_url: string | null
  subrole: string | null
  city: string | null
  province: string | null
  tagline: string | null
  bio: string | null
  service_radius_km: number | null
  discover_tier: 'STANDARD' | 'BOOST' | 'PREMIUM' | null
  in_pancia_count: number
  services_count: number
  created_at: string
}

export default function DiscoverPage() {
  const nav = useNavigate()
  const [list, setList] = useState<DiscoverSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState('')
  const [subrole, setSubrole] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('discover_suppliers', {
            p_city:    city.trim() || null,
            p_subrole: subrole || null,
            p_search:  search.trim() || null,
            p_limit:   48,
            p_offset:  0,
          })
        if (error) throw error
        if (!cancelled) setList((data as DiscoverSupplier[]) ?? [])
      } catch {
        if (!cancelled) setList([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [city, subrole, search])

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Hero */}
      <section className="relative border-b" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-6 sm:py-8">
          <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}
            className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-6">
            <ArrowLeft size={14} /> Indietro
          </button>
          <p className="text-xs uppercase tracking-[0.25em] mb-3 text-[rgb(var(--gold-600))]">
            <Sparkles size={12} className="inline mr-1" /> Il network dei professionisti degli eventi
          </p>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight leading-tight mb-4">
            Scopri i migliori professionisti<br />degli eventi italiani.
          </h1>
          <p className="text-base sm:text-lg text-[rgb(var(--fg-muted))] max-w-2xl leading-relaxed">
            Fotografi, fioriai, catering, location, light designer, pasticceri e tanto altro.
            Tutti collegati nei network privati dei migliori Wedding Planner e Location d'Italia.
          </p>
        </div>
      </section>

      {/* Filtri */}
      <section className="sticky top-0 z-20 border-b backdrop-blur-md" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev) / 0.9)' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-9" placeholder="Cerca per nome o tagline..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-9" placeholder="Città (es. Cosenza, Milano...)"
              value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <Select value={subrole} onChange={(e) => setSubrole(e.target.value)} className="sm:max-w-xs">
            <option value="">Tutti i mestieri</option>
            {SUPPLIER_SUBROLES.map((s) => (
              <option key={s.v} value={s.v}>{s.l}</option>
            ))}
          </Select>
        </div>
      </section>

      {/* Lista */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        <div className="flex items-baseline justify-between mb-6">
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {loading ? 'Caricamento...' : `${list.length} fornitori trovati`}
          </p>
        </div>

        {!loading && list.length === 0 && (
          <div className="text-center py-16">
            <Briefcase className="mx-auto mb-3 opacity-30" size={40} />
            <p className="text-[rgb(var(--fg-muted))]">Nessun fornitore trovato con questi filtri.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03 }}>
              <Link to={`/p/fornitore/${s.slug}`} className="block surface surface-elev p-5 hover:surface-lift transition-all">
                <div className="flex items-start gap-3 mb-3">
                  {s.brand_logo_url ? (
                    <img src={s.brand_logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-display text-lg"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {(s.business_name ?? s.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-lg leading-tight truncate">
                      {s.business_name ?? s.full_name ?? 'Fornitore'}
                    </h3>
                    {s.subrole && (
                      <p className="text-xs text-[rgb(var(--gold-600))] font-medium uppercase tracking-wider mt-0.5">
                        {labelForSubrole(s.subrole)}
                      </p>
                    )}
                  </div>
                  {s.discover_tier === 'PREMIUM' && (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                      style={{ background: 'rgb(var(--gold-500))', color: 'white' }}>
                      <Sparkles size={9} className="inline mr-0.5" /> Pro
                    </span>
                  )}
                </div>

                {s.tagline && (
                  <p className="text-sm text-[rgb(var(--fg))] mb-3 line-clamp-2 italic">"{s.tagline}"</p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-[rgb(var(--fg-muted))] pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                  {s.city && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} /> {s.city}{s.province && ` (${s.province})`}
                    </span>
                  )}
                  {Number(s.in_pancia_count) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> In pancia a {s.in_pancia_count}
                    </span>
                  )}
                  {Number(s.services_count) > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Briefcase size={12} /> {s.services_count} servizi
                    </span>
                  )}
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t mt-8" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-12 text-center">
          <h2 className="font-display text-2xl sm:text-3xl mb-3">Sei un fornitore?</h2>
          <p className="text-[rgb(var(--fg-muted))] mb-6 max-w-xl mx-auto">
            Costruisci il tuo profilo, candidati alle reti dei capostipiti del tuo territorio.
            <strong> 90 giorni gratis</strong>, senza carta di credito.
          </p>
          <Link to="/register?role=FORNITORE"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-colors"
            style={{ background: 'rgb(var(--gold-500))', color: 'white' }}>
            Crea il tuo profilo gratis
          </Link>
        </div>
      </section>
    </div>
  )
}

function labelForSubrole(v: string): string {
  return SUPPLIER_SUBROLES.find((s) => s.v === v)?.l ?? v
}
