import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen aurora py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] mb-6">
          <ArrowLeft size={14} /> Indietro
        </Link>
        <div className="surface surface-lift p-8 prose prose-sm max-w-none">
          <h1 className="font-display text-3xl mb-2">Informativa sulla privacy</h1>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mb-6">Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT')}</p>

          <h2 className="font-display text-xl mt-6 mb-2">Titolare del trattamento</h2>
          <p className="text-sm leading-relaxed">
            Planfully — Italia. Per esercitare i tuoi diritti scrivi a <a href="mailto:privacy@planfully.it" className="underline">privacy@planfully.it</a>.
          </p>

          <h2 className="font-display text-xl mt-6 mb-2">Dati raccolti</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li><strong>Account</strong>: nome, email, password (crittografata), ruolo, telefono opzionale</li>
            <li><strong>Fornitori</strong>: P.IVA, codice fiscale, indirizzo, bio, foto servizi, social</li>
            <li><strong>Eventi</strong>: dati cliente (nome, email), date, location, preventivi</li>
            <li><strong>Invitati</strong>: nome, email opzionale, dieta, RSVP — inseriti dal wedding planner</li>
            <li><strong>Cookie</strong>: solo essenziali. Analytics anonime con consenso esplicito</li>
          </ul>

          <h2 className="font-display text-xl mt-6 mb-2">Finalità</h2>
          <p className="text-sm leading-relaxed">
            I dati sono trattati esclusivamente per fornire i servizi richiesti: gestione matrimoni, preventivi,
            invio comunicazioni transazionali (mai marketing senza consenso).
          </p>

          <h2 className="font-display text-xl mt-6 mb-2">Base giuridica</h2>
          <p className="text-sm leading-relaxed">
            Esecuzione del contratto (art. 6.1.b GDPR) e legittimo interesse del professionista a gestire i clienti.
            Per gli invitati: legittimo interesse del wedding planner (art. 6.1.f) — l'invitato può richiedere cancellazione in qualsiasi momento.
          </p>

          <h2 className="font-display text-xl mt-6 mb-2">Conservazione</h2>
          <p className="text-sm leading-relaxed">
            I dati sono conservati per la durata del servizio + 10 anni (obblighi fiscali italiani).
            Account cancellati: dati rimossi entro 30 giorni dalla richiesta, salvo obblighi di legge.
          </p>

          <h2 className="font-display text-xl mt-6 mb-2">I tuoi diritti</h2>
          <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
            <li><strong>Accesso, rettifica, portabilità</strong>: contatta privacy@planfully.it</li>
            <li><strong>Cancellazione</strong>: dal tuo Profilo → bottone "Richiedi cancellazione account"</li>
            <li><strong>Opposizione e limitazione</strong>: scrivici per qualsiasi richiesta</li>
            <li><strong>Reclamo</strong>: puoi presentare reclamo al Garante privacy (garanteprivacy.it)</li>
          </ul>

          <h2 className="font-display text-xl mt-6 mb-2">Trasferimenti extra UE</h2>
          <p className="text-sm leading-relaxed">
            Servizi infrastrutturali (Supabase, Vercel, AWS SES) possono trattare dati in UE/USA con clausole contrattuali standard.
          </p>

          <h2 className="font-display text-xl mt-6 mb-2">Sicurezza</h2>
          <p className="text-sm leading-relaxed">
            HTTPS ovunque, password crittografate, Row Level Security sul database, isolamento dei dati per account.
          </p>
        </div>
      </div>
    </div>
  )
}
