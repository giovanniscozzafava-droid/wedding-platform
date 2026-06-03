import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CalendarClock, Table2, Users as UsersIcon, Wallet, ListChecks,
  Palette, Music, FileSignature, FolderOpen, BarChart3, FileText,
  BedDouble, Bus, Gift, PartyPopper, Globe, Heart, Utensils, Church, ClipboardList,
  Scale, MessageCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useWedding, useUpdateWedding } from '@/hooks/useWedding'
import { OverviewTab } from '@/components/wedding/OverviewTab'
import { TimelineTab } from '@/components/wedding/TimelineTab'
import { TablesTab } from '@/components/wedding/TablesTab'
import { GuestsTab } from '@/components/wedding/GuestsTab'
import { BudgetTab } from '@/components/wedding/BudgetTab'
import { ChecklistTab } from '@/components/wedding/ChecklistTab'
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
import { useQueryClient } from '@tanstack/react-query'

type TabKey = 'overview' | 'planning' | 'ceremony' | 'timeline' | 'tables' | 'guests' | 'menu' | 'budget' | 'payments' | 'checklist' | 'mood' | 'playlist' | 'contract' | 'contracts_net' | 'docs' | 'analytics' | 'accommodations' | 'transport' | 'gadgets' | 'subevents' | 'website' | 'members' | 'riconciliazione' | 'chat'

type TabDef = { key: TabKey; label: string; icon: typeof CalendarClock; nuovoModelloOnly?: boolean; capostipiteOnly?: boolean }

const TABS: Array<TabDef> = [
  { key: 'overview',       label: 'Overview',     icon: FileText },
  { key: 'planning',       label: 'Questionario', icon: ClipboardList },
  { key: 'ceremony',       label: 'Cerimonia',    icon: Church },
  { key: 'timeline',       label: 'Scaletta',     icon: CalendarClock },
  { key: 'guests',         label: 'Invitati',     icon: UsersIcon },
  { key: 'tables',         label: 'Tavoli',       icon: Table2 },
  { key: 'menu',           label: 'Menu',         icon: Utensils },
  { key: 'accommodations', label: 'Alloggi',      icon: BedDouble },
  { key: 'transport',      label: 'Trasporti',    icon: Bus },
  { key: 'subevents',      label: 'Eventi',       icon: PartyPopper },
  { key: 'gadgets',        label: 'Bomboniere',   icon: Gift },
  { key: 'mood',           label: 'Mood',         icon: Palette },
  { key: 'playlist',       label: 'Playlist',     icon: Music },
  { key: 'budget',         label: 'Budget',       icon: Wallet },
  { key: 'payments',       label: 'Pagamenti',    icon: Wallet },
  { key: 'riconciliazione', label: 'Riconciliazione', icon: Scale, nuovoModelloOnly: true },
  { key: 'chat',           label: 'Chat',         icon: MessageCircle, nuovoModelloOnly: true },
  { key: 'checklist',      label: 'Checklist',    icon: ListChecks },
  { key: 'contract',       label: 'Contratto',    icon: FileSignature, capostipiteOnly: true },
  { key: 'contracts_net',  label: 'Contratti rete', icon: FileSignature, capostipiteOnly: true },
  { key: 'website',        label: 'Sito evento', icon: Globe, capostipiteOnly: true },
  { key: 'members',        label: 'Clienti',      icon: Heart, capostipiteOnly: true },
  { key: 'docs',           label: 'Documenti',    icon: FolderOpen },
  { key: 'analytics', label: 'Analytics',  icon: BarChart3, capostipiteOnly: true },
]

export default function WeddingDashboard() {
  const { id } = useParams<{ id: string }>()
  const { data: wedding, isLoading } = useWedding(id ?? null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [rateOpen, setRateOpen] = useState(false)
  const [ambitoSkipped, setAmbitoSkipped] = useState(false)
  const nuovoModello = useNuovoModello()
  const { user, profile } = useAuth()
  const isFornitore = profile?.role === 'FORNITORE'
  const qc = useQueryClient()

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

  const visibleTabs = useMemo(
    () =>
      TABS.filter((t) => {
        if (t.nuovoModelloOnly && !nuovoModello) return false
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
    [nuovoModello, effectiveAmbito, isFornitore],
  )

  if (isLoading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>
  if (!wedding) return <div className="p-10 text-[rgb(var(--rose-500))]">Wedding non trovato</div>

  const eventPassed = wedding.date_to ? new Date(wedding.date_to) < new Date() : false

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="aurora relative">
        <div className="absolute inset-0 dotted opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 relative z-10">
          <Link to="/weddings" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-3">
            <ArrowLeft size={14} /> Tutti gli eventi
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
                Evento {(wedding as any).guest_count ? `· ${(wedding as any).guest_count} invitati` : ''}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl tracking-tight mt-1">{wedding.title}</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                {wedding.client_name} ·{' '}
                {new Date(wedding.date_from).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
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
          <div className="max-w-7xl mx-auto px-6 sm:px-10 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
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
                return (
                  <button
                    key={t.key}
                    onClick={(e) => {
                      setTab(t.key)
                      ;(e.currentTarget as HTMLElement).scrollIntoView({ inline: 'center', behavior: 'smooth', block: 'nearest' })
                    }}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-h-[44px]',
                      active
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
                  </button>
                )
              })}
            </div>
          </div>
          {/* Edge-fade indicators: rivelano scroll laterale */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6" style={{ background: 'linear-gradient(90deg, rgb(var(--bg-elev)), transparent)' }} />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6" style={{ background: 'linear-gradient(-90deg, rgb(var(--bg-elev)), transparent)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            {tab === 'overview' && <OverviewTab wedding={wedding} onTab={setTab as any} />}
            {tab === 'planning' && <CouplePlanningTab entryId={wedding.id} readOnly />}
            {tab === 'ceremony' && <CeremonyTab entryId={wedding.id} />}
            {tab === 'timeline' && <TimelineTab entryId={wedding.id} />}
            {tab === 'tables' && <TablesTab entryId={wedding.id} />}
            {tab === 'guests' && <GuestsTab entryId={wedding.id} />}
            {tab === 'menu' && <MenuTab entryId={wedding.id} />}
            {tab === 'budget' && <BudgetTab entryId={wedding.id} />}
            {tab === 'payments' && <PagamentiTab entryId={wedding.id} />}
            {tab === 'riconciliazione' && nuovoModello && <RiconciliazioneCard entryId={wedding.id} />}
            {tab === 'chat' && nuovoModello && <ChatEvento entryId={wedding.id} />}
            {tab === 'checklist' && <ChecklistTab entryId={wedding.id} />}
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
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-[rgb(var(--bg-elev))] w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl border p-5" style={{ borderColor: 'rgb(var(--border))' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg mb-1">Modello di business</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-4">Come gestirai questo matrimonio dal punto di vista commerciale.</p>
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
        </div>
      )}
    </>
  )
}
