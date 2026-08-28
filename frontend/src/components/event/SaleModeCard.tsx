import { useEffect, useState } from 'react'
import { Package, ListTree } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { toast } from '@/lib/toast'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Mode = 'BUNDLE' | 'ITEMIZED'

// Modalità di vendita del capostipite (fornitore globale). Decide il DEFAULT del "blind" sui nomi
// dei fornitori nei preventivi e la direzione del denaro (vedi cruscotto Finanze rete):
//  - BUNDLE   = pacchetto unico: nomi fornitori nascosti di default; incassi tu dal cliente, paghi i
//               fornitori e trattieni il margine.
//  - ITEMIZED = voci separate: nomi fornitori visibili di default; incassa il fornitore dal cliente
//               e ti gira il margine.
export function SaleModeCard() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('BUNDLE')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from('profiles') as any)
        .select('capostipite_sale_mode').eq('id', user.id).maybeSingle()
      if (data?.capostipite_sale_mode) setMode(data.capostipite_sale_mode as Mode)
    })()
  }, [user])

  async function choose(next: Mode) {
    if (next === mode || !user) return
    setBusy(true)
    const prev = mode
    setMode(next)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ capostipite_sale_mode: next }).eq('id', user.id)
      if (error) throw error
      toast.success(next === 'BUNDLE' ? 'Vendi a pacchetto unico: nomi fornitori nascosti di default' : 'Vendi a voci separate: nomi fornitori visibili di default')
    } catch (e) { setMode(prev); toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  const opt = (m: Mode, Icon: typeof Package, title: string, desc: string) => (
    <button type="button" disabled={busy} onClick={() => void choose(m)}
      className={`text-left p-3 rounded-lg border transition-colors ${mode === m ? 'border-[rgb(var(--gold))] bg-[rgb(var(--bg-sunken))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'} disabled:opacity-60`}>
      <div className="flex items-center gap-2"><Icon size={15} className="text-[rgb(var(--gold-600))]" /><p className="font-medium text-sm">{title}</p></div>
      <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">{desc}</p>
    </button>
  )

  return (
    <Card className="p-6 mt-6">
      <h3 className="font-display text-lg mb-1">Come vendi la tua rete</h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">
        Da fornitore globale puoi proporre i servizi dei tuoi fornitori con un ricarico. Questa scelta
        imposta il default: se il cliente vede il nome del fornitore su ogni voce (poi lo puoi cambiare
        voce per voce nel preventivo) e come scorre il denaro.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {opt('BUNDLE', Package, 'Pacchetto unico (blind)', 'Nomi fornitori nascosti di default. Incassi tu dal cliente, paghi i fornitori e trattieni il margine.')}
        {opt('ITEMIZED', ListTree, 'Voci separate (nomi visibili)', 'Il cliente vede chi è ogni fornitore. Incassa il fornitore dal cliente e ti gira il margine.')}
      </div>
    </Card>
  )
}
