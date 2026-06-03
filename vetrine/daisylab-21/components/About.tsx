import { brand } from '@/lib/data'

export function About() {
  return (
    <section id="chi-sono" className="py-24 bg-cream-2/40">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-gold-deep mb-4">Chi sono</p>
        <h2 className="font-display text-4xl md:text-5xl">Ogni pezzo nasce dalle mie mani</h2>
        <div className="mt-8 w-16 h-px bg-gold-deep mx-auto" />
        <p className="mt-8 text-lg leading-relaxed text-ink-soft">
          Sono <strong className="text-ink">Elisabetta Citraro</strong>, fondatrice di DaisyLab_21.
          Dalla mia bottega a {brand.city} disegno, stampo e rilego ogni elemento del coordinato grafico
          del tuo matrimonio: partecipazioni, libretti messa, tableau, segnaposti, bomboniere.
        </p>
        <p className="mt-6 text-lg leading-relaxed text-ink-soft">
          Lavoro con calligrafia manuale, acquerelli su carta martellata 300 gr e stampe pregiate.
          Niente template seriali: ogni progetto inizia da un confronto con la coppia e finisce con un coordinato
          che racconta solo la vostra storia.
        </p>
      </div>
    </section>
  )
}
