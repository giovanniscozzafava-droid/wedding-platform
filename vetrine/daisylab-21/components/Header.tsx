import Image from 'next/image'
import { brand } from '@/lib/data'

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-cream/80 border-b border-ink/5">
      <nav className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          <Image src={brand.logo} alt={brand.name} width={40} height={40} className="rounded-full object-contain bg-cream-2 p-1" />
          <span className="font-display text-xl tracking-tight">{brand.name}</span>
        </a>
        <ul className="hidden md:flex items-center gap-8 text-sm">
          <li><a href="#chi-sono" className="hover:text-gold-deep">Chi sono</a></li>
          <li><a href="#servizi" className="hover:text-gold-deep">Servizi</a></li>
          <li><a href="#galleria" className="hover:text-gold-deep">Galleria</a></li>
          <li><a href="#contatti" className="hover:text-gold-deep">Contatti</a></li>
        </ul>
        <a href="#contatti" className="btn btn-primary text-sm py-2 px-5">Scrivimi</a>
      </nav>
    </header>
  )
}
