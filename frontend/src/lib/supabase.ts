import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Variabili Supabase mancanti: imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY in .env.local',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Lock pass-through: evita il deadlock del Web Locks API di default quando molte query
    // partono insieme (es. pagina Food cost) e un refresh token resta appeso → tutte le richieste
    // si bloccavano dietro il lock e la pagina restava vuota. Senza lock ogni richiesta procede.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})
