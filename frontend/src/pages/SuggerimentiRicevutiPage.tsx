import { Gift } from 'lucide-react'
import { SuggerimentiRicevutiList } from '@/components/rete/SuggerimentiRicevutiList'

// Pagina standalone (deep-link dalla notifica). Il grosso vive nel componente riusabile,
// che è anche innestato dentro "Richieste" (un suggerimento è di fatto una richiesta/lead).
export default function SuggerimentiRicevutiPage() {
  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-4xl px-4 sm:px-8 py-8">
        <div className="flex items-center gap-2 mb-1"><Gift size={22} className="text-[rgb(var(--gold-600))]" /><h1 className="font-display text-3xl sm:text-4xl">Suggerimenti ricevuti</h1></div>
        <p className="text-[rgb(var(--fg-muted))] mb-6">Eventi per cui un collega ti ha suggerito. Rispondi da qui: prepara la tua offerta o segnala che non sei disponibile. Se il suggerimento è "cieco" vedi solo i dettagli dell'evento e i contatti si sbloccano quando il cliente accetta; se è una segnalazione diretta i contatti sono già visibili.</p>
        <SuggerimentiRicevutiList />
      </div>
    </div>
  )
}
