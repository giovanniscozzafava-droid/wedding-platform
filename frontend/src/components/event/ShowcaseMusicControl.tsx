// Controllo musica della presentazione: parte da sola quando la presentazione si
// apre (il click che l'ha aperta è il gesto che i browser richiedono per l'audio),
// e resta un altoparlante con cursore del volume. La scelta si ricorda.
import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from '@/components/icons/lucide'
import { startMusic, styleForKind, STYLE_LABEL, type MusicHandle } from '@/lib/showcaseMusic'

const K_VOL = 'planfully.showcase.volume'
const K_OFF = 'planfully.showcase.muted'

function readPref(): { vol: number; off: boolean } {
  // localStorage può lanciare (finestra privata, cookie bloccati): mai far cadere
  // la presentazione per una preferenza.
  try {
    const v = Number(localStorage.getItem(K_VOL))
    return {
      vol: Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.35,
      off: localStorage.getItem(K_OFF) === '1',
    }
  } catch { return { vol: 0.35, off: false } }
}

export function ShowcaseMusicControl({ eventKind }: { eventKind?: string | null }) {
  const pref = useRef(readPref())
  const [vol, setVol] = useState(pref.current.vol)
  const [off, setOff] = useState(pref.current.off)
  const [blocked, setBlocked] = useState(false)
  const handle = useRef<MusicHandle | null>(null)
  const style = styleForKind(eventKind)

  useEffect(() => {
    if (off) return
    const h = startMusic(style, vol)
    handle.current = h
    // Se il browser ha rifiutato l'autoplay, riprovo al primo tocco sulla pagina.
    void h.resume().then((ok) => {
      if (ok) return
      setBlocked(true)
      const retry = () => { void h.resume().then((r) => { if (r) setBlocked(false) }) }
      window.addEventListener('pointerdown', retry, { once: true })
    })
    return () => { h.stop(); handle.current = null }
    // volume gestito a parte: non voglio rigenerare la musica a ogni scatto del cursore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, off])

  useEffect(() => { handle.current?.setVolume(vol) }, [vol])

  function persist(v: number, muted: boolean) {
    try {
      localStorage.setItem(K_VOL, String(v))
      localStorage.setItem(K_OFF, muted ? '1' : '0')
    } catch { /* preferenza non salvata: pazienza */ }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => { const n = !off; setOff(n); persist(vol, n) }}
        title={off ? 'Attiva la musica' : `Musica ${STYLE_LABEL[style].toLowerCase()} — spegni`}
        aria-label={off ? 'Attiva la musica' : 'Spegni la musica'}
        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white">
        {off ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      {!off && (
        <input
          type="range" min={0} max={100} value={Math.round(vol * 100)}
          aria-label="Volume della musica"
          onChange={(e) => { const v = Number(e.target.value) / 100; setVol(v); persist(v, false) }}
          className="w-20 accent-[rgb(var(--gold-500))] cursor-pointer"
        />
      )}
      {blocked && !off && (
        <span className="text-[11px] text-white/60">tocca per la musica</span>
      )}
    </div>
  )
}
