import { Link } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'

// Atterraggio pubblico dopo la Stripe Checkout (success_url / cancel_url di payment-create).
// Nessun dato sensibile: lo stato reale del pagamento lo scrive il webhook sul ledger.
export default function PaymentResultPage({ ok = false }: { ok?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F4EE] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        {ok ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            <h1 className="mt-4 font-serif text-2xl text-[#1A1714]">Pagamento ricevuto</h1>
            <p className="mt-2 text-sm text-[#6B6358]">Grazie. Il professionista è stato avvisato: riceverai conferma a breve.</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-14 w-14 text-[#B08D57]" />
            <h1 className="mt-4 font-serif text-2xl text-[#1A1714]">Pagamento annullato</h1>
            <p className="mt-2 text-sm text-[#6B6358]">Nessun addebito è stato effettuato. Puoi riprovare dal link ricevuto quando vuoi.</p>
          </>
        )}
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-[#1A2E4F] underline">Torna a Planfully</Link>
      </div>
    </div>
  )
}
