import { useEffect, useMemo, useState } from 'react'
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, Target, Sparkles, Rocket,
  Compass, BarChart3, BookOpen, CheckCircle2, Circle, Flag, Users, Repeat, Megaphone, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

const rpc = (fn: string, a?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, a)
const fmtE = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const PLANS = [{ k: 'base', label: 'Base', price: 29 }, { k: 'plus', label: 'Plus', price: 59 }, { k: 'premium', label: 'Premium', price: 79 }]

type Overview = {
  cassetto: number; entrate_una_tantum: number; costi_una_tantum: number
  entrate_ricorrenti_mese: number; costi_ricorrenti_mese: number; netto_ricorrente_mese: number
  commissioni_totali: number; commissioni_incassate: number; commissioni_da_incassare: number
  users_by_role: Record<string, number>; subs_by_status: Record<string, number>; fornitori_totali: number
}
type Entry = { id: string; direction: string; category: string | null; label: string; amount: number; recurrence: string; entry_date: string; notes: string | null }
type Month = { mese: string; entrate: number; costi: number }
type Tab = 'panoramica' | 'stadio' | 'strategia' | 'conti' | 'report'

// ---- Stadi del percorso (da startup a scale-up) ----------------------------
const STAGES = [
  { key: 'startup',  label: 'Startup',        icon: Rocket,   blurb: 'Costruisci l’offerta e valida il valore. Obiettivo: massa di fornitori e i primi clienti.' },
  { key: 'first',    label: 'Primo abbonato', icon: Flag,     blurb: 'Hai il primo pagante: dimostra valore ripetibile e porta i paganti a 10.' },
  { key: 'rampup',   label: 'Ramp-up',        icon: TrendingUp, blurb: 'Acquisizione ripetibile e churn basso. Spingi MRR e converti la base.' },
  { key: 'scale',    label: 'Scale-up',       icon: Zap,      blurb: 'Macchina che gira: scala i canali, alza l’ARPA, punta a break-even e oltre.' },
] as const

export default function AdminFinancePage() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [costs, setCosts] = useState<Entry[]>([])
  const [incomes, setIncomes] = useState<Entry[]>([])
  const [months, setMonths] = useState<Month[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tab, setTab] = useState<Tab>('panoramica')

  async function load() {
    try {
      const [o, c, i, m] = await Promise.all([
        rpc('admin_finance_overview'), rpc('admin_finance_entries', { p_direction: 'OUT' }),
        rpc('admin_finance_entries', { p_direction: 'IN' }), rpc('admin_finance_monthly', { p_months: 12 }),
      ])
      const ovr = o.data as Overview & { error?: string }
      if (ovr?.error) { setErr('Accesso riservato allo staff.'); return }
      setOv(ovr); setCosts((c.data as Entry[]) ?? []); setIncomes((i.data as Entry[]) ?? [])
      setMonths(((m.data as { months?: Month[] })?.months) ?? [])
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }
  // Si aggiorna da solo: ricarica i dati reali ogni 60s (e a ogni ritorno sulla pagina).
  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 60000)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(id); window.removeEventListener('focus', onFocus) }
  }, [])

  const M = useMemo(() => ov ? deriveMetrics(ov, months) : null, [ov, months])

  if (loading) return <div className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</div>
  if (err) return <div className="max-w-3xl mx-auto px-6 py-10"><Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">{err}</Card></div>
  if (!ov || !M) return null

  const stageIdx = M.stageIdx
  const TABS: Array<{ k: Tab; label: string; icon: typeof Wallet }> = [
    { k: 'panoramica', label: 'Panoramica', icon: BarChart3 },
    { k: 'stadio', label: 'Stadio & Roadmap', icon: Compass },
    { k: 'strategia', label: 'Strategia', icon: Sparkles },
    { k: 'conti', label: 'Costi & Entrate', icon: Wallet },
    { k: 'report', label: 'Report', icon: TrendingUp },
  ]

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Admin · Business Plan" title="La cabina di regia di Planfully"
          description="Conti, metriche SaaS spiegate, stadio dell’azienda e la strategia da seguire — dalla startup alla scalata." />

        {/* Banner stadio corrente */}
        <Card className="p-5 mb-5" style={{ background: 'rgb(var(--bg-sunken))' }}>
          <div className="flex items-center gap-4 flex-wrap">
            {(() => { const S = STAGES[stageIdx]!; const Ic = S.icon; return (
              <div className="flex items-center gap-3">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><Ic size={24} /></span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Stadio attuale</p>
                  <p className="font-display text-xl">{S.label}</p>
                </div>
              </div>
            )})()}
            <p className="text-sm text-[rgb(var(--fg-muted))] flex-1 min-w-[240px]">{STAGES[stageIdx]!.blurb}</p>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Prossimo traguardo</p>
              <p className="font-medium text-sm">{M.nextMilestone.label}</p>
            </div>
          </div>
        </Card>

        {/* Sub-nav */}
        <div className="flex gap-1.5 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={tab === t.k ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' } : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {tab === 'panoramica' && <Panoramica ov={ov} M={M} />}
        {tab === 'stadio' && <Stadio M={M} ov={ov} />}
        {tab === 'strategia' && <Strategia M={M} ov={ov} />}
        {tab === 'conti' && (
          <div className="space-y-6">
            <Card className="p-5">
              <h2 className="font-display text-lg mb-3 flex items-center gap-2"><TrendingDown size={18} className="text-[rgb(var(--rose-500))]" /> Costi della piattaforma</h2>
              <EntryEditor direction="OUT" onSaved={load} /><EntryList entries={costs} onChanged={load} />
            </Card>
            <Card className="p-5">
              <h2 className="font-display text-lg mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-[rgb(var(--emerald-500))]" /> Entrate / cassetto</h2>
              <EntryEditor direction="IN" onSaved={load} /><EntryList entries={incomes} onChanged={load} />
            </Card>
          </div>
        )}
        {tab === 'report' && <Report months={months} M={M} />}
      </div>
    </div>
  )
}

// ============================ METRICHE ======================================
type Metrics = ReturnType<typeof deriveMetrics>
function deriveMetrics(ov: Overview, months: Month[]) {
  const paying = (ov.subs_by_status.PLUS ?? 0) + (ov.subs_by_status.PREMIUM ?? 0)
  // Periodo gratuito: tutti gratis fino al 31/12/2026. Gli abbonamenti (e quindi
  // l'MRR da abbonamento) partono da gennaio 2027 — prima sono solo account di test.
  const paidEra = new Date() >= new Date('2027-01-01')
  // MRR si aggiorna DA SOLO: abbonati reali × prezzo + entrate ricorrenti + commissioni.
  const mrrAbbon = paidEra ? (ov.subs_by_status.PLUS ?? 0) * 59 + (ov.subs_by_status.PREMIUM ?? 0) * 79 : 0
  const commMese = ov.commissioni_incassate / 12      // commissioni incassate spalmate sull'anno
  const mrr = mrrAbbon + ov.entrate_ricorrenti_mese + commMese
  const arr = mrr * 12
  const arpa = paying > 0 ? mrrAbbon / paying : 0
  const burn = Math.max(0, ov.costi_ricorrenti_mese - mrr)
  const runway = burn > 0 ? ov.cassetto / burn : Infinity
  const conv = ov.fornitori_totali > 0 ? (paying / ov.fornitori_totali) * 100 : 0
  // crescita MoM sulle entrate
  const last = months[months.length - 1]?.entrate ?? 0
  const prev = months[months.length - 2]?.entrate ?? 0
  const growth = prev > 0 ? ((last - prev) / prev) * 100 : (last > 0 ? 100 : 0)
  const breakEven = ov.costi_ricorrenti_mese        // MRR necessario per pareggiare i ricorrenti

  // Stadio
  let stageIdx = 0
  if (mrr >= 3000) stageIdx = 3
  else if (paying >= 10 || mrr >= 290) stageIdx = 2
  else if (paying >= 1) stageIdx = 1
  else stageIdx = 0

  const milestones = [
    { label: '10 fornitori attivi', done: ov.fornitori_totali >= 10, hint: 'Offerta minima per attrarre clienti' },
    { label: '50 fornitori attivi', done: ov.fornitori_totali >= 50, hint: 'Massa critica della rete' },
    { label: 'Primo abbonato pagante', done: paying >= 1, hint: 'Validi la monetizzazione' },
    { label: '10 abbonati', done: paying >= 10, hint: 'Ripetibilità del valore' },
    { label: 'MRR € 1.000', done: mrr >= 1000, hint: 'Traction iniziale' },
    { label: 'Break-even ricorrenti', done: ov.netto_ricorrente_mese >= 0 && breakEven > 0, hint: 'Entrate ricorrenti ≥ costi ricorrenti' },
    { label: 'MRR € 10.000', done: mrr >= 10000, hint: 'Scala vera' },
  ]
  const nextMilestone = (milestones.find((m) => !m.done) ?? milestones[milestones.length - 1])!

  return { paying, mrr, arr, arpa, burn, runway, conv, growth, breakEven, stageIdx, milestones, nextMilestone }
}

// ============================ PANORAMICA ====================================
function Panoramica({ ov, M }: { ov: Overview; M: Metrics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Repeat size={15} />} label="MRR" value={fmtE(M.mrr)} help="Ricavo ricorrente mensile: la somma degli abbonamenti attivi al mese. È la metrica regina del SaaS." tone="emerald" />
        <Kpi icon={<BarChart3 size={15} />} label="ARR" value={fmtE(M.arr)} help="Ricavo ricorrente annuo = MRR × 12. Misura la dimensione annua del business." />
        <Kpi icon={<Wallet size={15} />} label="Cassetto" value={fmtE(ov.cassetto)} help="Liquidità disponibile: entrate una tantum + commissioni incassate − costi una tantum." tone={ov.cassetto >= 0 ? 'emerald' : 'rose'} />
        <Kpi icon={<Target size={15} />} label="Runway" value={M.runway === Infinity ? '∞' : `${M.runway.toFixed(0)} mesi`} help="Da quanti mesi di vita hai col cassetto attuale al ritmo di spesa (burn). ∞ se non bruci cassa." tone={M.runway < 6 ? 'rose' : undefined} />
        <Kpi icon={<Users size={15} />} label="Fornitori" value={String(ov.fornitori_totali)} help="Lato offerta della rete. Più fornitori = più valore per i clienti." />
        <Kpi icon={<Flag size={15} />} label="Abbonati paganti" value={String(M.paying)} help="Fornitori che pagano un abbonamento. La monetizzazione vera." />
        <Kpi icon={<Percent2 />} label="Conversione" value={`${M.conv.toFixed(1)}%`} help="Quota di fornitori che diventano paganti. Sopra il 5-10% è buono in early stage." />
        <Kpi icon={<TrendingUp size={15} />} label="Crescita MoM" value={`${M.growth >= 0 ? '+' : ''}${M.growth.toFixed(0)}%`} help="Crescita delle entrate mese su mese. Il 'T2D3' (triplica, triplica, raddoppia…) è il riferimento dei top SaaS." tone={M.growth >= 0 ? 'emerald' : 'rose'} />
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Megaphone size={18} className="text-[rgb(var(--gold-600))]" /> Ricavi: due motori</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg p-4" style={{ background: 'rgb(var(--bg-sunken))' }}>
            <p className="font-medium text-sm mb-1">1 · Abbonamenti fornitori</p>
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-2"><strong>Tutti gratis fino a dicembre 2026.</strong> Abbonamenti da gennaio 2027 (valori provvisori: {PLANS.map((p) => `${p.price}€`).join(' / ')}). Capostipiti e clienti non pagano.</p>
            <Row k="MRR da abbonamenti" v={fmtE(M.mrr)} />
            <Row k="ARPA (ricavo medio per abbonato)" v={fmtE(M.arpa)} />
          </div>
          <div className="rounded-lg p-4" style={{ background: 'rgb(var(--bg-sunken))' }}>
            <p className="font-medium text-sm mb-1">2 · Commissioni (%) sulle segnalazioni</p>
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-2">Quota della piattaforma sui crediti tra colleghi andati a buon fine.</p>
            <Row k="Incassate" v={fmtE(ov.commissioni_incassate)} />
            <Row k="Da incassare" v={fmtE(ov.commissioni_da_incassare)} />
            <Row k="Totali maturate" v={fmtE(ov.commissioni_totali)} />
          </div>
        </div>
      </Card>
    </div>
  )
}

// ============================ STADIO & ROADMAP ==============================
function Stadio({ M }: { M: Metrics; ov: Overview }) {
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-display text-lg mb-4">Il percorso di Planfully</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAGES.map((s, i) => {
            const Ic = s.icon; const active = i === M.stageIdx; const done = i < M.stageIdx
            return (
              <div key={s.key} className="rounded-xl border p-4" style={{ borderColor: active ? 'rgb(var(--gold-500))' : 'rgb(var(--border))', background: active ? 'rgb(var(--gold-100))' : done ? 'rgb(var(--bg-sunken))' : 'transparent' }}>
                <Ic size={20} className={active ? 'text-[rgb(var(--gold-700))]' : 'text-[rgb(var(--fg-muted))]'} />
                <p className="font-medium text-sm mt-2">{i + 1}. {s.label} {done && '✓'}</p>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{s.blurb}</p>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Flag size={18} className="text-[rgb(var(--gold-600))]" /> Traguardi</h2>
        <div className="space-y-2">
          {M.milestones.map((m, i) => (
            <div key={i} className="flex items-start gap-3">
              {m.done ? <CheckCircle2 size={18} className="text-[rgb(var(--emerald-500))] shrink-0 mt-0.5" /> : <Circle size={18} className="text-[rgb(var(--fg-subtle))] shrink-0 mt-0.5" />}
              <div>
                <p className={`text-sm ${m.done ? 'line-through text-[rgb(var(--fg-muted))]' : 'font-medium'}`}>{m.label}</p>
                <p className="text-xs text-[rgb(var(--fg-subtle))]">{m.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============================ STRATEGIA =====================================
const PLAYBOOK: Record<number, { vision: string; pillars: { icon: any; title: string; moves: string[] }[] }> = {
  0: {
    vision: 'Sei in startup: nessuno paga ancora ed è giusto così. Il tuo unico lavoro è creare un’offerta densa (tanti fornitori di qualità) e portare i primi clienti a vivere il “momento aha”. Niente monetizzazione ora: prima il valore, poi il prezzo.',
    pillars: [
      { icon: Users, title: 'Offerta (supply)', moves: ['Arruola 50 fornitori nelle 3-4 categorie chiave (foto, location, catering, musica).', 'Cura le vetrine: portfolio + recensioni reali. Una rete bella attira clienti.', 'Attiva gli inviti tra colleghi: ogni fornitore ne porta altri.'] },
      { icon: Megaphone, title: 'Domanda (clienti)', moves: ['Metti il form di richiesta su ogni vetrina e sito dei fornitori.', 'Fai 10 matrimoni “concierge” seguiti a mano: impara cosa serve davvero.', 'Raccogli 5 case study con foto: sono la tua prova sociale.'] },
      { icon: Zap, title: 'Prodotto', moves: ['Riduci i click: preventivo→contratto→evento senza ripetizioni.', 'Misura l’attivazione: % di clienti che firmano un preventivo.'] },
    ],
  },
  1: {
    vision: 'Hai il primo abbonato: la monetizzazione è validata. Ora dimostra che il valore è ripetibile e porta i paganti a 10. Concentrati sull’onboarding: chi capisce il valore nei primi 7 giorni, resta.',
    pillars: [
      { icon: Megaphone, title: 'Acquisizione', moves: ['Replica il canale che ha portato il primo pagante. Raddoppialo.', 'Chiedi referral ai fornitori soddisfatti: incentivo + crediti.'] },
      { icon: Zap, title: 'Attivazione', moves: ['Onboarding guidato in 3 passi: profilo→catalogo→primo preventivo.', 'Email/whatsapp di benvenuto con il “primo successo” da raggiungere.'] },
      { icon: Repeat, title: 'Retention', moves: ['Misura chi NON torna dopo 14 giorni e chiamalo.', 'Costruisci l’abitudine: notifiche utili (turni, da rivedere).'] },
    ],
  },
  2: {
    vision: 'Ramp-up: serve acquisizione ripetibile e churn basso. Trasforma i canali che funzionano in una macchina. Inizia a misurare CAC e LTV: ogni euro speso deve tornare.',
    pillars: [
      { icon: Megaphone, title: 'Acquisizione', moves: ['Identifica 1-2 canali con CAC sostenibile e investi lì.', 'Programma referral strutturato (crediti €) come leva principale.'] },
      { icon: Target, title: 'Monetizzazione', moves: ['Alza la conversione free→pagante con limiti chiari sul piano gratis.', 'Introduci i 3 piani (29/59/79): fai upgrade chi usa di più.'] },
      { icon: Repeat, title: 'Retention & espansione', moves: ['Net revenue retention: fai crescere i clienti esistenti (upsell).', 'Churn < 3%/mese: intervieni i fornitori a rischio.'] },
    ],
  },
  3: {
    vision: 'Scale-up: la macchina gira. Scala i canali che funzionano, alza l’ARPA e punta a un margine sano. Ogni decisione guarda a LTV/CAC ≥ 3 e burn multiple < 1.',
    pillars: [
      { icon: Megaphone, title: 'Scala canali', moves: ['Aumenta il budget sui canali con LTV/CAC ≥ 3.', 'Espansione geografica: replica il playbook in nuove città.'] },
      { icon: Target, title: 'Pricing & ARPA', moves: ['Sperimenta prezzi e pacchetti annuali (cassa anticipata).', 'Add-on a valore (PDF brandizzati, vetrina premium).'] },
      { icon: Zap, title: 'Efficienza', moves: ['Tieni il burn multiple < 1 (bruci meno di quanto cresci).', 'Automatizza il supporto: self-service + AI.'] },
    ],
  },
}
function Strategia({ M, ov }: { M: Metrics; ov: Overview }) {
  const pb = PLAYBOOK[M.stageIdx]!
  // Simulatore in SOLDI: base abbonamenti MISTA (quanti a 29/59/79, prezzi editabili
  // perché i pacchetti sono provvisori) + ricavo da PERCENTUALI sui matrimoni.
  const [n29, setN29] = useState(0); const [n59, setN59] = useState(0); const [n79, setN79] = useState(0)
  const [p29, setP29] = useState(29); const [p59, setP59] = useState(59); const [p79, setP79] = useState(79)
  const [matrimoniMese, setMatrimoniMese] = useState(0)
  const [valoreMedio, setValoreMedio] = useState(20000)
  const [commPct, setCommPct] = useState(3)

  const mrrAbbon = n29 * p29 + n59 * p59 + n79 * p79
  const ricavoPercMese = matrimoniMese * valoreMedio * (commPct / 100)
  const ricavoMese = mrrAbbon + ricavoPercMese
  const nettoMese = ricavoMese - ov.costi_ricorrenti_mese
  const totAbbonati = n29 + n59 + n79
  const arpa = totAbbonati > 0 ? mrrAbbon / totAbbonati : 0

  const Num = ({ v, set, label, prefix }: { v: number; set: (n: number) => void; label: string; prefix?: string }) => (
    <div>
      <label className="text-[11px] text-[rgb(var(--fg-muted))]">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--fg-subtle))]">{prefix}</span>}
        <Input className={`text-sm ${prefix ? 'pl-5' : ''}`} type="number" min={0} value={v} onChange={(e) => set(Math.max(0, Number(e.target.value) || 0))} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-display text-lg mb-2 flex items-center gap-2"><Compass size={18} className="text-[rgb(var(--gold-600))]" /> La visione, ora</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed">{pb.vision}</p>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pb.pillars.map((p, i) => {
          const Ic = p.icon
          return (
            <Card key={i} className="p-4">
              <p className="font-medium text-sm mb-2 flex items-center gap-2"><Ic size={16} className="text-[rgb(var(--gold-600))]" /> {p.title}</p>
              <ul className="space-y-1.5">
                {p.moves.map((m, j) => <li key={j} className="text-xs text-[rgb(var(--fg-muted))] flex gap-1.5"><span className="text-[rgb(var(--gold-600))]">→</span>{m}</li>)}
              </ul>
            </Card>
          )
        })}
      </div>

      <Card className="p-5">
        <h2 className="font-display text-lg mb-1 flex items-center gap-2"><Sparkles size={18} className="text-[rgb(var(--gold-600))]" /> Simulatore di budget</h2>
        <p className="text-xs text-[rgb(var(--fg-subtle))] mb-4">Ragiona in soldi: una base di abbonamenti <strong>mista</strong> (chi 29, chi 59, chi 79 — prezzi modificabili) più le <strong>percentuali sui matrimoni</strong>.</p>

        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">1 · Abbonamenti (mix)</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Num v={n29} set={setN29} label="N° abbonati fascia A" />
          <Num v={n59} set={setN59} label="N° abbonati fascia B" />
          <Num v={n79} set={setN79} label="N° abbonati fascia C" />
          <Num v={p29} set={setP29} label="Prezzo A" prefix="€" />
          <Num v={p59} set={setP59} label="Prezzo B" prefix="€" />
          <Num v={p79} set={setP79} label="Prezzo C" prefix="€" />
        </div>

        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))] mt-4 mb-2">2 · Percentuali sui matrimoni</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Num v={matrimoniMese} set={setMatrimoniMese} label="Matrimoni / mese" />
          <Num v={valoreMedio} set={setValoreMedio} label="Valore medio" prefix="€" />
          <Num v={commPct} set={setCommPct} label="% commissione" />
        </div>

        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgb(var(--bg-sunken))' }}>
          <Row k="Ricavo abbonamenti / mese" v={fmtE(mrrAbbon)} />
          <Row k="Ricavo percentuali / mese" v={fmtE(ricavoPercMese)} />
          <div className="border-t my-1.5" style={{ borderColor: 'rgb(var(--border))' }} />
          <Row k="Ricavo mensile TOTALE" v={fmtE(ricavoMese)} />
          <Row k="Ricavo annuo (ARR)" v={fmtE(ricavoMese * 12)} />
          <Row k="ARPA (per abbonato)" v={fmtE(arpa)} />
          <Row k="Costi ricorrenti / mese" v={fmtE(ov.costi_ricorrenti_mese)} />
          <div className="border-t my-1.5" style={{ borderColor: 'rgb(var(--border))' }} />
          <div className="flex justify-between gap-3 py-1 text-sm font-semibold">
            <span>Netto mensile</span>
            <span className="tabular-nums" style={{ color: nettoMese >= 0 ? 'rgb(var(--emerald-600))' : 'rgb(var(--rose-500))' }}>{fmtE(nettoMese)}</span>
          </div>
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">{nettoMese >= 0 ? '✓ Sopra il break-even: il modello copre i costi ricorrenti.' : `Sotto break-even: mancano ${fmtE(-nettoMese)}/mese. Aumenta abbonati, prezzo medio o volume matrimoni.`}</p>
      </Card>
    </div>
  )
}

// ============================ REPORT ========================================
function Report({ months, M }: { months: Month[]; M: Metrics }) {
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.entrate, m.costi)))
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="font-display text-lg mb-4">Entrate vs Costi · ultimi 12 mesi</h2>
        <div className="flex items-end gap-2 h-44 overflow-x-auto">
          {months.map((m) => (
            <div key={m.mese} className="flex flex-col items-center gap-1 min-w-[34px]">
              <div className="flex items-end gap-0.5 h-32">
                <div title={`Entrate ${fmtE(m.entrate)}`} style={{ height: `${(m.entrate / maxBar) * 100}%`, width: 10, background: 'rgb(var(--emerald-500))', borderRadius: 3 }} />
                <div title={`Costi ${fmtE(m.costi)}`} style={{ height: `${(m.costi / maxBar) * 100}%`, width: 10, background: 'rgb(var(--rose-500))', borderRadius: 3 }} />
              </div>
              <span className="text-[9px] text-[rgb(var(--fg-subtle))]">{m.mese.slice(5)}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-[rgb(var(--fg-muted))]">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgb(var(--emerald-500))' }} /> Entrate</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgb(var(--rose-500))' }} /> Costi</span>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-lg mb-3">Ratio da tenere d’occhio</h2>
        <Row k="Margine ricorrente mensile" v={fmtE(M.mrr - M.breakEven)} />
        <Row k="Crescita entrate MoM" v={`${M.growth >= 0 ? '+' : ''}${M.growth.toFixed(0)}%`} />
        <Row k="Runway" v={M.runway === Infinity ? 'illimitato (no burn)' : `${M.runway.toFixed(0)} mesi`} />
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-3">Riferimenti SaaS: LTV/CAC ≥ 3 · churn &lt; 3%/mese · costi ricorrenti &lt; 50% delle entrate ricorrenti · burn multiple &lt; 1 in scala.</p>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg mb-3 flex items-center gap-2"><BookOpen size={18} className="text-[rgb(var(--gold-600))]" /> Glossario in parole semplici</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {[
            ['MRR', 'I soldi che incassi ogni mese in modo ricorrente (abbonamenti). È lo "stipendio fisso" dell\'azienda.'],
            ['ARR', 'L\'MRR moltiplicato per 12: quanto incassi in un anno se nulla cambia.'],
            ['Cassetto', 'I soldi che hai in cassa adesso, qui e ora.'],
            ['Runway', 'Per quanti mesi puoi andare avanti con i soldi che hai, se continui a spendere così. "∞" = non stai bruciando cassa.'],
            ['Burn', 'Quanto perdi al mese (esci più di quanto entra). Se è 0, sei in pari.'],
            ['ARPA', 'Quanto paga in media ogni abbonato. Più sale, meglio è.'],
            ['Conversione', 'Su 100 fornitori, quanti diventano paganti. In partenza, 5-10% è già buono.'],
            ['Churn', 'Quanti clienti ti lasciano ogni mese. Vuoi tenerlo basso (sotto il 3%).'],
            ['CAC', 'Quanto spendi per acquisire UN cliente nuovo (pubblicità, tempo, ecc.).'],
            ['LTV', 'Quanto ti rende UN cliente in tutta la sua "vita" con te. Deve valere almeno 3 volte il CAC.'],
            ['Crescita MoM', '"Month over Month": di quanto cresci ogni mese rispetto al precedente.'],
            ['Break-even', 'Il punto in cui le entrate coprono esattamente i costi: da lì in poi guadagni.'],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="text-sm font-medium">{t}</p>
              <p className="text-xs text-[rgb(var(--fg-muted))]">{d}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ============================ UI bits =======================================
function Percent2() { return <span className="text-[13px] font-bold">%</span> }
function EntryEditor({ direction, onSaved }: { direction: 'IN' | 'OUT'; onSaved: () => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('')
  const [recurrence, setRecurrence] = useState('UNA_TANTUM'); const [date, setDate] = useState(''); const [saving, setSaving] = useState(false)
  async function add() {
    if (!label.trim() || !Number(amount)) { toast.error('Inserisci voce e importo'); return }
    setSaving(true)
    const { data, error } = await rpc('admin_finance_entry_add', { p_direction: direction, p_label: label.trim(), p_amount: Number(amount), p_category: category.trim() || null, p_recurrence: recurrence, p_entry_date: date || null })
    setSaving(false)
    if (error || (data as { error?: string })?.error) { toast.error('Errore'); return }
    setLabel(''); setAmount(''); setCategory(''); setRecurrence('UNA_TANTUM'); setDate(''); toast.success('Aggiunto'); onSaved()
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 mb-3">
      <Input className="sm:col-span-2 text-sm" placeholder={direction === 'OUT' ? 'Es. Hosting Vercel' : 'Es. Abbonamento fornitore'} value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input className="text-sm" type="number" placeholder="€" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input className="text-sm" placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
      <select className="text-sm border rounded-lg px-2 bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
        <option value="UNA_TANTUM">Una tantum</option><option value="MENSILE">Mensile</option><option value="ANNUALE">Annuale</option>
      </select>
      <Button variant="gold" disabled={saving} onClick={() => void add()}><Plus size={14} className="mr-1" /> Aggiungi</Button>
    </div>
  )
}
function EntryList({ entries, onChanged }: { entries: Entry[]; onChanged: () => void }) {
  async function del(id: string) { await rpc('admin_finance_entry_delete', { p_id: id }); onChanged() }
  if (entries.length === 0) return <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna voce.</p>
  return (
    <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{e.label}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">{[e.category, e.recurrence === 'MENSILE' ? 'mensile' : e.recurrence === 'ANNUALE' ? 'annuale' : 'una tantum', new Date(e.entry_date).toLocaleDateString('it-IT')].filter(Boolean).join(' · ')}</p>
          </div>
          <span className="font-medium tabular-nums">{fmtE(e.amount)}</span>
          <button onClick={() => void del(e.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}
function Kpi({ icon, label, value, tone, help }: { icon: React.ReactNode; label: string; value: string; tone?: 'emerald' | 'rose'; help?: string }) {
  const c = tone === 'emerald' ? 'rgb(var(--emerald-600))' : tone === 'rose' ? 'rgb(var(--rose-500))' : 'rgb(var(--fg))'
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1.5">{icon} {label}</p>
      <p className="font-display text-2xl mt-1 tabular-nums" style={{ color: c }}>{value}</p>
      {/* Spiegazione sempre visibile, in parole semplici */}
      {help && <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1 leading-snug">{help}</p>}
    </Card>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-[rgb(var(--fg-muted))]">{k}</span><span className="font-medium tabular-nums">{v}</span></div>
}
