import Image from 'next/image'
import { services } from '@/lib/data'

export function Gallery() {
  const photos = services.map((s) => ({ src: s.photo, alt: s.name }))
  return (
    <section id="galleria" className="py-24 bg-cream-2/40">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep mb-4">Galleria</p>
          <h2 className="font-display text-4xl md:text-5xl">Lavori recenti</h2>
          <div className="mt-6 w-16 h-px bg-gold-deep mx-auto" />
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 [&>*]:mb-4">
          {photos.map((p, i) => (
            <figure key={p.src} className="relative break-inside-avoid overflow-hidden rounded-xl bg-cream group">
              <Image
                src={p.src}
                alt={p.alt}
                width={600}
                height={i % 3 === 0 ? 800 : i % 3 === 1 ? 600 : 700}
                sizes="(max-width: 768px) 50vw, 25vw"
                className="w-full h-auto group-hover:scale-105 transition-transform duration-500"
              />
              <figcaption className="absolute inset-x-0 bottom-0 p-3 text-xs text-cream bg-gradient-to-t from-ink/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                {p.alt}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
