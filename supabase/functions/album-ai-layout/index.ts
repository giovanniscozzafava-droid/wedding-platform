// Edge function: album-ai-layout (VISION)
// L'impaginatore AI dell'album che GUARDA DAVVERO le foto. Due fasi:
//   A) ANALISI VISIVA (gpt-4o vision, batch): per ogni foto → momento, didascalia, PUNTO FOCALE del
//      soggetto (fx,fy 0..1 = dove tagliare per non tagliare teste), scatto forte (hero), orientamento.
//   B) COMPOSIZIONE (testo): raggruppa in tavole (doppie pagine), sequenza del racconto, accostamenti,
//      rispettando lo stile del fotografo (foto/tavola più usate).
// La geometria fisica resta nel motore testato del frontend; qui decidiamo COSA sta con cosa, DOVE e
// COME ritagliare. Legge OPENAI_API_KEY (secret server). verify_jwt=true (solo autenticati).

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o'          // vision-capable
const OPENAI_TEXT_MODEL = Deno.env.get('OPENAI_TEXT_MODEL') ?? 'gpt-4o-mini'
const MAX_VISION = 120          // tetto foto analizzate a vista (costo/tempo); le altre: centro
const BATCH = 10                // foto per chiamata vision
const CONCURRENCY = 4           // chiamate vision in parallelo

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

const MOMENTS = ['preparativi','preparativi-sposo','dettagli-sposa','primo-sguardo','arrivo','partecipazione','chiesa','anelli','uscita','famiglia','coppia','aperitivo','tableau','ricevimento','brindisi','torta','primo-ballo','festa','bouquet','chiusura','dettagli']

type InPhoto = { id: string; url?: string | null; moment?: string | null; aspect?: number | null; likes?: number | null }
type Analysis = { id: string; moment: string; caption: string; fx: number; fy: number; hero: boolean }

async function openai(body: unknown): Promise<any> {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) { const t = await r.text(); throw new Error(`openai ${r.status}: ${t.slice(0, 300)}`) }
  return r.json()
}

const clamp01 = (n: unknown) => Math.min(1, Math.max(0, typeof n === 'number' ? n : 0.5))

// FASE A — analisi visiva di un batch di foto. Ritorna un'analisi per id (con fallback al centro).
async function analyzeBatch(photos: InPhoto[]): Promise<Analysis[]> {
  const withUrl = photos.filter((p) => p.url)
  if (!withUrl.length) return photos.map((p) => ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false }))
  const sys = [
    'Sei un art director di album di matrimonio. Guarda ogni foto e restituisci un giudizio tecnico per impaginarla.',
    `Per OGNI foto dai: moment (uno tra: ${MOMENTS.join(', ')}), caption (max 6 parole), fx e fy = punto focale del soggetto in frazioni 0..1 (dove NON tagliare: volti/soggetto; 0,0=alto-sx, 1,1=basso-dx), hero=true se è uno scatto forte da valorizzare grande.`,
    'Le foto arrivano nell\'ordine dei loro id, elencati nel messaggio. Rispondi SOLO JSON: {"a":[{"id","moment","caption","fx","fy","hero"}]}.',
  ].join('\n')
  const content: any[] = [{ type: 'text', text: `Foto in ordine, id: ${withUrl.map((p) => p.id).join(', ')}` }]
  for (const p of withUrl) content.push({ type: 'image_url', image_url: { url: p.url as string, detail: 'low' } })
  const data = await openai({
    model: OPENAI_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: sys }, { role: 'user', content }],
  })
  let out: Analysis[] = []
  try {
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
    const arr = Array.isArray(parsed?.a) ? parsed.a : (Array.isArray(parsed) ? parsed : [])
    out = arr.map((x: any) => ({
      id: String(x?.id ?? ''),
      moment: MOMENTS.includes(x?.moment) ? x.moment : 'dettagli',
      caption: typeof x?.caption === 'string' ? x.caption.slice(0, 60) : '',
      fx: clamp01(x?.fx), fy: clamp01(x?.fy), hero: !!x?.hero,
    })).filter((x: Analysis) => x.id)
  } catch { /* fallback sotto */ }
  const byId = new Map(out.map((a) => [a.id, a]))
  return photos.map((p) => byId.get(p.id) ?? { id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false })
}

// esegue task in parallelo con un tetto di concorrenza
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length)
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k]) }
  })
  await Promise.all(workers)
  return res
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!OPENAI_API_KEY) return json({ error: 'missing_openai_key', hint: 'Imposta il secret OPENAI_API_KEY' }, 503)

  let body: { photos?: InPhoto[]; format?: string; eventTerm?: string; maxPerSpread?: number; styleProfile?: { perSpread: number; times: number }[] }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const photos = (body.photos ?? []).filter((p) => p && typeof p.id === 'string').slice(0, 400)
  if (!photos.length) return json({ error: 'no_photos' }, 400)
  const maxPer = Math.min(6, Math.max(1, body.maxPerSpread ?? 5))
  const term = (body.eventTerm ?? 'matrimonio').replace(/[^\p{L}\s]/gu, '').slice(0, 40)
  const style = (body.styleProfile ?? []).filter((s) => s && s.perSpread > 0 && s.times > 0).slice(0, 6)
  const styleHint = style.length
    ? `STILE DEL FOTOGRAFO (rispettalo): foto per tavola più usate, dalla più frequente: ${style.map((s) => `${s.perSpread} (${s.times}x)`).join(', ')}. Preferito: ${style[0]!.perSpread} per tavola.`
    : 'Nessun modello salvato: ritmo elegante e vario (alterna tavole piene e tavole con 1 scatto forte).'

  // ── FASE A: analisi visiva a batch (con tetto) ──
  const toSee = photos.slice(0, MAX_VISION)
  const rest = photos.slice(MAX_VISION)
  const batches: InPhoto[][] = []
  for (let k = 0; k < toSee.length; k += BATCH) batches.push(toSee.slice(k, k + BATCH))
  let analyses: Analysis[] = []
  try {
    const results = await pool(batches, CONCURRENCY, (b) => analyzeBatch(b))
    analyses = results.flat()
  } catch (e) {
    // vision fallita del tutto → non blocco: uso i tag esistenti + centro (impagino comunque)
    analyses = toSee.map((p) => ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false }))
    // segnalo il motivo ma proseguo
    console.error('vision_failed', String(e).slice(0, 200))
  }
  for (const p of rest) analyses.push({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false })
  const focus: Record<string, { fx: number; fy: number; hero: boolean; moment: string }> = {}
  for (const a of analyses) focus[a.id] = { fx: a.fx, fy: a.fy, hero: a.hero, moment: a.moment }

  // ── FASE B: composizione (testo) — raggruppa in tavole + sequenza ──
  const sysB = [
    `Sei un art director che impagina un album di ${term} al posto del fotografo.`,
    'Ricevi le foto GIÀ ANALIZZATE: [id, moment, caption, hero]. Raggruppale in "tavole" (doppie pagine).',
    'Regole:',
    `- ogni foto UNA sola volta; usa SOLO gli id ricevuti;`,
    `- da 1 a ${maxPer} foto per tavola; una hero da sola o con poche per farla respirare;`,
    '- segui il RACCONTO: ordina le tavole per cronologia dei momenti; tieni insieme lo stesso momento;',
    '- accosta foto che dialogano (stessa scena/soggetto) e bilancia orizzontali/verticali.',
    styleHint,
    'Rispondi SOLO JSON: {"tavole":[{"photoIds":["id",...],"note":"1-4 parole"}]}.',
  ].join('\n')
  const compact = analyses.map((a) => ({ id: a.id, m: a.moment, c: a.caption, h: a.hero ? 1 : 0 }))
  let content = ''
  try {
    const data = await openai({
      model: OPENAI_TEXT_MODEL, temperature: 0.4, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: sysB }, { role: 'user', content: `Foto (${compact.length}):\n${JSON.stringify(compact)}` }],
    })
    content = data?.choices?.[0]?.message?.content ?? ''
  } catch (e) {
    return json({ error: 'openai_error', detail: String(e).slice(0, 300) }, 502)
  }

  // SANIFICA: solo id noti, dedup, nessuna foto persa (le mancanti in tavole extra a fine album)
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

  return json({ tavole, focus, seen: toSee.length, model: OPENAI_MODEL })
})
