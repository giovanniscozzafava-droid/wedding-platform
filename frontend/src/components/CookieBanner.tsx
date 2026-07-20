import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const KEY = 'planfully-cookie-consent-v1'

// Brand "filiera": carta / inchiostro / cipresso, lacca sull'azione. Filetti, niente
// card arrotondate. Colori fissi (non le CSS var oro dell'app): il cookie banner deve
// avere lo stesso registro ovunque compaia.
const CARTA = '#F4F3EE'
const INCHIOSTRO = '#181F1B'
const CIPRESSO = '#25402F'
const LACCA = '#C03B2A'

export function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (!localStorage.getItem(KEY)) setShow(true)
    } catch { /* */ }
  }, [])

  function accept(level: 'all' | 'essential') {
    try { localStorage.setItem(KEY, JSON.stringify({ level, at: Date.now() })) } catch { /* */ }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 inset-x-0 z-[40] p-4 sm:p-6 pointer-events-none">
      <div className="max-w-3xl mx-auto p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center pointer-events-auto"
        style={{ background: CARTA, border: `1px solid ${INCHIOSTRO}` }}>
        <div className="flex-1 text-sm" style={{ color: INCHIOSTRO }}>
          <p style={{ fontWeight: 500, letterSpacing: '0.02em' }}>Cookie &amp; privacy</p>
          <p className="text-xs mt-1" style={{ color: CIPRESSO }}>
            Usiamo cookie tecnici essenziali per il funzionamento. Per analytics anonime clicca «Accetta tutto».
            Niente tracciamento pubblicitario.{' '}
            <Link to="/privacy" className="underline" style={{ color: CIPRESSO }}>Privacy</Link> ·{' '}
            <Link to="/cookie" className="underline" style={{ color: CIPRESSO }}>Cookie</Link>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => accept('essential')}
            className="px-4 py-2 text-xs"
            style={{ color: INCHIOSTRO, border: `1px solid ${INCHIOSTRO}`, background: 'transparent' }}>
            Solo essenziali
          </button>
          <button onClick={() => accept('all')}
            className="px-4 py-2 text-xs"
            style={{ background: LACCA, color: CARTA, fontWeight: 500 }}>
            Accetta tutto
          </button>
        </div>
      </div>
    </div>
  )
}
