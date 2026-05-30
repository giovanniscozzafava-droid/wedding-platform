// FASE 6.2 — Hook feature flag "nuovo modello"
//
// Legge `profiles.nuovo_modello_attivo` per l'utente loggato.
// I componenti del workflow guidato si renderizzano SOLO se attivo:
//   - ProssimaMossa
//   - RiconciliazioneCard
//   - ChatEvento
//   - SaluteEventoBadge
//   - tab Scadenzario
//   - menu Cambiamenti evento
//
// Cache best-effort lato modulo: invalidata da setNuovoModelloAttivo().
// Listener pubsub: i componenti si re-renderizzano quando il flag cambia.

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

let cached: { uid: string; value: boolean } | null = null
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

async function fetchFlag(uid: string): Promise<boolean> {
  // Cast as any perche` la colonna e` appena introdotta e non e` ancora nei
  // generated types fino a `npm run db:types`.
  const { data, error } = await (supabase.from('profiles') as any)
    .select('nuovo_modello_attivo')
    .eq('id', uid)
    .maybeSingle()
  if (error) return false
  return Boolean(data?.nuovo_modello_attivo)
}

/**
 * Restituisce `true` se l'utente loggato ha attivato il nuovo modello.
 * Loading iniziale fa fallback a `false` (i componenti nuovi rimangono
 * nascosti finche` non sappiamo la risposta).
 */
export function useNuovoModello(): boolean {
  const { user } = useAuth()
  const [value, setValue] = useState<boolean>(() => {
    if (!user?.id) return false
    if (cached && cached.uid === user.id) return cached.value
    return false
  })

  useEffect(() => {
    let mounted = true
    const uid = user?.id
    if (!uid) {
      setValue(false)
      return () => { mounted = false }
    }

    function onChange() {
      if (!mounted) return
      if (cached && cached.uid === uid) setValue(cached.value)
    }
    listeners.add(onChange)

    // Carica fresh sempre, anche se in cache: il valore puo` cambiare via toggle altrove.
    void (async () => {
      const v = await fetchFlag(uid)
      cached = { uid, value: v }
      if (mounted) setValue(v)
      emit()
    })()

    return () => {
      mounted = false
      listeners.delete(onChange)
    }
  }, [user?.id])

  return value
}

/**
 * Imposta il flag per l'utente indicato (default: l'utente loggato).
 * Aggiorna cache e notifica i listener; il caller decide se mostrare toast.
 */
export function useSetNuovoModello() {
  const { user } = useAuth()

  return useCallback(
    async (next: boolean, targetUid?: string) => {
      const uid = targetUid ?? user?.id
      if (!uid) throw new Error('Nessun utente')
      const { error } = await (supabase.from('profiles') as any)
        .update({ nuovo_modello_attivo: next })
        .eq('id', uid)
      if (error) throw error
      if (uid === user?.id) {
        cached = { uid, value: next }
        emit()
      }
    },
    [user?.id],
  )
}
