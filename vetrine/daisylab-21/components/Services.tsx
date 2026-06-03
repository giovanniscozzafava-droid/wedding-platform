import Image from 'next/image'
import { services } from '@/lib/data'

const fmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })

export function Services() {
  return (
    <section id="servizi" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-16">
          <p className="text-xs uppercase tracking-[0.3em] text-gold-deep mb-4">Listino</p>
          <h2 className="font-display text-4xl md:text-5xl">14 servizi su misura</h2>
          <div className="mt-6 w-16 h-px bg-gold-deep mx-auto" />
          <p className="mt-6 text-ink-soft max-w-2xl mx-auto">
            Prezzi indicativi di partenza. Ogni progetto è quotato sul brief, materiali scelti e quantità ospiti.
          </p>
        </div>

        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {services.map((s) => (
            <li key={s.id} className="group bg-cream rounded-2xl overflow-hidden border border-ink/5 hover:shadow-xl hover:shadow-ink/5 transition-shadow">
              <div className="relative aspect-[4/5] overflow-hidden bg-cream-2">
                <Image
                  src={s.photo}
                  alt={s.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <span className="absolute top-3 left-3 text-[10px] uppercase tracking-widest bg-cream/95 backdrop-blur px-3 py-1 rounded-full">
                  {s.category}
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-display text-2xl leading-tight">{s.name}</h3>
                <p className="mt-3 text-sm text-ink-soft line-clamp-3">{s.description}</p>
                <div className="mt-5 pt-5 border-t border-ink/10 flex items-baseline justify-between">
                  <span className="text-xs uppercase tracking-wider text-ink-soft">da</span>
                  <span className="font-display text-2xl text-gold-deep">
                    {fmt.format(s.basePrice)}
                    <span className="text-sm text-ink-soft ml-1">/ {s.unit.toLowerCase()}</span>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
