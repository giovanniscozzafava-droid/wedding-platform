import { type FormEvent, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Heart, MapPin, Calendar, Plane, Gift, BedDouble, Bus, Car, Train, Ship, ExternalLink, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type SiteData = {
  wedding: {
    id: string; title: string; client_name: string | null; date_from: string; date_to: string;
    is_destination: boolean; destination_location: string | null; destination_country: string | null; destination_language: string | null;
    data: Record<string, any>
  }
  owner: { full_name: string | null; business_name: string | null; brand_logo_url: string | null; brand_primary_color: string | null; brand_secondary_color: string | null }
  subevents: any[]
  accommodations: any[]
  transport: any[]
}

export default function WeddingSitePage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<SiteData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [rsvpDone, setRsvpDone] = useState(false)
  const [rsvp, setRsvp] = useState({ full_name: '', email: '', rsvp: 'YES', party_size: '1', diet: '', notes: '' })

  useEffect(() => {
    if (!slug) return
    supabase.rpc('wedding_site_get', { p_slug: slug })
      .then(({ data, error }) => {
        if (error) { setErr(error.message); return }
        setData((data as unknown as SiteData) ?? null)
        if (!data) setErr('Wedding website non trovato o non pubblicato.')
      })
  }, [slug])

  async function submitRsvp(e: FormEvent) {
    e.preventDefault()
    if (!slug) return
    try {
      const { data: ok, error } = await supabase.rpc('wedding_site_rsvp', {
        p_slug: slug,
        p_full_name: rsvp.full_name,
        p_email: rsvp.email || undefined,
        p_rsvp: rsvp.rsvp,
        p_party: Number(rsvp.party_size || 1),
        p_diet: rsvp.diet || undefined,
        p_notes: rsvp.notes || undefined,
      } as any)
      if (error) throw error
      if (!ok) throw new Error('Impossibile registrare RSVP')
      setRsvpDone(true)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  if (err && !data) return <div className="min-h-screen flex items-center justify-center px-4"><p className="text-[rgb(var(--rose-500))]">{err}</p></div>
  if (!data) return <div className="min-h-screen flex items-center justify-center"><p className="text-[rgb(var(--fg-subtle))]">Caricamento...</p></div>

  const w = data.wedding
  const primary = data.owner?.brand_primary_color ?? '#1A2E4F'
  const secondary = data.owner?.brand_secondary_color ?? '#C9A961'
  const eventDate = new Date(w.date_from)
  const daysLeft = Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Hero fotografico full-bleed con velo scuro NEUTRO (mai gradienti colorati sopra le foto). */}
      <header className="relative overflow-hidden" style={{ background: '#1A1408' }}>
        <img src={w.data?.couple_photo_url ?? '/hero/preview.jpg'} alt={`${w.title} — foto`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: `center ${w.data?.couple_photo_focal_y ?? 30}%` }} />
        <div className="absolute inset-0" style={{ background: 'rgba(20,16,8,.35)' }} />
        <div className="relative max-w-4xl mx-auto px-6 sm:px-10 py-24 sm:py-32 text-center" style={{ color: '#FAF5EA' }}>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="block text-[11px] font-mono uppercase tracking-[0.3em] mb-5" style={{ color: '#FAF5EA', opacity: 0.85 }}>
              Save the date
            </span>
            <h1 className="font-display text-5xl sm:text-6xl xl:text-7xl tracking-tight leading-[1.02] mb-5">
              {w.title}
            </h1>
            <div className="w-14 h-px mx-auto mb-5" style={{ background: '#FAF5EA', opacity: 0.5 }} />
            <p className="font-mono text-sm sm:text-base uppercase tracking-[0.15em]" style={{ opacity: 0.9 }}>
              {eventDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            {w.is_destination && w.destination_location && (
              <p className="text-base flex items-center justify-center gap-2 mt-3" style={{ opacity: 0.85 }}>
                <Plane size={16} strokeWidth={1.5} /> {w.destination_location}{w.destination_country ? `, ${w.destination_country}` : ''}
              </p>
            )}
            {daysLeft > 0 && (
              <p className="mt-6 font-mono text-sm tracking-wide" style={{ opacity: 0.9 }}>
                mancano <strong>{daysLeft}</strong> giorni
              </p>
            )}
            {w.data?.hashtag && (
              <p className="mt-6 font-mono text-xs" style={{ opacity: 0.65 }}>{w.data.hashtag}</p>
            )}
          </motion.div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 sm:px-10 py-12 space-y-16">
        {w.data?.story && (
          <Section title="La nostra storia" primary={primary}>
            <p className="text-base leading-relaxed text-[rgb(var(--fg-muted))] whitespace-pre-line">{w.data.story}</p>
          </Section>
        )}

        {/* Programma */}
        {data.subevents.length > 0 && (
          <Section title="Programma" primary={primary} icon={Calendar}>
            <ul className="space-y-4">
              {data.subevents.map((s: any) => (
                <li key={s.id} className="rounded-lg border p-4" style={{ borderColor: 'rgb(var(--border))' }}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: primary }}>{s.kind.replace(/_/g, ' ')}</p>
                  <h4 className="font-display text-xl mt-1">{s.title}</h4>
                  {s.date_at && (
                    <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                      {new Date(s.date_at).toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {s.location && <p className="text-sm text-[rgb(var(--fg-muted))]"><MapPin size={12} className="inline" /> {s.location}</p>}
                  {s.description && <p className="text-sm mt-2">{s.description}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Alloggi consigliati */}
        {data.accommodations.length > 0 && (
          <Section title="Dove dormire" primary={primary} icon={BedDouble}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.accommodations.map((a: any) => (
                <a key={a.id} href={a.url ?? '#'} target="_blank" rel="noreferrer"
                  className="block rounded-lg border p-4 hover:bg-[rgb(var(--bg-sunken))] transition-colors" style={{ borderColor: 'rgb(var(--border))' }}>
                  <p className="text-xs uppercase tracking-wider" style={{ color: primary }}>{a.kind}</p>
                  <h4 className="font-display text-lg mt-1">{a.name}</h4>
                  {a.city && <p className="text-sm text-[rgb(var(--fg-muted))]"><MapPin size={12} className="inline" /> {a.city}{a.country ? `, ${a.country}` : ''}</p>}
                  {a.rate_per_night && <p className="text-sm mt-1">Da € {a.rate_per_night}/notte</p>}
                  {a.promo_code && <p className="text-xs mt-2 inline-block px-2 py-1 rounded" style={{ background: secondary + '33', color: primary }}>
                    Codice sconto: <strong>{a.promo_code}</strong>
                  </p>}
                  {a.url && <ExternalLink size={12} className="inline mt-2 text-[rgb(var(--fg-subtle))]" />}
                </a>
              ))}
            </div>
          </Section>
        )}

        {/* Trasporti */}
        {data.transport.length > 0 && (
          <Section title="Come arrivare" primary={primary} icon={Bus}>
            <ul className="space-y-3">
              {data.transport.map((t: any) => (
                <li key={t.id} className="rounded-lg border p-4 flex items-start gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
                  {(() => { const k = String(t.kind); const I = k === 'VOLO_GRUPPO' ? Plane : k.includes('AUTO') ? Car : k === 'TRENO_GRUPPO' ? Train : k === 'BARCA' ? Ship : Bus; return <I size={20} strokeWidth={1.5} className="mt-0.5 shrink-0 text-[rgb(var(--gold-700))]" /> })()}
                  <div className="flex-1">
                    <p className="font-medium">{t.label}</p>
                    {t.depart_at && <p className="text-sm text-[rgb(var(--fg-muted))]">
                      {new Date(t.depart_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>}
                    {(t.depart_from || t.arrive_to) && (
                      <p className="text-xs text-[rgb(var(--fg-subtle))]">{t.depart_from} → {t.arrive_to}</p>
                    )}
                    {t.route_notes && <p className="text-sm mt-1">{t.route_notes}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {w.data?.travel_info && (
          <Section title="Info viaggio & visti" primary={primary} icon={Plane}>
            <p className="text-base leading-relaxed text-[rgb(var(--fg-muted))] whitespace-pre-line">{w.data.travel_info}</p>
          </Section>
        )}

        {w.data?.things_to_do && (
          <Section title="Cosa fare nei dintorni" primary={primary}>
            <p className="text-base leading-relaxed text-[rgb(var(--fg-muted))] whitespace-pre-line">{w.data.things_to_do}</p>
          </Section>
        )}

        {w.data?.dress_code && (
          <Section title="Dress code" primary={primary}>
            <p className="text-base">{w.data.dress_code}</p>
          </Section>
        )}

        {w.data?.gift_registry_url && (
          <Section title="Lista regali" primary={primary} icon={Gift}>
            <div className="text-center">
              <a href={w.data.gift_registry_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium uppercase tracking-[0.12em] underline decoration-[1.5px] underline-offset-4 hover:opacity-70"
                style={{ color: 'rgb(var(--fg))' }}>
                Apri la lista regali <ExternalLink size={14} strokeWidth={1.5} />
              </a>
            </div>
          </Section>
        )}

        {w.data?.map_url && (
          <Section title="Mappa" primary={primary} icon={MapPin}>
            <iframe src={w.data.map_url} className="w-full h-72 rounded-lg border-0" loading="lazy" />
          </Section>
        )}

        {/* RSVP */}
        <Section title="RSVP" primary={primary} icon={Heart}>
          {rsvpDone ? (
            <div className="text-center py-8">
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-full mb-3"
                style={{ background: secondary + '33', color: primary }}>
                <CheckCircle2 size={28} />
              </span>
              <h3 className="font-display text-2xl">Grazie!</h3>
              <p className="text-sm text-[rgb(var(--fg-muted))]">La tua risposta è stata registrata.</p>
            </div>
          ) : (
            <form onSubmit={submitRsvp} className="space-y-3 max-w-md mx-auto">
              <Input placeholder="Nome e cognome" required value={rsvp.full_name}
                onChange={(e) => setRsvp((r) => ({ ...r, full_name: e.target.value }))} />
              <Input type="email" placeholder="Email" value={rsvp.email}
                onChange={(e) => setRsvp((r) => ({ ...r, email: e.target.value }))} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={rsvp.rsvp} onChange={(e) => setRsvp((r) => ({ ...r, rsvp: e.target.value }))}>
                  <option value="YES">Ci sarò!</option>
                  <option value="MAYBE">Forse</option>
                  <option value="NO">Non posso</option>
                </Select>
                <Input type="number" min="1" placeholder="Numero persone" value={rsvp.party_size}
                  onChange={(e) => setRsvp((r) => ({ ...r, party_size: e.target.value }))} />
              </div>
              <Input placeholder="Allergie/restrizioni alimentari" value={rsvp.diet}
                onChange={(e) => setRsvp((r) => ({ ...r, diet: e.target.value }))} />
              <Textarea rows={2} placeholder="Lascia un messaggio" value={rsvp.notes}
                onChange={(e) => setRsvp((r) => ({ ...r, notes: e.target.value }))} />
              {err && <p className="text-sm text-[rgb(var(--rose-500))]">{err}</p>}
              <Button type="submit" variant="gold" className="w-full">Conferma RSVP</Button>
            </form>
          )}
        </Section>
      </main>

      <footer className="border-t mt-12 py-10 text-center" style={{ borderColor: 'rgb(var(--border))' }}>
        <span className="inline-flex items-center gap-2 text-xs text-[rgb(var(--fg-subtle))]">
          <img src="/brand/planfully-symbol.svg" alt="" className="h-4 w-4" style={{ color: 'rgb(var(--fg))' }} />
          Realizzato con Planfully
        </span>
      </footer>
    </div>
  )
}

// Sezione come articolo di rivista: filetto oro + titolo Bodoni corsivo in inchiostro (carta+inchiostro;
// il colore brand del planner resta solo come accento altrove). L'icona non si mostra più nel titolo.
function Section({ title, children }: { title: string; primary?: string; icon?: any; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-center mb-6">
        <span className="block w-10 h-px mx-auto mb-3" style={{ background: 'rgb(var(--gold-600))' }} />
        <h2 className="font-display italic text-3xl sm:text-4xl" style={{ color: 'rgb(var(--fg))' }}>{title}</h2>
      </div>
      {children}
    </section>
  )
}
