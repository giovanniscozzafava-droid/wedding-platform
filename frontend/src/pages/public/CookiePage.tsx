import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function CookiePage() {
  return (
    <div className="min-h-screen aurora py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] mb-6">
          <ArrowLeft size={14} /> Indietro
        </Link>
        <div className="surface surface-lift p-8 prose prose-sm max-w-none">
          <h1 className="font-display text-3xl mb-2">Cookie policy</h1>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mb-6">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>

          <h2 className="font-display text-xl mt-6 mb-2">Cookie utilizzati</h2>

          <h3 className="font-medium mt-4 mb-1">Tecnici (sempre attivi, non richiedono consenso)</h3>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li><code>sb-*</code> Supabase Auth (sessione utente)</li>
            <li><code>planfully-theme</code> tema chiaro/scuro</li>
            <li><code>planfully-cookie-consent-v1</code> ricorda la tua scelta sul banner</li>
          </ul>

          <h3 className="font-medium mt-4 mb-1">Analitici anonimi (consenso richiesto)</h3>
          <p className="text-sm leading-relaxed">
            Vercel Analytics, raccoglie metriche aggregate (pagine viste, paesi, dispositivi) senza identificare utenti.
            Nessun fingerprinting, nessuna profilazione pubblicitaria.
          </p>

          <h2 className="font-display text-xl mt-6 mb-2">Come gestire le preferenze</h2>
          <p className="text-sm leading-relaxed">
            Puoi modificare le tue scelte cancellando il cookie <code>planfully-cookie-consent-v1</code> dal tuo browser
            e ricaricando la pagina, oppure usando le impostazioni privacy del browser.
          </p>
        </div>
      </div>
    </div>
  )
}
