import { useMemo, useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, FileDown, FileSignature, Send, Plus, Trash2, ExternalLink, Users, Table, Clock, Package, Wallet, Calendar, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AvailabilityBanner } from '@/components/quote/AvailabilityBanner'
import { AnswersPanel } from '@/components/AnswersPanel'
import { LikedStylesGallery } from '@/components/LikedStylesGallery'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useServices } from '@/hooks/useCatalog'
import { useSuppliers } from '@/hooks/useSuppliers'
import {
  useAddQuoteItem, useGeneratePdf, useQuote, useRemoveQuoteItem, useSendQuote, useUpdateQuote, useUpdateQuoteItem,
} from '@/hooks/useQuotes'
import type { Database } from '@/lib/database.types'
import { shareWhatsAppLink } from '@/lib/share'
import { waQuoteToClient } from '@/lib/waMessages'
import { ClientBriefEditor } from '@/components/quotes/ClientBriefEditor'
import { SuggestColleaguesCard } from '@/components/quotes/SuggestColleaguesCard'
import { QuoteActivityCard } from '@/components/quotes/QuoteActivityCard'
import { HelpDot } from '@/components/help/HelpDot'
import { eventTerm } from '@/lib/eventKind'

type Unit = Database['public']['Enums']['service_unit']
type Basis = Database['public']['Enums']['quantity_basis']

// Heuristic: dato unit del servizio, suggerisce basis di default
function defaultBasisFor(unit: Unit): Basis {
  switch (unit) {
    case 'PERSONA': return 'PER_GUEST'
    case 'ORA': return 'PER_HOUR'
    case 'PEZZO': return 'FLAT' // utente puo` switchare a PER_TABLE manualmente
    case 'EVENTO': return 'FLAT'
    default: return 'FLAT'
  }
}

function quantityFor(basis: Basis, guests: number | null | undefined, tables: number | null | undefined): number {
  switch (basis) {
    case 'PER_GUEST': return Math.max(guests ?? 1, 1)
    case 'PER_TABLE': return Math.max(tables ?? 1, 1)
    case 'PER_HOUR': return 1
    case 'FLAT': return 1
  }
}

const BASIS_LABEL: Record<Basis, { label: string; icon: typeof Users }> = {
  FLAT:      { label: 'Quantità fissa', icon: Package },
  PER_GUEST: { label: '× invitati',     icon: Users },
  PER_TABLE: { label: '× tavoli',       icon: Table },
  PER_HOUR:  { label: '× ore',          icon: Clock },
}

const QUOTE_EVENT_KINDS: { v: string; l: string }[] = [
  { v: 'matrimonio',  l: 'Matrimonio' },
  { v: 'battesimo',   l: 'Battesimo' },
  { v: 'comunione',   l: 'Comunione' },
  { v: 'cresima',     l: 'Cresima' },
  { v: 'compleanno',  l: 'Compleanno' },
  { v: 'anniversario', l: 'Anniversario' },
  { v: 'laurea',      l: 'Laurea' },
  { v: 'corporate',   l: 'Evento aziendale' },
  { v: 'altro',       l: 'Altro' },
]

type PayStatus = 'NON_PAGATO' | 'ACCONTO' | 'SALDATO' | 'STORNATO'
const PAY_STATUSES: { key: PayStatus; label: string; tone: string; dot: string }[] = [
  { key: 'NON_PAGATO', label: 'Non pagato', tone: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200', dot: 'bg-rose-500' },
  { key: 'ACCONTO',    label: 'Acconto',    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', dot: 'bg-amber-500' },
  { key: 'SALDATO',    label: 'Saldato',    tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200', dot: 'bg-emerald-500' },
  { key: 'STORNATO',   label: 'Stornato',   tone: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200', dot: 'bg-neutral-500' },
]

export default function QuoteEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { data: quote, isLoading } = useQuote(id ?? null)
  // Risposte del cliente (questionario di categoria/evento), da mostrare a chi crea il preventivo
  const { data: clientAnswers } = useQuery({
    queryKey: ['quote-answers', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase.from('quote_questionnaire_answers').select('answers').eq('quote_id', id!).maybeSingle()
      return ((data as { answers?: Record<string, unknown> } | null)?.answers ?? null)
    },
  })
  const qc = useQueryClient()
  const [closingQuote, setClosingQuote] = useState(false)
  // Flusso fornitore (sia direct quote sia owner ruolo FORNITORE): nasconde
  // campi WP-only (tavoli, invitati, markup, suggerimenti basis, dropdown
  // selezione fornitore).
  const isFornitoreFlow = !!quote?.direct_client_id || profile?.role === 'FORNITORE'
  const [contractInfo, setContractInfo] = useState<{ id: string; status: string } | null>(null)
  const [creatingContract, setCreatingContract] = useState(false)
  const update = useUpdateQuote()
  const addItem = useAddQuoteItem()
  const remItem = useRemoveQuoteItem()
  const updItem = useUpdateQuoteItem()
  const genPdf = useGeneratePdf()
  const sendQ = useSendQuote()
  const { data: services } = useServices({ onlyActive: true })
  const { data: suppliers } = useSuppliers()

  const [defaultMarkup, setDefaultMarkup] = useState<string>('')
  const [guestCount, setGuestCount] = useState<string>('')
  const [tableCount, setTableCount] = useState<string>('')
  const [title, setTitle] = useState<string>('')
  const [clientName, setClientName] = useState<string>('')
  const [clientEmail, setClientEmail] = useState<string>('')
  const [eventDate, setEventDate] = useState<string>('')
  const [eventKind, setEventKind] = useState<string>('matrimonio')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<{ access_token?: string } | null>(null)
  const [pickSupplier, setPickSupplier] = useState<string>('')
  const [forceUnlocked, setForceUnlocked] = useState(false)
  const [forceModal, setForceModal] = useState<{ open: boolean; reason: string }>({ open: false, reason: '' })
  // REVISIONE D: ambito dell'incarico del calendar_entry collegato al
  // preventivo. Quando 'SOLO_PROPRI_SERVIZI' restringiamo l'erogatore al
  // capostipite stesso (no raccolta da fornitori terzi).
  const [eventAmbito, setEventAmbito] = useState<'COMPLETO' | 'SOLO_COORDINAMENTO' | 'SOLO_PROPRI_SERVIZI' | null>(null)
  // Gating contratto per ambito: per COMPLETO si attende l'approvazione del
  // budget totale (tutti i fornitori terzi confermati). Per gli ambiti
  // ristretti basta che il preventivo sia ACCETTATO.
  const [budgetReadiness, setBudgetReadiness] = useState<{
    ready_for_contract: boolean; reason: string; ambito: string
    supplier_items: number; confirmed_supplier_items: number
  } | null>(null)

  // Preventivo VIVO: dopo l'accettazione il preventivo resta editabile (il WP
  // aggiunge voci che il cliente vede e decide live). Si blocca SOLO quando il
  // WP lo chiude (closed_at). "Modifica forzata" resta per i preventivi chiusi.
  const isClosed = !!(quote as { closed_at?: string | null } | null)?.closed_at
  const isLive = (quote?.status === 'ACCETTATO' || quote?.status === 'CONVERTITO_IN_CONTRATTO') && !isClosed
  const isLocked = isClosed && !forceUnlocked
  // SOLO_PROPRI_SERVIZI vale solo se l'utente puo' effettivamente erogare
  // (WP/LOCATION). Per il flusso fornitore (direct quote o role=FORNITORE)
  // resta il comportamento standard.
  const isSoloProprioServizi = eventAmbito === 'SOLO_PROPRI_SERVIZI'
    && !isFornitoreFlow
    && (profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION')

  // Fetch eventuale contratto già collegato a questo preventivo
  useEffect(() => {
    if (!id) return
    void (async () => {
      const { data } = await (supabase.from('contracts' as any) as any)
        .select('id, status')
        .eq('quote_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setContractInfo(data as { id: string; status: string })
    })()
  }, [id, quote?.status])

  // REVISIONE D: fetch ambito_capostipite del calendar_entry collegato.
  // calendar_entries.quote_id -> quotes.id (1:1 logico). Best-effort: se
  // l'entry non esiste, restiamo su COMPLETO (comportamento standard).
  useEffect(() => {
    if (!id) { setEventAmbito(null); return }
    void (async () => {
      const { data } = await (supabase
        .from('calendar_entries')
        .select('ambito_capostipite' as any) as any)
        .eq('quote_id', id)
        .limit(1)
        .maybeSingle()
      const v = data?.ambito_capostipite ?? null
      setEventAmbito(
        v === 'SOLO_PROPRI_SERVIZI' || v === 'SOLO_COORDINAMENTO' || v === 'COMPLETO'
          ? v
          : null,
      )
    })()
  }, [id])

  // Readiness contratto: per ambito COMPLETO il contratto attende l'approvazione
  // del budget totale (tutti i fornitori terzi confermati). Ricalcolato quando
  // cambia lo stato del preventivo o le voci.
  useEffect(() => {
    // Il "budget" e` un concetto esclusivo dei capostipiti: per il flusso
    // fornitore non si calcola ne` si mostra alcun gating di budget.
    if (isFornitoreFlow || !id || (quote?.status !== 'ACCETTATO' && quote?.status !== 'CONVERTITO_IN_CONTRATTO')) {
      setBudgetReadiness(null)
      return
    }
    void (async () => {
      const { data } = await (supabase.rpc as any)('quote_budget_readiness', { p_quote_id: id })
      if (data && !data.error) setBudgetReadiness(data)
    })()
  }, [id, quote?.status, quote?.quote_items?.length, isFornitoreFlow])

  async function handleCloseQuote(close: boolean) {
    if (!id) return
    if (close && !confirm('Chiudere il preventivo? Il cliente non potrà più accettare/rifiutare voci. Potrai riaprirlo quando vuoi.')) return
    setClosingQuote(true)
    try {
      const { data, error } = await (supabase.rpc as any)(close ? 'quote_close' : 'quote_reopen', { p_quote_id: id })
      if (error) throw error
      if (!data) { toast.error('Operazione non riuscita (permessi).'); return }
      await qc.invalidateQueries({ queryKey: ['quote', id] })

      // Alla chiusura: se le voci accettate divergono dal contratto firmato,
      // genera un addendum e invialo al cliente da firmare.
      if (close) {
        try {
          const { data: add } = await (supabase.rpc as any)('addendum_create_if_changed', { p_quote_id: id })
          if (add?.created && add?.addendum_id) {
            await supabase.functions.invoke('addendum-send', { body: { addendum_id: add.addendum_id } })
            toast.success('Preventivo chiuso · addendum generato e inviato al cliente per la firma')
            return
          }
        } catch { /* la chiusura è comunque andata a buon fine */ }
      }
      toast.success(close ? 'Preventivo chiuso' : 'Preventivo riaperto')
    } catch (e) {
      toast.error((e as Error).message)
    } finally { setClosingQuote(false) }
  }

  async function handleCreateContract() {
    if (!quote || !id) return
    // Gating per ambito: COMPLETO richiede approvazione del budget totale.
    if (budgetReadiness && !budgetReadiness.ready_for_contract) {
      toast.error(budgetReadiness.reason)
      return
    }
    setCreatingContract(true)
    try {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')
      // Genera articolato legale completo (15 articoli + premesse) via RPC
      const { data: sections, error: rpcErr } = await supabase.rpc('build_contract_sections', { p_quote_id: id })
      if (rpcErr) throw rpcErr
      const { data, error } = await (supabase.from('contracts' as any) as any)
        .insert({
          owner_id: me.user.id,
          quote_id: id,
          title: `Contratto ${eventTerm(eventKind || 'matrimonio').label} · ${quote.client_name ?? quote.title ?? ''}`.trim(),
          client_name: quote.client_name,
          client_email: quote.client_email,
          event_date: quote.event_date,
          total_amount: quote.total_client,
          status: 'BOZZA',
          access_token: crypto.randomUUID(),
          sections: sections ?? [],
          // Preventivo fornitore→cliente diretto: il contratto deve ereditare
          // direct_client_id e party_kind, sennò la rubrica non conta i firmati
          // e il trigger enforce_contract_party_kind rifiuta l'insert.
          ...((quote as any).direct_client_id
            ? { direct_client_id: (quote as any).direct_client_id, party_kind: 'SUPPLIER_CLIENT' }
            : {}),
        })
        .select('id, status')
        .single()
      if (error) throw error
      await (supabase.from('quotes' as any) as any).update({ status: 'CONVERTITO_IN_CONTRATTO' }).eq('id', id)
      toast.success('Contratto generato con articolato legale completo')
      setContractInfo(data as { id: string; status: string })
      navigate('/contracts')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore generazione contratto')
    } finally {
      setCreatingContract(false)
    }
  }

  useEffect(() => {
    if (quote) {
      setDefaultMarkup(quote.default_markup_percent?.toString() ?? '')
      setGuestCount(quote.guest_count?.toString() ?? '')
      setTableCount((quote as any).table_count?.toString() ?? '')
      setTitle(quote.title ?? '')
      setClientName(quote.client_name ?? '')
      setClientEmail(quote.client_email ?? '')
      setEventDate(quote.event_date ?? '')
      setEventKind(((quote as any).event_kind ?? 'matrimonio').toLowerCase())
      setPdfUrl(quote.pdf_url ?? null)
    }
  }, [quote])

  const grouped = useMemo(() => {
    const out = new Map<string, NonNullable<typeof services>>()
    for (const s of services ?? []) {
      const arr = out.get(s.fornitore_id) ?? []
      arr.push(s)
      out.set(s.fornitore_id, arr)
    }
    return out
  }, [services])

  // REVISIONE D: in SOLO_PROPRI_SERVIZI forza pickSupplier al capostipite
  // stesso (il dropdown e' nascosto), cosi' la card "Aggiungi voce dal
  // catalogo" elenca subito i SUOI servizi senza chiedere di scegliere.
  useEffect(() => {
    if (pickSupplier) return
    // SOLO_PROPRI_SERVIZI: forza i propri servizi.
    if (isSoloProprioServizi && profile?.id) { setPickSupplier(profile.id); return }
    // COMPLETO (WP/Location): se il capostipite ha servizi propri in catalogo,
    // mostrali SUBITO (niente dropdown da scoprire — fix mobile: i servizi
    // propri comparivano solo dopo aver selezionato l'erogatore).
    if (!isFornitoreFlow && profile?.id && grouped.has(profile.id)) {
      setPickSupplier(profile.id)
    }
  }, [isSoloProprioServizi, isFornitoreFlow, profile?.id, pickSupplier, grouped])

  if (isLoading) return <div className="p-10 text-[rgb(var(--fg-subtle))]">Caricamento...</div>
  if (!quote) return <div className="p-10 text-[rgb(var(--rose-500))]">Preventivo non trovato</div>

  async function handleAddItem(supplierId: string, serviceId: string) {
    if (!id) return
    const svc = services?.find((s) => s.id === serviceId)
    if (!svc || !quote) return

    // REVISIONE B: se l'erogatore e' il capostipite stesso (WP/LOCATION fornitore
    // di se' stesso), saltiamo il check di disponibilita' (e' l'evento del capostipite)
    // e impostiamo il flag no-ricarico.
    const isSelfCapostipite = supplierId === profile?.id

    if (!isSelfCapostipite && quote.event_date) {
      // Hard-block: il fornitore NON deve essere occupato nella data del preventivo.
      // (Il trigger DB blocca comunque l'INSERT — questo è il check UX preventivo.)
      try {
        const { data: conflicts } = await (supabase.rpc as any)('check_suppliers_busy_in_range', {
          p_supplier_ids: [supplierId],
          p_date_from: quote.event_date,
          p_date_to: quote.event_date,
          p_exclude_quote_id: quote.id,
        })
        const busyConflict = (conflicts as Array<{ status: string; conflict_date: string; supplier_business_name?: string; supplier_full_name?: string }> | null)
          ?.find((c) => c.status === 'BUSY')
        if (busyConflict) {
          const name = busyConflict.supplier_business_name ?? busyConflict.supplier_full_name ?? 'Il fornitore'
          const formatted = new Date(busyConflict.conflict_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
          toast.error(`${name} è OCCUPATO il ${formatted}. Cambia data o scegli un altro fornitore.`, { duration: 8000 })
          return
        }
        const tentative = (conflicts as Array<{ status: string }> | null)?.find((c) => c.status === 'TENTATIVE')
        if (tentative) {
          if (!confirm(`⚠️ Il fornitore ha segnato questa data come "in forse". Vuoi aggiungerlo comunque al preventivo?`)) return
        }
      } catch { /* check soft, prosegui */ }
    }

    const basis = defaultBasisFor(svc.unit)
    const qty = quantityFor(basis, quote.guest_count, (quote as any).table_count)
    try {
      await addItem.mutateAsync({
        quote_id: id, service_id: svc.id, supplier_id: supplierId,
        name_snapshot: svc.name, description_snapshot: svc.description ?? null,
        unit_snapshot: svc.unit, snapshot_price: svc.base_price, quantity: qty,
        quantity_basis: basis,
        // REVISIONE B: capostipite come erogatore di se' stesso → no ricarico
        ...(isSelfCapostipite ? { erogatore_e_capostipite: true } : {}),
      } as any)
      toast.success(isSelfCapostipite
        ? `Mio servizio aggiunto · ${qty} ${svc.unit.toLowerCase()} (no ricarico)`
        : `Voce aggiunta · ${qty} ${svc.unit.toLowerCase()}`)
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('non disponibile')) {
        toast.error(msg, { duration: 6000 })
      } else {
        toast.error(msg)
      }
    }
  }

  async function handleHeaderUpdate() {
    if (!id) return
    try {
      await update.mutateAsync({ id, patch: {
        title: title.trim() || quote?.title,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        event_date: eventDate || null,
        event_kind: eventKind || 'matrimonio',
        default_markup_percent: Number(defaultMarkup || 0),
        guest_count: guestCount ? Number(guestCount) : null,
        table_count: tableCount ? Number(tableCount) : null,
      } as any })
      toast.success('Preventivo aggiornato')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleForceEdit() {
    if (!id || !quote) return
    const reason = forceModal.reason.trim()
    if (!reason) { toast.error('Specifica il motivo della modifica per il cliente'); return }
    try {
      // 1. Bump revision + applica modifiche header
      await update.mutateAsync({ id, patch: {
        title: title.trim() || quote.title,
        client_name: clientName.trim() || null,
        client_email: clientEmail.trim() || null,
        event_date: eventDate || null,
        default_markup_percent: Number(defaultMarkup || 0),
        guest_count: guestCount ? Number(guestCount) : null,
        table_count: tableCount ? Number(tableCount) : null,
        revision: (quote.revision ?? 1) + 1,
      } as any })
      // 2. Notify cliente via Resend (edge function quote-send già esiste con FROM verificato)
      if (quote.client_email) {
        await supabase.functions.invoke('quote-send', {
          body: { quote_id: id, override_reason: reason, force_resend: true },
        }).catch(() => { /* email fallback OK, le modifiche sono salvate */ })
      }
      // 3. Notifica in-app per i membri della coppia (workflow guidato).
      // NB: supabase.rpc() è un thenable SENZA .catch → usare try/catch, non .catch().
      try {
        await (supabase.rpc as any)('notify_couple_quote_forced_edit', { p_quote_id: id, p_reason: reason })
      } catch { /* non bloccante */ }
      toast.success(`Modifiche applicate · rev. ${(quote.revision ?? 1) + 1} · cliente avvisato`)
      setForceModal({ open: false, reason: '' })
      setForceUnlocked(true)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleChangeItemBasis(itemId: string, newBasis: Basis) {
    if (!id || !quote) return
    const qty = quantityFor(newBasis, quote.guest_count, (quote as any).table_count)
    try {
      await updItem.mutateAsync({ id: itemId, quoteId: id, patch: { quantity_basis: newBasis, quantity: qty } })
    } catch (e) { toast.error((e as Error).message) }
  }
  async function handleChangePayStatus(itemId: string, status: PayStatus, lineClient: number, currentPaid: number) {
    try {
      const patch: any = { payment_status: status }
      if (status === 'SALDATO') {
        patch.paid_amount = lineClient
        patch.paid_at = new Date().toISOString()
      } else if (status === 'NON_PAGATO' || status === 'STORNATO') {
        patch.paid_amount = 0
        patch.paid_at = null
      } else if (status === 'ACCONTO') {
        // Chiedi l'importo dell'acconto (default: 30% della voce, oppure l'importo già registrato).
        const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const suggested = currentPaid > 0 ? currentPaid : Math.round(lineClient * 30) / 100
        const ans = window.prompt(
          `Importo dell'acconto (€)\n\nVoce: € ${fmt(lineClient)}\nSuggerito (30%): € ${fmt(Math.round(lineClient * 30) / 100)}`,
          fmt(suggested).replace(/\./g, '').replace(',', '.'),
        )
        if (ans === null) return // utente ha annullato
        const cleaned = ans.replace(/[€\s]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
        const amount = parseFloat(cleaned)
        if (isNaN(amount) || amount <= 0) {
          toast.error('Importo non valido')
          return
        }
        if (amount > lineClient) {
          toast.error(`L'acconto (€ ${fmt(amount)}) non può superare l'importo della voce (€ ${fmt(lineClient)})`)
          return
        }
        patch.paid_amount = amount
        patch.paid_at = new Date().toISOString()
      }
      await updItem.mutateAsync({ id: itemId, quoteId: id!, patch })
      toast.success(status === 'ACCONTO'
        ? `Acconto registrato (€ ${Number(patch.paid_amount).toLocaleString('it-IT')})`
        : `Pagamento → ${status}`)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleChangeItemQty(itemId: string, qty: number) {
    if (!id) return
    try {
      await updItem.mutateAsync({ id: itemId, quoteId: id, patch: { quantity: qty } })
    } catch (e) { toast.error((e as Error).message) }
  }
  // Sconto sulla singola voce (% sul prezzo cliente; negativo = maggiorazione).
  // Clamp [-1000, 100]: oltre 100 azzererebbe sotto costo (vincolo anche lato DB).
  async function handleChangeItemDiscount(itemId: string, pct: number) {
    if (!id) return
    const safe = Math.max(-1000, Math.min(100, Number.isFinite(pct) ? pct : 0))
    try {
      await updItem.mutateAsync({ id: itemId, quoteId: id, patch: { item_discount_percent: safe } as any })
    } catch (e) { toast.error((e as Error).message) }
  }
  // Sconto sul TOTALE del preventivo (% e/o € fisso).
  async function handleTotalDiscount(patch: { total_discount_percent?: number; total_discount_amount?: number }) {
    if (!id) return
    const safe: any = { ...patch }
    if (safe.total_discount_percent != null) safe.total_discount_percent = Math.max(-1000, Math.min(100, Number.isFinite(safe.total_discount_percent) ? safe.total_discount_percent : 0))
    if (safe.total_discount_amount != null) safe.total_discount_amount = Math.max(0, Number.isFinite(safe.total_discount_amount) ? safe.total_discount_amount : 0)
    try {
      await update.mutateAsync({ id, patch: safe })
    } catch (e) { toast.error((e as Error).message) }
  }

  // Scarica davvero il file: fetch→blob forza il download (anche cross-origin storage);
  // fallback su ?download (Supabase) o apertura in nuova scheda se il fetch è bloccato.
  async function downloadFile(url: string, filename: string) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error('fetch')
      const blob = await res.blob()
      const obj = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = obj; a.download = filename
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 5000)
    } catch {
      const sep = url.includes('?') ? '&' : '?'
      window.open(`${url}${sep}download=${encodeURIComponent(filename)}`, '_blank', 'noopener')
    }
  }

  async function handlePdf(variant: 'NEUTRA' | 'PREMIUM') {
    if (!id) return
    try {
      const r = await genPdf.mutateAsync({ quoteId: id, variant })
      setPdfUrl(r.url)
      const fn = `Preventivo-${(title || clientName || 'evento').replace(/[^\w\-]+/g, '_')}.pdf`
      if (r.url) await downloadFile(r.url, fn)
      toast.success(`PDF ${variant.toLowerCase()} generato e scaricato`)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleSend() {
    if (!id) return
    try {
      const r = await sendQ.mutateAsync(id)
      setSendResult(r)
      setPdfUrl(r.pdf_url ?? pdfUrl)
      toast.success('Preventivo inviato')
    } catch (e) { toast.error((e as Error).message) }
  }

  // Invio su WhatsApp: assicura il link cliente (se serve genera/invia), poi apre
  // WhatsApp con messaggio + link. Consigliato perché la mail può finire in spam.
  async function handleSendWhatsApp() {
    if (!id || !quote) return
    try {
      let token = (quote as any).access_token ?? sendResult?.access_token
      if (!token) {
        const r = await sendQ.mutateAsync(id)
        setSendResult(r); setPdfUrl(r.pdf_url ?? pdfUrl); token = r.access_token
      }
      if (!token) { toast.error('Non riesco a generare il link cliente'); return }
      // Niente cifre/firma fuori dalla piattaforma: il link porta all'accesso
      // cliente, poi atterra sul preventivo nella sua area.
      const url = `${window.location.origin}/area-cliente/accedi?next=${encodeURIComponent('/p/preview/' + token)}`
      shareWhatsAppLink(waQuoteToClient({ clientName: quote.client_name, title: quote.title }), url)
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <Link to="/quotes" className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline mb-3">
          <ArrowLeft size={14} /> Preventivi
        </Link>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
              Editor preventivo · v{quote.revision}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl mt-1">{quote.title}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))]">
              <Badge status={quote.status} />
              {quote.client_name && <span>· {quote.client_name}</span>}
              {quote.event_date && <span>· {new Date(quote.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="inline-flex items-center gap-1">
              <Button variant="outline" onClick={() => handlePdf('NEUTRA')} disabled={genPdf.isPending} data-testid="pdf-neutra">
                <FileDown /> PDF
              </Button>
              <HelpDot id="quote.pdf" />
            </span>
            <span className="inline-flex items-center gap-1">
              <Button variant="outline" onClick={handleSend} disabled={sendQ.isPending} data-testid="send-quote-btn">
                <Send /> {sendQ.isPending ? 'Invio...' : 'Invia via email'}
              </Button>
              <HelpDot id="quote.invia" />
            </span>
            <Button variant="gold" onClick={handleSendWhatsApp} disabled={sendQ.isPending}
              style={{ background: '#25D366', borderColor: '#25D366' }} title="Consigliato: l'email può finire in spam">
              <MessageCircle /> Invia su WhatsApp
            </Button>
          </div>
        </div>

        {/* Risposte del cliente (dal form di categoria/questionario): guidano il preventivo */}
        {clientAnswers && Object.keys(clientAnswers).length > 0 && (
          <div className="mb-4 space-y-3">
            <AnswersPanel answers={clientAnswers} title="Cosa desidera il cliente" note="Risposte dal questionario: usale per personalizzare le voci del preventivo." />
            <LikedStylesGallery cards={(clientAnswers as Record<string, unknown>).liked_style_cards} tags={(clientAnswers as Record<string, unknown>).liked_tags} />
          </div>
        )}

        {/* Banner: preventivo firmato → lock modifiche + convert-to-contract */}
        {(quote.status === 'ACCETTATO' || quote.status === 'CONVERTITO_IN_CONTRATTO') && (
          <Card className="p-4 mb-4 border-l-4" style={{ borderLeftColor: 'rgb(var(--gold-500))', background: 'rgb(var(--bg-sunken))' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  {isClosed
                    ? `🔒 Preventivo chiuso · rev. v${quote.revision}`
                    : `✨ Preventivo vivo — ${quote.status === 'CONVERTITO_IN_CONTRATTO' ? 'convertito in contratto' : 'accettato dal cliente'} · rev. v${quote.revision}`}
                </p>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
                  {isClosed
                    ? (forceUnlocked
                        ? 'Preventivo chiuso, modifica forzata attiva. Salva con "Applica".'
                        : 'Preventivo chiuso: campi in sola lettura. Riaprilo per modificarlo, oppure usa la modifica forzata.')
                    : 'Aggiungi pure altre voci, anche di altri fornitori: il cliente le vede live nella sua area e accetta o rifiuta la singola voce. Quando avete definito tutto, premi "Chiudi preventivo".'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!contractInfo && quote.status === 'ACCETTATO' && (
                  <div className="flex flex-col items-end gap-1">
                    <Button variant="gold" size="sm" onClick={handleCreateContract}
                      disabled={creatingContract || (budgetReadiness ? !budgetReadiness.ready_for_contract : false)}
                      data-testid="generate-contract-btn">
                      <FileSignature size={14} /> {creatingContract ? 'Genero…' : 'Genera contratto'}
                    </Button>
                    {budgetReadiness && !budgetReadiness.ready_for_contract && (
                      <p className="text-[11px] text-[rgb(var(--amber-600))] max-w-[240px] text-right leading-tight">
                        🔒 {budgetReadiness.reason}
                      </p>
                    )}
                    {budgetReadiness?.ready_for_contract && budgetReadiness.ambito !== 'COMPLETO' && (
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))] max-w-[240px] text-right leading-tight">
                        Ambito ristretto: firma possibile subito.
                      </p>
                    )}
                  </div>
                )}
                {contractInfo && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/contracts')}>
                    <FileSignature size={14} /> Apri contratto
                  </Button>
                )}
                {!isClosed && (
                  <Button variant="outline" size="sm" disabled={closingQuote} onClick={() => void handleCloseQuote(true)} data-testid="close-quote-btn">
                    {closingQuote ? '…' : 'Chiudi preventivo'}
                  </Button>
                )}
                {isClosed && (
                  <Button variant="gold" size="sm" disabled={closingQuote} onClick={() => void handleCloseQuote(false)} data-testid="reopen-quote-btn">
                    {closingQuote ? '…' : 'Riapri preventivo'}
                  </Button>
                )}
                {isClosed && !forceUnlocked && !contractInfo && (
                  <Button variant="outline" size="sm" onClick={() => setForceModal({ open: true, reason: '' })}>
                    Modifica forzata
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Header settings: title / client / date / guests / tables / markup */}
        <Card className="p-5 mb-6">
          <h2 className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-3">Dati preventivo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1 lg:col-span-2">
              <Label>Titolo</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={isLocked}
                placeholder="Es. Matrimonio Andrea & Giulia, Battesimo Sofia..." />
            </div>
            <div className="space-y-1">
              <Label><Calendar size={12} className="inline" /> Data evento</Label>
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-1">
              <Label>Tipo di evento</Label>
              <Select value={eventKind} onChange={(e) => setEventKind(e.target.value)} disabled={isLocked}>
                {QUOTE_EVENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
              </Select>
              <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Determina le domande del questionario al cliente.</p>
            </div>
            <div className="space-y-1">
              <Label>Nome cliente</Label>
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={isLocked}
                placeholder="Andrea & Giulia Romano" />
            </div>
            <div className="space-y-1">
              <Label>Email cliente</Label>
              <Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={isLocked}
                placeholder="sposi@example.it" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end mt-4 pt-4 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            {!isFornitoreFlow && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="gc"><Users size={12} className="inline" /> Invitati</Label>
                  <Input id="gc" type="number" min="0" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} disabled={isLocked} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tc"><Table size={12} className="inline" /> Tavoli</Label>
                  <Input id="tc" type="number" min="0" value={tableCount} onChange={(e) => setTableCount(e.target.value)} disabled={isLocked} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mk">Markup default %</Label>
                  <Input id="mk" type="number" step="0.1" value={defaultMarkup} onChange={(e) => setDefaultMarkup(e.target.value)} disabled={isLocked} />
                </div>
              </>
            )}
            <Button onClick={handleHeaderUpdate} variant="gold" disabled={isLocked}>
              {forceUnlocked ? 'Applica e notifica cliente' : 'Applica'}
            </Button>
          </div>
          {!isFornitoreFlow && (
            <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
              Cambiare <strong>invitati</strong>/<strong>tavoli</strong> riallinea automaticamente le voci con basis × invitati / × tavoli.
            </p>
          )}
        </Card>

        {/* METRICHE: quando e quante volte il cliente ha visto il preventivo (timeline di ogni vista) */}
        {id && <QuoteActivityCard quoteId={id} />}

        {/* Suggerisci colleghi al cliente — SOLO fornitori (non capostipiti/WP),
            e solo dopo la firma del preventivo */}
        {id && isFornitoreFlow && (quote?.status === 'ACCETTATO' || quote?.status === 'CONVERTITO_IN_CONTRATTO') && (
          <SuggestColleaguesCard quoteId={id} />
        )}

        {/* Modal modifica forzata */}
        {forceModal.open && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={() => setForceModal({ open: false, reason: '' })}>
            <div className="bg-[rgb(var(--bg-elev))] w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border max-h-[90vh] overflow-y-auto"
              style={{ borderColor: 'rgb(var(--border))' }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
                <h3 className="font-display text-lg">Modifica forzata preventivo firmato</h3>
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                  Il preventivo è stato accettato dal cliente. Le modifiche dovranno essere ricomunicate.
                </p>
              </div>
              <div className="p-5 space-y-3">
                <div className="rounded-lg p-3 text-xs border" style={{ borderColor: 'rgb(var(--gold-500))', background: 'rgb(var(--bg-sunken))' }}>
                  ⚠️ <strong>Cosa succede</strong>:
                  <ul className="mt-1.5 ml-4 list-disc space-y-0.5">
                    <li>la revisione viene incrementata (v{(quote.revision ?? 1) + 1})</li>
                    <li>il cliente riceve email con il motivo + nuovo PDF</li>
                    <li>per evento contestato, l'audit trail resta nel DB</li>
                  </ul>
                </div>
                <div className="space-y-1">
                  <Label>Motivo della modifica (verrà mostrato al cliente)</Label>
                  <Textarea rows={4} value={forceModal.reason}
                    onChange={(e) => setForceModal((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="Es. Cambio data evento per indisponibilità location: dal 18/09/2027 al 25/09/2027. Tutti i fornitori confermano disponibilità sulla nuova data." />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setForceModal({ open: false, reason: '' })}>Annulla</Button>
                  <Button variant="gold" onClick={handleForceEdit} disabled={update.isPending || !forceModal.reason.trim()}>
                    {update.isPending ? 'Invio...' : 'Sblocca e notifica cliente'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Banner disponibilità fornitori (mostra conflitti BUSY/TENTATIVE).
            excludeQuoteId: il quote stesso ha generato i BUSY se ACCETTATO -> escludo. */}
        <AvailabilityBanner
          date={eventDate || quote.event_date || null}
          supplierIds={Array.from(new Set((quote.quote_items ?? []).map((it: any) => it.supplier_id).filter(Boolean)))}
          excludeQuoteId={quote.id}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voci */}
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="font-display text-lg">Voci ({quote.quote_items.length})</h2>
            </div>
            <div className="px-6 py-3" data-testid="quote-items">
              {quote.quote_items.length === 0 && (
                <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">
                  Nessuna voce. Aggiungine dal catalogo qui sotto.
                </p>
              )}
              <motion.ul layout className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {quote.quote_items.map((it) => {
                  const basis = (it as any).quantity_basis as Basis ?? 'FLAT'
                  const Icon = BASIS_LABEL[basis].icon
                  const isMio = !!(it as any).erogatore_e_capostipite
                  return (
                    <motion.li key={it.id} layout className="py-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium">{it.name_snapshot}</p>
                            {isMio && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                                style={{
                                  background: 'rgb(var(--gold-100))',
                                  color: 'rgb(var(--gold-700))',
                                  border: '1px solid rgb(var(--gold-500))',
                                }}
                                title="Erogatore = io · nessun ricarico applicato"
                              >
                                ⭐ Mio servizio
                              </span>
                            )}
                            {(isLive || isClosed) && (() => {
                              const dec = (it as any).client_decision as string | undefined
                              const map: Record<string, { l: string; c: string }> = {
                                ACCETTATO: { l: '✓ Accettata dal cliente', c: '#16a34a' },
                                RIFIUTATO: { l: '✕ Rifiutata dal cliente', c: '#dc2626' },
                                IN_ATTESA: { l: '⏳ In attesa cliente', c: '#d97706' },
                              }
                              const m = map[dec ?? 'IN_ATTESA'] ?? { l: '⏳ In attesa cliente', c: '#d97706' }
                              return (
                                <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                  style={{ color: m.c, background: `${m.c}1a` }}>{m.l}</span>
                              )
                            })()}
                          </div>
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">
                            € {Number(it.snapshot_price).toFixed(2)} {it.unit_snapshot.toLowerCase()}
                            {isFornitoreFlow || isMio ? (
                              <> · <strong>€ {Number(it.line_client).toLocaleString('it-IT')}</strong>
                                {isMio && <span className="ml-1">· no ricarico</span>}
                              </>
                            ) : (
                              <> · costo € {Number(it.line_cost).toLocaleString('it-IT')} · cliente <strong>€ {Number(it.line_client).toLocaleString('it-IT')}</strong></>
                            )}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon"
                          onClick={() => remItem.mutate({ id: it.id, quoteId: quote.id })}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 mt-2 ml-0 flex-wrap">
                        <Icon size={14} className="text-[rgb(var(--fg-subtle))]" />
                        <Select value={basis} onChange={(e) => handleChangeItemBasis(it.id, e.target.value as Basis)}
                          className="h-8 w-44 text-xs">
                          {Object.entries(BASIS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </Select>
                        <Input type="number" step="0.5" min={0} value={Number(it.quantity)}
                          onChange={(e) => handleChangeItemQty(it.id, Number(e.target.value))}
                          title={basis === 'PER_GUEST' || basis === 'PER_TABLE' ? 'Quantità modificabile: scrivi un numero diverso dal totale (es. solo 10 invitati)' : undefined}
                          className="h-8 w-24 text-xs" />
                        <span className="text-xs text-[rgb(var(--fg-subtle))]">{it.unit_snapshot.toLowerCase()}</span>
                        <span className="text-xs text-[rgb(var(--fg-subtle))] ml-2">sconto</span>
                        <Input type="number" step="1" value={Number((it as any).item_discount_percent ?? 0)}
                          onChange={(e) => handleChangeItemDiscount(it.id, Number(e.target.value))}
                          title="Sconto % su questa voce (negativo = maggiorazione)"
                          className="h-8 w-16 text-xs" />
                        <span className="text-xs text-[rgb(var(--fg-subtle))]">%</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Wallet size={12} className="text-[rgb(var(--fg-subtle))]" />
                        <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Pagamento</span>
                        {PAY_STATUSES.map((p) => {
                          const active = ((it as any).payment_status ?? 'NON_PAGATO') === p.key
                          return (
                            <button key={p.key} type="button"
                              onClick={() => handleChangePayStatus(it.id, p.key, Number(it.line_client), Number((it as any).paid_amount ?? 0))}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${active ? p.tone : 'bg-transparent text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]'}`}
                              style={{ borderColor: active ? 'transparent' : 'rgb(var(--border))' }}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${p.dot}`} />
                              {p.label}
                            </button>
                          )
                        })}
                        {(it as any).paid_amount > 0 && (
                          <span className="text-[10px] text-[rgb(var(--fg-subtle))]">
                            (€ {Number((it as any).paid_amount).toLocaleString('it-IT')})
                          </span>
                        )}
                      </div>
                    </motion.li>
                  )
                })}
              </motion.ul>
            </div>
            <div className="px-6 py-4 border-t bg-[rgb(var(--bg-sunken))] space-y-3" style={{ borderColor: 'rgb(var(--border))' }}>
              {/* Sconto sul totale: % e/o € fisso. Negativo = maggiorazione. */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Sconto sul totale</span>
                <Input type="number" step="1" defaultValue={Number((quote as any).total_discount_percent ?? 0)}
                  onBlur={(e) => handleTotalDiscount({ total_discount_percent: Number(e.target.value) })}
                  title="Sconto % sul totale (negativo = maggiorazione)"
                  className="h-8 w-20 text-xs" />
                <span className="text-xs text-[rgb(var(--fg-subtle))]">%</span>
                <Input type="number" step="10" defaultValue={Number((quote as any).total_discount_amount ?? 0)}
                  onBlur={(e) => handleTotalDiscount({ total_discount_amount: Number(e.target.value) })}
                  title="Sconto fisso in € sul totale"
                  className="h-8 w-24 text-xs" />
                <span className="text-xs text-[rgb(var(--fg-subtle))]">€ fissi</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <Totals label="Costo" value={quote.total_cost} />
                {(quote as any).subtotal_client != null && Number((quote as any).subtotal_client) !== Number(quote.total_client) && (
                  <Totals label="Subtotale" value={(quote as any).subtotal_client} />
                )}
                <Totals label="Cliente" value={quote.total_client} accent />
                <Totals label="Margine" value={quote.margin_amount} />
                <Totals label="Margine %" value={`${Number(quote.margin_percent).toFixed(2)}%`} raw />
              </div>
            </div>
          </Card>

          {/* Sidebar actions */}
          <Card className="p-6 space-y-4 self-start">
            <div className="space-y-1">
              <h3 className="font-display text-lg">Output</h3>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">Genera PDF o invia link cliente</p>
            </div>
            {pdfUrl && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }} data-testid="pdf-link">
                <p className="text-xs text-[rgb(var(--fg-subtle))] mb-1">Ultimo PDF</p>
                <a href={pdfUrl} target="_blank" rel="noreferrer"
                  className="text-sm font-medium inline-flex items-center gap-1 hover:underline">
                  Apri <ExternalLink size={12} />
                </a>
              </div>
            )}
            {sendResult?.access_token && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }} data-testid="public-link">
                <p className="text-xs text-[rgb(var(--fg-subtle))] mb-1">Link cliente</p>
                <a href={`/p/preview/${sendResult.access_token}`} target="_blank" rel="noreferrer"
                  className="text-sm font-medium break-all hover:underline">
                  /p/preview/{sendResult.access_token.slice(0, 12)}…
                </a>
              </div>
            )}
            {!isFornitoreFlow && (
              <div className="text-xs text-[rgb(var(--fg-subtle))] pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <p className="mb-2 font-medium">Suggerimenti basis</p>
                <ul className="space-y-1">
                  <li><Users size={11} className="inline mr-1" /> Menu/aperitivo/welcome → <strong>per invitato</strong></li>
                  <li><Table size={11} className="inline mr-1" /> Centrotavola → <strong>per tavolo</strong></li>
                  <li><Clock size={11} className="inline mr-1" /> Open bar/musicisti → <strong>per ora</strong></li>
                  <li><Package size={11} className="inline mr-1" /> Sala/foto/video → <strong>quantità fissa</strong></li>
                </ul>
              </div>
            )}
          </Card>

          {/* Aggiungi voce */}
          <Card className="lg:col-span-3 p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg">Aggiungi voce dal catalogo</h3>
            </div>
            <div className="space-y-3">
              {!isFornitoreFlow && !isSoloProprioServizi && (
                <div className="flex gap-3 items-end max-w-md">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor="sup">Erogatore</Label>
                    <Select id="sup" value={pickSupplier}
                      onChange={(e) => setPickSupplier(e.target.value)}>
                      <option value="">— seleziona —</option>
                      {/* REVISIONE B: WP/LOCATION puo' essere fornitore di se' stesso (no ricarico) */}
                      {profile?.id && (profile.role === 'WEDDING_PLANNER' || profile.role === 'LOCATION') && grouped.has(profile.id) && (
                        <option value={profile.id}>
                          ⭐ I miei servizi (sono io l'erogatore · no ricarico) ({grouped.get(profile.id)?.length ?? 0})
                        </option>
                      )}
                      {Array.from(grouped.entries())
                        .filter(([sid]) => sid !== profile?.id)
                        .map(([sid]) => {
                          const sup = suppliers?.find((s) => s.id === sid)
                          const isSelf = sid === quote.owner_id
                          const label = isSelf
                            ? "⭐ I miei servizi (sono io l'erogatore · no ricarico)"
                            : (sup?.business_name ?? sup?.full_name ?? 'Fornitore senza nome')
                          return (
                            <option key={sid} value={sid}>
                              {label}{!isSelf && sup?.subrole ? ` · ${sup.subrole}` : ''} ({grouped.get(sid)?.length ?? 0})
                            </option>
                          )
                        })}
                    </Select>
                  </div>
                </div>
              )}
              {/* REVISIONE D: SOLO_PROPRI_SERVIZI → niente dropdown fornitori,
                  solo i miei servizi in catalogo (con badge contestuale). */}
              {!isFornitoreFlow && isSoloProprioServizi && (
                <div className="rounded-lg border p-3 text-sm max-w-md"
                  style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
                  <p className="font-medium">⭐ Solo i miei servizi</p>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1">
                    L'incarico e' "{eventAmbito?.replaceAll('_', ' ').toLowerCase()}": componi il preventivo
                    usando solo il tuo catalogo. Nessun ricarico applicato.
                  </p>
                </div>
              )}
              {(pickSupplier || isFornitoreFlow) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(grouped.get(isFornitoreFlow ? (profile?.id ?? quote.owner_id) : pickSupplier) ?? []).map((s) => (
                    <div key={s.id} className="rounded-lg border p-3 flex gap-3 hover:bg-[rgb(var(--bg-sunken))] transition-colors"
                      style={{ borderColor: 'rgb(var(--border))' }}>
                      {s.service_photos[0] && (
                        <img src={s.service_photos[0].thumbnail_url} alt=""
                          className="h-14 w-14 rounded-md object-cover shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{s.name}</p>
                        <p className="text-xs text-[rgb(var(--fg-subtle))]">
                          € {s.base_price} /{s.unit.toLowerCase()} · auto-basis {BASIS_LABEL[defaultBasisFor(s.unit)].label}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleAddItem(s.fornitore_id, s.id)}>
                        <Plus size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Brief di competenza fornitore→cliente: SOTTO il preventivo, così in
            cima il fornitore ha subito le voci e il catalogo. */}
        {isFornitoreFlow && id && (
          <div className="mt-6">
            <ClientBriefEditor quoteId={id} subrole={profile?.subrole} />
          </div>
        )}
      </div>
    </div>
  )
}

function Totals({ label, value, accent, raw }: { label: string; value: number | string; accent?: boolean; raw?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`font-display tabular-nums ${accent ? 'text-2xl' : 'text-xl'}`} style={accent ? { color: 'rgb(var(--gold-700))' } : undefined}>
        {raw ? value : `€ ${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`}
      </p>
    </div>
  )
}
