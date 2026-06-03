import Image from 'next/image'
import { brand } from '@/lib/data'

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-cream-2 via-cream to-cream" />
      <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-sage/20 blur-3xl -z-10" />
      <div className="absolute bottom-10 -right-20 w-96 h-96 rounded-full bg-gold/20 blur-3xl -z-10" />

      <div className="mx-auto max-w-6xl px-6 pt-24 pb-32 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <p className="font-script text-gold-deep text-3xl leading-none mb-4">fatto a mano</p>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.05] tracking-tight">
            {brand.name}
          </h1>
          <p className="mt-4 text-xl text-ink-soft uppercase tracking-[0.2em]">{brand.tagline}</p>
          <p className="mt-8 text-lg leading-relaxed text-ink-soft max-w-lg">{brand.bio}</p>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#servizi" className="btn btn-primary">Scopri i servizi</a>
            <a href="#contatti" className="btn btn-outline">Richiedi preventivo</a>
          </div>

          <dl className="mt-12 grid grid-cols-3 gap-6 max-w-md">
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-soft">Sede</dt>
              <dd className="mt-1 font-display text-lg">{brand.city}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-soft">Esperienza</dt>
              <dd className="mt-1 font-display text-lg">{brand.yearsActive}+ anni</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-soft">Servizio</dt>
              <dd className="mt-1 font-display text-lg">Italia</dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <div className="aspect-square relative rounded-[40%_60%_60%_40%/50%_50%_50%_50%] overflow-hidden bg-cream-2 shadow-2xl shadow-ink/10">
            <Image
              src={brand.logo}
              alt={brand.name}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain p-12"
            />
          </div>
          <div className="absolute -bottom-6 -right-6 bg-cream rounded-2xl shadow-xl shadow-ink/10 p-5 max-w-xs border border-ink/5">
            <p className="font-script text-3xl text-gold-deep leading-none">Elisabetta</p>
            <p className="text-sm text-ink-soft mt-1">la mano dietro DaisyLab_21</p>
          </div>
        </div>
      </div>
    </section>
  )
}
