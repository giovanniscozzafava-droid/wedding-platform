import { useEffect, useState } from 'react'

// Rileva quando è stato pubblicato un nuovo build (deploy) mentre l'app è aperta,
// così il cliente non resta "incollato" a una versione vecchia — problema critico
// sulle pagine pubbliche (preventivo/firma) dove il prezzo mostrato deve essere
// quello aggiornato. NON ricarica da solo: restituisce solo un flag, la ricarica
// la decide l'utente (nessun rischio di loop o di perdere dati di un form).

// Hash del chunk index-*.js attualmente in esecuzione (dallo <script> caricato).
function currentHash(): string | null {
  try {
    for (const s of Array.from(document.scripts)) {
      const m = s.src.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/)
      if (m) return m[1]!
    }
  } catch { /* ignore */ }
  return null
}

async function deployedHash(): Promise<string | null> {
  try {
    const res = await fetch('/', { cache: 'no-store' })
    if (!res.ok) return null
    const html = await res.text()
    const m = html.match(/\/assets\/index-([A-Za-z0-9_-]+)\.js/)
    return m ? m[1]! : null
  } catch { return null }
}

export function useAppVersion(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    const mine = currentHash()
    if (!mine) return // non riesco a determinare la versione → non disturbo
    let alive = true
    const check = async () => {
      if (!alive || document.hidden) return
      const live = await deployedHash()
      if (alive && live && live !== mine) setUpdateAvailable(true)
    }
    // controllo all'avvio, ogni 3 minuti, e quando la scheda torna in primo piano.
    const t0 = window.setTimeout(check, 4000)
    const iv = window.setInterval(check, 3 * 60 * 1000)
    const onVis = () => { if (!document.hidden) void check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; window.clearTimeout(t0); window.clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  return { updateAvailable }
}
