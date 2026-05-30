// useProfessione — legge profiles.professione_id e ritorna la professione
// dell'utente con etichette UI dinamiche + unita default.
//
// Pattern: il prodotto NON contiene mai if/else sul nome professione.
// Ogni vista pesca etichette/icona/default da qui (motore di vestizione).
//
// Fallback: se l'utente non ha professione_id, prendiamo la professione
// 'Generico' (seedata dalla migration 20260601100000).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export type ProfessioneEtichette = {
  servizio_label?: string
  catalogo_label?: string
  preventivo_label?: string
  empty_state?: string
  icona?: string
}

export type ProfessioneUnitaDefault = {
  quantity_basis_default?: 'FLAT' | 'PER_GUEST' | 'PER_TABLE' | 'PER_HOUR'
  service_unit_default?: 'PEZZO' | 'PERSONA' | 'ORA' | 'EVENTO'
}

export type Professione = {
  id: string
  nome: string
  slug: string
  gruppo: string
  icona: string | null
  etichette: ProfessioneEtichette
  unita_default: ProfessioneUnitaDefault
  attiva: boolean
  sort_order: number
}

const ETICHETTE_FALLBACK: ProfessioneEtichette = {
  servizio_label: 'I tuoi servizi',
  catalogo_label: 'Catalogo servizi',
  preventivo_label: 'Servizio',
  empty_state: 'Crea il tuo primo servizio',
  icona: 'Briefcase',
}

const UNITA_FALLBACK: ProfessioneUnitaDefault = {
  quantity_basis_default: 'FLAT',
  service_unit_default: 'EVENTO',
}

export function useProfessione() {
  const { user, profile } = useAuth()
  // L'id della professione viene dal profile esteso (non ancora nel Profile
  // TypeScript: lo leggiamo via supabase a colpo singolo per non toccare auth).
  return useQuery<Professione | null>({
    queryKey: ['professione', user?.id ?? null],
    enabled: !!user?.id,
    queryFn: async () => {
      // 1) leggo professione_id dal profile (al volo, una sola riga)
      const { data: prow, error: perr } = await (supabase as any)
        .from('profiles')
        .select('professione_id')
        .eq('id', user!.id)
        .maybeSingle()
      if (perr) throw perr
      const proId: string | null = prow?.professione_id ?? null

      // 2) leggo la professione (se settata), oppure il fallback 'generico'
      const q = (supabase as any).from('professioni').select('*')
      const { data, error } = proId
        ? await q.eq('id', proId).maybeSingle()
        : await q.eq('slug', 'generico').maybeSingle()
      if (error) throw error
      if (!data) return null
      const row = data as Professione
      return {
        ...row,
        etichette: { ...ETICHETTE_FALLBACK, ...(row.etichette ?? {}) },
        unita_default: { ...UNITA_FALLBACK, ...(row.unita_default ?? {}) },
      }
    },
    staleTime: 60_000,
  })
  // profile is intentionally unused: held in scope only to retrigger on logout
  void profile
}

// ─────────────────────────────────────────────────────────────────────────────
// Lista di tutte le professioni attive (per onboarding/cambio professione).
// ─────────────────────────────────────────────────────────────────────────────
export function useProfessioniList() {
  return useQuery<Professione[]>({
    queryKey: ['professioni', 'list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('professioni')
        .select('*')
        .eq('attiva', true)
        .order('sort_order', { ascending: true })
        .order('nome', { ascending: true })
      if (error) throw error
      return (data ?? []) as Professione[]
    },
    staleTime: 5 * 60_000,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Servizio template per una professione (usato dal PackImportPicker).
// ─────────────────────────────────────────────────────────────────────────────
export type ServizioTemplate = {
  id: string
  professione_id: string
  nome: string
  descrizione: string | null
  prezzo_base: number | null
  quantity_basis: 'FLAT' | 'PER_GUEST' | 'PER_TABLE' | 'PER_HOUR' | null
  service_unit: 'PEZZO' | 'PERSONA' | 'ORA' | 'EVENTO' | null
  sort_order: number | null
  is_default_pack: boolean
}

export function useServizioTemplate(professioneId: string | null | undefined) {
  return useQuery<ServizioTemplate[]>({
    queryKey: ['servizio_template', professioneId ?? null],
    enabled: !!professioneId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('servizio_template')
        .select('*')
        .eq('professione_id', professioneId!)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as ServizioTemplate[]
    },
    staleTime: 5 * 60_000,
  })
}
