import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, LogOut, Sun, Moon, CalendarClock, BedDouble, Bus, Gift, Palette, Music,
  Users as UsersIcon, Globe, Sparkles, MapPin, PartyPopper, FileText, FileSignature, ExternalLink, Utensils, HelpCircle, Newspaper, Church, ClipboardList,
} from 'lucide-react'
import { Link as LinkIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useMyWeddings } from '@/hooks/useCouple'
import { useAccommodations, useGadgets, useGuests, useMood, usePlaylist, useSubEvents, useTables, useTimeline, useTransport, useMoodMutations, usePlaylistMutations } from '@/hooks/useWedding'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ChangeRequestModal } from '@/components/wedding/ChangeRequestModal'
import { MenuTab } from '@/components/wedding/MenuTab'
import { CeremonyTab } from '@/components/wedding/CeremonyTab'
import { CouplePlanningTab } from '@/components/wedding/CouplePlanningTab'
import { AppFooter } from '@/components/layout/AppFooter'

type Tab = 'overview' | 'planning' | 'cerimonia' | 'documenti' | 'programma' | 'alloggi' | 'trasporti' | 'invitati' | 'tavoli' | 'menu' | 'mood' | 'playlist' | 'gadgets' | 'website'

const TABS: Array<{ key: Tab; label: string; icon: any }> = [
  { key: 'overview',  label: 'Overview',     icon: Heart },
  { key: 'planning',  label: 'Questionario', icon: ClipboardList },
  { key: 'cerimonia', label: 'Cerimonia',    icon: Church },
  { key: 'documenti', label: 'Documenti',    icon: FileText },
  { key: 'programma', label: 'Programma',    icon: CalendarClock },
  { key: 'alloggi',   label: 'Alloggi',      icon: BedDouble },
  { key: 'trasporti', label: 'Trasporti',    icon: Bus },
  { key: 'invitati',  label: 'Invitati',     icon: UsersIcon },
  { key: 'tavoli',    label: 'Tavoli',       icon: PartyPopper },
  { key: 'menu',      label: 'Menu',         icon: Utensils },
  { key: 'mood',      label: 'Mood board',   icon: Palette },
  { key: 'playlist',  label: 'Playlist',     icon: Music },
  { key: 'gadgets',   label: 'Bomboniere',   icon: Gift },
  { key: 'website',   label: 'Sito ospiti',  icon: Globe },
]

export default function CoupleDashboard() {
  const { data: weddings } = useMyWeddings()
  const { profile, user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const nav = useNavigate()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const list = weddings ?? []
  const wid = selectedId ?? list[0]?.entry?.id ?? null
  const selected = list.find((w) => w.entry?.id === wid)

  async function logout() {
    await signOut()
    nav('/login', { replace: true })
  }

  if (!wid && list.length === 0) {
    return (
      <div className="min-h-screen aurora flex items-center justify-center p-6">
        <Card className="max-w-md p-10 text-center">
          <Heart size={28} className="mx-auto mb-4 text-[rgb(var(--gold-600))]" />
          <h1 className="font-display text-2xl mb-2">Ancora nessun matrimonio</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
            Hai bisogno di un invito dal tuo wedding planner. Hai gia` ricevuto un link?
            Aprilo per accedere.
          </p>
          <Button variant="outline" onClick={logout}><LogOut size={14} /> Esci</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur border-b" style={{ background: 'rgb(var(--bg-elev) / 0.85)', borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/couple" className="inline-flex items-center gap-2 min-w-0 shrink">
            <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" />
            <span className="font-display text-sm sm:text-base hidden xs:inline">Planfully</span>
          </Link>
          {/* User name: visibile da sm+ in chiaro, su mobile solo iniziali in cerchio */}
          <div className="hidden sm:block text-sm text-[rgb(var(--fg-muted))] truncate min-w-0 flex-1 text-center">
            {profile?.full_name ?? user?.email}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span className="sm:hidden inline-flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-semibold"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}
              title={profile?.full_name ?? user?.email ?? undefined}>
              {(profile?.full_name ?? user?.email ?? '?').split(/\s+|@/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('')}
            </span>
            <Link to="/feed" className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]" title="Feed del network" aria-label="Feed">
              <Newspaper size={14} />
            </Link>
            <Link to="/faq" className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]" title="Domande frequenti" aria-label="FAQ">
              <HelpCircle size={14} />
            </Link>
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambia tema">{theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}</Button>
            <Link to="/profile" className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]" title="Profilo / Privacy" aria-label="Profilo">
              <Sparkles size={14} />
            </Link>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Esci"><LogOut size={14} /></Button>
          </div>
        </div>
      </header>

      {/* Selettore wedding se ne ho più */}
      {list.length > 1 && (
        <div className="max-w-6xl mx-auto px-6 py-3 flex gap-2 overflow-x-auto">
          {list.map((w) => (
            <button key={w.entry.id} onClick={() => setSelectedId(w.entry.id)}
              className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${wid === w.entry.id ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]' : 'bg-[rgb(var(--bg-sunken))]'}`}>
              {w.entry.title}
            </button>
          ))}
        </div>
      )}

      {selected && wid && <WeddingView wedding={selected.entry} memberRole={selected.role} entryId={wid} tab={tab} setTab={setTab} />}
      <AppFooter />
    </div>
  )
}

function WeddingView({ wedding, memberRole, entryId, tab, setTab }: { wedding: any; memberRole: string; entryId: string; tab: Tab; setTab: (t: Tab) => void }) {
  const primary = wedding.owner?.brand_primary_color ?? '#C9A961'
  const eventDate = new Date(wedding.date_from)
  const daysLeft = Math.max(0, Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: primary }}>
        <img src="/hero/preview.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary}DD 0%, ${primary}99 100%)` }} />
        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center text-white">
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.3em] text-white/80 mb-3">
            <Heart size={11} /> Il vostro grande giorno <Heart size={11} />
          </span>
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight">{wedding.title}</h1>
          <p className="text-base text-white/85 mt-2">
            {eventDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {daysLeft > 0 && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 backdrop-blur px-4 py-1.5 text-sm mt-4">
              <Sparkles size={12} /> Mancano <strong>{daysLeft}</strong> giorni
            </div>
          )}
        </div>
      </section>

      {/* Tabs — scrollable on mobile with edge-fade indicators */}
      <nav className="sticky top-[57px] z-20 border-b relative" style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-6xl mx-auto px-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 py-2 min-w-max">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={(e) => {
                    setTab(t.key)
                    ;(e.currentTarget as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]'
                      : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]',
                  )}>
                  <Icon size={14} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
        {/* Edge-fade indicators: comunica visivamente che ci sono altre tab fuori viewport */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6" style={{ background: 'linear-gradient(90deg, rgb(var(--bg-elev)), transparent)' }} />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6" style={{ background: 'linear-gradient(-90deg, rgb(var(--bg-elev)), transparent)' }} />
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'overview' && <OverviewCouple wedding={wedding} entryId={entryId} memberRole={memberRole} />}
            {tab === 'planning' && <CouplePlanningTab entryId={entryId} />}
            {tab === 'cerimonia' && <CeremonyTab entryId={entryId} />}
            {tab === 'documenti' && <DocumentiCouple wedding={wedding} entryId={entryId} />}
            {tab === 'programma' && <ProgrammaCouple entryId={entryId} />}
            {tab === 'alloggi' && <AlloggiCouple entryId={entryId} />}
            {tab === 'trasporti' && <TrasportiCouple entryId={entryId} />}
            {tab === 'invitati' && <InvitatiCouple entryId={entryId} />}
            {tab === 'tavoli' && <TavoliCouple entryId={entryId} />}
            {tab === 'menu' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <ChangeRequestModal weddingId={entryId} entityType="MENU" defaultAction="UPDATE" prefillTitle="Modifica al menu" />
                </div>
                <MenuTab entryId={entryId} readOnly />
              </div>
            )}
            {tab === 'mood' && <MoodCouple entryId={entryId} />}
            {tab === 'playlist' && <PlaylistCouple entryId={entryId} />}
            {tab === 'gadgets' && <GadgetsCouple entryId={entryId} />}
            {tab === 'website' && <WebsiteCouple wedding={wedding} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}

function OverviewCouple({ wedding, entryId, memberRole }: { wedding: any; entryId: string; memberRole: string }) {
  const guests = useGuests(entryId)
  const subevents = useSubEvents(entryId)
  const yes = (guests.data ?? []).filter((g: any) => g.rsvp === 'YES').length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="p-6">
        <Badge tone="gold">{memberRole}</Badge>
        <h2 className="font-display text-xl mt-3 mb-3">Riepilogo</h2>
        <dl className="space-y-2 text-sm">
          <Row k="Wedding planner" v={wedding.owner?.business_name ?? wedding.owner?.full_name ?? '—'} />
          <Row k="Data" v={new Date(wedding.date_from).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
          <Row k="Invitati confermati" v={`${yes} / ${wedding.guest_count ?? '?'}`} />
          <Row k="Programma" v={`${subevents.data?.length ?? 0} eventi`} />
          {wedding.is_destination && <Row k="Destination" v={wedding.destination_location ?? '—'} />}
        </dl>
      </Card>
      <Card className="p-6">
        <h2 className="font-display text-xl mb-3">Note del planner</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          {wedding.client_name && `Per: ${wedding.client_name}`}
        </p>
        <p className="text-sm mt-3">
          Le info sensibili (note interne, valore economico) sono riservate al wedding planner.
          Voi vedete tutto cio` che riguarda la vostra esperienza il giorno del matrimonio.
        </p>
      </Card>
    </div>
  )
}

function ProgrammaCouple({ entryId }: { entryId: string }) {
  const timeline = useTimeline(entryId)
  const subevents = useSubEvents(entryId)

  const hasSubevents = (subevents.data ?? []).length > 0
  const hasTimeline = (timeline.data ?? []).length > 0
  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display text-2xl">Eventi del weekend</h2>
          <ChangeRequestModal weddingId={entryId} entityType="SUBEVENT" defaultAction="CREATE" prefillTitle="" />
        </div>
        {hasSubevents ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(subevents.data ?? []).map((s: any) => (
              <Card key={s.id} className="p-4">
                <Badge tone="sage">{s.kind.replace(/_/g, ' ')}</Badge>
                <h3 className="font-display text-lg mt-2">{s.title}</h3>
                {s.date_at && <p className="text-sm text-[rgb(var(--fg-muted))]">
                  {new Date(s.date_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>}
                {s.location && <p className="text-xs text-[rgb(var(--fg-subtle))]"><MapPin size={11} className="inline" /> {s.location}</p>}
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Il/la tuo/a wedding planner non ha ancora aggiunto eventi pre o post matrimonio (es. rinfresco serale, brunch del giorno dopo).
            </p>
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
              Usa il bottone qui sopra per suggerire un evento extra.
            </p>
          </Card>
        )}
      </section>
      <section>
        <div className="flex items-end justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display text-2xl">Scaletta giorno-X</h2>
          <ChangeRequestModal weddingId={entryId} entityType="TIMELINE" defaultAction="UPDATE" prefillTitle="Modifica scaletta giorno matrimonio" />
        </div>
        {hasTimeline ? (
          <Card>
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {(timeline.data ?? []).map((t: any) => (
                <li key={t.id} className="px-4 py-3 flex items-baseline gap-3">
                  <span className="font-display text-lg tabular-nums w-16 shrink-0" style={{ color: 'rgb(var(--gold-700))' }}>
                    {t.start_time?.slice(0, 5) ?? '—'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t.title}</p>
                    {t.location && <p className="text-xs text-[rgb(var(--fg-subtle))]">{t.location}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              La scaletta del giorno-matrimonio non è ancora stata definita dal/la wedding planner.
            </p>
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
              Vedrai qui i momenti chiave (cerimonia, aperitivo, cena, danze) appena saranno pronti. Puoi suggerire orari/cambiamenti col bottone qui sopra.
            </p>
          </Card>
        )}
      </section>
    </div>
  )
}

function AlloggiCouple({ entryId }: { entryId: string }) {
  const { data } = useAccommodations(entryId)
  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl">Dove dormire</h2>
        <ChangeRequestModal weddingId={entryId} entityType="ACCOMMODATION" defaultAction="CREATE" prefillTitle="" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data ?? []).map((a: any) => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <Badge tone="sage">{a.kind}</Badge>
              <ChangeRequestModal weddingId={entryId} entityType="ACCOMMODATION" entityId={a.id}
                prefillTitle={`Alloggio: ${a.name}`} trigger="icon" />
            </div>
            <h3 className="font-display text-lg mt-2">{a.name}</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))]">{a.city}{a.country ? `, ${a.country}` : ''}</p>
            {a.rate_per_night && <p className="text-sm mt-1">Da € {a.rate_per_night}/notte</p>}
            {a.promo_code && <Badge tone="gold" className="mt-2">Codice: {a.promo_code}</Badge>}
            {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="block mt-3 text-sm hover:underline">Apri sito →</a>}
          </Card>
        ))}
      </div>
    </div>
  )
}

function TrasportiCouple({ entryId }: { entryId: string }) {
  const { data } = useTransport(entryId)
  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl">Trasporti</h2>
        <ChangeRequestModal weddingId={entryId} entityType="TRANSPORT" defaultAction="CREATE" />
      </div>
      <ul className="space-y-2">
        {(data ?? []).map((t: any) => (
          <Card key={t.id} className="p-4 flex items-center gap-3">
            <span className="text-2xl">{t.kind === 'VOLO_GRUPPO' ? '✈️' : t.kind.includes('AUTO') ? '🚗' : t.kind === 'BARCA' ? '🚤' : '🚌'}</span>
            <div className="flex-1">
              <p className="font-medium">{t.label}</p>
              {t.depart_at && <p className="text-sm text-[rgb(var(--fg-muted))]">{new Date(t.depart_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
              {(t.depart_from || t.arrive_to) && <p className="text-xs text-[rgb(var(--fg-subtle))]">{t.depart_from} → {t.arrive_to}</p>}
            </div>
            <ChangeRequestModal weddingId={entryId} entityType="TRANSPORT" entityId={t.id}
              prefillTitle={`Trasporto: ${t.label}`} trigger="icon" />
          </Card>
        ))}
      </ul>
    </div>
  )
}

function InvitatiCouple({ entryId }: { entryId: string }) {
  const { data } = useGuests(entryId)
  const stats = (data ?? []).reduce((acc: any, g: any) => { acc[g.rsvp] = (acc[g.rsvp] ?? 0) + 1; return acc }, {})
  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl">Invitati</h2>
        <ChangeRequestModal weddingId={entryId} entityType="GUEST" defaultAction="CREATE" prefillTitle="Aggiungere invitato:" />
      </div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <Stat label="Totale" v={data?.length ?? 0} />
        <Stat label="Sì" v={stats.YES ?? 0} tone="emerald" />
        <Stat label="In attesa" v={stats.PENDING ?? 0} tone="amber" />
        <Stat label="No" v={stats.NO ?? 0} tone="rose" />
      </div>
      <Card>
        <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
          {(data ?? []).map((g: any) => (
            <li key={g.id} className="px-4 py-2 flex items-center justify-between text-sm gap-2">
              <span className="flex-1 truncate">{g.full_name}</span>
              <Badge status={g.rsvp} />
              <ChangeRequestModal weddingId={entryId} entityType="GUEST" entityId={g.id}
                prefillTitle={`Invitato: ${g.full_name}`} trigger="icon" />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function TavoliCouple({ entryId }: { entryId: string }) {
  const { data: tables } = useTables(entryId)
  const { data: guests } = useGuests(entryId)
  return (
    <div>
      <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-display text-2xl">Tavoli</h2>
        <ChangeRequestModal weddingId={entryId} entityType="TABLE" defaultAction="CREATE" prefillTitle="Modifica disposizione tavoli" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {(tables ?? []).map((t: any) => {
          const seated = (guests ?? []).filter((g: any) => g.table_id === t.id)
          const label = t.label ?? `Tavolo ${t.table_no}`
          return (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg">{label}</h3>
                <ChangeRequestModal weddingId={entryId} entityType="TABLE" entityId={t.id}
                  prefillTitle={`Tavolo: ${label}`} trigger="icon" />
              </div>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">{seated.length}/{t.seats} posti</p>
              <ul className="mt-2 text-sm space-y-0.5">
                {seated.map((g: any) => <li key={g.id}>{g.full_name}</li>)}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function MoodCouple({ entryId }: { entryId: string }) {
  const { data } = useMood(entryId)
  const { add, remove } = useMoodMutations(entryId)
  const [pinUrl, setPinUrl] = useState('')
  const [tag, setTag] = useState('fiori')
  const [busy, setBusy] = useState(false)
  const TAGS = ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro']

  async function importFromUrl() {
    const trimmed = pinUrl.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) { toast.error('URL deve iniziare con http:// o https://'); return }
    setBusy(true)
    try {
      const { data: r, error } = await supabase.functions.invoke('import-pin-url', { body: { url: trimmed } })
      if (error) throw error
      const j = r as { image?: string; title?: string; source_url?: string; error?: string }
      if (j?.error || !j?.image) throw new Error(j?.error ?? 'Nessuna immagine')
      await add.mutateAsync({
        url: j.image, source: 'pinterest', tag,
        source_url: j.source_url ?? pinUrl, source_title: j.title ?? null,
        caption: j.title ?? null, ord: (data?.length ?? 0),
      })
      setPinUrl('')
      toast.success('Aggiunto al mood')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div>
      <h2 className="font-display text-2xl mb-2">Mood board</h2>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        Le ispirazioni raccolte dal vostro wedding planner. Aggiungete le vostre da Pinterest, Instagram o qualsiasi pagina web.
      </p>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="sm:col-span-2 relative">
            <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-8" placeholder="Incolla URL Pinterest / Instagram / blog..."
              value={pinUrl} onChange={(e) => setPinUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && importFromUrl()} />
          </div>
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Button variant="gold" onClick={importFromUrl} disabled={busy}>
            {busy ? 'Importo...' : 'Aggiungi'}
          </Button>
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">
          Su Pinterest: Condividi → Copia link → incolla qui.
        </p>
      </Card>

      {(data ?? []).length === 0 ? (
        <Card className="p-10 text-center"><p className="text-[rgb(var(--fg-muted))]">Ancora vuoto. Incollate il primo URL!</p></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(data ?? []).map((m: any) => (
            <Card key={m.id} className="relative overflow-hidden group">
              <img src={m.url} alt={m.caption ?? ''} className="aspect-square w-full object-cover" />
              <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white">{m.tag}</span>
              {m.source === 'pinterest' && (
                <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgb(var(--rose-500))] text-white">Pin</span>
              )}
              <button onClick={() => remove.mutate(m.id)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                ×
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function PlaylistCouple({ entryId }: { entryId: string }) {
  const { data: songs } = usePlaylist(entryId)
  const { add, remove } = usePlaylistMutations(entryId)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [moment, setMoment] = useState('FESTA')

  async function addSong() {
    if (!title.trim()) return
    try {
      await add.mutateAsync({ song_title: title, artist, moment })
      setTitle(''); setArtist('')
      toast.success('Brano suggerito')
    } catch (e) { toast.error((e as Error).message) }
  }

  const by = (m: string) => (songs ?? []).filter((s: any) => s.moment === m)
  const MOMS = [{ k: 'CERIMONIA', l: 'Cerimonia' }, { k: 'APERITIVO', l: 'Aperitivo' }, { k: 'CENA', l: 'Cena' }, { k: 'TAGLIO_TORTA', l: 'Taglio torta' }, { k: 'PRIMA_DANZA', l: 'Prima danza' }, { k: 'FESTA', l: 'Festa' }]

  return (
    <div>
      <h2 className="font-display text-2xl mb-2">Playlist</h2>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Suggerisci i brani per ogni momento. Il DJ li vedra` qui.</p>
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          <select className="rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-3 text-sm" value={moment} onChange={(e) => setMoment(e.target.value)}>
            {MOMS.map((m) => <option key={m.k} value={m.k}>{m.l}</option>)}
          </select>
          <input className="sm:col-span-2 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-3 text-sm h-10" placeholder="Titolo brano" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-3 text-sm h-10" placeholder="Artista" value={artist} onChange={(e) => setArtist(e.target.value)} />
          <Button variant="gold" onClick={addSong}>+ Suggerisci</Button>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MOMS.map((m) => {
          const items = by(m.k)
          if (items.length === 0) return null
          return (
            <Card key={m.k} className="overflow-hidden">
              <div className="px-4 py-2 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
                <h3 className="font-medium">{m.l}</h3>
              </div>
              <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {items.map((s: any) => (
                  <li key={s.id} className="px-4 py-2 flex items-center justify-between text-sm">
                    <span>{s.song_title} {s.artist && <span className="text-[rgb(var(--fg-subtle))]">— {s.artist}</span>}</span>
                    <button onClick={() => remove.mutate(s.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]">×</button>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

function GadgetsCouple({ entryId }: { entryId: string }) {
  const { data } = useGadgets(entryId)
  return (
    <div>
      <h2 className="font-display text-2xl mb-4">Bomboniere & gadget</h2>
      <ul className="space-y-2">
        {(data ?? []).map((g: any) => (
          <Card key={g.id} className="p-4 flex items-center justify-between">
            <div>
              <Badge tone="sage">{g.kind}</Badge>
              <p className="font-medium mt-1">{g.name}</p>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">{g.quantity} {g.quantity_basis === 'PER_GUEST' ? '× invitati' : 'unità'}</p>
            </div>
            <Badge status={g.status} />
          </Card>
        ))}
      </ul>
    </div>
  )
}

function WebsiteCouple({ wedding }: { wedding: any }) {
  const slug = wedding.wedding_website_slug
  const published = wedding.wedding_website_published
  const url = slug && published ? `${window.location.origin}/w/${slug}` : null
  return (
    <div>
      <h2 className="font-display text-2xl mb-4">Sito web ospiti</h2>
      <Card className="p-6">
        {url ? (
          <>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">Il vostro sito pubblico per gli ospiti:</p>
            <a href={url} target="_blank" rel="noreferrer" className="block font-display text-xl hover:underline">{url}</a>
            <Button variant="outline" className="mt-4" onClick={() => navigator.clipboard.writeText(url)}>Copia link da inviare</Button>
          </>
        ) : (
          <p className="text-sm text-[rgb(var(--fg-muted))]">Il sito ospiti non e&apos; ancora pubblicato. Chiedi al tuo wedding planner.</p>
        )}
      </Card>
    </div>
  )
}

function DocumentiCouple({ wedding, entryId }: { wedding: any; entryId: string }) {
  const [quote, setQuote] = useState<any | null>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        if (wedding.quote_id) {
          const { data } = await supabase.from('quotes').select('id, title, status, revision, total_client, sent_at, accepted_at, pdf_url, access_token').eq('id', wedding.quote_id).maybeSingle()
          setQuote(data)
        }
        const { data: cs } = await (supabase.from('contracts' as any) as any)
          .select('id, title, status, total_amount, signed_at, pdf_url, access_token')
          .eq('entry_id', entryId)
          .order('created_at', { ascending: false })
        setContracts((cs ?? []) as any[])
      } finally { setLoading(false) }
    })()
  }, [wedding.quote_id, entryId])

  const fmtEUR = (n: any) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n ?? 0))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-1">Documenti</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Il preventivo e il contratto del vostro matrimonio.</p>
      </div>

      {loading && <p className="text-sm text-[rgb(var(--fg-subtle))]">Carico...</p>}

      {/* PREVENTIVO */}
      {!loading && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Preventivo</p>
              <h3 className="font-display text-xl mt-1">{quote?.title ?? 'Nessun preventivo'}</h3>
              {quote && (
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                  Revisione v{quote.revision} · {fmtEUR(quote.total_client)}
                  {quote.accepted_at && ' · accettato'}
                </p>
              )}
            </div>
            {quote && <Badge status={quote.status} />}
          </div>
          {quote ? (
            <div className="flex flex-wrap gap-2">
              {quote.pdf_url && (
                <a href={quote.pdf_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><FileText size={13} /> Scarica PDF</Button>
                </a>
              )}
              {quote.access_token && (
                <a href={`/p/preview/${quote.access_token}`} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm">Apri online <ExternalLink size={13} /></Button>
                </a>
              )}
              {quote.status === 'INVIATO' && quote.access_token && (
                <a href={`/p/accept/${quote.access_token}`} target="_blank" rel="noreferrer">
                  <Button variant="gold" size="sm">Vai alla firma</Button>
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Il preventivo non è ancora stato emesso dal wedding planner.</p>
          )}
        </Card>
      )}

      {/* CONTRATTO */}
      {!loading && (
        <Card className="p-6">
          <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Contratto</p>
              <h3 className="font-display text-xl mt-1">
                {contracts.length === 0 ? 'Nessun contratto' : contracts[0].title}
              </h3>
              {contracts.length > 0 && (
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                  {fmtEUR(contracts[0].total_amount)}
                  {contracts[0].signed_at && ` · firmato il ${new Date(contracts[0].signed_at).toLocaleDateString('it-IT')}`}
                </p>
              )}
            </div>
            {contracts[0] && <Badge tone={contracts[0].status === 'FIRMATO' ? 'emerald' : contracts[0].status === 'INVIATO' ? 'amber' : 'neutral'}>{contracts[0].status}</Badge>}
          </div>
          {contracts.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {contracts[0].pdf_url && (
                <a href={contracts[0].pdf_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm"><FileSignature size={13} /> Scarica PDF</Button>
                </a>
              )}
              {contracts[0].access_token && contracts[0].status !== 'FIRMATO' && (
                <a href={`/p/contract/${contracts[0].access_token}`} target="_blank" rel="noreferrer">
                  <Button variant="gold" size="sm">Vai alla firma</Button>
                </a>
              )}
              {contracts[0].access_token && contracts[0].status === 'FIRMATO' && (
                <a href={`/p/contract/${contracts[0].access_token}`} target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="sm">Visualizza online <ExternalLink size={13} /></Button>
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Il contratto non è ancora stato preparato dal wedding planner.</p>
          )}
        </Card>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-[rgb(var(--fg-muted))]">{k}</dt><dd className="font-medium">{v}</dd></div>
}
function Stat({ label, v, tone }: { label: string; v: number; tone?: 'emerald' | 'amber' | 'rose' }) {
  const cls = tone === 'emerald' ? 'text-[rgb(var(--emerald-500))]' : tone === 'amber' ? 'text-[rgb(var(--amber-500))]' : tone === 'rose' ? 'text-[rgb(var(--rose-500))]' : ''
  return <div className="surface p-3 text-center"><p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p><p className={`font-display text-2xl mt-0.5 ${cls}`}>{v}</p></div>
}
