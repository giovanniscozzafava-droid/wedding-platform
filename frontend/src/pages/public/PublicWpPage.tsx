import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { motion } from 'framer-motion'
import { ArrowLeft, MapPin, Users, Briefcase, Globe, Send, AlertCircle, Heart, Sparkles, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { eventTerm } from '@/lib/eventKind'
import { FollowButton } from '@/components/feed/FollowButton'
import { StarsBadge } from '@/components/social/StarsBadge'
import { ReviewsList } from '@/components/social/ReviewsList'

type WpProfile = {
  id: string
  slug: string | null
  full_name: string | null
  business_name: string | null
  role: 'WEDDING_PLANNER' | 'LOCATION' | 'ADMIN'
  brand_logo_url: string | null
  brand_primary_color: string | null
  city: string | null
  province: string | null
  tagline: string | null
  bio: string | null
  work_style: string | null
  website: string | null
  instagram: string | null
  facebook: string | null
  tiktok: string | null
  service_radius_km: number | null
  in_pancia_suppliers: number
  total_events: number
  recent_posts: Array<{ id: string; body: string; media_urls: string[]; like_count: number; comment_count: number; created_at: string }>
  suppliers: Array<{ id: string; business_name: string | null; full_name: string | null; subrole: string | null; city: string | null; brand_logo_url: string | null; slug: string | null }>
  blog_posts: Array<{ slug: string; title: string; excerpt: string | null; hero_image_url: string | null; reading_minutes: number | null; published_at: string }>
}

const EVENT_KINDS = [
  'matrimonio','battesimo','cresima','comunione','compleanno',
  'anniversario','laurea','corporate','altro',
] as const

const BUDGETS = [
  { v: 'undecided', l: 'Non ancora deciso' },
  { v: '<5k',       l: 'Sotto i 5.000 €' },
  { v: '5-10k',     l: '5.000 – 10.000 €' },
  { v: '10-20k',    l: '10.000 – 20.000 €' },
  { v: '20-50k',    l: '20.000 – 50.000 €' },
  { v: '>50k',      l: 'Oltre i 50.000 €' },
]

export default function PublicWpPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const [wp, setWp] = useState<WpProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    event_kind: 'matrimonio', event_date: '',
    event_location: '', guests_estimate: '',
    budget_range: 'undecided', message: '',
    honeypot: '',  // anti-bot field, must stay empty
  })

  useEffect(() => {
    if (!slug) return
    void (async () => {
      try {
        const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
          .rpc('get_wp_public_profile', { p_slug: slug })
        if (error) throw error
        if (!data) { setNotFound(true); return }
        setWp(data as WpProfile)
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    })()
  }, [slug])

  async function submitLead() {
    if (!wp) return
    if (!form.client_name.trim()) { toast.error('Inserisci il tuo nome'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email.trim())) { toast.error('Email non valida'); return }
    setSending(true)
    try {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('submit_lead_request', {
          p_wp_slug:        slug,
          p_client_name:    form.client_name.trim(),
          p_client_email:   form.client_email.trim(),
          p_client_phone:   form.client_phone.trim() || null,
          p_event_kind:     form.event_kind,
          p_event_date:     form.event_date || null,
          p_event_location: form.event_location.trim() || null,
          p_guests_estimate: form.guests_estimate ? Number(form.guests_estimate) : null,
          p_budget_range:   form.budget_range || null,
          p_message:        form.message.trim() || null,
          p_honeypot:       form.honeypot,
          p_source:         'public_form',
        })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string; id?: string }
      if (r.error) throw new Error(r.error)
      setSent(true)
      toast.success('Richiesta inviata!')
      // Fire-and-forget notifica email (no await — non blocchiamo UX)
      if (r.id) {
        void supabase.functions.invoke('lead-notify', { body: { lead_id: r.id } }).catch(() => {})
      }
    } catch (e) { toast.error((e as Error).message) }
    finally { setSending(false) }
  }

  if (loading) return <Centered>Caricamento…</Centered>
  if (notFound || !wp) return (
    <Centered>
      <AlertCircle size={28} className="mx-auto mb-3 text-[rgb(var(--rose-500))]" />
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">Profilo non trovato.</p>
      <Link to="/" className="text-sm text-[rgb(var(--gold-600))] hover:underline">← Torna alla home</Link>
    </Centered>
  )

  const displayName = wp.business_name ?? wp.full_name ?? 'Wedding Planner'
  const roleLabel = wp.role === 'LOCATION' ? 'Location' : 'Wedding Planner'
  const canonical = `https://planfully.it/p/wp/${wp.slug}`

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <Helmet>
        <title>{displayName} · {roleLabel}{wp.city ? ` a ${wp.city}` : ''} · Planfully</title>
        <meta name="description" content={(wp.tagline ?? wp.bio ?? `${roleLabel} su Planfully`).slice(0, 160)} />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="profile" />
        <meta property="og:title" content={`${displayName} · ${roleLabel}`} />
        <meta property="og:description" content={(wp.tagline ?? wp.bio ?? '').slice(0, 200)} />
        <meta property="og:url" content={canonical} />
        {wp.brand_logo_url && <meta property="og:image" content={wp.brand_logo_url} />}
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'LocalBusiness',
          name: displayName,
          description: wp.tagline ?? wp.bio,
          image: wp.brand_logo_url,
          url: canonical,
          address: wp.city ? { '@type': 'PostalAddress', addressLocality: wp.city, addressRegion: wp.province, addressCountry: 'IT' } : undefined,
        })}</script>
      </Helmet>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6">
        <button onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}
          className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-4">
          <ArrowLeft size={14} /> Indietro
        </button>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="surface surface-lift p-6 sm:p-8 mb-5">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {wp.brand_logo_url ? (
              <img src={wp.brand_logo_url} alt="" className="w-24 h-24 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center font-display text-3xl shrink-0"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-[0.25em] mb-1" style={{ color: 'rgb(var(--gold-600))' }}>
                {roleLabel}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{displayName}</h1>
              <div className="mt-2"><StarsBadge userId={wp.id} size="md" /></div>
              {wp.tagline && <p className="text-base italic mt-2">"{wp.tagline}"</p>}
              <div className="flex flex-wrap gap-3 text-sm text-[rgb(var(--fg-muted))] mt-3">
                {wp.city && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {wp.city}{wp.province && ` (${wp.province})`}</span>}
                {wp.service_radius_km && <span>Raggio {wp.service_radius_km} km</span>}
                {wp.in_pancia_suppliers > 0 && (
                  <span className="inline-flex items-center gap-1"><Users size={14} /> Rete di {wp.in_pancia_suppliers} fornitori</span>
                )}
                {wp.total_events > 0 && (
                  <span className="inline-flex items-center gap-1"><Briefcase size={14} /> {wp.total_events} eventi gestiti</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="gold" onClick={() => setFormOpen(true)}>
                  <Send size={14} /> Richiedi preventivo
                </Button>
                <FollowButton userId={wp.id} targetRole="WEDDING_PLANNER" variant="outline" />
                {wp.website && (
                  <a href={wp.website} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    <Globe size={12} /> Sito
                  </a>
                )}
                {wp.instagram && (
                  <a href={wp.instagram.startsWith('http') ? wp.instagram : `https://instagram.com/${wp.instagram.replace('@','')}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs px-3 py-2 rounded-full border hover:bg-[rgb(var(--bg-sunken))]"
                    style={{ borderColor: 'rgb(var(--border))' }}>
                    Instagram
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bio + work style */}
        {(wp.bio || wp.work_style) && (
          <section className="surface p-6 mb-5">
            <h2 className="font-display text-xl mb-3">Chi sono</h2>
            {wp.bio && <p className="text-sm leading-relaxed">{wp.bio}</p>}
            {wp.work_style && (
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Come lavoro</p>
                <p className="text-sm leading-relaxed italic">{wp.work_style}</p>
              </div>
            )}
          </section>
        )}

        {/* Recent posts */}
        {wp.recent_posts.length > 0 && (
          <section className="surface p-6 mb-5">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-display text-xl flex items-center gap-2"><Sparkles size={18} /> Lavori recenti</h2>
              <Link to="/feed" className="text-xs text-[rgb(var(--gold-600))] hover:underline">Vedi tutto →</Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {wp.recent_posts.map((p) => (
                <div key={p.id} className="surface surface-elev overflow-hidden">
                  {p.media_urls.length > 0 && (
                    <img src={p.media_urls[0]!} alt="" className="aspect-square object-cover w-full" />
                  )}
                  {p.body && <p className="p-3 text-xs line-clamp-3">{p.body}</p>}
                  <div className="px-3 pb-3 text-[10px] text-[rgb(var(--fg-subtle))] flex gap-3">
                    {p.like_count > 0 && <span><Heart size={9} className="inline" /> {p.like_count}</span>}
                    {p.comment_count > 0 && <span>{p.comment_count} commenti</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Suppliers in pancia */}
        {wp.suppliers.length > 0 && (
          <section className="surface p-6 mb-5">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><Users size={18} /> La rete · {wp.suppliers.length} fornitori</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {wp.suppliers.slice(0, 12).map((s) => (
                <Link key={s.id} to={s.slug ? `/p/fornitore/${s.slug}` : '#'}
                  className="flex flex-col items-center text-center gap-2 p-3 rounded-lg hover:bg-[rgb(var(--bg-sunken))] transition-colors">
                  {s.brand_logo_url ? (
                    <img src={s.brand_logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center font-display"
                      style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                      {(s.business_name ?? s.full_name ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <p className="text-xs font-medium truncate w-full">{s.business_name ?? s.full_name}</p>
                  {s.subrole && <p className="text-[10px] text-[rgb(var(--fg-subtle))] truncate w-full">{s.subrole}</p>}
                  <StarsBadge userId={s.id} size="sm" showCount={false} />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Blog */}
        {wp.blog_posts.length > 0 && (
          <section className="surface p-6 mb-5">
            <h2 className="font-display text-xl mb-4 flex items-center gap-2"><FileText size={18} /> Articoli</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wp.blog_posts.map((b) => (
                <Link key={b.slug} to={`/blog/${b.slug}`}
                  className="flex gap-3 p-3 rounded-lg hover:bg-[rgb(var(--bg-sunken))] transition-colors">
                  {b.hero_image_url && (
                    <img src={b.hero_image_url} alt="" className="w-20 h-20 rounded object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{b.title}</p>
                    {b.excerpt && <p className="text-xs text-[rgb(var(--fg-muted))] line-clamp-2 mt-1">{b.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <ReviewsList userId={wp.id} />

        {/* Lead form modale */}
        {formOpen && !sent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setFormOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="surface surface-lift w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
              <h3 className="font-display text-2xl mb-1">Richiedi preventivo</h3>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">A {displayName}. Risposta entro 48h.</p>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nome *</Label><Input value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} /></div>
                  <div><Label>Email *</Label><Input type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Telefono</Label><Input type="tel" value={form.client_phone} onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))} /></div>
                  <div><Label>Tipo evento</Label>
                    <Select value={form.event_kind} onChange={(e) => setForm((f) => ({ ...f, event_kind: e.target.value }))}>
                      {EVENT_KINDS.map((k) => <option key={k} value={k}>{eventTerm(k).Label}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Data evento</Label><Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} /></div>
                  <div><Label>Invitati stimati</Label><Input type="number" value={form.guests_estimate} onChange={(e) => setForm((f) => ({ ...f, guests_estimate: e.target.value }))} /></div>
                </div>
                <div><Label>Location ideale</Label><Input value={form.event_location} onChange={(e) => setForm((f) => ({ ...f, event_location: e.target.value }))} placeholder="Es. Cosenza, Tropea..." /></div>
                <div><Label>Budget orientativo</Label>
                  <Select value={form.budget_range} onChange={(e) => setForm((f) => ({ ...f, budget_range: e.target.value }))}>
                    {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
                  </Select>
                </div>
                <div><Label>Messaggio</Label><Textarea rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="Cosa hai in mente per il tuo evento?" /></div>

                {/* honeypot anti-bot, hidden field */}
                <input type="text" tabIndex={-1} autoComplete="off" name="website_url"
                  value={form.honeypot} onChange={(e) => setForm((f) => ({ ...f, honeypot: e.target.value }))}
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }} aria-hidden="true" />
              </div>

              <div className="flex justify-end gap-2 mt-5">
                <Button variant="ghost" onClick={() => setFormOpen(false)}>Annulla</Button>
                <Button variant="gold" disabled={sending} onClick={submitLead}>
                  {sending ? 'Invio…' : 'Invia richiesta'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Success */}
        {sent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => { setSent(false); setFormOpen(false) }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="surface surface-lift p-8 text-center max-w-md">
              <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: 'rgb(var(--emerald-100))' }}>
                <Send size={24} style={{ color: 'rgb(var(--emerald-500))' }} />
              </div>
              <h3 className="font-display text-2xl mb-1">Richiesta inviata</h3>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
                {displayName} riceverà la tua richiesta e ti risponderà entro 48 ore.
              </p>
              <Button variant="outline" onClick={() => { setSent(false); setFormOpen(false) }}>Chiudi</Button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'rgb(var(--bg))' }}>
      <div className="surface p-10 text-center max-w-md">{children}</div>
    </div>
  )
}
