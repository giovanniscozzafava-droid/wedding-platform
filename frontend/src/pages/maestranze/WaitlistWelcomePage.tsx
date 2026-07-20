import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Share2, Check, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

export default function WaitlistWelcomePage() {
  const [params] = useSearchParams()
  const nome = params.get('nome') ?? ''
  const stato = params.get('stato') ?? 'inviata'
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.rpc('maestranze_waitlist_count')
      if (typeof data === 'number') setCount(data)
    })()
  }, [])

  const shareUrl = `${window.location.origin}/maestranze/lista-attesa?source=share`

  async function condividi() {
    const testo = 'Maestranze di Planfully: la bacheca dove chi lavora agli eventi si fa trovare. Apre dopo l’estate.'
    if (navigator.share) {
      try { await navigator.share({ title: 'Maestranze · Planfully', text: testo, url: shareUrl }); return } catch { /* annullato */ }
    }
    try {
      await navigator.clipboard.writeText(`${testo} ${shareUrl}`)
      toast.success('Link copiato: giralo a un collega.')
    } catch { toast.error('Non riesco a copiare il link.') }
  }

  const confermata = stato === 'confermata'

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <div className="max-w-md mx-auto px-5 py-16">
        <img src="/brand/planfully-logo.svg" alt="Planfully" className="h-7 mb-10" />

        {confermata ? (
          <>
            <div className="size-11 rounded-full grid place-items-center mb-6"
              style={{ background: 'rgb(var(--gold-500))' }}>
              <Check className="size-5" style={{ color: 'rgb(var(--bg))' }} />
            </div>
            <h1 className="font-display text-4xl leading-[1.1] tracking-tight mb-4" style={{ color: 'rgb(var(--fg))' }}>
              Fatto{nome ? `, ${nome.split(' ')[0]}` : ''}.<br />Sei in lista.
            </h1>
            <p className="text-[15px] leading-relaxed mb-2" style={{ color: 'rgb(var(--fg-muted))' }}>
              {count !== null && count > 0
                ? <>Sei tra i primi <strong style={{ color: 'rgb(var(--fg))' }}>{count}</strong> professionisti della bacheca Maestranze.</>
                : <>Sei tra i primi professionisti della bacheca Maestranze.</>}
            </p>
            <p className="text-[15px] leading-relaxed mb-10" style={{ color: 'rgb(var(--fg-muted))' }}>
              Dopo l’estate ricevi il link per attivare il tuo profilo completo. Ti scriviamo noi:
              non devi fare altro.
            </p>
          </>
        ) : (
          <>
            <div className="size-11 rounded-full grid place-items-center mb-6"
              style={{ background: 'rgb(var(--bg-sunken))' }}>
              <Mail className="size-5" style={{ color: 'rgb(var(--fg-muted))' }} />
            </div>
            <h1 className="font-display text-4xl leading-[1.1] tracking-tight mb-4" style={{ color: 'rgb(var(--fg))' }}>
              Controlla la posta.
            </h1>
            <p className="text-[15px] leading-relaxed mb-10" style={{ color: 'rgb(var(--fg-muted))' }}>
              {stato === 'no-email'
                ? <>Ti abbiamo registrato, ma l’email di conferma non è partita. Scrivici e ti confermiamo a mano — la tua iscrizione è salva.</>
                : <>Ti abbiamo mandato un’email: aprila e conferma il tuo indirizzo. Serve solo a essere sicuri di poterti raggiungere quando la bacheca apre. Se non la vedi, guarda nello spam.</>}
            </p>
          </>
        )}

        <div className="space-y-3">
          <button onClick={() => void condividi()}
            className="w-full h-12 rounded-lg text-base font-medium inline-flex items-center justify-center gap-2"
            style={{ background: '#25402F', color: '#FAF5EA' }}>
            <Share2 className="size-4" /> Condividi con un collega
          </button>
          <a href="https://instagram.com/planfully" target="_blank" rel="noreferrer"
            className="w-full h-12 rounded-lg border text-base inline-flex items-center justify-center"
            style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
            Segui @planfully
          </a>
        </div>

        <p className="text-[11px] leading-relaxed text-center mt-10" style={{ color: 'rgb(var(--fg-subtle))' }}>
          Planfully è una bacheca informativa, non un’agenzia per il lavoro. Nessuna commissione, mai.
        </p>
      </div>
    </div>
  )
}
