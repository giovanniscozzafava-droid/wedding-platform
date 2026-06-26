import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Smartphone } from 'lucide-react'

// Invito esperienziale a girare/allargare lo schermo: overlay a tutto schermo con sfondo scurito
// e un telefono animato che ruota. Compare su device stretto/in verticale; sparisce da solo quando
// si ruota in orizzontale. `when` = condizione specifica (es. il catalogo PDF è orizzontale).
export function RotateScreenGate({ when = true, title = 'Gira lo schermo', subtitle }: { when?: boolean; title?: string; subtitle?: string }) {
  const portraitNow = () => (typeof window !== 'undefined' ? window.innerHeight > window.innerWidth && window.innerWidth < 820 : false)
  const [portrait, setPortrait] = useState(portraitNow)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const on = () => {
      const p = portraitNow()
      setPortrait(p)
      if (!p) setDismissed(false) // tornato orizzontale → reset, così riappare se rigira in verticale
    }
    window.addEventListener('resize', on)
    window.addEventListener('orientationchange', on)
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on) }
  }, [])

  if (!when || !portrait || dismissed) return null

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-6">
      <div className="text-center max-w-xs">
        <motion.div className="mx-auto mb-6 inline-flex text-white"
          animate={{ rotate: [0, 0, -90, -90, 0] }}
          transition={{ duration: 2.6, times: [0, 0.18, 0.5, 0.8, 1], repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}>
          <Smartphone size={72} strokeWidth={1.4} />
        </motion.div>
        <h2 className="text-white font-display text-2xl leading-tight">{title}</h2>
        <p className="text-white/70 text-sm mt-2.5">{subtitle ?? 'Ruota il telefono in orizzontale (o allarga la finestra) per un’esperienza migliore.'}</p>
        <button onClick={() => setDismissed(true)} className="mt-7 text-white/55 text-xs underline underline-offset-2">Continua comunque</button>
      </div>
    </motion.div>
  )
}
