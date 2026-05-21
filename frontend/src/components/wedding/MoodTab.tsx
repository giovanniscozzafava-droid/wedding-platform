import { useState } from 'react'
import { Trash2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useMood, useMoodMutations } from '@/hooks/useWedding'

const TAGS = ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro']

export function MoodTab({ entryId }: { entryId: string }) {
  const { data: images } = useMood(entryId)
  const { add, remove } = useMoodMutations(entryId)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('fiori')
  const [results, setResults] = useState<Array<{ src: { medium: string; large: string } }>>([])
  const [busy, setBusy] = useState(false)

  async function searchPexels() {
    if (!search.trim()) return
    setBusy(true)
    try {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(search)}&per_page=12&orientation=landscape`, {
        headers: { Authorization: import.meta.env.VITE_PEXELS_KEY ?? '' },
      })
      if (!r.ok) throw new Error('Pexels: ' + r.status)
      const j = await r.json()
      setResults(j.photos ?? [])
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function pickPhoto(url: string) {
    try { await add.mutateAsync({ url, source: 'pexels', tag, ord: (images?.length ?? 0) }); toast.success('Aggiunto al mood') }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Mood board</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Cerca su Pexels e aggiungi reference per ispirazione cliente/fornitori.</p>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <div className="sm:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input className="pl-8" placeholder="Es. peonie bianche bouquet..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchPexels()} />
          </div>
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Button variant="gold" onClick={searchPexels} disabled={busy}>
            {busy ? 'Cerco...' : 'Cerca su Pexels'}
          </Button>
        </div>
        {results.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
            {results.map((p, i) => (
              <button key={i} onClick={() => pickPhoto(p.src.large)}
                className="aspect-square rounded-md overflow-hidden bg-[rgb(var(--bg-sunken))] hover:ring-2 hover:ring-[rgb(var(--gold-500))]">
                <img src={p.src.medium} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </Card>

      <h3 className="font-display text-lg mb-3">Board ({images?.length ?? 0})</h3>
      {(images ?? []).length === 0 ? (
        <Card className="p-10 text-center"><p className="text-[rgb(var(--fg-muted))]">Mood board vuoto. Cerca su Pexels per iniziare.</p></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(images ?? []).map((m: any) => (
            <Card key={m.id} className="relative overflow-hidden group">
              <img src={m.url} alt={m.caption ?? ''} className="aspect-square w-full object-cover" />
              <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white">{m.tag}</span>
              <button onClick={() => remove.mutate(m.id)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <Trash2 size={12} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
