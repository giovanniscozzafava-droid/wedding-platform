import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Smartphone } from '@/components/icons/lucide'

// Invito esperienziale a girare/allargare lo schermo: overlay a tutto schermo con sfondo scurito
// e un telefono animato che ruota. Compare su device stretto/in verticale; sparisce da solo quando
// si ruota in orizzontale. `when` = condizione specifica (es. il catalogo PDF è orizzontale).
/** `inline`: invece del velo a tutto schermo, un riquadro dentro il contenitore (che deve essere `relative`):
 *  non copre il resto della pagina (es. l'album 3D sopra lo sfogliatore). */
export function RotateScreenGate({ when = true, title = 'Gira lo schermo', subtitle, inline = false }: { when?: boolean; title?: string; subtitle?: string; inline?: boolean }) {
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

  if (inline) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 rounded-2xl">
      <div className="text-center max-w-[260px]">
        <motion.div className="mx-auto mb-3 inline-flex text-white"
          animate={{ rotate: [0, 0, -90, -90, 0] }}
          transition={{ duration: 2.6, times: [0, 0.18, 0.5, 0.8, 1], repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}>
          <Smartphone size={40} strokeWidth={1.4} />
        </motion.div>
        <p className="text-white font-display text-lg leading-tight">{title}</p>
        <p className="text-white/70 text-[12px] mt-1.5">{subtitle ?? 'Ruota il telefono in orizzontale per sfogliare meglio.'}</p>
        <button onClick={() => setDismissed(true)} className="mt-3 rounded-full bg-white/15 px-3 py-1.5 text-white text-xs">Sfoglia così</button>
      </div>
    </motion.div>
  )
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
