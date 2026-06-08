import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { Search, MapPin, Heart, Camera, Building2, Briefcase, Sparkles, ArrowRight } from 'lucide-react'
import { Input, Select } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

type WpCard = {
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

const EVENT_KINDS = [
  { v: '',             l: 'Qualsiasi evento' },
  { v: 'matrimonio',   l: 'Matrimonio' },
  { v: 'battesimo',    l: 'Battesimo' },
  { v: 'comunione',    l: 'Prima Comunione' },
  { v: 'cresima',      l: 'Cresima' },
  { v: 'compleanno',   l: 'Compleanno / Festa' },
  { v: 'anniversario', l: 'Anniversario' },
  { v: 'laurea',       l: 'Festa di laurea' },
  { v: 'corporate',    l: 'Evento aziendale' },
]

export default function PublicHomePage() {
  const nav = useNavigate()
  const [city, setCity] = useState('')
  const [eventKind, setEventKind] = useState('')
  const [topWp, setTopWp] = useState<WpCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> })
          .rpc('discover_wp_and_locations', { p_limit: 6, p_offset: 0 })
        setTopWp((data as WpCard[]) ?? [])
      } catch { setTopWp([]) }
      finally { setLoading(false) }
    })()
  }, [])

  function search() {
    const params = new URLSearchParams()
    if (city.trim()) params.set('city', city.trim())
    if (eventKind) params.set('event', eventKind)
    nav(`/scopri-pro${params.toString() ? `?${params}` : ''}`)
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>Planfully · Trova chi organizza il tuo evento</title>
        <meta name="description" content="Il portale italiano dei professionisti degli eventi. Trova wedding planner, location, fotografi, fioriai, catering. Tutti i mestieri in un solo posto." />
        <link rel="canonical" href="https://planfully.it/" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Planfully · Il portale dei professionisti degli eventi italiani" />
        <meta property="og:description" content="Trova chi organizza il tuo matrimonio, battesimo, comunione o evento speciale. Wedding planner, location, fornitori — tutti in un solo posto." />
        <meta property="og:url" content="https://planfully.it/" />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Planfully',
          url: 'https://planfully.it',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://planfully.it/scopri-pro?city={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        })}</script>
      </Helmet>

      {/* Top bar minimale */}
      <header className="absolute top-0 left-0 right-0 z-20">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-white">
            <img src="/brand/planfully-symbol.svg" alt="" className="h-7 w-7 brightness-0 invert" />
            <span className="font-display text-lg tracking-tight">Planfully</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/scopri-pro" className="text-white/80 hover:text-white hidden sm:inline">Scopri</Link>
            <Link to="/blog" className="text-white/80 hover:text-white hidden sm:inline">Blog</Link>
            <Link to="/login" className="text-white/80 hover:text-white">Accedi</Link>
            <Link to="/register" className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'white', color: 'rgb(var(--fg))' }}>
              Sei un professionista?
            </Link>
          </div>
        </div>
      </header>

      {/* Hero con search */}
      <section className="relative min-h-[620px] flex items-center" style={{ background: '#0E1116' }}>
        <img src="/hero/success.jpg" alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-50" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(14,17,22,0.6) 0%, rgba(14,17,22,0.4) 50%, rgba(14,17,22,0.85) 100%)' }} />

        <div className="relative z-10 max-w-4xl mx-auto px-6 sm:px-10 py-24 text-center w-full">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-xs uppercase tracking-[0.35em] mb-4" style={{ color: 'rgb(var(--gold-300, 230 200 120))' }}>
              <Sparkles size={12} className="inline mr-1" /> Il portale dei professionisti degli eventi
            </p>
            <h1 className="font-display text-4xl sm:text-6xl tracking-tight leading-[1.05] text-white mb-5">
              Trova chi organizza<br />il tuo evento.
            </h1>
            <p className="text-base sm:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed mb-8">
              Wedding planner, location, event planner italiani.
              Un unico posto dove scoprire i migliori professionisti del settore,
              vedere i loro lavori, contattarli direttamente.
            </p>

            {/* Search bar */}
            <div className="surface surface-lift p-3 max-w-2xl mx-auto rounded-2xl flex flex-col sm:flex-row gap-2"
              style={{ background: 'rgba(255,255,255,0.97)' }}>
              <Select value={eventKind} onChange={(e) => setEventKind(e.target.value)}
                className="sm:flex-1 border-0 bg-transparent">
                {EVENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
              </Select>
              <div className="relative sm:flex-1">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                <Input className="pl-9 border-0 bg-transparent" placeholder="Città o regione (es. Cosenza, Toscana...)"
                  value={city} onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') search() }} />
              </div>
              <Button variant="gold" onClick={search} className="shrink-0">
                <Search size={14} /> Cerca
              </Button>
            </div>

            <p className="text-xs text-white/60 mt-4">
              Oppure <Link to="/scopri-pro" className="underline">esplora tutti i professionisti</Link> · {' '}
              <Link to="/scopri" className="underline">tutti i fornitori</Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Top WP/Location */}
      {topWp.length > 0 && (
        <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="flex items-baseline justify-between mb-8 flex-wrap gap-3">
            <h2 className="font-display text-3xl sm:text-4xl tracking-tight">Wedding planner e location in evidenza</h2>
            <Link to="/scopri-pro" className="text-sm font-medium hover:underline inline-flex items-center gap-1"
              style={{ color: 'rgb(var(--gold-600))' }}>
              Vedi tutti <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {topWp.map((wp, i) => (
              <motion.div key={wp.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
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
                      <h3 className="font-display text-lg leading-tight truncate">{wp.business_name ?? wp.full_name}</h3>
                    </div>
                  </div>
                  {wp.tagline && <p className="text-sm italic line-clamp-2 mb-3">"{wp.tagline}"</p>}
                  <div className="flex flex-wrap gap-3 text-xs text-[rgb(var(--fg-muted))] pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    {wp.city && <span className="inline-flex items-center gap-0.5"><MapPin size={11} /> {wp.city}</span>}
                    {wp.suppliers_count > 0 && <span>Rete di {wp.suppliers_count}</span>}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Come funziona */}
      <section className="border-t" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <h2 className="font-display text-3xl sm:text-4xl mb-3 text-center">Come funziona</h2>
          <p className="text-base text-[rgb(var(--fg-muted))] max-w-xl mx-auto mb-12 text-center">
            Tre passi semplici per trovare il professionista giusto per il tuo evento.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Step n="1" icon={Search} title="Cerca"
              copy="Filtra per tipo di evento, città o regione. Scopri i professionisti che lavorano nella tua zona." />
            <Step n="2" icon={Heart} title="Esplora"
              copy="Vedi i loro lavori, leggi gli articoli, scopri la loro rete di fornitori di fiducia." />
            <Step n="3" icon={Briefcase} title="Contatta"
              copy="Invia la tua richiesta. Riceverai una risposta direttamente, senza intermediari." />
          </div>
        </div>
      </section>

      {/* Categorie eventi */}
      <section className="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
        <h2 className="font-display text-3xl sm:text-4xl mb-3 text-center">Per ogni occasione</h2>
        <p className="text-base text-[rgb(var(--fg-muted))] max-w-xl mx-auto mb-10 text-center">
          Planfully copre tutto il panorama degli eventi italiani.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {EVENT_KINDS.filter((k) => k.v).map((k) => (
            <Link key={k.v} to={`/scopri-pro?event=${k.v}`}
              className="surface p-5 text-center hover:surface-elev transition-all">
              <p className="font-display text-base">{k.l}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA Professionisti */}
      <section className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] mb-3" style={{ color: 'rgb(var(--gold-600))' }}>
                <Building2 size={12} className="inline mr-1" /> Per i professionisti
              </p>
              <h2 className="font-display text-3xl sm:text-4xl mb-4 leading-tight">
                Sei un wedding planner, una location o un fornitore?
              </h2>
              <p className="text-base text-[rgb(var(--fg-muted))] leading-relaxed mb-6">
                Costruisci il tuo profilo professionale, pubblica i tuoi lavori,
                fatti scoprire dai clienti finali. Connettiti con altri professionisti del settore,
                forma la tua rete di fiducia, lavora come una squadra.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link to="/register">
                  <Button variant="gold">Crea il tuo profilo</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline">Ho già un account</Button>
                </Link>
              </div>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-4">
                Gratis per tutti i professionisti fino a dicembre 2026.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FeatureCard icon={Camera} title="Mostra i tuoi lavori" copy="Foto, articoli, storie di eventi reali." />
              <FeatureCard icon={Heart} title="Costruisci la tua rete" copy="Invita i fornitori che già conosci." />
              <FeatureCard icon={Sparkles} title="Fatti scoprire" copy="Algoritmo trending stile social." />
              <FeatureCard icon={Briefcase} title="Ricevi clienti" copy="Lead diretti dal portale pubblico." />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[rgb(var(--fg-muted))]">
          <p>
            © {new Date().getFullYear()} <strong>Fuyue Srl</strong> · Software indipendente per il settore eventi italiano
          </p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:underline">Privacy</Link>
            <Link to="/cookie" className="hover:underline">Cookie</Link>
            <Link to="/blog" className="hover:underline">Blog</Link>
            <Link to="/scopri-pro" className="hover:underline">Professionisti</Link>
          </div>
        </div>
      </footer>

      {loading && null}
    </div>
  )
}

function Step({ n, icon: Icon, title, copy }: { n: string; icon: typeof Search; title: string; copy: string }) {
  return (
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
        style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
        <Icon size={22} />
      </div>
      <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Step {n}</p>
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed">{copy}</p>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, copy }: { icon: typeof Search; title: string; copy: string }) {
  return (
    <div className="surface p-4">
      <Icon size={18} className="mb-2" style={{ color: 'rgb(var(--gold-600))' }} />
      <p className="font-medium text-sm mb-1">{title}</p>
      <p className="text-xs text-[rgb(var(--fg-muted))] leading-relaxed">{copy}</p>
    </div>
  )
}
