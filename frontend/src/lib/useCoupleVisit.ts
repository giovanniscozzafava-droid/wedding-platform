// Registra la presenza del cliente dentro il suo evento: quando entra, dove, e
// quanto ci resta. Un "battito" ogni 30 secondi; la durata la ricava il server dalla
// distanza fra il primo e l'ultimo battito.
//
// Perché a battiti e non con un evento di uscita: i browser NON garantiscono di
// eseguire nulla quando si chiude la pagina (chi chiude il portatile, cambia app o
// perde la rete non manda nessun addio). Coi battiti la visita si chiude da sola.
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const OGNI_MS = 30_000

export function useCoupleVisit(entryId: string | null | undefined, section: string | null | undefined) {
  const attivo = useRef(true)

  useEffect(() => {
    if (!entryId || !section) return
    attivo.current = true
    let timer: number | undefined

    const battito = () => {
      // Scheda in secondo piano = non sta guardando: non gonfiamo il tempo.
      if (document.visibilityState !== 'visible' || !attivo.current) return
      void (supabase.rpc as any)('couple_visit_ping', { p_entry: entryId, p_section: section })
        .then(() => {})
        .catch(() => { /* il tracciamento non deve mai disturbare l'uso */ })
    }

    battito()
    timer = window.setInterval(battito, OGNI_MS)
    // Tornando sulla scheda si batte subito, così il tempo riprende senza aspettare.
    const onVis = () => { if (document.visibilityState === 'visible') battito() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      attivo.current = false
      if (timer) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [entryId, section])
}
