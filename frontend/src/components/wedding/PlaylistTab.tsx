import { useState } from 'react'
import { Plus, Trash2, Music } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { usePlaylist, usePlaylistMutations } from '@/hooks/useWedding'

const MOMENTS = [
  { key: 'CERIMONIA',    label: 'Cerimonia' },
  { key: 'APERITIVO',    label: 'Aperitivo' },
  { key: 'CENA',         label: 'Cena' },
  { key: 'TAGLIO_TORTA', label: 'Taglio torta' },
  { key: 'PRIMA_DANZA',  label: 'Prima danza' },
  { key: 'FESTA',        label: 'Festa' },
]

export function PlaylistTab({ entryId }: { entryId: string }) {
  const { data: songs } = usePlaylist(entryId)
  const { add, update, remove } = usePlaylistMutations(entryId)
  const [draft, setDraft] = useState({ moment: 'CERIMONIA', song_title: '', artist: '', notes: '' })

  function songsOf(m: string) {
    return (songs ?? []).filter((s: any) => s.moment === m)
  }

  async function addSong() {
    if (!draft.song_title.trim()) return
    try {
      await add.mutateAsync({ ...draft, song_title: draft.song_title.trim() })
      setDraft({ moment: draft.moment, song_title: '', artist: '', notes: '' })
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Playlist musica</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Brani per ogni momento, condivisi con il musicista/DJ.</p>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <Select value={draft.moment} onChange={(e) => setDraft((d) => ({ ...d, moment: e.target.value }))}>
            {MOMENTS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Select>
          <Input className="sm:col-span-2" placeholder="Titolo brano" value={draft.song_title} onChange={(e) => setDraft((d) => ({ ...d, song_title: e.target.value }))} />
          <Input placeholder="Artista" value={draft.artist} onChange={(e) => setDraft((d) => ({ ...d, artist: e.target.value }))} />
          <Button variant="gold" onClick={addSong}><Plus size={14} /> Aggiungi</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {MOMENTS.map((m) => {
          const items = songsOf(m.key)
          if (items.length === 0) return null
          return (
            <Card key={m.key} className="overflow-hidden">
              <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgb(var(--border))' }}>
                <h3 className="font-display text-lg">{m.label}</h3>
                <span className="text-xs text-[rgb(var(--fg-subtle))]">{items.length} brani</span>
              </div>
              <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                {items.map((s: any) => (
                  <li key={s.id} className="px-5 py-3 flex items-center gap-3">
                    <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                      checked={s.done} onChange={(e) => update.mutate({ id: s.id, patch: { done: e.target.checked } })} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{s.song_title}</p>
                      {s.artist && <p className="text-xs text-[rgb(var(--fg-subtle))]">{s.artist}</p>}
                      {s.notes && <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">{s.notes}</p>}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 size={14} /></Button>
                  </li>
                ))}
              </ul>
            </Card>
          )
        })}
        {(songs ?? []).length === 0 && (
          <Card className="lg:col-span-2 p-10 text-center">
            <Music size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <p className="text-[rgb(var(--fg-muted))]">Playlist vuota.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
