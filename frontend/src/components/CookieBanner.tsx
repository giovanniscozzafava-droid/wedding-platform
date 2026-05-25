import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cookie } from 'lucide-react'

const KEY = 'planfully-cookie-consent-v1'

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
    <div className="fixed bottom-0 inset-x-0 z-[40] p-4 sm:p-6 pointer-events-none"
      style={{ background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 100%)' }}>
      <div className="max-w-3xl mx-auto rounded-2xl shadow-xl border p-4 sm:p-5 flex flex-col sm:flex-row gap-3 sm:items-center pointer-events-auto"
        style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--border))' }}>
        <Cookie size={28} className="shrink-0 text-[rgb(var(--gold-500))]" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Cookie & privacy</p>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
            Usiamo cookie tecnici essenziali per il funzionamento. Per analytics anonime click "Accetta tutto".
            Niente tracciamento pubblicitario. <Link to="/privacy" className="underline">Privacy</Link> · <Link to="/cookie" className="underline">Cookie</Link>
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => accept('essential')}
            className="px-3 py-2 rounded-md text-xs font-medium hover:bg-[rgb(var(--bg-sunken))]">
            Solo essenziali
          </button>
          <button onClick={() => accept('all')}
            className="px-4 py-2 rounded-md text-xs font-semibold"
            style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
            Accetta tutto
          </button>
        </div>
      </div>
    </div>
  )
}
