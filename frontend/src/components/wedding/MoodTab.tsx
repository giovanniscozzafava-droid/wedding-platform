import { useState } from 'react'
import { Trash2, Search, Link as LinkIcon, ImageIcon, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useMood, useMoodMutations } from '@/hooks/useWedding'

const TAGS = ['vestito', 'fiori', 'location', 'torta', 'allestimento', 'altro']

export function MoodTab({ entryId }: { entryId: string }) {
  const { data: images } = useMood(entryId)
  const { add, remove } = useMoodMutations(entryId)
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('fiori')
  const [results, setResults] = useState<Array<{ src: { medium: string; large: string } }>>([])
  const [busy, setBusy] = useState(false)
  const [pinUrl, setPinUrl] = useState('')
  const [pinBusy, setPinBusy] = useState(false)
  const [mode, setMode] = useState<'pexels' | 'pinterest'>('pexels')
  const [exporting, setExporting] = useState(false)

  async function exportMoodboardPdf() {
    if (!images || images.length === 0) { toast.error('Aggiungi almeno una foto prima di esportare'); return }
    setExporting(true)
    try {
      const { data, error } = await supabase.functions.invoke('moodboard-pdf', { body: { entry_id: entryId } })
      if (error) throw error
      const url = (data as any)?.url
      if (!url) throw new Error('URL PDF non generato')
      window.open(url, '_blank')
      toast.success(`PDF moodboard generato (${(data as any).count} immagini)`)
    } catch (e) { toast.error((e as Error).message) }
    finally { setExporting(false) }
  }

  async function searchPexels() {
    if (!search.trim()) return
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        photos?: Array<{ id: number; src: { medium: string; large: string }; alt?: string }>
        error?: string
        hint?: string
        status?: number
      }>('pexels-search', { body: { query: search, per_page: 12, orientation: 'landscape' } })
      if (error) throw error
      if (!data?.ok) {
        if (data?.error === 'no_pexels_key') {
          toast.error('Pexels non configurato. Contatta l\'admin per attivare la chiave (gratuita).')
        } else {
          throw new Error(data?.hint ?? data?.error ?? 'Pexels non risponde')
        }
        return
      }
      setResults((data.photos ?? []) as any)
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function pickPhoto(url: string) {
    try { await add.mutateAsync({ url, source: 'pexels', tag, ord: (images?.length ?? 0) }); toast.success('Aggiunto al mood') }
    catch (e) { toast.error((e as Error).message) }
  }

  async function importFromUrl() {
    const trimmed = pinUrl.trim()
    if (!trimmed) return
    if (!/^https?:\/\//i.test(trimmed)) { toast.error('URL deve iniziare con http:// o https://'); return }
    setPinBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('import-pin-url', { body: { url: trimmed } })
      if (error) throw error
      const j = data as { image?: string; title?: string; source_url?: string; error?: string }
      if (j?.error || !j?.image) throw new Error(j?.error ?? 'Nessuna immagine trovata')
      await add.mutateAsync({
        url: j.image, source: 'pinterest', tag,
        source_url: j.source_url ?? pinUrl,
        source_title: j.title ?? null,
        caption: j.title ?? null,
        ord: (images?.length ?? 0),
      })
      setPinUrl('')
      toast.success('Importato da Pinterest')
    } catch (e) { toast.error((e as Error).message) }
    finally { setPinBusy(false) }
  }

  return (
    <div>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Mood board</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Pexels per stock, oppure incolla qualsiasi URL (Pinterest, Instagram, blog) per importare l'immagine.</p>
        </div>
        <Button variant="gold" onClick={exportMoodboardPdf} disabled={exporting || !images || images.length === 0}>
          <FileDown size={14} /> {exporting ? 'Genero PDF...' : 'Esporta PDF editoriale'}
        </Button>
      </header>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setMode('pexels')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mode === 'pexels' ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>
          <ImageIcon size={12} className="inline mr-1" /> Pexels
        </button>
        <button onClick={() => setMode('pinterest')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${mode === 'pinterest' ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>
          <LinkIcon size={12} className="inline mr-1" /> Importa da URL
        </button>
      </div>

      <Card className="p-4 mb-6">
        {mode === 'pexels' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="sm:col-span-2 relative">
                <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                <Input className="pl-8" placeholder="https://pinterest.com/pin/... o pin.it/..."
                  value={pinUrl} onChange={(e) => setPinUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && importFromUrl()} />
              </div>
              <Select value={tag} onChange={(e) => setTag(e.target.value)}>
                {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Button variant="gold" onClick={importFromUrl} disabled={pinBusy}>
                {pinBusy ? 'Importo...' : 'Importa'}
              </Button>
            </div>
            <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">
              Suggerimento: apri il pin su Pinterest, clicca "Condividi → Copia link", poi incolla qui.
              Funziona anche con link diretti a immagini.
            </p>
          </>
        )}
      </Card>

      <h3 className="font-display text-lg mb-3">Board ({images?.length ?? 0})</h3>
      {(images ?? []).length === 0 ? (
        <Card className="p-10 text-center"><p className="text-[rgb(var(--fg-muted))]">Mood board vuoto. Cerca su Pexels o incolla un URL per iniziare.</p></Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {(images ?? []).map((m: any) => (
            <Card key={m.id} className="relative overflow-hidden group">
              <img src={m.url} alt={m.caption ?? ''} className="aspect-square w-full object-cover" />
              <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/60 text-white">{m.tag}</span>
              {m.source === 'pinterest' && (
                <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[rgb(var(--rose-500))] text-white">Pin</span>
              )}
              <button onClick={() => remove.mutate(m.id)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center">
                <Trash2 size={12} />
              </button>
              {m.source_url && (
                <a href={m.source_url} target="_blank" rel="noreferrer"
                  className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center"
                  title="Apri sorgente">
                  <LinkIcon size={12} />
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
