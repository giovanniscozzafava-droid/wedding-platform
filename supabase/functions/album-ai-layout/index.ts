// Edge function: album-ai-layout
// L'IMPAGINATORE AI dell'album. Il fotografo preme "Impagina con AI" e questa funzione chiede a
// OpenAI (GPT) di fare la parte CURATORIALE: raggruppare le foto in tavole (doppie pagine),
// decidere la SEQUENZA del racconto e quante foto per tavola. NON genera immagini e NON tocca la
// geometria: la disposizione fisica la calcola il frontend col motore testato (genTavolaLayouts).
//
// Input (POST):  { photos: [{ id, moment?, aspect?, likes? }], format?, eventTerm?, maxPerSpread? }
// Output:        { tavole: [ { photoIds: string[], note?: string } ] }
//
// Sicurezza: verify_jwt = true (default) → solo utenti autenticati. La chiave OpenAI è un secret
// server (OPENAI_API_KEY): mai nel frontend. Il modello è configurabile (OPENAI_MODEL).

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

type InPhoto = { id: string; moment?: string | null; aspect?: number | null; likes?: number | null }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!OPENAI_API_KEY) return json({ error: 'missing_openai_key', hint: 'Imposta il secret OPENAI_API_KEY' }, 503)

  let body: { photos?: InPhoto[]; format?: string; eventTerm?: string; maxPerSpread?: number; styleProfile?: { perSpread: number; times: number }[] }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }

  const photos = (body.photos ?? []).filter((p) => p && typeof p.id === 'string').slice(0, 400)
  if (!photos.length) return json({ error: 'no_photos' }, 400)
  const maxPer = Math.min(6, Math.max(1, body.maxPerSpread ?? 5))
  const term = (body.eventTerm ?? 'evento').replace(/[^\p{L}\s]/gu, '').slice(0, 40)

  // STILE del fotografo: quante foto per tavola usa di solito (dai suoi preset salvati + album).
  // Serve a far imitare all'AI "il modello che usa più spesso".
  const style = (body.styleProfile ?? []).filter((s) => s && s.perSpread > 0 && s.times > 0).slice(0, 6)
  const styleHint = style.length
    ? `STILE DEL FOTOGRAFO (rispettalo): di solito impagina con questo numero di foto per tavola, dal più usato: ${style.map((s) => `${s.perSpread} foto (${s.times}x)`).join(', ')}. Usa soprattutto la cadenza più frequente; il preferito in assoluto è ${style[0]!.perSpread} foto per tavola.`
    : 'Non ci sono modelli salvati: usa un ritmo elegante e vario.'

  // Elenco compatto per il modello: id + orientamento (P/L/S) + momento + like. Niente immagini.
  const orient = (a?: number | null) => (!a ? 'S' : a > 1.15 ? 'L' : a < 0.87 ? 'P' : 'S')
  const list = photos.map((p) => ({ id: p.id, o: orient(p.aspect), m: p.moment ?? '', l: Math.max(0, Math.round(p.likes ?? 0)) }))

  const sys = [
    `Sei un art director che impagina un album fotografico di ${term}, al posto del fotografo.`,
    `Ricevi le foto come [id, o(orientamento P=verticale L=orizzontale S=quadrata), m(momento/tag), l(like degli sposi)].`,
    `Raggruppa TUTTE le foto in "tavole" (doppie pagine). Regole:`,
    `- ogni foto usata UNA sola volta; NON inventare id; usa SOLO gli id ricevuti;`,
    `- da 1 a ${maxPer} foto per tavola (varia il ritmo: alterna tavole piene e tavole con 1 foto forte);`,
    `- rispetta il RACCONTO: ordina le tavole seguendo la cronologia dei momenti (m) se presenti;`,
    `- tieni insieme foto dello stesso momento; una foto con molti like (l alto) merita risalto (tavola con poche foto);`,
    `- non mischiare orientamenti in modo caotico: accorpa verticali con verticali dove sensato.`,
    styleHint,
    `Rispondi SOLO JSON: {"tavole":[{"photoIds":["id",...],"note":"1-4 parole"}]}.`,
  ].join('\n')

  let content = ''
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Foto (${list.length}):\n${JSON.stringify(list)}` },
        ],
      }),
    })
    if (!r.ok) { const t = await r.text(); return json({ error: 'openai_error', status: r.status, detail: t.slice(0, 500) }, 502) }
    const data = await r.json()
    content = data?.choices?.[0]?.message?.content ?? ''
  } catch (e) {
    return json({ error: 'openai_unreachable', detail: String(e).slice(0, 300) }, 502)
  }

  // Parsing robusto + SANIFICA: solo id noti, deduplica, e NON perde nessuna foto (le mancanti
  // finiscono in tavole extra a fine album). Così il risultato è sempre applicabile.
  let parsed: { tavole?: { photoIds?: string[]; note?: string }[] }
  try { parsed = JSON.parse(content) } catch { return json({ error: 'ai_bad_output' }, 502) }
  const known = new Set(photos.map((p) => p.id))
  const used = new Set<string>()
  const tavole: { photoIds: string[]; note?: string }[] = []
  for (const t of parsed.tavole ?? []) {
    const ids = (t?.photoIds ?? []).filter((id) => known.has(id) && !used.has(id)).slice(0, maxPer)
    if (!ids.length) continue
    ids.forEach((id) => used.add(id))
    tavole.push({ photoIds: ids, note: typeof t?.note === 'string' ? t.note.slice(0, 40) : undefined })
  }
  const missing = photos.map((p) => p.id).filter((id) => !used.has(id))
  for (let i = 0; i < missing.length; i += maxPer) tavole.push({ photoIds: missing.slice(i, i + maxPer), note: 'extra' })
  if (!tavole.length) return json({ error: 'ai_empty' }, 502)

  return json({ tavole, model: OPENAI_MODEL })
})
