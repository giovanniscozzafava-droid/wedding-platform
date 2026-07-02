// Edge function: album-ai-layout (VISION, robusta)
// Impaginatore AI che GUARDA le foto. Due fasi:
//   A) ANALISI VISIVA (gpt-4o vision, batch): per foto → momento, didascalia, PUNTO FOCALE (fx,fy),
//      scatto forte (hero).
//   B) COMPOSIZIONE (testo): raggruppa in tavole + sequenza, rispetta lo stile del fotografo.
// ROBUSTA: se OpenAI fallisce (credito/accesso/timeout) NON dà errore secco → degrada e impagina
// comunque con un'euristica per momento, riportando il motivo (`degraded`+`reason`). Non-2xx SOLO per
// chiave mancante / niente foto / json rotto. Legge OPENAI_API_KEY (secret server). verify_jwt=true.

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? ''
// VISIONE (tante chiamate): CASCATA dal più preciso al sicuro (5.1 mappa bene i VOLTI). Override via
// env OPENAI_MODEL (es. 'gpt-4o-mini' per andare economici/veloci sui grandi album).
const OPENAI_VISION_OVERRIDE = Deno.env.get('OPENAI_MODEL') ?? ''
const VISION_MODELS = [...new Set([OPENAI_VISION_OVERRIDE, 'gpt-5.1', 'gpt-4o', 'gpt-4o-mini'].filter((x) => x))]
// COMPOSIZIONE (1 sola chiamata testo): CASCATA dal più avanzato al sicuro. Usa il primo modello a
// cui l'account ha davvero accesso (i non disponibili danno 404 e si saltano). Override env in testa.
const OPENAI_TEXT_OVERRIDE = Deno.env.get('OPENAI_TEXT_MODEL') ?? ''
const TEXT_MODELS = [...new Set([OPENAI_TEXT_OVERRIDE, 'gpt-5.5', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o'].filter((x) => x))]
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

type InPhoto = { id: string; url?: string | null; moment?: string | null; aspect?: number | null; likes?: number | null; takenAt?: number | null }
type Analysis = { id: string; moment: string; caption: string; fx: number; fy: number; hero: boolean; subjects?: string; people?: number; bw?: boolean; ht?: number; hb?: number; sx?: number; sr?: number }

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
    'Sei un art director di album di matrimonio. Guarda ogni foto (LEGGI I VOLTI e i soggetti) e dai un giudizio per impaginarla.',
    `Per OGNI foto: moment (uno tra: ${MOMENTS.join(', ')}), caption (max 6 parole su cosa si vede), subjects (uno tra: sposi, sposa, sposo, coppia, persona, gruppo, famiglia, dettaglio, ambiente), people (numero approssimativo di persone nel frame, 0 se nessuna), fx e fy = CENTRO DEL VOLTO del soggetto principale in frazioni 0..1 (0,0=alto-sx, 1,1=basso-dx; se più volti, il baricentro), hero=true se scatto forte da valorizzare grande.`,
    'RIQUADRO DI TUTTI I SOGGETTI (persone) da NON tagliare mai — 4 frazioni 0..1: ht = y del TOP della testa più alta, hb = y del punto più basso del corpo/mento visibile, sx = x del soggetto più a SINISTRA (bordo sinistro della persona più a sinistra), sr = x del soggetto più a DESTRA. Considera TUTTE le persone nel frame, non solo la principale. Se non ci sono persone: ht=0, hb=1, sx=0, sr=1.',
    'Aggiungi bw=true se la foto è in BIANCO E NERO (monocroma), false se a colori.',
    'Le foto sono nell\'ordine degli id elencati. Rispondi SOLO JSON: {"a":[{"id","moment","caption","subjects","people","bw","fx","fy","ht","hb","sx","sr","hero"}]}.',
  ].join('\n')
  const content: any[] = [{ type: 'text', text: `Foto in ordine, id: ${withUrl.map((p) => p.id).join(', ')}` }]
  for (const p of withUrl) content.push({ type: 'image_url', image_url: { url: p.url as string, detail: 'low' } })
  try {
    let data: any
    for (let mi = 0; mi < VISION_MODELS.length; mi++) {
      const mdl = VISION_MODELS[mi]!
      try { data = await openai({ model: mdl, temperature: 0.2, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sys }, { role: 'user', content }] }); break }
      catch (e) {
        // QUALUNQUE errore (modello non accessibile, niente supporto immagini, parametro non valido,
        // rate limit persistente) → prova il modello successivo. Così un modello che VEDE i volti c'è sempre.
        if (mi < VISION_MODELS.length - 1) continue
        throw e
      }
    }
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
    const arr = Array.isArray(parsed?.a) ? parsed.a : (Array.isArray(parsed) ? parsed : [])
    const out: Analysis[] = arr.map((x: any) => ({
      id: String(x?.id ?? ''), moment: MOMENTS.includes(x?.moment) ? x.moment : 'dettagli',
      caption: typeof x?.caption === 'string' ? x.caption.slice(0, 60) : '', fx: clamp01(x?.fx), fy: clamp01(x?.fy), hero: !!x?.hero,
      subjects: typeof x?.subjects === 'string' ? x.subjects.slice(0, 20) : undefined,
      people: Number.isFinite(x?.people) ? Math.max(0, Math.round(x.people)) : undefined,
      bw: typeof x?.bw === 'boolean' ? x.bw : undefined,
      ht: Number.isFinite(x?.ht) ? clamp01(x.ht) : undefined,
      hb: Number.isFinite(x?.hb) ? clamp01(x.hb) : undefined,
      sx: Number.isFinite(x?.sx) ? clamp01(x.sx) : undefined,
      sr: Number.isFinite(x?.sr) ? clamp01(x.sr) : undefined,
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
type QScore = { id: string; score: number; issues: string[]; reason: string; advice: string }
async function qualityBatch(photos: { id: string; url?: string | null }[], model: string): Promise<QScore[]> {
  const withUrl = photos.filter((p) => p.url)
  if (!withUrl.length) return photos.map((p) => ({ id: p.id, score: 0, issues: [], reason: 'anteprima non disponibile', advice: '' }))
  const sys = [
    'Sei un RETOUCHER e stampatore fine-art. Giudica la qualità TECNICA di stampa di ogni foto in modo ESTREMAMENTE TECNICO, senza complimenti.',
    `Per OGNI foto dai: score 0-100 (idoneità alla stampa), issues (array tra: ${QUALITY_ISSUES.join(', ')}), reason (1 frase, diagnosi tecnica).`,
    'advice = COSA FARE per migliorare la stampa, concreto e tecnico (1-2 azioni): es. "recupera ombre +0.6 stop, chiudi alte luci -0.4", "riduci rumore luminanza, +nitidezza output per stampa", "correggi dominante magenta ~+5, alza il punto di nero", "raddrizza orizzonte 1.5°, ricomponi in aureo", "aumenta micro-contrasto/chiarezza, satura selettivamente gli incarnati".',
    'Criteri: esposizione (stop), neri chiusi (ombre bloccate), alte luci bruciate (clipping), contrasto e curva, dominante colore/bilanciamento del bianco, messa a fuoco/mosso, rumore luminanza/cromatico, nitidezza per la stampa, orizzonte/prospettiva.',
    "Sii onesto sui limiti dell'anteprima (rumore e micro-nitidezza sono indicativi): dillo nella reason, non penalizzare a caso.",
    'Le foto sono nell\'ordine degli id elencati. Rispondi SOLO JSON: {"q":[{"id","score","issues","reason","advice"}]}.',
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
      advice: typeof x?.advice === 'string' ? x.advice.slice(0, 200) : '',
    })).filter((x: QScore) => x.id)
    const byId = new Map(out.map((a) => [a.id, a]))
    return photos.map((p) => byId.get(p.id) ?? { id: p.id, score: 0, issues: [], reason: 'non valutata', advice: '' })
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

  let body: { photos?: InPhoto[]; format?: string; eventTerm?: string; maxPerSpread?: number; style?: string; groupBw?: boolean; chronological?: boolean; doublePct?: number; fullPct?: number; maxPages?: number; styleProfile?: { perSpread: number; times: number }[] }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const photos = (body.photos ?? []).filter((p) => p && typeof p.id === 'string').slice(0, 400)
  if (!photos.length) return json({ error: 'no_photos' }, 400)
  // quante foto a DOPPIA PAGINA / PAGINA INTERA (dalle percentuali del brief, sul totale)
  const pct = (v: unknown) => Math.max(0, Math.min(40, typeof v === 'number' ? v : 0))
  const targetDouble = Math.round(photos.length * pct(body.doublePct) / 100)
  const targetFull = Math.round(photos.length * pct(body.fullPct) / 100)

  // ── MODALITÀ RANKING QUALITÀ (on-demand): valuta a vista i criteri tecnici di stampa ──
  if ((body as { mode?: string }).mode === 'quality') {
    const qModel = Deno.env.get('OPENAI_QUALITY_MODEL') ?? 'gpt-4o'   // dettaglio alto: serve il modello grande
    const qBatches: { id: string; url?: string | null }[][] = []
    for (let k = 0; k < photos.length; k += 5) qBatches.push(photos.slice(k, k + 5)) // batch piccoli (detail high)
    const qReasons: string[] = []
    const results = await pool(qBatches, 2, async (b) => {
      try { return await qualityBatch(b, qModel) }
      catch (e) { qReasons.push(String((e as Error)?.message ?? e).slice(0, 120)); return b.map((p) => ({ id: p.id, score: 0, issues: [], reason: 'non valutata (errore)', advice: '' })) }
    })
    const scores: Record<string, { score: number; issues: string[]; reason: string; advice: string }> = {}
    for (const q of results.flat()) scores[q.id] = { score: q.score, issues: q.issues, reason: q.reason, advice: q.advice }
    const rated = Object.values(scores).filter((s) => s.score > 0).length
    return json({ scores, rated, degraded: qReasons.length > 0, reason: qReasons.slice(0, 2).join(' · ') || undefined, model: qModel })
  }

  // STILE di impaginazione scelto dal fotografo: cambia cadenza + criterio di composizione.
  const STYLE_GUIDE: Record<string, { hint: string; maxPer: number; chrono: 'strict' | 'ref' }> = {
    fotografo:    { maxPer: 8, chrono: 'strict', hint: 'STILE DEL FOTOGRAFO (imita i suoi album): POCHE foto per tavola, tanto RESPIRO — spesso 1-2 foto per pagina (2-4 per tavola), a volte una foto sola. Ogni foto INTERA, mai tagliata. DOPPIA PAGINA (layout "double") SOLO per uno scatto ORIZZONTALE forte (auto, navata, coppia, brindisi) — MAI verticali o gruppi a doppia pagina. Verticali a coppie o in strisce di 3 (dettagli: scarpe, fedi, bouquet). GRUPPI e TAVOLATE in mosaici fitti da 6-9 foto. Bianco e nero in tavole dedicate. Segui la cronologia.' },
    narrativo:    { maxPer: 6, chrono: 'strict', hint: 'STILE NARRATIVO: comanda la CRONOLOGIA di scatto (EXIF). Racconto reportage fitto, molte foto che scorrono nella sequenza esatta degli attimi, ritmo continuo.' },
    editoriale:   { maxPer: 3, chrono: 'ref',    hint: 'STILE EDITORIALE (magazine): comandano gli SCATTI FORTI e il ritmo visivo. Molto respiro, 1-3 foto per tavola, gli hero grandi e isolati; la cronologia è solo uno sfondo.' },
    ritrattistico:{ maxPer: 4, chrono: 'ref',    hint: 'STILE RITRATTISTICO: comandano i RITRATTI e le PERSONE. Raggruppa per soggetto (sposi, coppie, volti), primi piani in grande, volti protagonisti; cronologia secondaria.' },
    dettaglio:    { maxPer: 6, chrono: 'ref',    hint: 'STILE DETTAGLIO: comandano i DETTAGLI e gli allestimenti. Raggruppa per TEMA (fedi, bouquet, mise en place, close-up), dettagli in evidenza; cronologia secondaria.' },
  }
  const styleG = STYLE_GUIDE[typeof body.style === 'string' ? body.style : '']
  const chronoStrict = !styleG || styleG.chrono === 'strict'   // narrativo (o nessuno stile) = cronologia rigida
  const maxPer = Math.min(24, Math.max(1, body.maxPerSpread ?? styleG?.maxPer ?? 5))
  const maxSpreads = body.maxPages && body.maxPages > 0 ? Math.max(1, Math.floor(body.maxPages / 2)) : 0 // tavola = 2 pagine
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
  const focus: Record<string, { fx: number; fy: number; hero: boolean; moment: string; face: boolean; people: number; ht?: number; hb?: number; sx?: number; sr?: number }> = {}
  for (const a of analyses) focus[a.id] = { fx: a.fx, fy: a.fy, hero: a.hero, moment: a.moment, face: (a.people ?? 0) > 0, people: a.people ?? 0, ht: a.ht, hb: a.hb, sx: a.sx, sr: a.sr }
  const facesFound = Object.values(focus).filter((f) => f.face).length

  // ── FASE B: composizione (testo), con fallback euristico ──
  let rawTavole: { photoIds?: string[]; note?: string; layout?: string }[] = []
  let composeModel = ''
  try {
    const sysB = [
      `Sei un art director esperto di album di ${term}. Impagini al posto del fotografo, con un criterio preciso — MAI a caso.`,
      'Ricevi le foto GIÀ ANALIZZATE a vista: [id, m=momento, c=didascalia, s=soggetto (sposi/coppia/gruppo/dettaglio…), ppl=n. persone, h=1 scatto forte, imp=importanza per la coppia].',
      chronoStrict
        ? 'IMPORTANTE: le foto arrivano GIÀ IN ORDINE CRONOLOGICO DI SCATTO (orario reale). RISPETTA rigorosamente questa sequenza: è il racconto del giorno.'
        : "Le foto arrivano in ordine cronologico di scatto come RIFERIMENTO, ma per lo stile scelto PRIORITIZZA il criterio dello stile (sotto) sull'ordine temporale: puoi raggruppare per soggetto/tema/impatto anche foto non consecutive.",
      'Ragiona in due passi:',
      chronoStrict
        ? '1) Scorri la sequenza cronologica e individua dove CAMBIA scena/momento (usa m e s).'
        : '1) Raggruppa le foto secondo il criterio dello stile (soggetto/tema/impatto), usando m e s.',
      `2) Forma "tavole" (doppie pagine) da 1 a ${maxPer} foto: ogni tavola è UNA scena/tema coerente — NON mischiare cose diverse nella stessa tavola.`,
      'Per ogni tavola puoi indicare "layout": "double" = 1 sola foto a doppia pagina (full-bleed); "full" = 1 foto dominante a pagina intera + poche piccole; altrimenti ometti (griglia).',
      'ATTENZIONE TESTE: NON usare "double" (doppia pagina orizzontale) per foto VERTICALI con persone/volti → il taglio taglierebbe le teste. Riserva "double" a foto ORIZZONTALI o a dettagli/paesaggi.',
      ...(targetDouble > 0 ? [`Metti circa ${targetDouble} foto (le più forti/importanti, imp/h alti) come tavole "double".`] : []),
      ...(targetFull > 0 ? [`Metti circa ${targetFull} foto forti come tavole "full".`] : []),
      ...(targetDouble === 0 && targetFull === 0 ? ['Valorizza gli scatti forti: qualcuno da solo a doppia pagina ("double"), con parsimonia.'] : []),
      'Bilancia orizzontali e verticali. La "note" dice il momento (1-4 parole).',
      'NON tagliare né spremere le foto: se una scena ha bisogno di spazio, usa tavole con POCHE foto (o una sola). Meglio PIÙ tavole che foto sacrificate.',
      ...(maxSpreads > 0 ? [`Non superare ${maxSpreads} tavole in totale (${maxSpreads * 2} pagine): se le foto sono tante, aumenta le foto per tavola per rientrare nel limite.`] : []),
      ...(body.groupBw ? ['Le foto in BIANCO E NERO (bw=1) vanno tenute INSIEME e NON mischiate col colore: tavole dedicate.'] : []),
      ...(styleG ? [`Stile: ${styleG.hint}`] : []),
      styleHint,
      'Ogni foto UNA sola volta; usa SOLO gli id ricevuti. Rispondi SOLO JSON: {"tavole":[{"photoIds":["id"],"note":"...","layout":"double|full"}]} (layout opzionale).',
    ].join('\n')
    const likeById = new Map(photos.map((p) => [p.id, Math.max(0, Math.round(p.likes ?? 0))]))
    const compact = analyses.map((a) => ({ id: a.id, m: a.moment, c: a.caption, s: a.subjects ?? '', ppl: a.people ?? 0, bw: a.bw ? 1 : 0, h: a.hero ? 1 : 0, imp: likeById.get(a.id) ?? 0 }))
    const msgsB = [{ role: 'system', content: sysB }, { role: 'user', content: `Foto (${compact.length}):\n${JSON.stringify(compact)}` }]
    let data: any
    // CASCATA modelli: prova dal più avanzato; salta quelli non accessibili (404/modello inesistente).
    for (let mi = 0; mi < TEXT_MODELS.length; mi++) {
      const mdl = TEXT_MODELS[mi]!
      try { data = await openai({ model: mdl, temperature: 0.4, response_format: { type: 'json_object' }, messages: msgsB }); composeModel = mdl; break }
      catch (e) {
        const isModelErr = /model|404|does not exist|not found|no access|does not have access|invalid model/i.test(String(e))
        if (isModelErr && mi < TEXT_MODELS.length - 1) { continue } // prova il prossimo
        throw e
      }
    }
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
  const tavole: { photoIds: string[]; note?: string; layout?: string }[] = []
  for (const t of rawTavole) {
    const ids = (t?.photoIds ?? []).filter((id) => known.has(id) && !used.has(id)).slice(0, maxPer)
    if (!ids.length) continue
    ids.forEach((id) => used.add(id))
    const lay = ((t as { layout?: string })?.layout === 'double' || (t as { layout?: string })?.layout === 'full') ? (t as { layout?: string }).layout : undefined
    tavole.push({ photoIds: ids, note: typeof t?.note === 'string' ? t.note.slice(0, 40) : undefined, layout: lay })
  }
  const missing = photos.map((p) => p.id).filter((id) => !used.has(id))
  for (let i = 0; i < missing.length; i += maxPer) tavole.push({ photoIds: missing.slice(i, i + maxPer), note: 'extra' })
  if (!tavole.length) return json({ error: 'ai_empty' }, 502)

  // TETTO PAGINE: se le tavole superano il massimo, riaccorpa TUTTE le foto (in ordine) in
  // esattamente maxSpreads tavole equilibrate → rientra nel limite senza perdere foto.
  let outTavole = tavole
  if (maxSpreads > 0 && tavole.length > maxSpreads) {
    const allIds = tavole.flatMap((t) => t.photoIds)
    const per = Math.ceil(allIds.length / maxSpreads)
    outTavole = []
    for (let i = 0; i < allIds.length; i += per) outTavole.push({ photoIds: allIds.slice(i, i + per), note: 'auto' })
  }

  const degraded = reasons.length > 0
  return json({ tavole: outTavole, focus, seen: visionOk, facesFound, tavoleCount: outTavole.length, degraded, reason: degraded ? reasons.slice(0, 2).join(' · ') : undefined, model: VISION_MODELS[0], composeModel: composeModel || 'euristica' })
})
