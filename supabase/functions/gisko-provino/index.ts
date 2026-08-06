// Edge function: gisko-provino
// Tiene le scelte del provino sulle foto del vecchio sito Wix, così la selezione
// si può fare dal telefono, in giorni diversi, senza dipendere da un computer acceso.
//
//   GET  ?t=<parola d'ordine>              -> tutte le scelte fatte finora
//   POST {t, scelte:[{id, scelta}]}        -> registra (scelta null = ripensamento)
//
// La parola d'ordine sta nel segreto GISKO_PROVINO_TOKEN. Non c'è login: le foto
// sono già pubbliche sul vecchio sito, quello che si protegge è la scrittura.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const TOKEN = Deno.env.get('GISKO_PROVINO_TOKEN') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })

const VALIDE = new Set(['top', 'tieni', 'scarta'])

/** Confronto a tempo costante: non lascia indovinare la parola d'ordine un carattere per volta. */
function tokenGiusto(dato: string): boolean {
  if (!TOKEN || dato.length !== TOKEN.length) return false
  let diff = 0
  for (let i = 0; i < TOKEN.length; i++) diff |= dato.charCodeAt(i) ^ TOKEN.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!TOKEN) return json({ ok: false, error: 'token_non_configurato' }, 500)

  const url = new URL(req.url)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  if (req.method === 'GET') {
    if (!tokenGiusto(url.searchParams.get('t') ?? '')) return json({ ok: false, error: 'token' }, 403)

    // la tabella può superare le mille righe: si scorre a pagine
    const scelte: Record<string, string> = {}
    for (let from = 0; ; from += 1000) {
      const { data, error } = await admin
        .from('gisko_wix_picks')
        .select('photo_id, scelta')
        .range(from, from + 999)
      if (error) return json({ ok: false, error: 'lettura', detail: error.message }, 500)
      for (const r of data ?? []) scelte[r.photo_id as string] = r.scelta as string
      if ((data ?? []).length < 1000) break
    }
    return json({ ok: true, scelte, totale: Object.keys(scelte).length })
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'metodo' }, 405)

  let body: { t?: string; scelte?: { id?: string; scelta?: string | null }[] }
  try { body = await req.json() } catch { return json({ ok: false, error: 'json' }, 400) }
  if (!tokenGiusto(body.t ?? '')) return json({ ok: false, error: 'token' }, 403)

  const voci = Array.isArray(body.scelte) ? body.scelte : []
  if (!voci.length) return json({ ok: false, error: 'vuoto' }, 400)
  if (voci.length > 500) return json({ ok: false, error: 'troppe_in_una_volta' }, 400)

  // i ripensamenti tolgono la riga, il resto la scrive o la aggiorna
  const daTogliere = voci.filter((v) => v.id && !v.scelta).map((v) => v.id as string)
  const daScrivere = voci
    .filter((v) => v.id && v.scelta && VALIDE.has(v.scelta))
    .map((v) => ({ photo_id: v.id as string, scelta: v.scelta as string, updated_at: new Date().toISOString() }))

  if (daTogliere.length) {
    const { error } = await admin.from('gisko_wix_picks').delete().in('photo_id', daTogliere)
    if (error) return json({ ok: false, error: 'cancellazione', detail: error.message }, 500)
  }
  if (daScrivere.length) {
    const { error } = await admin.from('gisko_wix_picks').upsert(daScrivere, { onConflict: 'photo_id' })
    if (error) return json({ ok: false, error: 'scrittura', detail: error.message }, 500)
  }

  const { count } = await admin.from('gisko_wix_picks').select('photo_id', { count: 'exact', head: true })
  return json({ ok: true, scritte: daScrivere.length, tolte: daTogliere.length, totale: count ?? 0 })
})
