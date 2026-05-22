import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, CalendarClock, Table2, Users as UsersIcon, Wallet, ListChecks,
  Palette, Music, FileSignature, FolderOpen, BarChart3, FileText,
  BedDouble, Bus, Gift, PartyPopper, Globe, Heart,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useWedding } from '@/hooks/useWedding'
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
import { cn } from '@/lib/utils'

type TabKey = 'overview' | 'timeline' | 'tables' | 'guests' | 'budget' | 'checklist' | 'mood' | 'playlist' | 'contract' | 'docs' | 'analytics' | 'accommodations' | 'transport' | 'gadgets' | 'subevents' | 'website' | 'members'

const TABS: Array<{ key: TabKey; label: string; icon: typeof CalendarClock }> = [
  { key: 'overview',       label: 'Overview',     icon: FileText },
  { key: 'timeline',       label: 'Scaletta',     icon: CalendarClock },
  { key: 'guests',         label: 'Invitati',     icon: UsersIcon },
  { key: 'tables',         label: 'Tavoli',       icon: Table2 },
  { key: 'accommodations', label: 'Alloggi',      icon: BedDouble },
  { key: 'transport',      label: 'Trasporti',    icon: Bus },
  { key: 'subevents',      label: 'Eventi',       icon: PartyPopper },
  { key: 'gadgets',        label: 'Bomboniere',   icon: Gift },
  { key: 'mood',           label: 'Mood',         icon: Palette },
  { key: 'playlist',       label: 'Playlist',     icon: Music },
  { key: 'budget',         label: 'Budget',       icon: Wallet },
  { key: 'checklist',      label: 'Checklist',    icon: ListChecks },
  { key: 'contract',       label: 'Contratto',    icon: FileSignature },
  { key: 'website',        label: 'Wedding site', icon: Globe },
  { key: 'members',        label: 'Sposi',        icon: Heart },
  { key: 'docs',           label: 'Documenti',    icon: FolderOpen },
  { key: 'analytics', label: 'Analytics',  icon: BarChart3 },
]

export default function WeddingDashboard() {
  const { id } = useParams<{ id: string }>()
  const { data: wedding, isLoading } = useWedding(id ?? null)
  const [tab, setTab] = useState<TabKey>('overview')

  if (isLoading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>
  if (!wedding) return <div className="p-10 text-[rgb(var(--rose-500))]">Wedding non trovato</div>

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="aurora relative">
        <div className="absolute inset-0 dotted opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8 relative z-10">
          <Link to="/weddings" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-3">
            <ArrowLeft size={14} /> Tutti i matrimoni
          </Link>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
                Matrimonio · {(wedding as any).guest_count ? `${(wedding as any).guest_count} invitati` : ''}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl tracking-tight mt-1">{wedding.title}</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                {wedding.client_name} ·{' '}
                {new Date(wedding.date_from).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge status={wedding.status} />
              {wedding.value_amount && (
                <span className="font-display text-2xl tabular-nums" style={{ color: 'rgb(var(--gold-700))' }}>
                  € {Number(wedding.value_amount).toLocaleString('it-IT', { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t relative z-20" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
          <div className="max-w-7xl mx-auto px-6 sm:px-10 overflow-x-auto">
            <div className="flex gap-1 py-2 min-w-max">
              {TABS.map((t) => {
                const Icon = t.icon
                const active = tab === t.key
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={cn(
                      'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      active
                        ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]'
                        : 'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] hover:text-[rgb(var(--fg))]',
                    )}>
                    <Icon size={14} />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-8">
        <AnimatePresence mode="wait">
          <motion.div key={tab}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}>
            {tab === 'overview' && <OverviewTab wedding={wedding} onTab={setTab as any} />}
            {tab === 'timeline' && <TimelineTab entryId={wedding.id} />}
            {tab === 'tables' && <TablesTab entryId={wedding.id} />}
            {tab === 'guests' && <GuestsTab entryId={wedding.id} />}
            {tab === 'budget' && <BudgetTab entryId={wedding.id} />}
            {tab === 'checklist' && <ChecklistTab entryId={wedding.id} />}
            {tab === 'mood' && <MoodTab entryId={wedding.id} />}
            {tab === 'playlist' && <PlaylistTab entryId={wedding.id} />}
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
    </div>
  )
}
