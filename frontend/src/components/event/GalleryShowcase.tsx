import { useCallback, useEffect, useMemo, useState } from 'react'
import { X, Shuffle, LayoutGrid, ChevronLeft, ChevronRight, Heart } from '@/components/icons/lucide'
import { supabase } from '@/lib/supabase'
import { ShowcaseMusicControl } from '@/components/event/ShowcaseMusicControl'

export type ShowItem = { id: string; thumb: string; full: string }

// Vista "mostra galleria": mosaico a colonne (Pinterest-style). Modalità CASUAL = foto mischiate e
// rimescolabili; ORDINATA = come caricate. Click su una foto → lightbox a tutto schermo con frecce.
export function GalleryShowcase({ items, title, eventKind, canLike = false, onClose }:
  { items: ShowItem[]; title?: string; eventKind?: string | null; canLike?: boolean; onClose: () => void }) {
  const [casual, setCasual] = useState(true)
  const [seed, setSeed] = useState(1)
  const [box, setBox] = useState<number | null>(null)

  // I like degli sposi valgono come scelta per l'album (trigger trg_like_feeds_selection).
  // Li carico in UNA query per tutta la presentazione, non una per foto.
  const [uid, setUid] = useState<string | null>(null)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const ids = useMemo(() => items.map((i) => i.id), [items])

  const loadLikes = useCallback(async () => {
    if (!canLike || ids.length === 0) return
    const me = (await supabase.auth.getUser()).data.user?.id ?? null
    setUid(me)
    if (!me) return
    const { data } = await (supabase.from as any)('gallery_media_likes')
      .select('media_id').eq('user_id', me).in('media_id', ids.slice(0, 1000))
    setLiked(new Set(((data as { media_id: string }[]) ?? []).map((r) => r.media_id)))
  }, [canLike, ids])
  useEffect(() => { void loadLikes() }, [loadLikes])

  async function toggleLike(id: string) {
    if (!uid) return
    const on = liked.has(id)
    setLiked((s) => { const n = new Set(s); on ? n.delete(id) : n.add(id); return n })   // ottimistico
    const q = on
      ? (supabase.from as any)('gallery_media_likes').delete().eq('media_id', id).eq('user_id', uid)
      : (supabase.from as any)('gallery_media_likes').insert({ media_id: id, user_id: uid })
    const { error } = await q
    // supabase-js non lancia sugli errori Postgres: se non controllo, il cuore resta
    // acceso mentre la scelta non è stata salvata da nessuna parte.
    if (error) setLiked((s) => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n })
  }

  const ordered = useMemo(() => {
    if (!casual) return items
    const a = items.slice()
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]!; a[i] = a[j]!; a[j] = t }
    return a
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, casual, seed])

  const nav = (d: number) => setBox((b) => (b === null ? b : (b + d + ordered.length) % ordered.length))

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ background: '#0c0a09' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 text-white" style={{ background: 'rgba(12,10,9,.85)', backdropFilter: 'blur(8px)' }}>
        <span className="font-display text-lg">{title || 'Galleria'} <span className="text-white/45 text-sm">· {items.length} foto</span></span>
        <div className="flex items-center gap-2">
          {/* Musica di sottofondo: il carattere segue il tipo di evento. */}
          <ShowcaseMusicControl eventKind={eventKind} />
          <button onClick={() => setCasual((c) => !c)} className="text-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
            {casual ? <><Shuffle size={15} /> Casual</> : <><LayoutGrid size={15} /> Ordinata</>}
          </button>
          {casual && <button onClick={() => setSeed((s) => s + 1)} title="Rimescola" className="text-sm px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"><Shuffle size={15} /></button>}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition"><X size={20} /></button>
        </div>
      </div>

      <div className="p-3" style={{ columnGap: '8px', columnWidth: '230px' }}>
        {ordered.map((m, i) => (
          <div key={m.id + i} className="relative mb-2" style={{ breakInside: 'avoid' }}>
            <button onClick={() => setBox(i)} className="block w-full overflow-hidden rounded-lg group">
              <img src={m.thumb} loading="lazy" alt="" className="w-full block transition group-hover:opacity-90 group-hover:scale-[1.015]" />
            </button>
            {canLike && (
              <button type="button" onClick={() => void toggleLike(m.id)}
                title={liked.has(m.id) ? 'Tolgo dai preferiti' : 'Mi piace — va nella vostra selezione'}
                aria-label={liked.has(m.id) ? 'Togli il mi piace' : 'Metti mi piace'}
                className="absolute bottom-2 right-2 p-2 rounded-full bg-black/45 hover:bg-black/70 transition">
                <Heart size={17} className={liked.has(m.id) ? 'fill-rose-500 text-rose-500' : 'text-white/90'} />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-white/50 text-center py-20">Nessuna foto da mostrare.</p>}
      </div>

      {box !== null && (
        <div className="fixed inset-0 z-20 grid place-items-center" style={{ background: 'rgba(0,0,0,.95)' }} onClick={() => setBox(null)}>
          <img src={ordered[box]!.full} alt="" className="max-h-[92vh] max-w-[94vw] object-contain rounded" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setBox(null)}><X size={26} /></button>
          {canLike && (
            <button type="button" onClick={(e) => { e.stopPropagation(); void toggleLike(ordered[box]!.id) }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 hover:bg-black/70 transition text-white text-sm">
              <Heart size={18} className={liked.has(ordered[box]!.id) ? 'fill-rose-500 text-rose-500' : 'text-white/90'} />
              {liked.has(ordered[box]!.id) ? 'Nella vostra selezione' : 'Mi piace'}
            </button>
          )}
          <button className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); nav(-1) }}><ChevronLeft size={34} /></button>
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); nav(1) }}><ChevronRight size={34} /></button>
        </div>
      )}
    </div>
  )
}
