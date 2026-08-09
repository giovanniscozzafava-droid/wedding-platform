import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, CheckCircle2, ExternalLink, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type ConnectStatus = {
  account_id: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
} | null

// Impostazioni → Incassi. Il professionista collega il PROPRIO account Stripe (Connect Express) per
// ricevere i pagamenti dei clienti direttamente sul suo conto. Planfully è solo il tramite.
export default function IncassiSettingsPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState<ConnectStatus>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // Piano pagamenti del professionista (3 rate, somma 100). Default 30/50/20.
  const [plan, setPlan] = useState({ deposit: 30, second: 50, balance: 20 })
  const [planBusy, setPlanBusy] = useState(false)

  async function loadStatus() {
    if (!user) return
    const { data } = await (supabase.from as any)('stripe_connect_accounts')
      .select('account_id, charges_enabled, payouts_enabled, details_submitted')
      .eq('profile_id', user.id).maybeSingle()
    setStatus((data as ConnectStatus) ?? null)
    const { data: prof } = await (supabase.from as any)('profiles')
      .select('pay_deposit_pct, pay_second_pct, pay_balance_pct').eq('id', user.id).maybeSingle()
    if (prof) setPlan({ deposit: Number(prof.pay_deposit_pct ?? 30), second: Number(prof.pay_second_pct ?? 50), balance: Number(prof.pay_balance_pct ?? 20) })
    setLoading(false)
  }

  async function savePlan() {
    if (!user) return
    const sum = plan.deposit + plan.second + plan.balance
    if (Math.round(sum) !== 100) { toast.error('Le tre rate devono sommare a 100%.'); return }
    if (plan.deposit < 0 || plan.second < 0 || plan.balance < 0) { toast.error('Le percentuali non possono essere negative.'); return }
    setPlanBusy(true)
    try {
      const { error } = await (supabase.from as any)('profiles')
        .update({ pay_deposit_pct: plan.deposit, pay_second_pct: plan.second, pay_balance_pct: plan.balance }).eq('id', user.id)
      if (error) throw error
      toast.success('Piano pagamenti salvato')
    } catch (e) { toast.error((e as Error).message) } finally { setPlanBusy(false) }
  }

  // Allinea lo stato REALE da Stripe (retrieve live via edge, non dipende dal webhook), poi rilegge.
  async function refresh() {
    if (!user) return
    try { await supabase.functions.invoke('connect-onboard', { body: { sync: true } }) } catch { /* ignora */ }
    await loadStatus()
  }

  useEffect(() => { refresh() }, [user?.id])

  // Ritorno dall'onboarding Stripe: allinea lo stato e pulisci la query.
  useEffect(() => {
    if (params.get('stripe')) { refresh(); setParams({}, { replace: true }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  async function connect(dashboard = false) {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('connect-onboard', { body: { dashboard } })
      if (error) throw new Error(error.message)
      if (data?.error === 'stripe_not_configured') { toast.error('Incassi non ancora attivi: configurazione in corso.'); return }
      if (data?.error) throw new Error(data.error)
      if (data?.url) { window.location.href = data.url as string; return }
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  const active = !!status?.charges_enabled
  const pending = !!status && !status.charges_enabled

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsTabs />
      <PageHeader title="Incassi" description="Ricevi i pagamenti dei tuoi clienti direttamente sul tuo conto" />

      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-muted p-3"><CreditCard className="h-6 w-6" /></div>
          <div className="flex-1">
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carico lo stato…</div>
            ) : active ? (
              <>
                <div className="flex items-center gap-2 font-medium text-emerald-600"><CheckCircle2 className="h-5 w-5" /> Incassi attivi</div>
                <p className="mt-1 text-sm text-muted-foreground">Il tuo account è collegato: i pagamenti dei clienti arrivano direttamente sul tuo conto Stripe.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => connect(true)} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />} Apri la mia dashboard Stripe
                  </Button>
                </div>
              </>
            ) : pending ? (
              <>
                <div className="font-medium text-amber-600">Collegamento da completare</div>
                <p className="mt-1 text-sm text-muted-foreground">Hai iniziato il collegamento ma mancano alcuni dati (documento, IBAN). Completa per poter incassare.</p>
                <Button className="mt-4" onClick={() => connect(false)} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Completa il collegamento
                </Button>
              </>
            ) : (
              <>
                <div className="font-medium">Collega il tuo Stripe per farti pagare</div>
                <p className="mt-1 text-sm text-muted-foreground">Un passaggio guidato da Stripe (documento + IBAN). Da quel momento potrai richiedere pagamenti ai tuoi clienti e riceverli sul tuo conto.</p>
                <Button className="mt-4" onClick={() => connect(false)} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Collega il tuo Stripe
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Piano pagamenti: come il professionista si fa pagare (3 rate, somma 100). */}
      <Card className="mt-4 p-6">
        <div className="font-medium">Come ti fai pagare</div>
        <p className="mt-1 text-sm text-muted-foreground">Le tre rate del contratto: acconto alla firma, seconda rata, saldo prima dell’evento. Devono sommare a 100%.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <label className="text-xs text-muted-foreground">Acconto alla firma (%)
            <Input type="number" min={0} max={100} value={plan.deposit}
              onChange={(e) => setPlan((p) => ({ ...p, deposit: Number(e.target.value) }))} className="mt-1" /></label>
          <label className="text-xs text-muted-foreground">Seconda rata (%)
            <Input type="number" min={0} max={100} value={plan.second}
              onChange={(e) => setPlan((p) => ({ ...p, second: Number(e.target.value) }))} className="mt-1" /></label>
          <label className="text-xs text-muted-foreground">Saldo (%)
            <Input type="number" min={0} max={100} value={plan.balance}
              onChange={(e) => setPlan((p) => ({ ...p, balance: Number(e.target.value) }))} className="mt-1" /></label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="gold" size="sm" disabled={planBusy} onClick={savePlan}>{planBusy ? 'Salvo…' : 'Salva piano'}</Button>
          <span className={`text-xs ${Math.round(plan.deposit + plan.second + plan.balance) === 100 ? 'text-muted-foreground' : 'text-[rgb(var(--rose-500))]'}`}>
            Totale: {Math.round(plan.deposit + plan.second + plan.balance)}%
          </span>
        </div>
      </Card>

      <div className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Il collegamento e i dati bancari sono gestiti direttamente da Stripe. Planfully non vede né conserva i tuoi dati di pagamento: fa solo da tramite tra te e il cliente.</span>
      </div>
    </div>
  )
}
