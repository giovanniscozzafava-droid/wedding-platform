import { Heart } from 'lucide-react'

export type LikedCard = { id: string; url: string; tags?: string[] }

// Galleria SOLA LETTURA degli stili scelti dal cliente nel gioco swipe.
// Mostra le foto preferite (dagli asset del fornitore) + i tag aggregati.
export function LikedStylesGallery({ cards, title = 'Stili scelti dal cliente' }: { cards: unknown; title?: string }) {
  const list = Array.isArray(cards) ? (cards as LikedCard[]).filter((c) => c && c.url) : []
  if (list.length === 0) return null
  const tags = Array.from(new Set(list.flatMap((c) => c.tags ?? [])))
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] p-4">
      <p className="text-sm font-medium flex items-center gap-1.5 mb-2"><Heart size={15} className="text-[rgb(var(--rose-500))]" /> {title} <span className="text-[rgb(var(--fg-subtle))] font-normal">({list.length})</span></p>
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
        {list.map((c) => (
          <a key={c.id} href={c.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-[rgb(var(--border))] hover:ring-2 hover:ring-[rgb(var(--gold-500))]" title={(c.tags ?? []).join(', ')}>
            <img src={c.url} alt="" className="w-full h-full object-cover" loading="lazy" />
          </a>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map((t) => <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">{t}</span>)}
        </div>
      )}
    </div>
  )
}
