import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Crown } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Ambito = 'COMPLETO' | 'SOLO_COORDINAMENTO' | 'SOLO_PROPRI_SERVIZI'
const OPTS: { key: Ambito; title: string; desc: string }[] = [
  { key: 'COMPLETO', title: 'Gestisco l’intero evento',
    desc: 'Raccolgo io i preventivi di tutti i fornitori e porto al contratto: sei il regista dell’evento.' },
  { key: 'SOLO_COORDINAMENTO', title: 'Coordino, ma ognuno firma il suo',
    desc: 'Tu coordini; preventivi e contratti li gestiscono e firmano i singoli professionisti.' },
  { key: 'SOLO_PROPRI_SERVIZI', title: 'Solo i miei servizi',
    desc: 'Proponi soltanto i tuoi servizi, senza raccogliere preventivi esterni.' },
]

// Profilo → default ambito del capostipite: si applica ai NUOVI eventi (override per-evento resta).
export function AmbitoDefaultCard() {
  const { user } = useAuth()
  const [val, setVal] = useState<Ambito | ''>('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from('profiles') as any)
        .select('default_ambito_capostipite').eq('id', user.id).maybeSingle()
      setVal(((data?.default_ambito_capostipite as Ambito) ?? '') || '')
    })()
  }, [user?.id])

  async function pick(k: Ambito) {
    if (!user || busy) return
    setBusy(true)
    try {
      const { error } = await (supabase.from('profiles') as any)
        .update({ default_ambito_capostipite: k }).eq('id', user.id)
      if (error) throw error
      setVal(k)
      toast.success('Impostazione salvata')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-lg mb-1 flex items-center gap-2">
        <Crown size={18} className="text-[rgb(var(--gold-600))]" /> Il tuo ruolo sugli eventi
      </h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        Come gestisci di default i nuovi eventi. Puoi comunque cambiarlo sul singolo evento.
      </p>
      <div className="space-y-2">
        {OPTS.map((o) => {
          const active = val === o.key
          return (
            <button key={o.key} disabled={busy} onClick={() => void pick(o.key)} type="button"
              className="w-full text-left rounded-xl border p-3 transition disabled:opacity-60"
              style={{ borderColor: active ? 'rgb(var(--gold-600))' : 'rgb(var(--border))', background: active ? 'rgb(var(--bg-sunken))' : 'transparent' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-[15px]">{o.title}</p>
                {active && <Check size={16} className="text-[rgb(var(--gold-600))] shrink-0" />}
              </div>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">{o.desc}</p>
            </button>
          )
        })}
      </div>
    </Card>
  )
}
export default AmbitoDefaultCard
