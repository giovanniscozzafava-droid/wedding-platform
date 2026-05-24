export default function InsurancePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
      <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-widest mb-6"
        style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
        ✨ COMING SOON
      </div>
      <h1 className="font-display text-4xl sm:text-5xl mb-3">Assicurazione matrimonio</h1>
      <p className="text-base text-[rgb(var(--fg-muted))] max-w-xl mx-auto leading-relaxed">
        Stiamo finalizzando l'accordo esclusivo con la compagnia per la polizza dedicata: annullamento evento, maltempo, RC ospiti. Arriva presto.
      </p>
      <p className="text-xs text-[rgb(var(--fg-subtle))] mt-8">
        Per consulenze su polizze specifiche scrivici a <a href="mailto:hello@planfully.it" className="underline">hello@planfully.it</a>
      </p>
    </div>
  )
}
