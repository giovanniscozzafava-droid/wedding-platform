import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, LogOut, Sun, Moon, CalendarClock, BedDouble, Bus, Gift, Palette, Music,
  Users as UsersIcon, Globe, Sparkles, MapPin, PartyPopper, FileText, FileSignature, ExternalLink, Utensils, HelpCircle, Church, Package, ListChecks,
} from 'lucide-react'
import { Link as LinkIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useMyWeddings } from '@/hooks/useCouple'
import { useAccommodations, useGadgets, useGuests, useMood, usePlaylist, useSubEvents, useTimeline, useTransport, useMoodMutations, usePlaylistMutations, useWedding } from '@/hooks/useWedding'

// Traduci i codici errore tecnici delle RPC preventivo in messaggi chiari per la coppia.
const CLIENT_ERR: Record<string, string> = {
  not_accepted: 'Per concludere devi prima accettare e firmare il preventivo: usa "Procedi alla firma del preventivo" qui sotto.',
  forbidden: 'Non hai i permessi per questa azione su questo preventivo.',
  no_email: 'Sessione scaduta: esci e rientra, poi riprova.',
  not_found: 'Preventivo non trovato.',
  already_contracted: 'Questa voce è già passata a contratto e non è più modificabile.',
}
const friendlyErr = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? String(e)
  return CLIENT_ERR[m] ?? m
}
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { eventTerm } from '@/lib/eventKind'
import { isPhotoOnlyEvent, PHOTO_ONLY_KEYS } from '@/lib/eventMode'
import { ChangeRequestModal } from '@/components/wedding/ChangeRequestModal'
import { MenuTab } from '@/components/wedding/MenuTab'
import { GuestsTab } from '@/components/wedding/GuestsTab'
import { GiftsTab } from '@/components/wedding/GiftsTab'
import { TablesTab } from '@/components/wedding/TablesTab'
import { CeremonyTab } from '@/components/wedding/CeremonyTab'
import { TimelineTab } from '@/components/wedding/TimelineTab'
import { ChecklistTab } from '@/components/wedding/ChecklistTab'
import { CouplePlanningTab } from '@/components/wedding/CouplePlanningTab'
import { AppFooter } from '@/components/layout/AppFooter'
import { ProssimaMossa } from '@/components/workflow/ProssimaMossa'
import { SaluteEventoBadge } from '@/components/wedding/SaluteEventoBadge'
import { EventRing } from '@/components/event/EventRing'
import { CompletionRings } from '@/components/event/CompletionRings'
import { EventGalleryTab } from '@/components/event/EventGalleryTab'
import { MoodBoardEditor } from '@/components/wedding/MoodBoardEditor'
import { AudioWishes } from '@/components/event/AudioWishes'
import { Guestbook } from '@/components/event/Guestbook'
import { Images, Mic, BookHeart, Film, MessageCircle } from 'lucide-react'
import { ChatEvento } from '@/components/wedding/ChatEvento'
import { CoupleRequestsCard } from '@/components/wedding/CoupleRequestsCard'
import { useNuovoModello } from '@/hooks/useNuovoModello'
import { ClientProfessionalsView } from '@/components/client/ClientProfessionalsView'

type Tab = 'overview' | 'chat' | 'preventivo' | 'fornitori' | 'planning' | 'cerimonia' | 'documenti' | 'programma' | 'scaletta' | 'checklist' | 'alloggi' | 'trasporti' | 'invitati' | 'regali' | 'tavoli' | 'menu' | 'mood' | 'playlist' | 'gadgets' | 'website' | 'foto' | 'audio' | 'guestbook' | 'video'

// La tab "Questionario" (planning) e' stata rimossa dalla coppia:
// le domande sono gia` raccolte nel questionario di presentazione iniziale
// degli sposi (lato lead/intake). La tab "Menu" e' filtrata in render se
// il preventivo non include alcun servizio di ristorazione.
const TABS: Array<{ key: Tab; label: string; icon: any }> = [
  { key: 'overview',   label: 'Overview',     icon: Heart },
  { key: 'chat',       label: 'Chat',         icon: MessageCircle },
  { key: 'preventivo', label: 'Preventivo',   icon: FileSignature },
  { key: 'fornitori',  label: 'I miei fornitori', icon: Package },
  { key: 'foto',       label: 'Foto',         icon: Images },
  { key: 'audio',      label: 'Audio auguri', icon: Mic },
  { key: 'guestbook',  label: 'Guestbook',    icon: BookHeart },
  { key: 'video',      label: 'Video',        icon: Film },
  { key: 'cerimonia',  label: 'Cerimonia',    icon: Church },
  { key: 'documenti',  label: 'Documenti',    icon: FileText },
  { key: 'programma', label: 'Programma',    icon: CalendarClock },
  { key: 'scaletta',  label: 'Scaletta',     icon: CalendarClock },
  { key: 'checklist', label: 'Checklist',    icon: ListChecks },
  { key: 'alloggi',   label: 'Alloggi',      icon: BedDouble },
  { key: 'trasporti', label: 'Trasporti',    icon: Bus },
  { key: 'invitati',  label: 'Invitati',     icon: UsersIcon },
  { key: 'regali',    label: 'Regali',       icon: Gift },
  { key: 'tavoli',    label: 'Tavoli',       icon: PartyPopper },
  { key: 'menu',      label: 'Menu',         icon: Utensils },
  { key: 'mood',      label: 'Mood board',   icon: Palette },
  { key: 'playlist',  label: 'Playlist',     icon: Music },
  { key: 'gadgets',   label: 'Bomboniere',   icon: Gift },
  { key: 'website',   label: 'Sito ospiti',  icon: Globe },
]

// Categorie del menu laterale cliente: raggruppano le tab in aree comprensibili,
// così la coppia capisce subito dove trovare le cose. Le tab non pertinenti
// all'evento vengono filtrate; i gruppi senza voci visibili non si mostrano.
const TAB_GROUPS: Array<{ label: string; keys: Tab[] }> = [
  { label: 'Il tuo evento', keys: ['overview', 'programma', 'scaletta', 'cerimonia'] },
  { label: 'Ricordi', keys: ['foto', 'video', 'audio', 'guestbook'] },
  { label: 'Stile & festa', keys: ['mood', 'playlist', 'menu', 'gadgets'] },
  { label: 'Ospiti', keys: ['invitati', 'tavoli', 'website'] },
  { label: 'Organizzazione', keys: ['chat', 'preventivo', 'fornitori', 'documenti', 'checklist', 'alloggi', 'trasporti', 'planning'] },
]

const RESTAURATION_SUBROLES = new Set(['location', 'catering', 'chef', 'food_truck', 'pasticcere', 'sweet_table', 'bartender', 'sommelier'])

// Quali tab mostrare per tipo evento. Le tab "base" (overview, preventivo,
// documenti, programma, invitati, tavoli) ci sono sempre; le altre dipendono
// dal tipo. Così tutta la dashboard è centrata sull'evento.
function isTabVisible(tab: Tab, eventKind: string, hasRestauration: boolean): boolean {
  const religious = eventKind === 'battesimo' || eventKind === 'comunione' || eventKind === 'cresima'
  switch (tab) {
    case 'menu':      return hasRestauration
    case 'cerimonia': return eventKind === 'matrimonio' || religious
    case 'alloggi':                                        // pernottamenti: solo grandi eventi
    case 'trasporti': return eventKind === 'matrimonio'
    case 'mood':      return true                          // il mood board serve a ogni tipo evento
    case 'playlist':  return !religious                    // i riti religiosi non hanno "playlist"
    case 'gadgets':   return eventKind === 'matrimonio' || religious   // bomboniere
    case 'website':   return eventKind === 'matrimonio' || eventKind === 'corporate'
    default:          return true                          // overview, preventivo, documenti, programma, invitati, tavoli
  }
}

export default function CoupleDashboard() {
  const { data: weddings } = useMyWeddings()
  const { profile, user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Tab iniziale leggibile da URL (?tab=preventivo) — es. atterraggio post-questionario.
  const wantedTab = searchParams.get('tab') as Tab | null
  const [tab, setTab] = useState<Tab>(wantedTab ?? 'overview')

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
          <img src="/brand/planfully-symbol.svg" alt="Planfully" className="h-9 w-9 mx-auto mb-4" />
          <h1 className="font-display text-2xl mb-2">Ancora nessun evento</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
            Hai bisogno di un invito dall'organizzatore. Hai gia` ricevuto un link?
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
            {/* Feed network = solo professionisti (WP/fornitori). La coppia non lo vede. */}
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
  const { data: fullWedding } = useWedding(entryId)
  const quoteItems: Array<any> = (fullWedding as any)?.quote?.quote_items ?? []
  // Mostra la tab Menu SOLO se il preventivo include almeno un servizio di
  // ristorazione (location, catering, chef, ...). Se il quote non e` ancora
  // caricato o e` vuoto, fallback a mostrare la tab (non sappiamo ancora).
  const hasRestauration = quoteItems.length === 0
    ? true
    : quoteItems.some((it) => RESTAURATION_SUBROLES.has(String(it?.supplier?.subrole ?? '').toLowerCase()))
  const eventKind = wedding.event_kind ?? 'matrimonio'
  const term = eventTerm(eventKind)
  // Tutta la dashboard è centrata sul tipo evento: mostriamo SOLO le tab
  // pertinenti. Es. per un battesimo niente Alloggi/Trasporti/Mood/Playlist/Sito;
  // per un corporate niente Cerimonia/Bomboniere/Mood; ecc.
  const visibleTabs = TABS.filter((t) => isTabVisible(t.key, eventKind, hasRestauration))
  // Evento "solo ricordi": concluso e mai gestito col dashboard (nessun preventivo).
  // Restano attive solo Foto e Video; il resto si oscura. Atterro sempre su Foto.
  const photoOnly = isPhotoOnlyEvent(wedding)
  useEffect(() => { if (photoOnly && !PHOTO_ONLY_KEYS.has(tab)) setTab('foto') }, [photoOnly, tab, setTab])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: primary }}>
        <img src="/hero/preview.jpg" alt="" className="absolute inset-0 w-full h-full object-cover opacity-25" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary}DD 0%, ${primary}99 100%)` }} />
        <div className="relative max-w-4xl mx-auto px-6 py-16 text-center text-white">
          <span className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.3em] text-white/80 mb-3">
            {term.hasCoupleConcept
              ? <><Heart size={11} /> Il vostro grande giorno <Heart size={11} /></>
              : <><Sparkles size={11} /> {term.Label} <Sparkles size={11} /></>}
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

      {/* Tabs — barra orizzontale SOLO su mobile (su desktop c'è il menu laterale) */}
      <nav className="lg:hidden sticky top-[57px] z-20 border-b relative" style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-6xl mx-auto px-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-1 py-2 min-w-max">
            {visibleTabs.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              const locked = photoOnly && !PHOTO_ONLY_KEYS.has(t.key)
              return (
                <button
                  key={t.key}
                  disabled={locked}
                  title={locked ? 'Evento concluso — disponibili solo Foto e Video' : undefined}
                  onClick={(e) => {
                    setTab(t.key)
                    ;(e.currentTarget as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
                  }}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                    locked
                      ? 'opacity-35 cursor-not-allowed pointer-events-none text-[rgb(var(--fg-subtle))]'
                      : active
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

      <div className="max-w-6xl mx-auto px-6 py-8 lg:flex lg:gap-8 lg:items-start">
        {/* Menu laterale per categorie (desktop): le cose in ordine, così la coppia capisce subito */}
        <aside className="hidden lg:block w-52 shrink-0 sticky top-[73px] self-start max-h-[calc(100vh-90px)] overflow-y-auto pr-1">
          {TAB_GROUPS.map((g) => {
            const items = g.keys.map((k) => visibleTabs.find((t) => t.key === k)).filter(Boolean) as typeof visibleTabs
            if (!items.length) return null
            return (
              <div key={g.label} className="mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--fg-subtle))] px-3 mb-1">{g.label}</p>
                <div className="space-y-0.5">
                  {items.map((t) => {
                    const Icon = t.icon; const active = tab === t.key
                    const locked = photoOnly && !PHOTO_ONLY_KEYS.has(t.key)
                    return (
                      <button key={t.key} disabled={locked} onClick={() => setTab(t.key)}
                        title={locked ? 'Evento concluso — disponibili solo Foto e Video' : undefined}
                        className={cn('w-full inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-left',
                          locked ? 'opacity-35 cursor-not-allowed pointer-events-none text-[rgb(var(--fg-subtle))]'
                            : active ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]' : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]')}>
                        <Icon size={15} className="shrink-0" /> <span className="truncate">{t.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </aside>

        <div className="flex-1 min-w-0">
        {photoOnly && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
            <Sparkles size={15} className="text-[rgb(var(--gold-600))] shrink-0" />
            <span className="text-[rgb(var(--fg-muted))]">Evento concluso: qui trovi i tuoi <strong className="text-[rgb(var(--fg))]">ricordi</strong> — Foto e Video.</span>
          </div>
        )}
        {!photoOnly && tab === 'overview' && <div className="mb-6"><EventRing entryId={entryId} view="sposi" /></div>}
        {tab === 'overview' && <div className="mb-6"><CompletionRings entryId={entryId} onOpen={(t) => setTab(((({ guests: 'invitati', rsvp: 'invitati', tables: 'tavoli', ceremony: 'cerimonia', timeline: 'programma', cerchio: 'overview' }) as Record<string, string>)[t] ?? t) as Tab)} /></div>}
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'overview' && <OverviewCouple wedding={wedding} entryId={entryId} memberRole={memberRole} />}
            {tab === 'overview' && <div className="mt-6"><CoupleRequestsCard entryId={entryId} /></div>}
            {tab === 'chat' && <ChatEvento entryId={entryId} />}
            {tab === 'foto' && <EventGalleryTab entryId={entryId} role="sposi" />}
            {tab === 'audio' && <AudioWishes entryId={entryId} readOnly />}
            {tab === 'guestbook' && <Guestbook entryId={entryId} readOnly />}
            {tab === 'video' && (
              <Card className="p-8 text-center">
                <Film size={26} className="mx-auto mb-3 text-[rgb(var(--gold-600))]" />
                <h3 className="font-display text-xl mb-1">Il vostro video</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Guarda la bozza e lascia i tuoi <strong>post-it</strong> sui momenti da rivedere (montaggio, musica…). Il videomaker li riceve.</p>
                <Link to={`/video/${entryId}`}><Button variant="gold"><Film size={15} /> Apri il video e commenta</Button></Link>
              </Card>
            )}
            {tab === 'preventivo' && <PreventivoCouple entryId={entryId} />}
            {tab === 'fornitori' && (
              <div>
                <h2 className="font-display text-2xl mb-1">I miei fornitori</h2>
                <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
                  Preventivi, contratti e comunicazioni di ogni professionista — anche quelli che hai contattato per conto tuo, fuori dalla rete dell'organizzatore.
                </p>
                <ClientProfessionalsView />
              </div>
            )}
            {tab === 'planning' && <CouplePlanningTab entryId={entryId} />}
            {tab === 'cerimonia' && <CeremonyTab entryId={entryId} readOnly />}
            {tab === 'documenti' && <DocumentiCouple wedding={wedding} entryId={entryId} />}
            {tab === 'programma' && <ProgrammaCouple entryId={entryId} />}
            {tab === 'scaletta' && <TimelineTab entryId={entryId} eventKind={(wedding as { event_kind?: string }).event_kind} />}
            {tab === 'checklist' && <ChecklistTab entryId={entryId} />}
            {tab === 'alloggi' && <AlloggiCouple entryId={entryId} />}
            {tab === 'trasporti' && <TrasportiCouple entryId={entryId} />}
            {tab === 'invitati' && <GuestsTab entryId={entryId} eventKind={eventKind} />}
            {tab === 'regali' && <GiftsTab entryId={entryId} />}
            {tab === 'tavoli' && <TablesTab entryId={entryId} />}
            {tab === 'menu' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <ChangeRequestModal weddingId={entryId} entityType="MENU" defaultAction="UPDATE" prefillTitle="Modifica al menu" />
                </div>
                <MenuTab entryId={entryId} readOnly />
              </div>
            )}
            {tab === 'mood' && <MoodCouple entryId={entryId} eventKind={eventKind} />}
            {tab === 'playlist' && <PlaylistCouple entryId={entryId} eventKind={eventKind} />}
            {tab === 'gadgets' && <GadgetsCouple entryId={entryId} />}
            {tab === 'website' && <WebsiteCouple wedding={wedding} />}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
    </>
  )
}

function OverviewCouple({ wedding, entryId, memberRole }: { wedding: any; entryId: string; memberRole: string }) {
  const guests = useGuests(entryId)
  const subevents = useSubEvents(entryId)
  const yes = (guests.data ?? []).filter((g: any) => g.rsvp === 'YES').length
  const nuovoModello = useNuovoModello()
  const eventKind = wedding.event_kind ?? 'matrimonio'
  const term = eventTerm(eventKind)
  const orgLabel = term.hasCoupleConcept ? 'Wedding planner' : 'Organizzatore'
  const guestsLabel = eventKind === 'corporate' ? 'Partecipanti confermati' : 'Invitati confermati'
  const roleLabel = term.hasCoupleConcept ? memberRole : 'Referente'

  return (
    <div className="space-y-6">
      {/* Prossima mossa per la coppia su questo matrimonio (workflow guidato) */}
      {nuovoModello && (
        <>
          <div className="flex items-center justify-end">
            <SaluteEventoBadge entryId={entryId} />
          </div>
          <ProssimaMossa entryId={entryId} title="La vostra prossima mossa" limit={5} />
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <Badge tone="gold">{roleLabel}</Badge>
          <h2 className="font-display text-xl mt-3 mb-3">Riepilogo</h2>
          <dl className="space-y-2 text-sm">
            <Row k={orgLabel} v={wedding.owner?.business_name ?? wedding.owner?.full_name ?? '—'} />
            <Row k="Data" v={new Date(wedding.date_from).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
            <Row k={guestsLabel} v={`${yes} / ${wedding.guest_count ?? '?'}`} />
            <Row k="Programma" v={`${subevents.data?.length ?? 0} eventi`} />
            {wedding.is_destination && <Row k="Destination" v={wedding.destination_location ?? '—'} />}
          </dl>
        </Card>
        <Card className="p-6">
          <h2 className="font-display text-xl mb-3">Note dell'organizzatore</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {wedding.client_name && `Per: ${wedding.client_name}`}
          </p>
          <p className="text-sm mt-3">
            Le info sensibili (note interne, valore economico) sono riservate all'organizzatore.
            {term.hasCoupleConcept ? ' Voi vedete' : ' Vedi'} tutto ciò che riguarda l'esperienza {term.ofIt}.
          </p>
        </Card>
      </div>
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
          <h2 className="font-display text-2xl">Eventi collegati</h2>
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
              L'organizzatore non ha ancora aggiunto eventi collegati (es. cena della vigilia, brunch del giorno dopo).
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
          <ChangeRequestModal weddingId={entryId} entityType="TIMELINE" defaultAction="UPDATE" prefillTitle="Modifica scaletta del giorno" />
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
              La scaletta del giorno non è ancora stata definita dall'organizzatore.
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

function MoodCouple({ entryId, eventKind }: { entryId: string; eventKind?: string }) {
  const { data } = useMood(entryId)
  const { add, remove } = useMoodMutations(entryId)
  // Categorie mood coerenti col tipo evento: niente "vestito"/"torta" (nuziali)
  // per corporate/battesimo/compleanno.
  const TAGS = eventKind === 'corporate'
    ? ['allestimento', 'branding', 'catering', 'location', 'altro']
    : eventTerm(eventKind ?? 'matrimonio').hasCoupleConcept
      ? ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro']
      : ['allestimento', 'fiori', 'location', 'altro']
  const [pinUrl, setPinUrl] = useState('')
  const [tag, setTag] = useState(TAGS[0])
  const [busy, setBusy] = useState(false)

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
        Le ispirazioni raccolte dal vostro organizzatore. Aggiungete le vostre da Pinterest, Instagram o qualsiasi pagina web.
      </p>

      {/* Mini-Canva: il cliente compone il suo moodboard con foto, scritte, forme e icone */}
      <div className="mb-6">
        <MoodBoardEditor entryId={entryId} pins={(data ?? []).map((d: any) => d.url).filter(Boolean)} />
      </div>

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

function PlaylistCouple({ entryId, eventKind }: { entryId: string; eventKind?: string }) {
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
  // Momenti coerenti col tipo evento: "Taglio torta"/"Prima danza" solo per
  // eventi wedding-like; per gli altri momenti generici.
  const isWeddingLike = eventTerm(eventKind ?? 'matrimonio').hasCoupleConcept
  const baseMoms = isWeddingLike
    ? [{ k: 'CERIMONIA', l: 'Cerimonia' }, { k: 'APERITIVO', l: 'Aperitivo' }, { k: 'CENA', l: 'Cena' }, { k: 'TAGLIO_TORTA', l: 'Taglio torta' }, { k: 'PRIMA_DANZA', l: 'Prima danza' }, { k: 'FESTA', l: 'Festa' }]
    : [{ k: 'INGRESSO', l: 'Ingresso' }, { k: 'APERITIVO', l: 'Aperitivo' }, { k: 'CENA', l: 'Cena' }, { k: 'BRINDISI', l: 'Brindisi' }, { k: 'FESTA', l: 'Festa' }]
  // Non perdere brani salvati su momenti non più in elenco: aggiungili come "Altro".
  const known = new Set(baseMoms.map((m) => m.k))
  const orphan = Array.from(new Set((songs ?? []).map((s: any) => s.moment))).filter((m) => m && !known.has(m as string))
  const MOMS = [...baseMoms, ...orphan.map((m) => ({ k: m as string, l: m as string }))]

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
          <p className="text-sm text-[rgb(var(--fg-muted))]">Il sito ospiti non e&apos; ancora pubblicato. Chiedi al tuo organizzatore.</p>
        )}
      </Card>
    </div>
  )
}

function DocumentiCouple({ wedding, entryId }: { wedding: any; entryId: string }) {
  const [quote, setQuote] = useState<any | null>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [sharedDocs, setSharedDocs] = useState<any[]>([])
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
        // documenti che il WP ha esplicitamente condiviso (RLS restituisce solo gli shared)
        const { data: docs } = await (supabase.from('event_documents' as any) as any)
          .select('id, kind, name, storage_path, size_bytes, created_at')
          .eq('entry_id', entryId)
          .order('created_at', { ascending: false })
        setSharedDocs((docs ?? []) as any[])
      } finally { setLoading(false) }
    })()
  }, [wedding.quote_id, entryId])

  async function openDoc(path: string) {
    const { data } = await supabase.storage.from('event-documents').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast.error('Documento non disponibile')
  }

  const fmtEUR = (n: any) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n ?? 0))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl mb-1">Documenti</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Il preventivo e il contratto del vostro evento.</p>
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
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Il preventivo non è ancora stato emesso dal organizzatore.</p>
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
            <p className="text-sm text-[rgb(var(--fg-subtle))]">Il contratto non è ancora stato preparato dal organizzatore.</p>
          )}
        </Card>
      )}

      {/* DOCUMENTI CONDIVISI dal wedding planner (fatture, ricevute, permessi, liberatorie…) */}
      {!loading && sharedDocs.length > 0 && (
        <Card className="p-6">
          <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-3">Documenti condivisi</p>
          <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {sharedDocs.map((d) => (
              <li key={d.id} className="py-2.5 flex items-center gap-3">
                <FileText size={16} className="text-[rgb(var(--fg-muted))] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{d.name}</p>
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))]">{d.kind} · {Math.round((d.size_bytes ?? 0) / 1024)} KB</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void openDoc(d.storage_path)}><FileText size={13} /> Apri</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><dt className="text-[rgb(var(--fg-muted))]">{k}</dt><dd className="font-medium">{v}</dd></div>
}

// ──────────────────────────────────────────────────────────────────────
// Preventivo Couple — sposi loggati vedono e firmano il preventivo
// ──────────────────────────────────────────────────────────────────────
type PreventivoData = {
  id: string
  access_token: string
  title: string
  client_name: string | null
  client_email: string | null
  event_date: string | null
  guest_count: number | null
  status: string
  revision: number
  total_client: number | null
  pdf_url: string | null
  accepted_at: string | null
  closed_at: string | null
  business_model: 'GLOBAL' | 'BROKER'
  owner: { full_name?: string | null; business_name?: string | null; role?: string | null }
  items: Array<{
    id: string; name_snapshot: string; quantity: number; unit_snapshot: string; line_client: number
    supplier_id?: string | null; created_at?: string | null
    client_decision?: 'IN_ATTESA' | 'ACCETTATO' | 'RIFIUTATO' | 'FORSE'
    client_decline_reason?: string | null; contracted_at?: string | null
  }>
  error?: string
}

function PreventivoCouple({ entryId }: { entryId: string }) {
  const [data, setData] = useState<PreventivoData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [signed, setSigned] = useState(false)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [concluding, setConcluding] = useState(false)

  async function load(initial = false) {
    if (initial) setLoading(true)
    try {
      const { data: res, error } = await (supabase.rpc as any)('couple_get_quote_for_entry', { p_entry_id: entryId })
      if (error) throw error
      const p = res as PreventivoData
      if (p?.error) {
        if (p.error === 'no_quote') setErr('Il tuo organizzatore non ha ancora generato un preventivo.')
        else if (p.error === 'not_couple_member') setErr('Non fai parte di questo evento.')
        else setErr(p.error)
        return
      }
      setData(p)
      if (p.accepted_at) setSigned(true)
    } catch (e) { setErr((e as Error).message) }
    finally { if (initial) setLoading(false) }
  }

  useEffect(() => { void load(true) }, [entryId])

  async function decide(itemId: string, decision: 'ACCETTATO' | 'RIFIUTATO' | 'FORSE') {
    let reason: string | null = null
    if (decision === 'RIFIUTATO') reason = window.prompt('Vuoi indicare un motivo? (facoltativo)') || null
    setBusyItem(itemId)
    try {
      const { data: r, error } = await (supabase.rpc as any)('client_decide_quote_item', { p_item_id: itemId, p_decision: decision, p_reason: reason })
      if (error) throw error
      if ((r as any)?.error) throw new Error((r as any).error)
      await load()
    } catch (e) { toast.error(friendlyErr(e)) }
    finally { setBusyItem(null) }
  }

  async function conclude() {
    if (!data) return
    if (!window.confirm('Concludere il preventivo? Le voci approvate verranno integrate nel contratto con un addendum da firmare.')) return
    setConcluding(true)
    try {
      const { data: r, error } = await (supabase.rpc as any)('quote_conclude_by_client', { p_quote_id: data.id })
      if (error) throw error
      const res = r as any
      if (res?.error) throw new Error(res.error)
      if (res?.addendum?.created && res?.addendum?.token) {
        window.location.href = `/p/addendum/${res.addendum.token}`
        return
      }
      await load()
      toast.success('Preventivo concluso. Nessuna modifica al contratto da firmare.')
    } catch (e) { toast.error(friendlyErr(e)) }
    finally { setConcluding(false) }
  }

  if (loading) return <div className="text-sm text-[rgb(var(--fg-muted))]">Carico il preventivo…</div>
  if (err) return (
    <Card className="p-6 text-center">
      <FileSignature size={28} className="mx-auto mb-3 text-[rgb(var(--gold-600))]" />
      <h2 className="font-display text-xl mb-1">Preventivo non disponibile</h2>
      <p className="text-sm text-[rgb(var(--fg-muted))]">{err}</p>
    </Card>
  )
  if (!data) return null

  // Fornitore (non capostipite) → preventivo "à la carte": il cliente sceglie le
  // voci, il totale è la somma di quelle approvate; niente logica organizzatore.
  const isFornitore = (data.owner?.role ?? '').toUpperCase() === 'FORNITORE'
  const ownerName = data.owner?.business_name ?? data.owner?.full_name ?? (isFornitore ? 'Il fornitore' : 'Organizzatore')
  const liveItems = data.items.filter((it) => !it.contracted_at)
  const hasLive = liveItems.length > 0
  const isClosed = !!data.closed_at
  const pendingCount = liveItems.filter((it) => (it.client_decision ?? 'IN_ATTESA') === 'IN_ATTESA').length
  const confirmedTotal = data.items
    .filter((it) => it.contracted_at || it.client_decision === 'ACCETTATO')
    .reduce((s, it) => s + Number(it.line_client || 0), 0)
  const fmtAddTime = (d?: string | null) => {
    if (!d) return null
    try { return new Date(d).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
    catch { return null }
  }

  return (
    <div className="space-y-5">
      {pendingCount > 0 && !isClosed && (
        <Card className="p-4 flex items-center gap-3" style={{ background: 'rgb(var(--gold-100))', borderColor: 'rgb(var(--gold-500))' }}>
          <span className="text-xl">✨</span>
          <p className="text-sm">
            Hai <strong>{pendingCount} {pendingCount === 1 ? 'nuova proposta' : 'nuove proposte'}</strong> {isFornitore ? `da ${ownerName}` : 'dal tuo organizzatore'} da rivedere qui sotto: approva, metti in forse o non accettare.
          </p>
        </Card>
      )}
      <Card className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[rgb(var(--gold-600))] mb-1">
              Preventivo · revisione {data.revision}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl tracking-tight">{data.title}</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
              Da <strong>{ownerName}</strong>
            </p>
          </div>
          <Badge>
            {signed ? '✓ Firmato' : data.status}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5 text-sm">
          {data.event_date && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Data evento</p>
              <p className="font-medium mt-0.5">{new Date(data.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          )}
          {data.guest_count != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Invitati</p>
              <p className="font-medium mt-0.5">{data.guest_count}</p>
            </div>
          )}
          {isFornitore ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Totale selezionato</p>
              <p className="font-display text-2xl mt-0.5">€ {confirmedTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
          ) : data.total_client != null && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Totale</p>
              <p className="font-display text-2xl mt-0.5">€ {Number(data.total_client).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
            </div>
          )}
        </div>

        <h3 className="font-display text-lg mb-2">Servizi</h3>
        {isFornitore ? (
          <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
            Scegli i servizi che preferisci: il <strong>totale</strong> è la somma di quelli che approvi. Niente è vincolante finché non firmi. {ownerName} può applicare uno sconto, che vedrai qui prima della firma.
          </p>
        ) : hasLive && (
          <p className="text-xs mb-3 rounded-lg px-3 py-2" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
            Le voci con <strong>✓ Firmato nel preventivo</strong> sono già nel contratto firmato. Le altre sono <strong>integrazioni</strong> aggiunte dopo: puoi approvarle, metterle in forse o non accettarle. Nulla entra nel contratto finché non concludi e firmi.
          </p>
        )}
        <ul className="divide-y mb-4" style={{ borderColor: 'rgb(var(--border))' }}>
          {data.items.map((it) => {
            const dec = it.client_decision ?? 'IN_ATTESA'
            const isContracted = !!it.contracted_at
            return (
              <li key={it.id} className="py-3 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{it.name_snapshot}</p>
                    {isFornitore ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: 'rgb(var(--fg-muted))', background: 'rgb(var(--bg-sunken))' }}>Opzione</span>
                    ) : isContracted ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#16a34a', background: '#16a34a1a' }}>✓ Firmato nel preventivo</span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#d97706', background: '#d977061a' }}>Integrazione</span>
                    )}
                  </div>
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-0.5">
                    {it.quantity} {String(it.unit_snapshot ?? '').toLowerCase()}
                    {it.created_at && <span className="ml-2 text-[10px]">· aggiunta il {fmtAddTime(it.created_at)}</span>}
                  </p>
                  {dec === 'RIFIUTATO' && it.client_decline_reason && (
                    <p className="text-[10px] italic text-[rgb(var(--fg-subtle))] mt-0.5">Motivo: {it.client_decline_reason}</p>
                  )}
                  {/* Decisione per-voce (solo integrazioni live, preventivo non concluso) */}
                  {!isContracted && !isClosed && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {dec === 'IN_ATTESA' ? (
                        <>
                          <button disabled={busyItem === it.id} onClick={() => void decide(it.id, 'ACCETTATO')} className="px-2 py-1 rounded-md text-white text-[11px] font-medium disabled:opacity-50" style={{ background: '#16a34a' }}>Approva</button>
                          <button disabled={busyItem === it.id} onClick={() => void decide(it.id, 'FORSE')} className="px-2 py-1 rounded-md text-[11px] font-medium border disabled:opacity-50" style={{ borderColor: 'rgb(var(--border))' }}>In forse</button>
                          <button disabled={busyItem === it.id} onClick={() => void decide(it.id, 'RIFIUTATO')} className="px-2 py-1 rounded-md text-[11px] font-medium border disabled:opacity-50" style={{ borderColor: 'rgb(var(--border))' }}>Non accetto</button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={
                            dec === 'ACCETTATO' ? { color: '#16a34a', background: '#16a34a1a' }
                            : dec === 'FORSE' ? { color: '#7c3aed', background: '#7c3aed1a' }
                            : { color: '#dc2626', background: '#dc26261a' }}>
                            {dec === 'ACCETTATO' ? '✓ Approvata' : dec === 'FORSE' ? '? In forse' : '✕ Non accettata'}
                          </span>
                          <button disabled={busyItem === it.id} onClick={() => void decide(it.id, 'IN_ATTESA' as any)} className="text-[10px] underline text-[rgb(var(--fg-subtle))] disabled:opacity-50">cambia</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="font-medium text-sm whitespace-nowrap">€ {Number(it.line_client ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
              </li>
            )
          })}
        </ul>
        {hasLive && !isClosed && (!isFornitore || signed) && (
          <div className="rounded-lg border p-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="text-xs text-[rgb(var(--fg-muted))]">
              {isFornitore ? 'Totale selezionato' : 'Totale confermato finora'}: <strong className="text-[rgb(var(--fg))]">€ {confirmedTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
            </div>
            <Button variant="gold" disabled={concluding} onClick={() => void conclude()}>
              {concluding ? 'Concludo…' : 'Concludi preventivo e firma'}
            </Button>
          </div>
        )}
        {isFornitore && !signed && (
          <div className="rounded-lg border p-3 mb-4 text-xs text-[rgb(var(--fg-muted))]" style={{ borderColor: 'rgb(var(--border))' }}>
            Totale selezionato: <strong className="text-[rgb(var(--fg))]">€ {confirmedTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong> — somma delle voci che hai approvato. Procedi alla firma qui sotto.
          </div>
        )}

        {data.pdf_url && (
          <a href={data.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--gold-600))] hover:underline mb-4">
            <FileText size={12} /> Scarica PDF preventivo <ExternalLink size={10} />
          </a>
        )}
      </Card>

      {!signed ? (
        <Card className="p-6 sm:p-8">
          <h3 className="font-display text-xl mb-2 flex items-center gap-2">
            <FileSignature size={18} className="text-[rgb(var(--gold-600))]" /> Accetta e firma
          </h3>
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-5">
            La firma richiede: dati documento d'identità, consenso GDPR e firma grafica (puoi disegnarla
            col mouse o col dito). Tutto in una pagina dedicata.
          </p>
          {data.access_token ? (
            <a href={`/p/accept/${data.access_token}`} target="_blank" rel="noreferrer">
              <Button variant="gold">
                <FileSignature size={14} /> Procedi alla firma del preventivo
              </Button>
            </a>
          ) : (
            <Button variant="gold" disabled>
              <FileSignature size={14} /> Preventivo non ancora pronto alla firma
            </Button>
          )}
        </Card>
      ) : (
        <Card className="p-6 sm:p-8 text-center">
          <FileSignature size={36} className="mx-auto mb-3 text-emerald-500" />
          <h3 className="font-display text-2xl mb-2">Preventivo firmato</h3>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            L'atto di accettazione e' stato registrato il {data.accepted_at ? new Date(data.accepted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : 'oggi'}.
            Una copia firmata e' stata inviata via email.
          </p>
        </Card>
      )}
    </div>
  )
}
