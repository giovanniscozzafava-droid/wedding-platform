import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CalendarClock, Table2, Users as UsersIcon, Wallet, ListChecks,
  Palette, Music, FileSignature, FolderOpen, BarChart3, FileText,
  BedDouble, Bus, Gift, PartyPopper, Globe, Heart, Utensils, Church, ClipboardList,
  Scale, MessageCircle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useWedding, useUpdateWedding } from '@/hooks/useWedding'
import { OverviewTab } from '@/components/wedding/OverviewTab'
import { TimelineTab } from '@/components/wedding/TimelineTab'
import { TablesTab } from '@/components/wedding/TablesTab'
import { GuestsTab } from '@/components/wedding/GuestsTab'
import { GiftsTab } from '@/components/wedding/GiftsTab'
import { CornersTab } from '@/components/wedding/CornersTab'
import { Boxes } from 'lucide-react'
import { BudgetTab } from '@/components/wedding/BudgetTab'
import { ChecklistTab } from '@/components/wedding/ChecklistTab'
import { eventTerm } from '@/lib/eventKind'
import { MoodTab } from '@/components/wedding/MoodTab'
import { PlaylistTab } from '@/components/wedding/PlaylistTab'
import { ContractTab } from '@/components/wedding/ContractTab'
import { DocumentsTab } from '@/components/wedding/DocumentsTab'
import { AnalyticsTab } from '@/components/wedding/AnalyticsTab'
import { AccommodationsTab } from '@/components/wedding/AccommodationsTab'
import { TransportTab } from '@/components/wedding/TransportTab'
import { GadgetsTab } from '@/components/wedding/GadgetsTab'
import { SubEventsTab } from '@/components/wedding/SubEventsTab'
import { WebsiteTab } from '@/components/wedding/WebsiteTab'
import { MembersTab } from '@/components/wedding/MembersTab'
import { MenuTab } from '@/components/wedding/MenuTab'
import { CeremonyTab } from '@/components/wedding/CeremonyTab'
import { CouplePlanningTab } from '@/components/wedding/CouplePlanningTab'
import { AllContractsMonitor } from '@/components/wedding/AllContractsMonitor'
import { PagamentiTab } from '@/components/wedding/PagamentiTab'
import { RiconciliazioneCard } from '@/components/wedding/RiconciliazioneCard'
import { ChatEvento } from '@/components/wedding/ChatEvento'
import { SaluteEventoBadge } from '@/components/wedding/SaluteEventoBadge'
import { useNuovoModello } from '@/hooks/useNuovoModello'
import { RateCollaborationModal } from '@/components/social/RateCollaborationModal'
import { AmbitoIncaricoModal, type Ambito } from '@/components/wedding/AmbitoIncaricoModal'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { EventRing } from '@/components/event/EventRing'
import { CompletionRings } from '@/components/event/CompletionRings'
import { EventGalleryTab } from '@/components/event/EventGalleryTab'
import { AlbumFunnelTab } from '@/components/event/AlbumFunnelTab'
import { Images, Mic, BookHeart, Film } from 'lucide-react'
import { AudioWishes } from '@/components/event/AudioWishes'
import { Guestbook } from '@/components/event/Guestbook'
import { Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchUnreadByEntry, tabsWithDot, typesForTab, markEntryTabRead } from '@/lib/notifGuide'
import { isPhotoOnlyEvent } from '@/lib/eventMode'
import { useQueryClient } from '@tanstack/react-query'

type TabKey = 'overview' | 'album_funnel' | 'planning' | 'ceremony' | 'timeline' | 'tables' | 'guests' | 'regali' | 'menu' | 'budget' | 'payments' | 'checklist' | 'mood' | 'playlist' | 'contract' | 'contracts_net' | 'docs' | 'analytics' | 'accommodations' | 'transport' | 'gadgets' | 'angoli' | 'subevents' | 'website' | 'members' | 'riconciliazione' | 'chat' | 'foto' | 'audio' | 'guestbook' | 'video'

type TabDef = { key: TabKey; label: string; icon: typeof CalendarClock; nuovoModelloOnly?: boolean; capostipiteOnly?: boolean; coupleOnly?: boolean }

// Evento "solo ricordi" (passato + senza preventivo): tengo attive Foto/Video e, lato
// professionista, anche Overview (così l'owner non resta intrappolato e può sempre gestire).
const PRO_PHOTO_ONLY_KEYS = new Set(['foto', 'video', 'overview'])

const TABS: Array<TabDef> = [
  { key: 'overview',       label: 'Overview',     icon: FileText },
  // Percorso guidato del cliente (solo coppia): foto → impaginazione → copertina → stampe
  { key: 'album_funnel',   label: 'Il tuo album', icon: BookHeart, coupleOnly: true },
  // Ricordi (consegne) — priorità e coerenza: Foto e Video subito, vicini
  { key: 'foto',           label: 'Foto',         icon: Images },
  { key: 'video',          label: 'Video',        icon: Film },
  { key: 'audio',          label: 'Audio auguri', icon: Mic },
  { key: 'guestbook',      label: 'Guestbook',    icon: BookHeart },
  // Ospiti & festa
  { key: 'guests',         label: 'Invitati',     icon: UsersIcon },
  { key: 'tables',         label: 'Tavoli',       icon: Table2 },
  { key: 'regali',         label: 'Regali',       icon: Gift },
  { key: 'menu',           label: 'Menu',         icon: Utensils, capostipiteOnly: true },
  { key: 'gadgets',        label: 'Bomboniere',   icon: Gift },
  { key: 'angoli',         label: 'Angoli',       icon: Boxes },
  { key: 'subevents',      label: 'Eventi',       icon: PartyPopper },
  // Programma & stile
  { key: 'ceremony',       label: 'Cerimonia',    icon: Church },
  { key: 'timeline',       label: 'Scaletta',     icon: CalendarClock },
  { key: 'mood',           label: 'Mood',         icon: Palette },
  { key: 'playlist',       label: 'Playlist',     icon: Music },
  // Logistica
  { key: 'accommodations', label: 'Alloggi',      icon: BedDouble },
  { key: 'transport',      label: 'Trasporti',    icon: Bus },
  // Organizzazione
  { key: 'chat',           label: 'Chat',         icon: MessageCircle, nuovoModelloOnly: true },
  { key: 'checklist',      label: 'Checklist',    icon: ListChecks },
  { key: 'planning',       label: 'Questionario', icon: ClipboardList, capostipiteOnly: true },
  // Gestione (capostipite)
  { key: 'contract',       label: 'Contratto',    icon: FileSignature, capostipiteOnly: true },
  { key: 'contracts_net',  label: 'Contratti rete', icon: FileSignature, capostipiteOnly: true },
  { key: 'budget',         label: 'Budget',       icon: Wallet, capostipiteOnly: true },
  { key: 'payments',       label: 'Pagamenti',    icon: Wallet, capostipiteOnly: true },
  { key: 'riconciliazione', label: 'Riconciliazione', icon: Scale, nuovoModelloOnly: true, capostipiteOnly: true },
  { key: 'members',        label: 'Clienti',      icon: Heart, capostipiteOnly: true },
  { key: 'website',        label: 'Sito evento', icon: Globe, capostipiteOnly: true },
  { key: 'docs',           label: 'Documenti',    icon: FolderOpen, capostipiteOnly: true },
  { key: 'analytics', label: 'Analytics',  icon: BarChart3, capostipiteOnly: true },
]

export default function WeddingDashboard() {
  const { id } = useParams<{ id: string }>()
  const { data: wedding, isLoading } = useWedding(id ?? null)
  const [tab, setTab] = useState<TabKey>('overview')
  const tabsRef = useRef<HTMLDivElement>(null)
  const scrollTabs = (dir: number) => tabsRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })
  const [rateOpen, setRateOpen] = useState(false)
  const [ambitoSkipped, setAmbitoSkipped] = useState(false)
  const nuovoModello = useNuovoModello()
  const { user, profile } = useAuth()
  const isFornitore = profile?.role === 'FORNITORE'
  const ringView: 'capostipite' | 'fornitore' | 'sposi' =
    profile?.role === 'FORNITORE' ? 'fornitore' : profile?.role === 'COUPLE' ? 'sposi' : 'capostipite'
  const qc = useQueryClient()
  const [dotTabs, setDotTabs] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!wedding?.id) return
    void fetchUnreadByEntry().then((m) => setDotTabs(tabsWithDot(m[wedding.id]?.types ?? [])))
  }, [wedding?.id])

  // REVISIONE C: ambito incarico (COMPLETO | SOLO_COORDINAMENTO | SOLO_PROPRI_SERVIZI).
  // Letto da wedding.ambito_capostipite (puo` essere null). Per il gating delle tab
  // e per ProssimaMossa, fallback operativo a COMPLETO.
  const ambito = ((wedding as any)?.ambito_capostipite ?? null) as Ambito | null
  const effectiveAmbito: Ambito = ambito ?? 'COMPLETO'

  // Reset "skipped" se cambio evento.
  useEffect(() => {
    setAmbitoSkipped(false)
  }, [wedding?.id])

  // Se la tab attiva e' stata nascosta dal gating, torno a overview.
  useEffect(() => {
    const capostipiteTab = ['contract', 'contracts_net', 'website', 'members', 'analytics'].includes(tab)
    const hidden = ((effectiveAmbito === 'SOLO_COORDINAMENTO') &&
      (tab === 'contract' || tab === 'contracts_net' || tab === 'budget'))
      || (isFornitore && capostipiteTab)
    if (hidden) setTab('overview')
  }, [effectiveAmbito, tab, isFornitore])

  // La modale appare per l'owner del calendar_entry quando lo stato e`
  // INCARICO_FIRMATO (o successivo, se non l'aveva ancora scelto) e ambito = null.
  const shouldAskAmbito = useMemo(() => {
    if (!wedding) return false
    if (ambito != null) return false
    if (ambitoSkipped) return false
    const stato = (wedding as any).evento_stato as string | null | undefined
    if (!stato) return false
    if (stato === 'LEAD' || stato === 'SVOLTO' || stato === 'ANNULLATO') return false
    const ownerId = (wedding as any).owner_id as string | undefined
    if (!ownerId || !user?.id) return false
    return ownerId === user.id
  }, [wedding, ambito, ambitoSkipped, user?.id])

  // Le sezioni COINCIDONO col tipo evento: la "Cerimonia" esiste solo dove c'è un rito
  // (matrimonio, battesimo, comunione, cresima, anniversario), non su compleanno/laurea/corporate/festa.
  const eventKind = String((wedding as any)?.event_kind ?? 'matrimonio').toLowerCase()
  const hasCeremony = ['matrimonio', 'battesimo', 'comunione', 'cresima', 'anniversario'].includes(eventKind)
  const visibleTabs = useMemo(
    () =>
      TABS.filter((t) => {
        if (t.nuovoModelloOnly && !nuovoModello) return false
        // "Il tuo album" è il percorso guidato del cliente: solo per la coppia.
        if (t.coupleOnly && ringView !== 'sposi') return false
        // La Cerimonia c'è solo negli eventi con un rito.
        if (t.key === 'ceremony' && !hasCeremony) return false
        // Un fornitore lavora solo sull'operativo del SUO evento: niente tab da
        // capostipite (contratto-quadro, contratti rete, sito, clienti, analytics).
        if (t.capostipiteOnly && isFornitore) return false
        // Gating per ambito incarico.
        if (effectiveAmbito === 'SOLO_COORDINAMENTO') {
          // Niente preventivi/contratti/contratti-rete: il capostipite coordina solo.
          if (t.key === 'contract' || t.key === 'contracts_net' || t.key === 'budget') return false
        }
        return true
      }),
    [nuovoModello, effectiveAmbito, isFornitore, ringView, hasCeremony],
  )

  // Evento "solo ricordi": concluso e mai gestito col dashboard (nessun preventivo).
  // Tengo attive solo Foto/Video (+ Overview lato pro); il resto si oscura. Atterro su Foto.
  const photoOnly = isPhotoOnlyEvent(wedding as { date_from?: string | null; date_to?: string | null; quote?: unknown } | null)
  useEffect(() => { if (photoOnly && !PRO_PHOTO_ONLY_KEYS.has(tab)) setTab('foto') }, [photoOnly, tab])
  // Fornitore su evento già passato → atterra su Foto (la cosa che gli interessa). Una volta sola.
  const landedRef = useRef(false)
  useEffect(() => {
    if (landedRef.current || !wedding) return
    landedRef.current = true
    const end = (wedding as { date_to?: string | null; date_from?: string | null }).date_to || (wedding as { date_from?: string | null }).date_from
    if (ringView === 'fornitore' && end && new Date(end) < new Date()) setTab('foto')
  }, [wedding, ringView])

  if (isLoading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>
  if (!wedding) return <div className="p-10 text-[rgb(var(--rose-500))]">Wedding non trovato</div>

  const eventPassed = wedding.date_to ? new Date(wedding.date_to) < new Date() : false

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="aurora relative">
        <div className="absolute inset-0 dotted opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 relative z-30">
          <Link to="/weddings" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-3">
            <ArrowLeft size={14} /> Tutti gli eventi
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
                Evento {(wedding as any).guest_count ? `· ${(wedding as any).guest_count} invitati` : ''}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <h1 className="font-display text-3xl sm:text-4xl tracking-tight">{wedding.title}</h1>
                <button title="Modifica nome evento" className="p-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))] shrink-0"
                  onClick={async () => {
                    const v = prompt('Nuovo nome evento:', wedding.title)
                    if (v == null) return
                    const name = v.trim()
                    if (!name || name === wedding.title) return
                    const { error } = await (supabase.from as unknown as (t: string) => { update: (o: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } })('calendar_entries').update({ title: name }).eq('id', wedding.id)
                    if (error) { toast.error(error.message); return }
                    toast.success('Nome aggiornato')
                    qc.invalidateQueries({ queryKey: ['wedding'] }); qc.invalidateQueries({ queryKey: ['weddings'] }); qc.invalidateQueries({ queryKey: ['calendar'] })
                  }}><Pencil size={18} /></button>
                <button title="Copia il link con cui la coppia accede/rientra" className="text-xs text-[rgb(var(--gold-600))] hover:underline shrink-0"
                  onClick={async () => {
                    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { ok?: boolean; token?: string; error?: string } }> }).rpc('couple_access_link', { p_entry: wedding.id })
                    if (!data?.token) { toast.error(data?.error === 'no_couple' ? 'Nessuna coppia collegata a questo evento.' : 'Link non disponibile'); return }
                    const url = `${window.location.origin}/invito-coppia/${data.token}`
                    try { await navigator.clipboard.writeText(url); toast.success('Link accesso coppia copiato') } catch { toast.success(url) }
                  }}>{eventTerm(eventKind).hasCoupleConcept ? 'Link coppia' : 'Link cliente'}</button>
              </div>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                {wedding.client_name} ·{' '}
                {new Date(wedding.date_from).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {eventPassed && (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                  ✓ Evento concluso — il lavoro si chiude: valuta chi ha collaborato con te.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={wedding.status} />
              {nuovoModello && <SaluteEventoBadge entryId={wedding.id} />}
              {ambito && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border"
                  style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--gold-700))', background: 'rgb(var(--gold-100))' }}
                  title="Ambito incarico capostipite"
                >
                  {ambito === 'COMPLETO' && 'Ambito: completo'}
                  {ambito === 'SOLO_COORDINAMENTO' && 'Ambito: solo coordinamento'}
                  {ambito === 'SOLO_PROPRI_SERVIZI' && 'Ambito: solo propri servizi'}
                </span>
              )}
              {/* "Tutto WP" è una scelta commerciale da capostipite/WP (contratto unico
                  + sub-appalto fornitori). Un fornitore non la gestisce. */}
              {!isFornitore && <BusinessModelToggle wedding={wedding} />}
              {wedding.value_amount && (
                <span className="font-display text-2xl tabular-nums" style={{ color: 'rgb(var(--gold-700))' }}>
                  € {Number(wedding.value_amount).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                </span>
              )}
              {eventPassed && (
                <Button variant="gold" size="sm" onClick={() => setRateOpen(true)}>
                  <Star size={14} /> Valuta collaborazione
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs — scrollable on mobile with edge-fade indicators */}
        <div className="border-t relative z-20" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
          <div ref={tabsRef} onWheel={(e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) tabsRef.current?.scrollBy({ left: e.deltaY }) }}
            className="max-w-7xl mx-auto px-6 sm:px-10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex gap-1 py-2 min-w-max">
              {visibleTabs.map((t) => {
                const Icon = t.icon
                const active = tab === t.key
                // SOLO_PROPRI_SERVIZI: enfatizza "Menu" + tab dedicato ai servizi
                // propri (qui usiamo "contract" come tab "Documenti del proprio
                // catalogo" via highlight visivo; il routing reale lo gestisce
                // /services tramite la link_action del ProssimaMossa).
                const emphasized =
                  effectiveAmbito === 'SOLO_PROPRI_SERVIZI' && t.key === 'menu'
                const locked = photoOnly && !PRO_PHOTO_ONLY_KEYS.has(t.key)
                return (
                  <button
                    key={t.key}
                    disabled={locked}
                    title={locked ? 'Evento concluso — disponibili solo Foto e Video' : undefined}
                    onClick={(e) => {
                      setTab(t.key)
                      if (dotTabs.has(t.key) && wedding?.id) {
                        setDotTabs((s) => { const n = new Set(s); n.delete(t.key); return n })
                        void markEntryTabRead(wedding.id, typesForTab(t.key))
                      }
                      ;(e.currentTarget as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[44px]',
                      locked
                        ? 'opacity-35 cursor-not-allowed pointer-events-none text-[rgb(var(--fg-subtle))]'
                        : active
                          ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]'
                          : emphasized
                            ? 'text-[rgb(var(--gold-700))] bg-[rgb(var(--gold-100))] hover:bg-[rgb(var(--bg-sunken))]'
                            : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] hover:text-[rgb(var(--fg))]',
                    )}
                    aria-label={emphasized ? `${t.label} (in evidenza)` : t.label}
                  >
                    <Icon size={14} />
                    {t.label}
                    {emphasized && !active && (
                      <span aria-hidden className="ml-1">★</span>
                    )}
                    {dotTabs.has(t.key) && !active && (
                      <span aria-hidden className="ml-0.5 h-2 w-2 rounded-full bg-[rgb(var(--rose-500))] animate-pulse" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          {/* Frecce: spostano la barra anche con un mouse normale (clic) — oltre a rotella e trascinamento */}
          <button type="button" aria-label="Scorri i tab a sinistra" onClick={() => scrollTabs(-1)}
            className="absolute inset-y-0 left-0 w-10 flex items-center justify-start pl-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"
            style={{ background: 'linear-gradient(90deg, rgb(var(--bg-elev)) 60%, transparent)' }}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Scorri i tab a destra" onClick={() => scrollTabs(1)}
            className="absolute inset-y-0 right-0 w-10 flex items-center justify-end pr-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"
            style={{ background: 'linear-gradient(-90deg, rgb(var(--bg-elev)) 60%, transparent)' }}><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
        {photoOnly && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
            <Images size={15} className="text-[rgb(var(--gold-600))] shrink-0" />
            <span className="text-[rgb(var(--fg-muted))]">Evento concluso e non gestito col dashboard: restano attive solo <strong className="text-[rgb(var(--fg))]">Foto e Video</strong>.</span>
          </div>
        )}
        {/* Cerchio SEMPRE visibile (anche su evento solo-ricordi): le collaborazioni restano gestibili — es. aggiungere il fotografo a un evento passato per condividere le foto */}
        <div className="mb-6"><EventRing entryId={wedding.id} view={ringView} /></div>
        {!photoOnly && tab === 'overview' && <div className="mb-6"><CompletionRings entryId={wedding.id} onOpen={(t) => setTab((t === 'rsvp' ? 'guests' : t === 'cerchio' ? 'overview' : t) as TabKey)} /></div>}
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            {tab === 'overview' && <OverviewTab wedding={wedding} onTab={setTab as any} />}
            {tab === 'album_funnel' && <AlbumFunnelTab entryId={wedding.id} onTab={(k) => setTab(k as TabKey)} />}
            {tab === 'foto' && <EventGalleryTab entryId={wedding.id} role={ringView} />}
            {tab === 'audio' && <AudioWishes entryId={wedding.id} readOnly />}
            {tab === 'guestbook' && <Guestbook entryId={wedding.id} readOnly />}
            {tab === 'video' && (
              <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-8 text-center">
                <Film size={26} className="mx-auto mb-3 text-[rgb(var(--gold-600))]" />
                <h3 className="font-display text-xl mb-1">Consegna video</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">Consegna la bozza e il video finale; il cliente lascia i <strong>post-it</strong> sui momenti da rivedere e tu li risolvi.</p>
                <Link to={`/video/${wedding.id}`}><Button variant="gold"><Film size={15} /> Apri la revisione video</Button></Link>
              </div>
            )}
            {tab === 'planning' && <CouplePlanningTab entryId={wedding.id} readOnly />}
            {tab === 'ceremony' && <CeremonyTab entryId={wedding.id} />}
            {tab === 'timeline' && <TimelineTab entryId={wedding.id} eventKind={(wedding as any).event_kind} />}
            {tab === 'tables' && <TablesTab entryId={wedding.id} />}
            {tab === 'guests' && <GuestsTab entryId={wedding.id} eventKind={wedding.event_kind} />}
            {tab === 'regali' && <GiftsTab entryId={wedding.id} />}
            {tab === 'angoli' && <CornersTab entryId={wedding.id} />}
            {tab === 'menu' && <MenuTab entryId={wedding.id} readOnly={ringView === 'sposi'} />}
            {tab === 'budget' && <BudgetTab entryId={wedding.id} />}
            {tab === 'payments' && <PagamentiTab entryId={wedding.id} />}
            {tab === 'riconciliazione' && nuovoModello && <RiconciliazioneCard entryId={wedding.id} />}
            {tab === 'chat' && nuovoModello && <ChatEvento entryId={wedding.id} />}
            {tab === 'checklist' && <ChecklistTab entryId={wedding.id} eventKind={(wedding as any).event_kind} />}
            {tab === 'mood' && <MoodTab entryId={wedding.id} />}
            {tab === 'playlist' && <PlaylistTab entryId={wedding.id} />}
            {tab === 'contracts_net' && <AllContractsMonitor entryId={wedding.id} />}
            {tab === 'contract' && <ContractTab wedding={wedding} />}
            {tab === 'docs' && <DocumentsTab entryId={wedding.id} />}
            {tab === 'analytics' && <AnalyticsTab quoteId={wedding.quote_id} />}
            {tab === 'accommodations' && <AccommodationsTab entryId={wedding.id} />}
            {tab === 'transport' && <TransportTab entryId={wedding.id} />}
            {tab === 'gadgets' && <GadgetsTab entryId={wedding.id} />}
            {tab === 'subevents' && <SubEventsTab entryId={wedding.id} />}
            {tab === 'website' && <WebsiteTab wedding={wedding} />}
            {tab === 'members' && <MembersTab entryId={wedding.id} />}
          </motion.div>
        </AnimatePresence>
      </div>
      {rateOpen && <RateCollaborationModal entryId={wedding.id} onClose={() => setRateOpen(false)} />}
      {shouldAskAmbito && (
        <AmbitoIncaricoModal
          entryId={wedding.id}
          onSaved={() => {
            // Forza il refetch dell'evento e delle notifiche prossima-mossa.
            void qc.invalidateQueries({ queryKey: ['wedding', wedding.id] })
            void qc.invalidateQueries({ queryKey: ['notifiche'] })
          }}
          onSkip={() => setAmbitoSkipped(true)}
        />
      )}
    </div>
  )
}

function BusinessModelToggle({ wedding }: { wedding: any }) {
  const update = useUpdateWedding(wedding.id)
  const [open, setOpen] = useState(false)
  const current = (wedding.business_model ?? 'GLOBAL') as 'GLOBAL' | 'BROKER'

  async function set(value: 'GLOBAL' | 'BROKER') {
    if (value === current) { setOpen(false); return }
    try {
      await update.mutateAsync({ business_model: value } as any)
      toast.success(value === 'GLOBAL' ? 'Modello: WP gestisce tutto' : 'Modello: sposi firmano coi fornitori')
      setOpen(false)
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border hover:bg-[rgb(var(--bg-sunken))] transition-colors"
        style={{ borderColor: 'rgb(var(--border-strong))' }}
        title="Cambia modello di business">
        {current === 'GLOBAL' ? '🏛 Tutto WP' : '🤝 Clienti diretti'}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-[rgb(var(--bg-elev))] w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border p-5" style={{ borderColor: 'rgb(var(--border-strong))' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-display text-lg">Modello di business</h3>
              <button onClick={() => setOpen(false)} aria-label="Chiudi"
                className="shrink-0 -mr-1 -mt-1 h-8 w-8 inline-flex items-center justify-center rounded-full text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]">✕</button>
            </div>
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-4">Come gestirai questo evento dal punto di vista commerciale.</p>
            <div className="space-y-2">
              <button onClick={() => set('GLOBAL')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${current === 'GLOBAL' ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--bg-sunken))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                <p className="font-medium">🏛 Tutto a carico WP</p>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">Tu firmi un contratto unico con gli sposi. Sub-contrattualizzi tu i fornitori. Gli sposi pagano solo a te.</p>
              </button>
              <button onClick={() => set('BROKER')}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${current === 'BROKER' ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--bg-sunken))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                <p className="font-medium">🤝 Clienti firmano coi fornitori</p>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">Tu organizzi e coordini. Gli sposi firmano contratti diretti con ogni fornitore e pagano direttamente loro. Tu emetti eventuale fee organizzativa separata.</p>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
