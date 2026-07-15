import { useEffect, useState } from 'react'
import { CreditCard, Loader2, ExternalLink, Check, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'

type Sub = { status: string; price_id: string | null; current_period_end: string | null; cancel_at_period_end: boolean }
type PriceRow = { price_id: string; tier: string }

// Pagina gestione abbonamento. GATED dietro il flag `billing` (feature_enabled):
// in beta è OFF → nessun money-talk in UI (regola beta). Le edge function esistono
// già (checkout-session-create / stripe-portal); il prezzo si legge da stripe_price_map,
// che va popolato quando [DECISIONE-STRIPE-1] è chiusa.
export default function BillingPage() {
  const { user, profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(false)
  const [sub, setSub] = useState<Sub | null>(null)
  const [prices, setPrices] = useState<PriceRow[]>([])
  const [busy, setBusy] = useState<'' | 'checkout' | 'portal'>('')

  useEffect(() => {
    if (!user) return
    void (async () => {
      // flag: se la RPC non risponde true → consideriamo OFF (beta)
      try {
        const { data } = await (supabase.rpc as any)('feature_enabled', { p_key: 'billing' })
        setEnabled(data === true)
      } catch { setEnabled(false) }
      const { data: s } = await (supabase.from as any)('stripe_subscriptions')
        .select('status, price_id, current_period_end, cancel_at_period_end')
        .eq('profile_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
      setSub((s as Sub | null) ?? null)
      const { data: pm } = await (supabase.from as any)('stripe_price_map').select('price_id, tier')
      setPrices((pm as PriceRow[] | null) ?? [])
      setLoading(false)
    })()
  }, [user])

  const tier = profile?.subscription_tier ?? 'FREE'
  const isActive = sub && ['active', 'trialing', 'past_due'].includes(sub.status)
  const premiumPrice = prices.find((p) => p.tier === 'PREMIUM') ?? prices.find((p) => p.tier === 'PLUS') ?? prices[0]

  async function startCheckout() {
    if (!premiumPrice) { toast.error('Piano non ancora disponibile'); return }
    setBusy('checkout')
    try {
      const { data, error } = await supabase.functions.invoke('checkout-session-create', { body: { price_id: premiumPrice.price_id } })
      if (error || !(data as any)?.url) throw new Error((data as any)?.error || error?.message || 'Checkout non disponibile')
      window.location.href = (data as any).url
    } catch (e) { toast.error((e as Error).message); setBusy('') }
  }
  async function openPortal() {
    setBusy('portal')
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal', { body: {} })
      if (error || !(data as any)?.url) throw new Error((data as any)?.error === 'no_customer' ? 'Nessun abbonamento da gestire' : ((data as any)?.error || error?.message || 'Portale non disponibile'))
      window.location.href = (data as any).url
    } catch (e) { toast.error((e as Error).message); setBusy('') }
  }

  if (loading) return <div className="min-h-full grid place-items-center py-20"><Loader2 className="animate-spin text-[rgb(var(--fg-muted))]" /></div>

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Impostazioni" title="Abbonamento" description="Il tuo piano e la fatturazione." />

        {!enabled ? (
          // BETA: nessun money-talk. Messaggio neutro.
          <Card>
            <CardContent className="p-6 flex items-start gap-3">
              <ShieldCheck size={20} className="text-[rgb(var(--gold-600))] shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Durante la beta tutte le funzioni sono attive per te.</p>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">La gestione dell'abbonamento comparirà qui più avanti. Non devi fare nulla ora.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Stato piano */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Piano attuale</p>
                    <p className="font-display text-2xl mt-0.5">{isActive ? (sub?.status === 'trialing' ? 'Premium · prova' : 'Premium') : tier === 'FREE' ? 'Free' : tier}</p>
                    {sub?.current_period_end && (
                      <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                        {sub.cancel_at_period_end ? 'Termina il ' : 'Si rinnova il '}
                        {new Date(sub.current_period_end).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {isActive
                    ? <Button variant="outline" disabled={busy !== ''} onClick={() => void openPortal()}>{busy === 'portal' ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />} Gestisci / disdici</Button>
                    : <Button variant="gold" disabled={busy !== '' || !premiumPrice} onClick={() => void startCheckout()}>{busy === 'checkout' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />} {premiumPrice ? 'Passa a Premium' : 'Prezzo in definizione'}</Button>}
                </div>
              </CardContent>
            </Card>

            {/* Cosa include Premium (senza prezzo finché non è configurato) */}
            <Card>
              <CardContent className="p-6">
                <p className="font-medium mb-3">Premium include</p>
                <ul className="space-y-1.5 text-sm text-[rgb(var(--fg-muted))]">
                  {['Preventivi illimitati', 'Tutti gli strumenti (album, carosello, F&B, calendario)', 'Supporto prioritario'].map((f) => (
                    <li key={f} className="flex items-center gap-2"><Check size={15} className="text-[rgb(var(--gold-600))]" /> {f}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-3">La fatturazione è gestita in modo sicuro da Stripe. Puoi disdire in autonomia dal portale in ogni momento.</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
