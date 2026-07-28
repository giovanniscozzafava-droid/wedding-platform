import { useEffect, useState } from 'react'

// Cover di un servizio a catalogo: con UNA foto è statica, con PIÙ foto diventa uno slideshow
// (dissolvenza automatica ogni ~2,8s, si mette in pausa al passaggio del mouse, con i puntini).
// Va dentro un contenitore `relative`: riempie il genitore (absolute inset-0).
export function ServiceSlideshow({ photos, alt = '', fit = 'object-cover' }: { photos: { url: string }[]; alt?: string; fit?: string }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = photos.length

  useEffect(() => {
    if (n <= 1 || paused) return
    const t = setInterval(() => setI((x) => (x + 1) % n), 2800)
    return () => clearInterval(t)
  }, [n, paused])
  useEffect(() => { if (i >= n) setI(0) }, [n, i])

  if (n === 0) return null

  return (
    <div className="absolute inset-0 overflow-hidden" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {photos.map((p, idx) => (
        <img key={idx} src={p.url} alt={alt} loading="lazy" draggable={false}
          className={`absolute inset-0 h-full w-full ${fit} ${n > 1 ? `transition-opacity duration-700 ${idx === i ? 'opacity-100' : 'opacity-0'}` : ''}`} />
      ))}
      {n > 1 && (
        <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1 z-10 pointer-events-none">
          {photos.map((_, idx) => (
            <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === i ? 'w-3 bg-white' : 'w-1.5 bg-white/60'}`} style={{ boxShadow: '0 0 2px rgba(0,0,0,.55)' }} />
          ))}
        </div>
      )}
    </div>
  )
}
