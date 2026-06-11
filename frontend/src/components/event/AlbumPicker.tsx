import { useMemo, useState } from 'react'
import { Heart, X, Undo2, RotateCcw, Check, Play, Images } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// Selezione album "a la Tinder": una media alla volta, Tieni/Scarta, con Annulla e
// tab per rivedere Tenute/Scarti e RECUPERARE gli scarti. Foto e video.

export type AlbumMedia = { id: string; thumbnail_link: string | null; drive_file_id: string; media_type: string; album_choice: 'KEPT' | 'DISCARDED' | null }

const isDrive = (m: AlbumMedia) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-')
const big = (m: AlbumMedia) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

export function AlbumPicker({ media, onClose, onChanged }: { media: AlbumMedia[]; onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<AlbumMedia[]>(media)
  const [view, setView] = useState<'deck' | 'KEPT' | 'DISCARDED'>('deck')
  const [history, setHistory] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const pending = useMemo(() => items.filter((m) => m.album_choice == null), [items])
  const kept = useMemo(() => items.filter((m) => m.album_choice === 'KEPT'), [items])
  const discarded = useMemo(() => items.filter((m) => m.album_choice === 'DISCARDED'), [items])

  async function setChoice(id: string, choice: 'KEPT' | 'DISCARDED' | null, track = true) {
    setBusy(true)
    setItems((arr) => arr.map((m) => (m.id === id ? { ...m, album_choice: choice } : m)))
    if (track) setHistory((h) => [...h, id])
    const { data } = await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: { error?: string } }> })
      .rpc('set_album_choice', { p_media: id, p_choice: choice })
    setBusy(false)
    if (data?.error) { toast.error('Non salvato: ' + data.error); setItems(media); return }
    onChanged()
  }

  function undo() {
    const last = history[history.length - 1]
    if (!last) return
    setHistory((h) => h.slice(0, -1))
    void setChoice(last, null, false)
  }

  const cur = pending[0]
  const Tab = ({ id, label, n }: { id: typeof view; label: string; n: number }) => (
    <button onClick={() => setView(id)}
      className={`px-3 py-1.5 rounded-full text-xs font-medium ${view === id ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>
      {label} {n}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Tab id="deck" label="Da scegliere" n={pending.length} />
          <Tab id="KEPT" label="Tenute" n={kept.length} />
          <Tab id="DISCARDED" label="Scarti" n={discarded.length} />
        </div>
        <button className="p-1.5 rounded hover:bg-white/10" onClick={onClose} aria-label="Chiudi"><X size={18} className="text-white" /></button>
      </div>

      {view === 'deck' ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 min-h-0 gap-4" onClick={(e) => e.stopPropagation()}>
          {!cur ? (
            <div className="text-center text-white/80 space-y-2">
              <Check size={36} className="mx-auto text-[rgb(var(--gold-400))]" />
              <p className="text-sm">Hai scelto tutte le foto. {kept.length} tenute, {discarded.length} scartate.</p>
              <Button variant="gold" size="sm" onClick={onClose}>Fine</Button>
            </div>
          ) : (
            <>
              <div className="relative max-w-md w-full" style={{ aspectRatio: '3/4' }}>
                <img src={big(cur)} alt="" className="w-full h-full object-cover rounded-2xl shadow-2xl select-none" />
                {cur.media_type === 'VIDEO' && <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-black/55 text-white text-[11px] px-2 py-1 rounded-full"><Play size={11} className="fill-white" /> video</span>}
              </div>
              <div className="flex items-center gap-4">
                <button disabled={busy} onClick={() => setChoice(cur.id, 'DISCARDED')}
                  className="h-14 w-14 rounded-full bg-white text-[rgb(var(--rose-600,220_60_60))] shadow-lg flex items-center justify-center hover:scale-105 transition disabled:opacity-50" aria-label="Scarta">
                  <X size={26} className="text-rose-500" />
                </button>
                <button disabled={history.length === 0 || busy} onClick={undo}
                  className="h-11 w-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition disabled:opacity-30" aria-label="Annulla">
                  <Undo2 size={18} />
                </button>
                <button disabled={busy} onClick={() => setChoice(cur.id, 'KEPT')}
                  className="h-14 w-14 rounded-full bg-[rgb(var(--gold-500))] text-white shadow-lg flex items-center justify-center hover:scale-105 transition disabled:opacity-50" aria-label="Tieni">
                  <Heart size={24} className="fill-white" />
                </button>
              </div>
              <p className="text-white/50 text-xs">Restano {pending.length}</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6 min-h-0" onClick={(e) => e.stopPropagation()}>
          {(view === 'KEPT' ? kept : discarded).length === 0 ? (
            <p className="text-white/60 text-sm text-center py-12 flex flex-col items-center gap-2"><Images size={28} /> {view === 'KEPT' ? 'Niente di tenuto ancora.' : 'Nessuno scarto.'}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-w-3xl mx-auto">
              {(view === 'KEPT' ? kept : discarded).map((m) => (
                <div key={m.id} className="relative rounded-md overflow-hidden bg-white/5" style={{ aspectRatio: '4/3' }}>
                  {m.thumbnail_link && <img src={m.thumbnail_link} alt="" className="w-full h-full object-cover" loading="lazy" />}
                  <button onClick={() => setChoice(m.id, view === 'KEPT' ? 'DISCARDED' : 'KEPT')}
                    className="absolute inset-0 bg-black/0 hover:bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition text-white text-[11px] gap-1">
                    {view === 'KEPT' ? <><X size={14} /> scarta</> : <><RotateCcw size={14} /> recupera</>}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
