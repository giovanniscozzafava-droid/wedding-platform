// Edge function: album-ai-layout (VISION, robusta)
// Impaginatore AI che GUARDA le foto. Due fasi:
//   A) ANALISI VISIVA (gpt-4o vision, batch): per foto → momento, didascalia, PUNTO FOCALE (fx,fy),
//      scatto forte (hero).
//   B) COMPOSIZIONE (testo): raggruppa in tavole + sequenza, rispetta lo stile del fotografo.
// ROBUSTA: se OpenAI fallisce (credito/accesso/timeout) NON dà errore secco → degrada e impagina
// comunque con un'euristica per momento, riportando il motivo (`degraded`+`reason`). Non-2xx SOLO per
// chiave mancante / niente foto / json rotto. Legge OPENAI_API_KEY (secret server). verify_jwt=true.

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
// VISIONE (tante chiamate) su gpt-4o-mini: vision-capable, rate limit alti, economico (account nuovi).
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini'
// COMPOSIZIONE (1 sola chiamata testo) su gpt-4o: ragiona meglio → impaginazione con criterio, non a caso.
const OPENAI_TEXT_MODEL = Deno.env.get('OPENAI_TEXT_MODEL') ?? 'gpt-4o'
const MAX_VISION = 130
const BATCH = 8
const CONCURRENCY = 3
const CALL_TIMEOUT_MS = 45000

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

const MOMENTS = ['preparativi','preparativi-sposo','dettagli-sposa','primo-sguardo','arrivo','partecipazione','chiesa','anelli','uscita','famiglia','coppia','aperitivo','tableau','ricevimento','brindisi','torta','primo-ballo','festa','bouquet','chiusura','dettagli']
const M_ORDER = new Map(MOMENTS.map((m, i) => [m, i]))

type InPhoto = { id: string; url?: string | null; moment?: string | null; aspect?: number | null; likes?: number | null }
type Analysis = { id: string; moment: string; caption: string; fx: number; fy: number; hero: boolean }

async function openai(body: unknown, attempt = 0): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS)
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    })
    // Rate limit / errori temporanei → retry con attesa (l'header retry-after o backoff crescente).
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      const ra = parseFloat(r.headers.get('retry-after') ?? '')
      const waitMs = Number.isFinite(ra) ? ra * 1000 : 1500 * (attempt + 1)
      await sleep(Math.min(8000, waitMs))
      return openai(body, attempt + 1)
    }
    if (!r.ok) { const t2 = await r.text(); throw new Error(`openai ${r.status}: ${t2.slice(0, 200)}`) }
    return await r.json()
  } finally { clearTimeout(t) }
}

const clamp01 = (n: unknown) => Math.min(1, Math.max(0, typeof n === 'number' ? n : 0.5))

async function analyzeBatch(photos: InPhoto[]): Promise<Analysis[]> {
  const fallback = () => photos.map((p) => ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false }))
  const withUrl = photos.filter((p) => p.url)
  if (!withUrl.length) return fallback()
  const sys = [
    'Sei un art director di album di matrimonio. Guarda ogni foto e dai un giudizio tecnico per impaginarla.',
    `Per OGNI foto: moment (uno tra: ${MOMENTS.join(', ')}), caption (max 6 parole), fx e fy = punto focale del soggetto 0..1 (dove NON tagliare; 0,0=alto-sx, 1,1=basso-dx), hero=true se scatto forte da valorizzare grande.`,
    'Le foto sono nell\'ordine degli id elencati. Rispondi SOLO JSON: {"a":[{"id","moment","caption","fx","fy","hero"}]}.',
  ].join('\n')
  const content: any[] = [{ type: 'text', text: `Foto in ordine, id: ${withUrl.map((p) => p.id).join(', ')}` }]
  for (const p of withUrl) content.push({ type: 'image_url', image_url: { url: p.url as string, detail: 'low' } })
  try {
    const data = await openai({ model: OPENAI_MODEL, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content }] })
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
    const arr = Array.isArray(parsed?.a) ? parsed.a : (Array.isArray(parsed) ? parsed : [])
    const out: Analysis[] = arr.map((x: any) => ({
      id: String(x?.id ?? ''), moment: MOMENTS.includes(x?.moment) ? x.moment : 'dettagli',
      caption: typeof x?.caption === 'string' ? x.caption.slice(0, 60) : '', fx: clamp01(x?.fx), fy: clamp01(x?.fy), hero: !!x?.hero,
    })).filter((x: Analysis) => x.id)
    const byId = new Map(out.map((a) => [a.id, a]))
    return photos.map((p) => byId.get(p.id) ?? { id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false })
  } catch (e) { throw new Error(`vision: ${String((e as Error)?.message ?? e).slice(0, 160)}`) }
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(items.length); let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; res[k] = await fn(items[k]) } })
  await Promise.all(workers); return res
}

// ── RANKING QUALITÀ DI STAMPA (tecnico) ──────────────────────────────────────────────────────
// Valuta a vista (dettaglio alto) i criteri tecnici REALI. Onesto sui limiti: rumore/nitidezza fine
// da un'anteprima web sono "indicativi" (il ridimensionamento nasconde il rumore).
const QUALITY_ISSUES = ['neri_chiusi','luci_bruciate','sottoesposta','sovraesposta','poco_contrasto','troppo_contrasto','dominante_colore','mosso','fuori_fuoco','rumore','ok']
type QScore = { id: string; score: number; issues: string[]; reason: string }
async function qualityBatch(photos: { id: string; url?: string | null }[], model: string): Promise<QScore[]> {
  const withUrl = photos.filter((p) => p.url)
  if (!withUrl.length) return photos.map((p) => ({ id: p.id, score: 0, issues: [], reason: 'anteprima non disponibile' }))
  const sys = [
    'Sei un fotografo esperto di STAMPA. Valuta la qualità TECNICA di stampa di ogni foto, seriamente.',
    `Per OGNI foto dai: score 0-100 (idoneità alla stampa), issues (array tra: ${QUALITY_ISSUES.join(', ')}), reason (1 frase tecnica in italiano).`,
    'Criteri: esposizione, neri chiusi (ombre senza dettaglio), alte luci bruciate, contrasto, dominante colore, messa a fuoco/mosso, rumore.',
    "Sii onesto: se rumore o nitidezza fine non sono giudicabili dall'anteprima, dillo nella reason e non penalizzare a caso.",
    'Le foto sono nell\'ordine degli id elencati. Rispondi SOLO JSON: {"q":[{"id","score","issues","reason"}]}.',
  ].join('\n')
  const content: any[] = [{ type: 'text', text: `Foto in ordine, id: ${withUrl.map((p) => p.id).join(', ')}` }]
  for (const p of withUrl) content.push({ type: 'image_url', image_url: { url: p.url as string, detail: 'high' } })
  try {
    const data = await openai({ model, temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content }] })
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
    const arr = Array.isArray(parsed?.q) ? parsed.q : (Array.isArray(parsed) ? parsed : [])
    const out: QScore[] = arr.map((x: any) => ({
      id: String(x?.id ?? ''),
      score: Math.max(0, Math.min(100, Math.round(typeof x?.score === 'number' ? x.score : 0))),
      issues: Array.isArray(x?.issues) ? x.issues.filter((i: any) => QUALITY_ISSUES.includes(i)).slice(0, 5) : [],
      reason: typeof x?.reason === 'string' ? x.reason.slice(0, 140) : '',
    })).filter((x: QScore) => x.id)
    const byId = new Map(out.map((a) => [a.id, a]))
    return photos.map((p) => byId.get(p.id) ?? { id: p.id, score: 0, issues: [], reason: 'non valutata' })
  } catch (e) { throw new Error(`quality: ${String((e as Error)?.message ?? e).slice(0, 160)}`) }
}

// Raggruppamento EURISTICO (fallback senza AI): ordina per momento e spezza in tavole da maxPer.
function heuristicGroup(analyses: Analysis[], maxPer: number): { photoIds: string[]; note?: string }[] {
  const sorted = [...analyses].sort((a, b) => (M_ORDER.get(a.moment) ?? 99) - (M_ORDER.get(b.moment) ?? 99))
  const tavole: { photoIds: string[]; note?: string }[] = []
  let cur: string[] = []; let curM = ''
  for (const a of sorted) {
    if (cur.length >= maxPer || (curM && a.moment !== curM && cur.length >= 2)) { tavole.push({ photoIds: cur, note: curM }); cur = []; }
    if (!cur.length) curM = a.moment
    cur.push(a.id)
  }
  if (cur.length) tavole.push({ photoIds: cur, note: curM })
  return tavole
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!OPENAI_API_KEY) return json({ error: 'missing_openai_key', hint: 'Imposta il secret OPENAI_API_KEY' }, 503)

  let body: { photos?: InPhoto[]; format?: string; eventTerm?: string; maxPerSpread?: number; style?: string; styleProfile?: { perSpread: number; times: number }[] }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const photos = (body.photos ?? []).filter((p) => p && typeof p.id === 'string').slice(0, 400)
  if (!photos.length) return json({ error: 'no_photos' }, 400)

  // ── MODALITÀ RANKING QUALITÀ (on-demand): valuta a vista i criteri tecnici di stampa ──
  if ((body as { mode?: string }).mode === 'quality') {
    const qModel = Deno.env.get('OPENAI_QUALITY_MODEL') ?? 'gpt-4o'   // dettaglio alto: serve il modello grande
    const qBatches: { id: string; url?: string | null }[][] = []
    for (let k = 0; k < photos.length; k += 5) qBatches.push(photos.slice(k, k + 5)) // batch piccoli (detail high)
    const qReasons: string[] = []
    const results = await pool(qBatches, 2, async (b) => {
      try { return await qualityBatch(b, qModel) }
      catch (e) { qReasons.push(String((e as Error)?.message ?? e).slice(0, 120)); return b.map((p) => ({ id: p.id, score: 0, issues: [], reason: 'non valutata (errore)' })) }
    })
    const scores: Record<string, { score: number; issues: string[]; reason: string }> = {}
    for (const q of results.flat()) scores[q.id] = { score: q.score, issues: q.issues, reason: q.reason }
    const rated = Object.values(scores).filter((s) => s.score > 0).length
    return json({ scores, rated, degraded: qReasons.length > 0, reason: qReasons.slice(0, 2).join(' · ') || undefined, model: qModel })
  }

  // STILE di impaginazione scelto dal fotografo: cambia cadenza + criterio di composizione.
  const STYLE_GUIDE: Record<string, { hint: string; maxPer: number }> = {
    narrativo:    { maxPer: 6, hint: 'STILE NARRATIVO: racconto cronologico fitto in stile reportage — molte foto che scorrono, sequenza degli attimi, tavole piene e ritmo continuo.' },
    editoriale:   { maxPer: 3, hint: 'STILE EDITORIALE (magazine): molto respiro e spazio bianco, 1-3 foto forti per tavola, gli scatti hero grandi e isolati, composizioni pulite.' },
    ritrattistico:{ maxPer: 4, hint: 'STILE RITRATTISTICO: valorizza ritratti e persone — primi piani e coppie in grande, i volti sono protagonisti, poche foto per tavola.' },
    dettaglio:    { maxPer: 6, hint: 'STILE DETTAGLIO: valorizza dettagli, oggetti e allestimenti (bouquet, fedi, mise en place, close-up) raggruppati per tema, tavole ricche e curate.' },
  }
  const styleG = STYLE_GUIDE[typeof body.style === 'string' ? body.style : '']
  const maxPer = Math.min(6, Math.max(1, body.maxPerSpread ?? styleG?.maxPer ?? 5))
  const term = (body.eventTerm ?? 'matrimonio').replace(/[^\p{L}\s]/gu, '').slice(0, 40)
  const style = (body.styleProfile ?? []).filter((s) => s && s.perSpread > 0 && s.times > 0).slice(0, 6)
  const styleHint = style.length
    ? `STILE DEL FOTOGRAFO (rispettalo): foto per tavola più usate: ${style.map((s) => `${s.perSpread} (${s.times}x)`).join(', ')}. Preferito: ${style[0]!.perSpread}.`
    : 'Nessun modello salvato: ritmo elegante e vario (alterna tavole piene e tavole con 1 scatto forte).'

  const reasons: string[] = []

  // ── FASE A: analisi visiva (con fallback ai tag) ──
  const toSee = photos.slice(0, MAX_VISION)
  const rest = photos.slice(MAX_VISION)
  const batches: InPhoto[][] = []
  for (let k = 0; k < toSee.length; k += BATCH) batches.push(toSee.slice(k, k + BATCH))
  let analyses: Analysis[] = []
  let visionOk = 0
  try {
    const results = await pool(batches, CONCURRENCY, async (b) => {
      try { const r = await analyzeBatch(b); visionOk += b.length; return r }
      catch (e) { reasons.push(String((e as Error)?.message ?? e).slice(0, 120)); return b.map((p) => ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false })) }
    })
    analyses = results.flat()
  } catch (e) {
    reasons.push(`vision_pool: ${String((e as Error)?.message ?? e).slice(0, 100)}`)
    analyses = toSee.map((p) => ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false }))
  }
  for (const p of rest) analyses.push({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false })
  const focus: Record<string, { fx: number; fy: number; hero: boolean; moment: string }> = {}
  for (const a of analyses) focus[a.id] = { fx: a.fx, fy: a.fy, hero: a.hero, moment: a.moment }

  // ── FASE B: composizione (testo), con fallback euristico ──
  let rawTavole: { photoIds?: string[]; note?: string }[] = []
  try {
    const sysB = [
      `Sei un art director esperto di album di ${term}. Impagini al posto del fotografo, con un criterio preciso — MAI a caso.`,
      'Ricevi le foto GIÀ ANALIZZATE a vista: [id, m=momento, c=didascalia di cosa si vede, h=1 se scatto forte].',
      'Ragiona in due passi:',
      '1) ORDINA tutte le foto in un racconto coerente: cronologia del giorno seguendo i momenti (preparativi → cerimonia → ricevimento → festa), e dentro lo stesso momento tieni vicine le foto della STESSA scena/soggetto (leggi la didascalia c).',
      `2) SPEZZA la sequenza in "tavole" (doppie pagine) da 1 a ${maxPer} foto: ogni tavola è UN momento/scena coerente — NON mischiare mai momenti diversi nella stessa tavola. Uno scatto forte (h=1) va valorizzato: da solo o con 1-2 di supporto.`,
      'Bilancia orizzontali e verticali nella stessa tavola. La "note" di ogni tavola dice il momento (1-4 parole).',
      ...(styleG ? [`Applica inoltre lo ${styleG.hint}`] : []),
      styleHint,
      'Ogni foto UNA sola volta; usa SOLO gli id ricevuti. Rispondi SOLO JSON: {"tavole":[{"photoIds":["id"],"note":"..."}]}.',
    ].join('\n')
    const compact = analyses.map((a) => ({ id: a.id, m: a.moment, c: a.caption, h: a.hero ? 1 : 0 }))
    const data = await openai({ model: OPENAI_TEXT_MODEL, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sysB }, { role: 'user', content: `Foto (${compact.length}):\n${JSON.stringify(compact)}` }] })
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
    rawTavole = Array.isArray(parsed?.tavole) ? parsed.tavole : []
    if (!rawTavole.length) throw new Error('nessuna tavola dal modello')
  } catch (e) {
    reasons.push(`group: ${String((e as Error)?.message ?? e).slice(0, 120)}`)
    rawTavole = heuristicGroup(analyses, maxPer)
  }

  // SANIFICA: solo id noti, dedup, nessuna foto persa
  const known = new Set(photos.map((p) => p.id))
  const used = new Set<string>()
  const tavole: { photoIds: string[]; note?: string }[] = []
  for (const t of rawTavole) {
    const ids = (t?.photoIds ?? []).filter((id) => known.has(id) && !used.has(id)).slice(0, maxPer)
    if (!ids.length) continue
    ids.forEach((id) => used.add(id)); tavole.push({ photoIds: ids, note: typeof t?.note === 'string' ? t.note.slice(0, 40) : undefined })
  }
  const missing = photos.map((p) => p.id).filter((id) => !used.has(id))
  for (let i = 0; i < missing.length; i += maxPer) tavole.push({ photoIds: missing.slice(i, i + maxPer), note: 'extra' })
  if (!tavole.length) return json({ error: 'ai_empty' }, 502)

  const degraded = reasons.length > 0
  return json({ tavole, focus, seen: visionOk, degraded, reason: degraded ? reasons.slice(0, 2).join(' · ') : undefined, model: OPENAI_MODEL })
})
