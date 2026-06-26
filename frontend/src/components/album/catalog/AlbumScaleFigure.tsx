// Rappresentazione di scala con FOTO reali (generate): una donna che tiene un album,
// scelta in base alla grandezza del formato, così il cliente capisce la dimensione reale.
const BUCKETS = [
  { max: 20, src: '/album-scale/small.webp', tag: 'piccolo' },
  { max: 33, src: '/album-scale/medium.webp', tag: 'medio' },
  { max: Infinity, src: '/album-scale/large.webp', tag: 'grande' },
]

export function AlbumScaleFigure({ wCm, hCm, sizeLabel }: { wCm: number; hCm: number; sizeLabel?: string }) {
  const long = Math.max(wCm, hCm)
  const b = BUCKETS.find((x) => long <= x.max) ?? BUCKETS[2]!

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[230px] overflow-hidden rounded-2xl border border-[rgb(var(--border))] shadow-[0_10px_30px_rgba(20,18,14,.16)]">
        <img src={b.src} alt={`Album ${b.tag} tenuto in mano`} className="block w-full h-auto" loading="lazy" />
        <span className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full text-[11px] font-medium bg-black/55 text-white backdrop-blur whitespace-nowrap">
          Grandezza reale{sizeLabel ? ` · ${sizeLabel}` : ''}
        </span>
      </div>
      <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-1.5">Per dare un'idea della dimensione in mano</p>
    </div>
  )
}
