import { supabase } from '@/lib/supabase'

export type Maestranza = {
  id: string
  display_name: string
  photo_path: string | null
  provincia: string
  provincia_nome: string
  regione: string
  raggio_disponibilita: 'PROVINCIA' | 'REGIONE' | 'NAZIONALE'
  bio: string | null
  anni_esperienza: number | null
  fascia_prezzo: string | null
  disponibilita_note: string | null
  skills: string[]
  total_count?: number
  published_at?: string | null
}

export type Skill = { id: string; name: string; famiglia: string }
export type Provincia = { provincia: string; nome: string; regione: string }

export const RAGGIO_LABEL: Record<Maestranza['raggio_disponibilita'], string> = {
  PROVINCIA: 'In provincia',
  REGIONE: 'In tutta la regione',
  NAZIONALE: 'In tutta Italia',
}

/** Testo ESATTO delle opzioni di regime: viene salvato com'è nella dichiarazione
 *  (snapshot immutabile). Se cambia il testo, le vecchie dichiarazioni restano quelle. */
export const REGIMI = [
  { value: 'PARTITA_IVA', label: 'Ho la Partita IVA e fatturo le mie prestazioni' },
  { value: 'SUBORDINATO_DISPONIBILE', label: 'Sono disponibile a essere assunto con un contratto di lavoro' },
  { value: 'SOLO_CONTRATTI_REGOLARI', label: 'Accetto esclusivamente incarichi regolarizzati' },
  { value: 'NON_DICHIARO', label: 'Preferisco non dichiarare la mia posizione' },
] as const

export const TOS_VERSION = '2026-07'

/**
 * La bacheca è APERTA alle iscrizioni dirette?
 *
 * false = fase lista d'attesa: /maestranze/iscriviti rimanda a /maestranze/lista-attesa.
 *
 * Perché serve: le Stories dicono "apre dopo l'estate, mettiti in lista", ma l'iscrizione
 * diretta è pubblica e funzionante. Due porte aperte insieme = la lista d'attesa è una
 * finzione (chi trova l'altra porta entra subito) e il conteggio dato ai capostipiti non
 * vuol dire più niente. Una porta sola, alla volta.
 *
 * A settembre: metti true. È l'unica riga da toccare — il wizard, il profilo e la bacheca
 * sono già costruiti e testati, aspettano solo questa.
 */
export const BACHECA_APERTA = false

export const DISCLAIMER =
  'Planfully è una bacheca informativa. Non siamo un’agenzia per il lavoro e non intermediamo ' +
  'rapporti di lavoro: non selezioniamo, non ordiniamo per merito, non verifichiamo. La ' +
  'regolarizzazione del rapporto è responsabilità esclusiva delle parti.'

/** Il bucket è PRIVATO (le foto sono volti di persone su una bacheca chiusa): l'unico
 *  modo di mostrarle è una URL firmata a tempo. Mai getPublicUrl in questo modulo. */
export async function signedPhoto(path: string | null): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from('maestranze-photos').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

export async function signedPhotos(rows: Maestranza[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  await Promise.all(rows.map(async (r) => {
    const u = await signedPhoto(r.photo_path)
    if (u) out[r.id] = u
  }))
  return out
}

/** Seed di sessione: fissa l'ordine casuale finché l'utente resta sulla bacheca
 *  (le carte non ballano sotto il dito), ma nessuno ha una posizione "sua". */
export function sessionSeed(): number {
  const k = 'maestranze_seed'
  const cached = sessionStorage.getItem(k)
  if (cached) return Number(cached)
  const s = Math.random()
  sessionStorage.setItem(k, String(s))
  return s
}

/** Via RPC e non `from()`: la lista d'attesa è PUBBLICA e le tabelle hanno RLS
 *  `to authenticated`. Le RPC restituiscono solo dati di riferimento (mestieri,
 *  province) — nessun dato personale — così non serve aprire policy ad anon. */
export async function loadSkills(): Promise<Skill[]> {
  const { data, error } = await supabase.rpc('maestranze_vocabolario')
  if (error) throw error
  return (data ?? []) as Skill[]
}

export async function loadProvince(): Promise<Provincia[]> {
  const { data, error } = await supabase.rpc('province_elenco')
  if (error) throw error
  return (data ?? []) as Provincia[]
}

export function groupByFamiglia(skills: Skill[]): [string, Skill[]][] {
  const m = new Map<string, Skill[]>()
  for (const s of skills) {
    const arr = m.get(s.famiglia) ?? []
    arr.push(s)
    m.set(s.famiglia, arr)
  }
  return [...m.entries()]
}
