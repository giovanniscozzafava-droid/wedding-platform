import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { MapPin, Users, Sparkles, Briefcase, Globe, Heart, ArrowLeft, AlertCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'
import { StarsBadge } from '@/components/social/StarsBadge'
import { FollowButton } from '@/components/feed/FollowButton'
import { ReviewsList } from '@/components/social/ReviewsList'

type PublicProfile = {
  id: string
  slug: string
  full_name: string | null
  business_name: string | null
  brand_logo_url: string | null
  brand_primary_color: string | null
  subrole: string | null
  city: string | null
  province: string | null
  tagline: string | null
  bio: string | null
  work_style: string | null
  service_radius_km: number | null
  service_regions: string[] | null
  website: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  discover_tier: string | null
  in_pancia_count: number
  services: Array<{
    id: string
    name: string
    description: string | null
    base_price: number
    unit: string
    category: string | null
    photos: Array<{ url: string; caption: string | null }>
  }>
  capostipiti: Array<{
    business_name: string | null
    full_name: string | null
    role: string
    city: string | null
  }>
}

export default function PublicSupplierPage() {
  const { slug } = useParams<{ slug: string }>()
  const { profile, user } = useAuth()
  const nav = useNavigate()
  const [data, setData] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(false)
  const [existingCollab, setExistingCollab] = useState<'ACTIVE' | 'PENDING' | 'REVOKED' | null>(null)

  useEffect(() => {
    if (!slug) return
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('get_supplier_public_profile', { p_slug: slug })
        if (error) throw error
        if (!data) { setErr('Fornitore non trovato'); return }
        setData(data as PublicProfile)
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setLoading(false)
      }
    })()
  }, [slug])

  // Se il visitatore è WP/LOCATION, verifica se ha già una collaboration con
  // questo fornitore — così evitiamo di mostrargli "Aggiungi al mio team"
  // quando il fornitore è già nel suo team (paradosso).
  useEffect(() => {
    if (!user || !data?.id) { setExistingCollab(null); return }
    if (profile?.role !== 'WEDDING_PLANNER' && profile?.role !== 'LOCATION') return
    void (async () => {
      const { data: row } = await (supabase.from as any)('collaborations')
        .select('status')
        .eq('capostipite_id', user.id)
        .eq('fornitore_id', data.id)
        .maybeSingle()
      setExistingCollab((row?.status as any) ?? null)
    })()
  }, [user, profile, data?.id])

  async function requestCollaboration() {
    if (!user) { nav('/login'); return }
    if (!data) return
    setRequesting(true)
    try {
      const { data: res, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('capostipite_add_supplier', { p_supplier_id: data.id })
      if (error) throw error
      const r = res as { error?: string; ok?: boolean; already_active?: boolean; reactivated?: boolean }
      if (r.error) throw new Error(r.error)
      if (r.already_active) {
        toast.info('Fornitore già nel tuo team')
        setExistingCollab('ACTIVE')
        return
      }
      toast.success(r.reactivated ? 'Fornitore riattivato nel tuo team!' : 'Fornitore aggiunto al tuo team!')
      setExistingCollab('ACTIVE')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRequesting(false)
    }
  }

  if (loading) return <Centered><p className="text-[rgb(var(--fg-subtle))]">Caricamento...</p></Centered>
  if (err || !data) return (
    <Centered>
      <AlertCircle size={28} className="mx-auto mb-3 text-[rgb(var(--rose-500))]" />
      <p className="text-sm text-[rgb(var(--fg-muted))]">{err ?? 'Profilo non disponibile'}</p>
      <Link to="/" className="text-sm text-[rgb(var(--gold-600))] hover:underline mt-3 inline-block">← Torna alla home</Link>
    </Centered>
  )

  const subroleLabel = SUPPLIER_SUBROLES.find((s) => s.v === data.subrole)?.l ?? data.subrole
  const isOwner = user?.id === data.id
  const isFornitoreViewer = profile?.role === 'FORNITORE'
  const isCoupleViewer = profile?.role === 'COUPLE'
  // Visitatore pubblico (non loggato): nessuna navigazione dentro l'app e
  // nessun funnel login/register. Resta pagina informativa pubblica.
  const isPublicVisitor = !user
  // Solo i fornitori loggati che NON sono il proprietario possono "candidarsi" al capostipite —
  // ma qui siamo sul profilo di un fornitore, quindi la candidatura non si applica.
  // Mostriamo CTA "Contatta" per chi cerca il professionista.

  const canonical = `https://planfully.it/p/fornitore/${data.slug}`
  const subroleLabelLocal = subroleLabel ?? data.subrole

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>{(data.business_name ?? data.full_name ?? 'Fornitore')}{subroleLabelLocal ? ` · ${subroleLabelLocal}` : ''}{data.city ? ` a ${data.city}` : ''} · Planfully</title>
        <meta name="description" content={(data.tagline ?? data.bio ?? `Fornitore eventi su Planfully`).slice(0, 160)} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${data.business_name ?? data.full_name} · ${subroleLabelLocal}`} />
        <meta property="og:description" content={(data.tagline ?? data.bio ?? '').slice(0, 200)} />
        <meta property="og:url" content={canonical} />
        {data.brand_logo_url && <meta property="og:image" content={data.brand_logo_url} />}
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: data.business_name ?? data.full_name,
          description: data.tagline ?? data.bio,
          image: data.brand_logo_url,
          url: canonical,
          address: data.city ? { '@type': 'PostalAddress', addressLocality: data.city, addressRegion: data.province, addressCountry: 'IT' } : undefined,
        })}</script>
      </Helmet>
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-6">
        <Link to={isPublicVisitor ? '/' : '/scopri'} className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-4">
          <ArrowLeft size={14} /> {isPublicVisitor ? 'Home' : 'Tutti i fornitori'}
        </Link>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="surface surface-lift p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {data.brand_logo_url ? (
              <img src={data.brand_logo_url} alt="" className="w-24 h-24 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center font-display text-3xl shrink-0"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                {(data.business_name ?? data.full_name ?? '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h1 className="font-display text-3xl sm:text-4xl tracking-tight">
                    {data.business_name ?? data.full_name ?? 'Fornitore'}
                  </h1>
                  {subroleLabel && (
                    <p className="text-sm font-medium uppercase tracking-wider mt-1" style={{ color: 'rgb(var(--gold-600))' }}>
                      {subroleLabel}
                    </p>
                  )}
                </div>
                {data.discover_tier === 'PREMIUM' && (
                  <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full"
                    style={{ background: 'rgb(var(--gold-500))', color: 'white' }}>
                    <Sparkles size={11} className="inline mr-1" /> Premium
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StarsBadge userId={data.id} size="md" />
                {!isPublicVisitor && <FollowButton userId={data.id} targetRole="FORNITORE" />}
              </div>

              {data.tagline && (
                <p className="text-base italic text-[rgb(var(--fg))] mt-3">"{data.tagline}"</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-[rgb(var(--fg-muted))] mt-4">
                {data.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={14} /> {data.city}{data.province && ` (${data.province})`}
                  </span>
                )}
                {data.service_regions && data.service_regions.length > 0 ? (
                  <span>{data.service_regions.length >= 20 ? 'Tutta Italia' : `Zone: ${data.service_regions.join(', ')}`}</span>
                ) : data.service_radius_km ? (
                  <span>Raggio servizio: {data.service_radius_km} km</span>
                ) : null}
                {data.in_pancia_count > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users size={14} /> In pancia a {data.in_pancia_count} {data.in_pancia_count === 1 ? 'capostipite' : 'capostipiti'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {data.website && (
                  <a href={data.website} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    <Globe size={12} /> Sito
                  </a>
                )}
                {data.instagram && (
                  <a href={data.instagram.startsWith('http') ? data.instagram : `https://instagram.com/${data.instagram.replace('@','')}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    Instagram
                  </a>
                )}
                {data.facebook && (
                  <a href={data.facebook} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    Facebook
                  </a>
                )}
              </div>

              {/* CTA dinamica */}
              <div className="mt-5 pt-5 border-t flex flex-wrap items-center gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
                {isOwner ? (
                  <Link to="/profile">
                    <Button variant="outline" size="sm">Modifica il tuo profilo</Button>
                  </Link>
                ) : profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' ? (
                  existingCollab === 'ACTIVE' ? (
                    <Button variant="outline" size="sm" disabled className="text-emerald-600">
                      <Heart size={14} className="fill-emerald-600" /> Già nel tuo team
                    </Button>
                  ) : existingCollab === 'PENDING' ? (
                    <Button variant="outline" size="sm" disabled>
                      <Heart size={14} /> Invito in attesa
                    </Button>
                  ) : (
                    <Button variant="gold" disabled={requesting} onClick={requestCollaboration}>
                      <Heart size={14} /> {requesting ? 'Invio…' : 'Aggiungi al mio team'}
                    </Button>
                  )
                ) : isFornitoreViewer ? (
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">Sei un fornitore. Solo i wedding planner e le location possono aggiungerti al loro team.</p>
                ) : isCoupleViewer ? (
                  <Link to="/register">
                    <Button variant="gold" size="sm"><Send size={14} /> Contatta tramite Planfully</Button>
                  </Link>
                ) : isPublicVisitor ? (
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">
                    Per lavorare con {data.business_name ?? data.full_name ?? 'questo fornitore'}, contatta il tuo wedding planner di riferimento.
                  </p>
                ) : null}
                {!isOwner && !isPublicVisitor && <FollowButton userId={data.id} variant="outline" />}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bio + lavoro */}
        {(data.bio || data.work_style) && (
          <section className="surface p-6 mb-6">
            <h2 className="font-display text-xl mb-3">Chi sono</h2>
            {data.bio && <p className="text-sm leading-relaxed mb-3">{data.bio}</p>}
            {data.work_style && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Come lavoro</p>
                <p className="text-sm leading-relaxed italic">{data.work_style}</p>
              </div>
            )}
          </section>
        )}

        {/* Servizi */}
        {data.services.length > 0 && (
          <section className="surface p-6 mb-6">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Briefcase size={18} /> Servizi · {data.services.length}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.services.map((s) => (
                <div key={s.id} className="p-4 rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                  {s.photos.length > 0 && (
                    <img src={s.photos[0]!.url} alt={s.photos[0]!.caption ?? s.name}
                      className="w-full h-32 object-cover rounded-md mb-3" />
                  )}
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-600))]">{s.category ?? 'Servizio'}</p>
                  <h3 className="font-medium mt-0.5">{s.name}</h3>
                  {s.description && <p className="text-xs text-[rgb(var(--fg-muted))] mt-1 line-clamp-3">{s.description}</p>}
                  <p className="text-sm font-medium mt-2 tabular-nums">
                    da € {Number(s.base_price).toLocaleString('it-IT', { maximumFractionDigits: 0 })} <span className="text-xs text-[rgb(var(--fg-subtle))]">/ {s.unit.toLowerCase()}</span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* In pancia a */}
        {data.capostipiti.length > 0 && (
          <section className="surface p-6 mb-6">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2">
              <Users size={18} /> Lavora con
            </h2>
            <div className="flex flex-wrap gap-2">
              {data.capostipiti.map((c, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full"
                  style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg))' }}>
                  {c.business_name ?? c.full_name}{c.city && ` · ${c.city}`}
                </span>
              ))}
            </div>
          </section>
        )}

        <ReviewsList userId={data.id} />

        <p className="text-center text-[11px] text-[rgb(var(--fg-subtle))] mt-8 pb-6">
          Profilo pubblico Planfully — il network indipendente del settore eventi italiani
        </p>
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'rgb(var(--bg))' }}>
      <div className="surface p-10 text-center w-full max-w-md">{children}</div>
    </div>
  )
}
