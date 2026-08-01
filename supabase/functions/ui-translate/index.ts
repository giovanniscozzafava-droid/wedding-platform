// Edge: ui-translate
// Auto-traduzione UI. Riceve { lang, texts[] }, restituisce { map: {source: translated} }.
// Legge la cache condivisa (ui_translations); le stringhe mancanti le traduce UNA volta con aiChat
// e le salva, così la volta dopo (per chiunque) sono istantanee. Nessuna autenticazione richiesta:
// serve anche al sito matrimonio pubblico (ospiti non loggati).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { aiChat, firstJson } from '../_shared/ai.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const LANGS: Record<string, string> = { en: 'inglese', es: 'spagnolo', fr: 'francese', de: 'tedesco' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  let body: { lang?: string; texts?: string[] }
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const lang = String(body.lang ?? '')
  if (!LANGS[lang]) return json({ error: 'unsupported_lang' }, 400)
  let texts = Array.isArray(body.texts) ? body.texts.filter((t) => typeof t === 'string' && t.trim()) : []
  // dedup + cap per non esplodere costi/tempi
  texts = [...new Set(texts.map((t) => t.slice(0, 500)))].slice(0, 120)
  if (texts.length === 0) return json({ map: {} })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  try {
    // 1) cache server
    const { data: known } = await admin.rpc('get_ui_translations', { p_lang: lang, p_sources: texts })
    const map: Record<string, string> = (known as Record<string, string>) ?? {}
    const missing = texts.filter((t) => !(t in map))

    // 2) traduci le mancanti con l'AI (un solo batch)
    if (missing.length > 0) {
      const numbered = missing.map((t, i) => `${i + 1}. ${t.replace(/\n/g, ' ')}`).join('\n')
      const prompt = `Traduci queste micro-stringhe di interfaccia da ITALIANO a ${LANGS[lang].toUpperCase()}.
Regole TASSATIVE:
- Mantieni identici: i segnaposto tra doppie graffe {{cosi}}, i numeri, le valute (€), le percentuali, le email, gli URL, i nomi propri/di marca.
- Tono naturale da interfaccia (breve, imperativo dove serve), NON aggiungere punteggiatura o spiegazioni.
- Restituisci SOLO JSON valido nella forma {"t":["trad1","trad2",...]} con ESATTAMENTE ${missing.length} elementi, nello stesso ordine.

Stringhe:
${numbered}`
      const res = await aiChat({ parts: [{ text: prompt }], maxTokens: 4000 })
      if (res.ok) {
        const parsed = firstJson<{ t?: string[] }>(res.text)
        const arr = Array.isArray(parsed?.t) ? parsed!.t! : []
        const rows: { lang: string; source: string; translated: string }[] = []
        missing.forEach((src, i) => {
          const tr = typeof arr[i] === 'string' ? arr[i].trim() : ''
          if (tr) { map[src] = tr; rows.push({ lang, source: src, translated: tr }) }
        })
        if (rows.length) {
          // upsert nella cache condivisa (chiave = lang + md5(source))
          await admin.from('ui_translations').upsert(rows, { onConflict: 'lang,src_hash', ignoreDuplicates: false })
        }
      }
    }

    return json({ map })
  } catch (e) { return json({ error: 'exception', detail: String((e as Error)?.message ?? e).slice(0, 200) }, 500) }
})
