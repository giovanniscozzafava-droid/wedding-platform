import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X, Check, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { PRINT_PRODUCTS, PRODUCT_BY_KEY, type PrintProduct } from '@/lib/printCatalog'

type Photo = { driveId?: string | null; thumb?: string | null }
type Props = { open: boolean; onClose: () => void; entryId?: string; slug?: string; photo?: Photo }

// Anteprima fresca: la foto "dentro" il prodotto, solo CSS (niente compositing pesante).
function Preview({ product, src }: { product: PrintProduct; src?: string | null }) {
  const img = src
    ? <img src={src} alt="" className="w-full h-full object-cover" />
    : <div className="w-full h-full grid place-items-center text-[rgb(var(--fg-subtle))] text-xs">la tua foto</div>
  const wrap = 'relative aspect-[3/4] w-40 sm:w-48 mx-auto overflow-hidden'
  switch (product.frame) {
    case 'canvas':
      return <div className={`${wrap} rounded-[2px] shadow-[0_14px_30px_rgba(20,18,14,.28)]`} style={{ padding: 6, background: '#fff' }}><div className="w-full h-full overflow-hidden" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06)' }}>{img}</div></div>
    case 'framed':
      return <div className={`${wrap} shadow-[0_16px_34px_rgba(20,18,14,.30)]`} style={{ padding: 10, background: 'linear-gradient(135deg,#6b5742,#3f3327)', borderRadius: 3 }}><div className="w-full h-full bg-white p-1.5"><div className="w-full h-full overflow-hidden">{img}</div></div></div>
    case 'fineart':
      return <div className={`${wrap} bg-white shadow-[0_16px_34px_rgba(20,18,14,.22)] ring-1 ring-black/5`} style={{ padding: 18 }}><div className="w-full h-full overflow-hidden">{img}</div></div>
    case 'panel':
      return <div className={`${wrap} rounded-lg shadow-[0_20px_40px_rgba(20,18,14,.30)]`}>{img}</div>
    case 'set':
      return <div className={`${wrap} grid grid-cols-2 grid-rows-2 gap-1`}>{[0, 1, 2, 3].map((i) => <div key={i} className="overflow-hidden rounded-sm bg-white p-0.5 shadow">{img}</div>)}</div>
    default: // print
      return <div className={`${wrap} bg-white shadow-[0_12px_28px_rgba(20,18,14,.22)]`} style={{ padding: 5 }}><div className="w-full h-full overflow-hidden">{img}</div></div>
  }
}

export function PrintOrderSheet({ open, onClose, entryId, slug, photo }: Props) {
  const [loading, setLoading] = useState(true)
  const [shop, setShop] = useState<{ enabled: boolean; products: string[]; pro_name?: string; intro?: string } | null>(null)
  const [pKey, setPKey] = useState<string | null>(null)
  const [fKey, setFKey] = useState<string | null>(null)
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    setDone(false); setLoading(true)
    void (async () => {
      const fn = entryId ? 'print_shop_for_entry' : 'print_shop_public'
      const arg = entryId ? { p_entry: entryId } : { p_slug: slug }
      const { data } = await (supabase as any).rpc(fn, arg)
      const s = (data ?? { enabled: false }) as any
      setShop(s)
      const enabled: string[] = Array.isArray(s.products) ? s.products : []
      const first = PRINT_PRODUCTS.find((p) => enabled.includes(p.key))?.key ?? null
      setPKey(first); setFKey(first ? PRODUCT_BY_KEY[first]!.formats[0]!.key : null)
      const u = (await supabase.auth.getUser()).data.user
      if (u) {
        setEmail(u.email ?? '')
        const { data: prof } = await (supabase.from as any)('profiles').select('full_name').eq('id', u.id).maybeSingle()
        if (prof?.full_name) setName(prof.full_name)
      }
      setLoading(false)
    })()
  }, [open, entryId, slug])

  const enabledProducts = useMemo(() => {
    const set = new Set(shop?.products ?? [])
    return PRINT_PRODUCTS.filter((p) => set.has(p.key))
  }, [shop])
  const product = pKey ? PRODUCT_BY_KEY[pKey] : null

  async function submit() {
    if (!product || !fKey) return
    if (name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error('Inserisci nome ed email validi'); return }
    setBusy(true)
    try {
      const fmt = product.formats.find((f) => f.key === fKey)
      const { data, error } = await supabase.functions.invoke('print-request', {
        body: {
          entryId, slug, photoDriveId: photo?.driveId, photoThumb: photo?.thumb,
          productKey: product.key, formatKey: fKey, productLabel: product.name, formatLabel: fmt?.label,
          name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim() || undefined, note: note.trim() || undefined,
        },
      })
      if (error || (data as any)?.error) throw new Error('Invio non riuscito')
      setDone(true)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-[rgb(var(--bg-elev))] rounded-t-3xl sm:rounded-3xl shadow-[var(--shadow-lift)] animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-3 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><Sparkles size={11} /> Stampe</span>
          <p className="font-medium text-sm flex-1">Ordina una stampa</p>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-full hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="py-20 grid place-items-center text-[rgb(var(--fg-muted))]"><Loader2 className="animate-spin" /></div>
        ) : !shop?.enabled || enabledProducts.length === 0 ? (
          <div className="py-16 px-6 text-center text-sm text-[rgb(var(--fg-muted))]">Le stampe non sono ancora disponibili per questa galleria.</div>
        ) : done ? (
          <div className="py-12 px-6 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-3" style={{ background: 'rgb(var(--gold-500))', color: '#fff' }}><Check size={28} /></span>
            <h3 className="font-display text-xl">Richiesta inviata!</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">{shop.pro_name ?? 'Il fotografo'} ti ricontatterà per la tua stampa <strong>{product?.name}</strong>{fKey ? ` · ${product?.formats.find((f) => f.key === fKey)?.label}` : ''}.</p>
            <Button variant="gold" className="mt-5 w-full" onClick={onClose}>Chiudi</Button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-5">
            {product && (
              <div className="pt-2">
                <Preview product={product} src={photo?.thumb} />
                <p className="text-center font-display text-lg mt-3">{product.name}</p>
                <p className="text-center text-xs text-[rgb(var(--fg-muted))] mt-0.5 px-4">{product.tagline}</p>
              </div>
            )}

            <div>
              <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mb-2">Prodotto</p>
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {enabledProducts.map((p) => (
                  <button key={p.key} onClick={() => { setPKey(p.key); setFKey(p.formats[0]!.key) }}
                    className={`shrink-0 rounded-2xl border p-2 w-20 text-center transition-colors ${pKey === p.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]/50' : 'border-[rgb(var(--border))]'}`}>
                    <span className="block h-10 w-full rounded-lg mb-1" style={{ background: `linear-gradient(135deg, ${p.accent[0]}, ${p.accent[1]})` }} />
                    <span className="text-[10px] leading-tight block">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {product && (
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[rgb(var(--fg-subtle))] mb-2">Formato (cm)</p>
                <div className="flex flex-wrap gap-2">
                  {product.formats.map((f) => (
                    <button key={f.key} onClick={() => setFKey(f.key)}
                      className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${fKey === f.key ? 'border-transparent text-white bg-[rgb(var(--gold-600))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>{f.label}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="La tua email" className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono / WhatsApp (facoltativo)" className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (facoltativo)" className="w-full rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2.5 text-sm" />
            </div>

            <Button variant="gold" className="w-full !py-3 text-base" disabled={busy} onClick={submit}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Invia richiesta
            </Button>
            <p className="text-center text-[11px] text-[rgb(var(--fg-subtle))]">Nessun pagamento ora: {shop.pro_name ?? 'il fotografo'} ti ricontatta per concludere.</p>
          </div>
        )}
      </div>
    </div>
  )
}
