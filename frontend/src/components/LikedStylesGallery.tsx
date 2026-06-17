import { Heart } from 'lucide-react'

export type LikedCard = { id: string; url: string; tags?: string[] }

// Galleria SOLA LETTURA degli stili scelti dal cliente nel gioco swipe.
// Mostra le foto preferite (dagli asset del fornitore) + i tag aggregati.
export function LikedStylesGallery({ cards, tags: rankedTags, title = 'Stili scelti dal cliente' }: { cards: unknown; tags?: unknown; title?: string }) {
  const list = Array.isArray(cards) ? (cards as LikedCard[]).filter((c) => c && c.url) : []
  if (list.length === 0) return null
  // tag del verdetto (già ordinati dal matching) se forniti, altrimenti unione dai finalisti
  const tags = Array.isArray(rankedTags) && rankedTags.length > 0
    ? (rankedTags as string[])
    : Array.from(new Set(list.flatMap((c) => c.tags ?? [])))
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] p-4">
      <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Heart size={15} className="text-[rgb(var(--rose-500))]" /> {title} <span className="text-[rgb(var(--fg-subtle))] font-normal">({list.length})</span></p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {list.map((c) => (
          <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="flex items-center justify-center aspect-square rounded-lg overflow-hidden border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] hover:ring-2 hover:ring-[rgb(var(--gold-500))]" title={(c.tags ?? []).join(', ')}>
            <img src={c.url} alt="" className="max-w-full max-h-full object-contain" loading="lazy" />
          </a>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] text-[rgb(var(--fg-subtle))] mb-1">Stile del cliente (in ordine di preferenza)</p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t, i) => <span key={t} className={`text-[11px] px-2 py-0.5 rounded-full ${i === 0 ? 'bg-[rgb(var(--gold-500))] text-white font-medium' : 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]'}`}>{t}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
