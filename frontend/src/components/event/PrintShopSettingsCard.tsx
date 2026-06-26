import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Printer, Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { PRINT_PRODUCTS } from '@/lib/printCatalog'

// Il fotografo abilita il negozio stampe e sceglie QUALI prodotti mostrare ai clienti.
// In beta è solo selezione+richiesta (nessun prezzo/pagamento).
export function PrintShopSettingsCard() {
  const [me, setMe] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [products, setProducts] = useState<string[]>(['stampa', 'tela', 'cornice'])
  const [intro, setIntro] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setMe(uid)
      const { data } = await (supabase.from as any)('print_shop_settings').select('*').eq('professional_id', uid).maybeSingle()
      if (data) { setEnabled(!!data.enabled); setProducts(data.products ?? []); setIntro(data.intro ?? '') }
      setLoading(false)
    })()
  }, [])

  function toggleProduct(key: string) {
    setProducts((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key])
  }

  async function save() {
    if (!me) return
    setSaving(true)
    try {
      const { error } = await (supabase.from as any)('print_shop_settings').upsert({
        professional_id: me, enabled, products, intro: intro.trim() || null, updated_at: new Date().toISOString(),
      }, { onConflict: 'professional_id' })
      if (error) throw error
      toast.success('Negozio stampe salvato')
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }

  if (loading) return null

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><Printer size={18} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg flex items-center gap-2">Negozio stampe {enabled && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))]"><Check size={11} className="inline" /> attivo</span>}</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">I clienti possono richiederti stampe delle loro foto dalla galleria. Scegli tu cosa mostrare. In beta è solo raccolta richieste: stampa e consegna le gestisci tu, nessun pagamento online.</p>

          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Mostra il negozio stampe ai clienti
          </label>

          <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mt-4 mb-2">Prodotti in vetrina</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {PRINT_PRODUCTS.map((p) => {
              const on = products.includes(p.key)
              return (
                <button key={p.key} type="button" onClick={() => toggleProduct(p.key)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${on ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]/40' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                  <span className="h-8 w-8 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${p.accent[0]}, ${p.accent[1]})` }} />
                  <span className="flex-1 min-w-0">
                    <span className="text-sm font-medium block truncate">{p.name}</span>
                    <span className="text-[11px] text-[rgb(var(--fg-subtle))] block truncate">{p.formats.length} formati</span>
                  </span>
                  <span className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ${on ? 'bg-[rgb(var(--gold-600))] border-transparent text-white' : 'border-[rgb(var(--border-strong))]'}`}>{on && <Check size={12} />}</span>
                </button>
              )
            })}
          </div>

          <label className="block text-[11px] text-[rgb(var(--fg-muted))] mt-4">Messaggio di benvenuto (facoltativo)
            <input value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Es. Trasforma i tuoi ricordi in stampe da appendere" className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
          </label>

          <div className="mt-4">
            <Button variant="gold" disabled={saving} onClick={save}>{saving ? '…' : 'Salva negozio stampe'}</Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
