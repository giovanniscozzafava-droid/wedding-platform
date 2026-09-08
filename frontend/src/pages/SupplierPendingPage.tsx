import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, X, HelpCircle, CircleDashed } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { toast } from '@/lib/toast'

// ============================================================================
// "Lavori da confermare": il fornitore NON conferma le singole voci (album,
// servizio fotografico…) una per una. Dichiara la propria PRESENZA sull'INTERO
// preventivo assegnato da un capostipite → Si` / No / Forse. La conferma "Si`"
// sblocca il budget totale del capostipite. Non sono contratti.
// ============================================================================

type Item = {
  id: string; name_snapshot: string; description_snapshot: string | null
  quantity: number; line_cost: number; quote_id: string
  supplier_presence: 'SI' | 'NO' | 'FORSE' | null
  entry_title?: string | null; event_date?: string | null; client_name?: string | null
  entry_id?: string | null; capostipite_name?: string | null
}
type Group = {
  quote_id: string
  entry_title?: string; event_date?: string | null; client_name?: string | null
  entry_id?: string | null; capostipite_name?: string | null
  items: Item[]
  presence: 'SI' | 'NO' | 'FORSE' | null
  total: number
}

export default function SupplierPendingPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const confirmId = searchParams.get('confirm')

  async function load() {
    setLoading(true)
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) { setGroups([]); return }
      // Il filtro (preventivi vivi, non del fornitore stesso, INVIATO, non
      // archiviato) e la scelta delle colonne restituite (mai line_client/
      // markup/snapshot_price, quello è il margine del capostipite) vivono
      // ora server-side nella RPC: una policy RLS diretta su quote_items non
      // può restringere le colonne riga per riga, solo le righe.
      const { data, error } = await (supabase.rpc as any)('supplier_pending_items')
      if (error) { setGroups([]); return }
      const items = (data ?? []) as Item[]

      // Raggruppa per preventivo.
      const byQuote = new Map<string, Group>()
      for (const it of items) {
        let g = byQuote.get(it.quote_id)
        if (!g) {
          g = {
            quote_id: it.quote_id, items: [], presence: it.supplier_presence, total: 0,
            entry_title: it.entry_title ?? undefined, event_date: it.event_date ?? null, client_name: it.client_name ?? null,
            entry_id: it.entry_id ?? null, capostipite_name: it.capostipite_name ?? null,
          }
          byQuote.set(it.quote_id, g)
        }
        g.items.push(it)
        g.total += Number(it.line_cost) // line_cost = incasso fornitore, GIÀ totale di riga (qtà inclusa)
        if (it.supplier_presence === 'FORSE') g.presence = 'FORSE'
      }
      setGroups(Array.from(byQuote.values()))
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function setPresence(quoteId: string, status: 'SI' | 'NO' | 'FORSE') {
    setBusy(quoteId)
    try {
      const { error } = await (supabase as any).rpc('supplier_set_quote_presence', { p_quote_id: quoteId, p_status: status })
      if (error) { toast.error(error.message); return }
      toast.success(status === 'SI' ? 'Confermata la tua presenza' : status === 'NO' ? 'Hai declinato' : 'Segnato come "forse"')
      if (confirmId) { searchParams.delete('confirm'); setSearchParams(searchParams, { replace: true }) }
      // Rispondere NON porta via da questa pagina: il lavoro resta qui, sotto la
      // sezione della risposta che hai dato, e ci si entra dal link "Apri il
      // lavoro". Prima un "ci sono" faceva saltare subito sull'evento e sembrava
      // che il lavoro fosse sparito dalla lista.
      await load()
    } finally { setBusy(null) }
  }

  // La pagina è divisa per stato della risposta, con i conti in chiaro: una
  // risposta data non fa sparire il lavoro, lo sposta di sezione. Solo i
  // declinati restano ripiegati (sono una porta chiusa), ma il titolo dice
  // quanti sono e si riaprono con un clic: la risposta si può sempre cambiare.
  const daRispondere = groups.filter((g) => g.presence == null || g.presence === 'FORSE')
  const confermati = groups.filter((g) => g.presence === 'SI')
  const declinati = groups.filter((g) => g.presence === 'NO')

  // funzione, non componente: definirlo dentro il render lo farebbe rimontare
  // a ogni giro, con le schede che sfarfallano a ogni risposta.
  function sezione(titolo: string, nota: string, gruppi: Group[]) {
    if (gruppi.length === 0) return null
    return (
      <section className="mt-6 first:mt-0">
        <h2 className="text-xs uppercase tracking-wide text-[rgb(var(--fg-subtle))]">
          {titolo} ({gruppi.length})
        </h2>
        <p className="mt-1 text-xs text-[rgb(var(--fg-muted))]">{nota}</p>
        <div className="mt-2 space-y-3">{gruppi.map(scheda)}</div>
      </section>
    )
  }

  function scheda(g: Group) {
    return (
              <Card key={g.quote_id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="self-start min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full" style={{ background: 'rgb(var(--bg-sunken))' }}>
                    <CircleDashed size={20} style={{ color: 'rgb(var(--gold-700))' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <h3 className="font-medium">{g.entry_title ?? 'Preventivo'}</h3>
                      {g.event_date && <span className="text-[11px] text-[rgb(var(--fg-subtle))]">{new Date(g.event_date).toLocaleDateString('it-IT')}</span>}
                      {g.client_name && <span className="text-[11px] text-[rgb(var(--fg-subtle))]">· {g.client_name}</span>}
                      {g.presence === 'SI' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--sage-100))' }}>Ci sei</span>}
                      {g.presence === 'FORSE' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>In valutazione</span>}
                      {g.presence === 'NO' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--danger,220_38_38))' }}>Hai declinato</span>}
                    </div>
                    {/* Le voci sono solo di riepilogo: NON si confermano una per una. */}
                    <ul className="mt-2 space-y-1">
                      {g.items.map((it) => (
                        <li key={it.id} className="text-xs text-[rgb(var(--fg-muted))] flex items-center justify-between gap-2">
                          <span className="truncate">• {it.name_snapshot}{Number(it.quantity) > 1 ? ` ×${Number(it.quantity)}` : ''}</span>
                          <span className="shrink-0 text-[rgb(var(--fg-subtle))]">€ {Number(it.line_cost).toLocaleString('it-IT', { maximumFractionDigits: 2 })}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">
                      {g.items.length} voci · tuo compenso € {g.total.toLocaleString('it-IT', { maximumFractionDigits: 2 })}
                      {g.capostipite_name && <> · te lo chiede {g.capostipite_name}</>}
                    </div>
                    {/* Detto "ci sono", il lavoro è tuo: da qui ci entri. Restava
                        una risposta senza seguito, senza un posto dove andare. */}
                    {g.presence === 'SI' && g.entry_id && (
                      <button type="button" onClick={() => nav(`/weddings/${g.entry_id}`)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium underline underline-offset-2"
                        style={{ color: 'rgb(var(--gold-700))' }}>
                        Apri il lavoro <ArrowRight size={13} />
                      </button>
                    )}
                    {/* I tre bottoni dicono qual è la risposta data: quello scelto
                        è pieno e sottolineato, gli altri restano neutri. Prima
                        "Ci sono" era pieno sempre, anche su un lavoro declinato:
                        guardando la scheda non si capiva cosa avessi risposto. */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {([
                        { stato: 'SI', testo: 'Ci sono', icona: <Check size={14} />, variante: 'gold' },
                        { stato: 'FORSE', testo: 'Forse', icona: <HelpCircle size={14} />, variante: 'subtle' },
                        { stato: 'NO', testo: 'Non ci sono', icona: <X size={14} />, variante: 'destructive' },
                      ] as const).map((b) => {
                        const scelto = g.presence === b.stato
                        return (
                          <Button
                            key={b.stato}
                            variant={scelto ? b.variante : 'outline'}
                            aria-pressed={scelto}
                            disabled={busy === g.quote_id}
                            onClick={() => setPresence(g.quote_id, b.stato)}
                            className={`min-h-[40px] ${scelto ? 'underline underline-offset-4 font-semibold' : 'opacity-70'}`}
                            title={scelto ? 'È la risposta che hai dato' : `Cambia la risposta in «${b.testo}»`}
                          >
                            {b.icona} {b.testo}
                          </Button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </Card>
    )
  }

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8">
        <PageHeader eyebrow="Pipeline" title="Lavori da confermare"
          description="Un capostipite (wedding planner / location) ti ha inserito in un preventivo. Dichiara se ci sei: confermare la presenza serve a chiudere il budget totale del capostipite. Non sono contratti — e puoi cambiare la tua risposta quando vuoi." />
        {loading ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : groups.length === 0 ? (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Nessun preventivo da confermare.</Card>
        ) : (
          <>
            {sezione('Da rispondere', 'Il capostipite sta aspettando: finché non rispondi non può chiudere il budget.', daRispondere)}
            {sezione('Ci sei', 'Da ognuno entri nel lavoro, e la risposta si può sempre cambiare.', confermati)}
            {sezione('Hai declinato', 'Restano in elenco: se cambi idea la risposta si cambia da qui.', declinati)}
          </>
        )}
      </div>
    </div>
  )
}
