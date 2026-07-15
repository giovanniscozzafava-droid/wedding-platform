export default function FinancePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-widest mb-6"
        style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
        COMING SOON
      </div>
      <h1 className="font-display text-4xl sm:text-5xl mb-3">Finanziamento matrimonio</h1>
      <p className="text-base text-[rgb(var(--fg-muted))] max-w-xl mx-auto leading-relaxed">
        Stiamo definendo l'accordo quadro con il partner finanziario per offrirti tassi dedicati e iter pratico digitalizzato. Sarà disponibile a breve.
      </p>
      <p className="text-xs text-[rgb(var(--fg-subtle))] mt-8">
        Nel frattempo, per consulenze su finanziamenti dedicati scrivici a <a href="mailto:hello@planfully.it" className="underline">hello@planfully.it</a>
      </p>
    </div>
  )
}
