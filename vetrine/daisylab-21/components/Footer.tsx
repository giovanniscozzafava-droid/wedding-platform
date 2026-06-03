import { brand } from '@/lib/data'

export function Footer() {
  return (
    <footer className="border-t border-ink/10 bg-cream-2/30">
      <div className="mx-auto max-w-6xl px-6 py-12 grid sm:grid-cols-3 gap-8 text-sm">
        <div>
          <p className="font-display text-xl">{brand.name}</p>
          <p className="mt-2 text-ink-soft">{brand.tagline}</p>
          <p className="mt-4 text-ink-soft">{brand.owner} · {brand.city}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-soft mb-3">Link</p>
          <ul className="space-y-2">
            <li><a href={brand.links.website} target="_blank" rel="noopener" className="hover:text-gold-deep">Sito ufficiale</a></li>
            <li><a href={brand.links.instagram} target="_blank" rel="noopener" className="hover:text-gold-deep">Instagram</a></li>
            <li><a href={brand.links.planfully} target="_blank" rel="noopener" className="hover:text-gold-deep">Profilo Planfully</a></li>
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-soft mb-3">Network</p>
          <p className="text-ink-soft">
            Profilo pubblico verificato da <a href="https://planfully.it" className="underline decoration-gold-deep underline-offset-4">Planfully</a>,
            il network del settore eventi italiani.
          </p>
        </div>
      </div>
      <div className="border-t border-ink/10 py-5 text-center text-xs text-ink-soft">
        &copy; {new Date().getFullYear()} {brand.name} · Tutti i diritti riservati
      </div>
    </footer>
  )
}
