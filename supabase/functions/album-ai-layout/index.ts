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
const QUALITY_ISSUES = ['bassa_risoluzione','fuori_fuoco','mosso','luci_bruciate','neri_chiusi','sottoesposta','sovraesposta','poco_contrasto','troppo_contrasto','dominante_colore','incarnati','rumore','banding','aberrazione_cromatica','artefatti_jpeg','fuori_gamut','aloni_nitidezza','ok']
type QScore = { id: string; score: number; issues: string[]; reason: string; advice: string }
async function qualityBatch(photos: { id: string; url?: string | null }[], model: string): Promise<QScore[]> {
  const withUrl = photos.filter((p) => p.url)
  if (!withUrl.length) return photos.map((p) => ({ id: p.id, score: 0, issues: [], reason: 'anteprima non disponibile', advice: '' }))
  const sys = [
    "Sei l'operatore del LABORATORIO DI STAMPA fine-art che fa il controllo file PRIMA di stampare un album di nozze. Giudica SOLO in ottica STAMPA, come faresti al prepress: cosa reggerà sulla carta e cosa no. Estremamente tecnico, nessun complimento, niente giudizio artistico/estetico.",
    `Per OGNI foto: score 0-100 = IDONEITÀ ALLA STAMPA in album (300 dpi, carta fine-art), issues (array tra: ${QUALITY_ISSUES.join(', ')}), reason (1 frase, diagnosi da prepress), advice (correzione da fare prima di mandare in stampa).`,
    'CONTROLLI DEL LABORATORIO (in ordine di gravità):',
    '• RISOLUZIONE/NITIDEZZA reale: la foto regge l\'ingrandimento in tavola o appare morbida/interpolata/upscalata? (bassa_risoluzione). Micro-mosso o fuori fuoco sul soggetto = scarto (mosso/fuori_fuoco).',
    '• CLIPPING non recuperabile: alte luci bruciate a 255 senza dettaglio (abito, cielo) = luci_bruciate; ombre bloccate a 0 che in stampa diventano nero pieno impastato = neri_chiusi. In stampa NON si recupera ciò che è clippato.',
    '• ESPOSIZIONE: sotto/sovraesposta (in stampa la carta scurisce ~mezzo stop, va valutato per il supporto).',
    '• BILANCIAMENTO DEL BIANCO / dominante colore: le dominanti in stampa si amplificano; gli INCARNATI fuori tono sono il difetto più visibile in un album (incarnati).',
    '• CONTRASTO/CURVA per la carta (poco_contrasto smorto / troppo_contrasto che chiude i neri).',
    '• RUMORE luminanza/cromatico (in stampa fine si vede più che a schermo), BANDING nelle sfumature/cieli (posterizzazione), ARTEFATTI JPEG da compressione, ALONI da over-sharpen ai bordi, ABERRAZIONE cromatica ai contorni.',
    '• GAMUT: colori troppo saturi/elettrici (blu, magenta, verdi al neon) fuori dal gamut CMYK/carta → vireranno in stampa (fuori_gamut).',
    'PESI: risoluzione/fuoco/mosso e clipping non recuperabile pesano di più (difetti "duri", score basso); dominanti/contrasto/rumore lievi sono correggibili (score medio-alto).',
    'advice = azioni concrete da prepress prima della stampa, es.: "recupera alte luci -0.5 stop sull\'abito o vira in b/n", "apri le ombre +0.6 e alza il punto di nero a 12/255 per non impastare in stampa", "correggi WB dominante magenta ~+6, ribilancia gli incarnati", "denoise luminanza + leggero sharpen output a 300dpi", "desatura il blu del cielo ~-15 per rientrare in gamut CMYK", "ristampa max a dimensione ridotta: file morbido, non regge la pagina intera".',
    "Onestà sui limiti dell'anteprima web: rumore fine, banding lieve e micro-nitidezza sono INDICATIVI (il ridimensionamento li maschera) → dillo nella reason e non penalizzare a caso; risoluzione insufficiente ed evidente morbidezza invece si vedono.",
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

  let body: { photos?: InPhoto[]; analyses?: Analysis[]; format?: string; albumOrient?: string; eventTerm?: string; maxPerSpread?: number; style?: string; groupBw?: boolean; chronological?: boolean; doublePct?: number; fullPct?: number; maxPages?: number; styleProfile?: { perSpread: number; times: number }[]; learnedStyle?: { fullbleedPct?: number; avgPhotos?: number; whiteAvg?: number; vertPct?: number; horizPct?: number } }
  try { body = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const photos = (body.photos ?? []).filter((p) => p && typeof p.id === 'string').slice(0, 400)
  // NB: la modalità "learn" (Il mio stile) manda `images`, NON `photos` → non applicare qui la guardia
  if (!photos.length && (body as { mode?: string }).mode !== 'learn') return json({ error: 'no_photos' }, 400)
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

  // ── MODALITÀ "IL MIO STILE" (learn): estrae la geometria delle tavole di un album caricato ──
  if ((body as { mode?: string }).mode === 'learn') {
    const imgs = ((body as { images?: string[] }).images ?? []).filter((x) => typeof x === 'string' && x.length > 20).slice(0, 80)
    if (!imgs.length) return json({ error: 'no_images' }, 400)
    const lModels = [...new Set([Deno.env.get('OPENAI_QUALITY_MODEL') ?? '', 'gpt-4o', 'gpt-4o-mini'].filter((x) => x))]
    const lReasons: string[] = []
    const sysL = [
      "Guarda questa TAVOLA di un album fotografico (una doppia pagina). Estrai la GEOMETRIA dell'impaginazione, come la userebbe un impaginatore.",
      'Per OGNI foto presente dai il riquadro in frazioni 0..1 della tavola: x,y = angolo in alto a sinistra, w,h = larghezza/altezza. n = numero di foto.',
      'fullbleed = true se UNA foto occupa tutta la tavola bordo a bordo. bw = true se la tavola è in bianco e nero. white = quanto spazio bianco/vuoto attorno alle foto (0 nessuno … 1 moltissimo).',
      'vert = numero di foto VERTICALI (ritratto, più alte che larghe) nella tavola. horiz = numero di foto ORIZZONTALI (paesaggio, più larghe che alte).',
      'Rispondi SOLO JSON: {"n","boxes":[{"x","y","w","h"}],"fullbleed","bw","white","vert","horiz"}.',
    ].join('\n')
    const analyzeOne = async (img: string) => {
      let lastErr = ''
      for (let mi = 0; mi < lModels.length; mi++) {
        try {
          const data = await openai({ model: lModels[mi], temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sysL }, { role: 'user', content: [{ type: 'image_url', image_url: { url: img, detail: 'high' } }] }] })
          const p = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
          const boxes = Array.isArray(p?.boxes) ? p.boxes.map((b: any) => ({ x: clamp01(b?.x), y: clamp01(b?.y), w: clamp01(b?.w), h: clamp01(b?.h) })).filter((b: any) => b.w > 0.02 && b.h > 0.02).slice(0, 24) : []
          const n = Number.isFinite(p?.n) ? Math.max(0, Math.round(p.n)) : boxes.length
          const vert = Number.isFinite(p?.vert) ? Math.max(0, Math.round(p.vert)) : 0
          const horiz = Number.isFinite(p?.horiz) ? Math.max(0, Math.round(p.horiz)) : 0
          return { n, boxes, fullbleed: !!p?.fullbleed, bw: !!p?.bw, white: Number.isFinite(p?.white) ? clamp01(p.white) : 0, vert, horiz }
        } catch (e) { lastErr = String((e as Error)?.message ?? e).slice(0, 160); /* prova il modello successivo */ }
      }
      if (lastErr) lReasons.push(lastErr)
      return { n: 0, boxes: [], fullbleed: false, bw: false, white: 0, vert: 0, horiz: 0 }
    }
    const spreads = (await pool(imgs, 3, analyzeOne)).filter((s) => s.n > 0)
    // Se NON ha letto niente, di' PERCHÉ (prima falliva in silenzio → "non legge il pdf")
    if (!spreads.length) return json({ spreads: [], profile: { perSpread: [], fullbleedPct: 0, bwPct: 0, whiteAvg: 0, avgPhotos: 0, samples: 0 }, error: 'vision_failed', reason: lReasons.slice(0, 2).join(' · ') || 'nessuna tavola riconosciuta' }, 200)
    // aggregato: distribuzione foto/tavola + percentuali
    const counts = new Map<number, number>()
    let full = 0, bw = 0, whiteSum = 0
    for (const s of spreads) { counts.set(s.n, (counts.get(s.n) ?? 0) + 1); if (s.fullbleed) full++; if (s.bw) bw++; whiteSum += s.white }
    const perSpread = [...counts.entries()].map(([perSpread, times]) => ({ perSpread, times })).sort((a, b) => b.times - a.times)
    const tot = spreads.length || 1
    const profile = { perSpread, fullbleedPct: Math.round((full / tot) * 100), bwPct: Math.round((bw / tot) * 100), whiteAvg: Math.round((whiteSum / tot) * 100) / 100, avgPhotos: Math.round((spreads.reduce((s, x) => s + x.n, 0) / tot) * 10) / 10, samples: spreads.length }
    return json({ spreads, profile })
  }

  // ── MODALITÀ "ANALIZZA" (un batch di foto alla volta): serve al client per la BARRA di
  //    avanzamento reale. Il client chiama questa per gruppi di foto, poi manda le analisi a comporre.
  if ((body as { mode?: string }).mode === 'analyze') {
    const batch = photos.slice(0, 40)
    try {
      const a = await analyzeBatch(batch)
      return json({ analyses: a, visionOk: a.filter((x) => (x.people ?? 0) >= 0 && (x.fx !== 0.5 || x.fy !== 0.5 || x.caption)).length })
    } catch (e) {
      // degrada ai tag: non blocca la barra, segnala il motivo
      return json({ analyses: batch.map((p) => ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false })), error: 'vision_failed', reason: String((e as Error)?.message ?? e).slice(0, 140) })
    }
  }

  // ── MODALITÀ "AI SELEZIONA" (curate): la coppia dà TROPPE foto e ripete i momenti → l'AI cura
  //    una selezione più stretta che racconta meglio, con respiro. Ritorna keep + drop(con motivo). ──
  if ((body as { mode?: string }).mode === 'curate') {
    const items = Array.isArray(body.analyses) ? body.analyses.filter((a) => a && typeof a.id === 'string') : []
    if (items.length < 2) return json({ keep: items.map((a) => a.id), drop: [] })
    const target = Math.max(0, Math.min(600, Math.round((body as { target?: number }).target ?? 0)))
    const likeById = new Map((body.photos ?? []).map((p) => [p.id, Math.max(0, Math.round(p.likes ?? 0))]))
    const compact = items.map((a) => ({ id: a.id, m: a.moment, c: a.caption, s: a.subjects ?? '', ppl: a.people ?? 0, bw: a.bw ? 1 : 0, h: a.hero ? 1 : 0, imp: likeById.get(a.id) ?? 0 }))
    const term = (body.eventTerm ?? 'matrimonio').replace(/[^\p{L}\s]/gu, '').slice(0, 40)
    const sysC = [
      `Sei un art director di album di ${term}. La coppia ha selezionato TROPPE foto (${items.length}) e ripete gli stessi momenti: troppe foto tolgono RESPIRO e qualità all'album.`,
      'Cura una SELEZIONE PIÙ STRETTA che racconti BENE la giornata: elimina i QUASI-DUPLICATI (stesso momento+soggetto in scatti consecutivi/vicini), le ripetizioni e gli scatti più deboli; TIENI il meglio di ogni momento, gli scatti forti (h=1), i picchi emotivi, la varietà di soggetti/scene.',
      "REGOLA: non cancellare interi momenti — tieni almeno 1-2 foto per ogni momento presente. Bilancia il racconto (preparativi→cerimonia→ricevimento→festa).",
      'Le foto sono in ORDINE CRONOLOGICO: i quasi-duplicati sono spesso vicini nell\'elenco.',
      target > 0 ? `Obiettivo: circa ${target} foto da TENERE (puoi discostarti di poco).` : 'Scegli TU il numero ideale da tenere: di solito 45-60% del totale, MAI meno del 40%.',
      'Rispondi SOLO JSON {"keep":["id",...],"drop":[{"id":"id","reason":"..."}]}. reason breve tra: ripetizione, quasi-duplicato, scatto debole, momento sovrarappresentato.',
    ].join('\n')
    let cModel = ''
    try {
      let data: any
      for (let mi = 0; mi < TEXT_MODELS.length; mi++) {
        const mdl = TEXT_MODELS[mi]!
        try { data = await openai({ model: mdl, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: sysC }, { role: 'user', content: `Foto (${compact.length}), ordine cronologico:\n${JSON.stringify(compact)}` }] }); cModel = mdl; break }
        catch (e) { if (/model|404|does not exist|not found|no access|does not have access|invalid model/i.test(String(e)) && mi < TEXT_MODELS.length - 1) continue; throw e }
      }
      const parsed = JSON.parse(data?.choices?.[0]?.message?.content ?? '{}')
      const known = new Set(items.map((a) => a.id))
      const keepSet = new Set((Array.isArray(parsed?.keep) ? parsed.keep : []).filter((id: unknown) => typeof id === 'string' && known.has(id)))
      if (!keepSet.size) return json({ keep: items.map((a) => a.id), drop: [], degraded: true, reason: 'il modello non ha selezionato nulla' })
      const dropReason = new Map((Array.isArray(parsed?.drop) ? parsed.drop : []).filter((d: any) => d && typeof d.id === 'string').map((d: any) => [d.id, typeof d.reason === 'string' ? d.reason.slice(0, 40) : '']))
      const drop = items.filter((a) => !keepSet.has(a.id)).map((a) => ({ id: a.id, reason: (dropReason.get(a.id) as string) || 'momento sovrarappresentato' }))
      return json({ keep: [...keepSet], drop, target: keepSet.size, model: cModel })
    } catch (e) {
      return json({ keep: items.map((a) => a.id), drop: [], degraded: true, reason: String((e as Error)?.message ?? e).slice(0, 140) })
    }
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
  let analyses: Analysis[] = []
  let visionOk = 0
  const precomputed = Array.isArray(body.analyses) ? body.analyses.filter((a) => a && typeof a.id === 'string') : null
  if (precomputed && precomputed.length) {
    // Il CLIENT ha già fatto la vision a batch (barra di avanzamento reale) → qui componiamo soltanto.
    const byId = new Map(precomputed.map((a) => [a.id, a]))
    analyses = photos.map((p) => byId.get(p.id) ?? ({ id: p.id, moment: p.moment ?? 'dettagli', caption: '', fx: 0.5, fy: 0.5, hero: false }))
    visionOk = analyses.filter((a) => byId.has(a.id) && (a.fx !== 0.5 || a.fy !== 0.5 || !!a.caption || (a.people ?? 0) > 0)).length
  } else {
    const toSee = photos.slice(0, MAX_VISION)
    const rest = photos.slice(MAX_VISION)
    const batches: InPhoto[][] = []
    for (let k = 0; k < toSee.length; k += BATCH) batches.push(toSee.slice(k, k + BATCH))
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
  }
  const focus: Record<string, { fx: number; fy: number; hero: boolean; moment: string; face: boolean; people: number; ht?: number; hb?: number; sx?: number; sr?: number }> = {}
  for (const a of analyses) focus[a.id] = { fx: a.fx, fy: a.fy, hero: a.hero, moment: a.moment, face: (a.people ?? 0) > 0, people: a.people ?? 0, ht: a.ht, hb: a.hb, sx: a.sx, sr: a.sr }
  const facesFound = Object.values(focus).filter((f) => f.face).length

  // ── FASE B: composizione (testo), con fallback euristico ──
  let rawTavole: { photoIds?: string[]; note?: string; layout?: string }[] = []
  let composeModel = ''
  try {
    const sysB = [
      `Sei un art director esperto di album di ${term}. Impagini al posto del fotografo, con un criterio preciso — MAI a caso.`,
      `Ricevi le foto GIÀ ANALIZZATE a vista: [id, m=momento, c=didascalia, s=soggetto (sposi/coppia/gruppo/dettaglio…), ppl=n. persone, h=1 scatto forte, o=orientamento (H orizzontale, V verticale, Q quadrata), imp=importanza per la coppia].`,
      `L'ALBUM è ${body.albumOrient === 'orizzontale' ? 'ORIZZONTALE' : body.albumOrient === 'quadrato' ? 'QUADRATO' : 'VERTICALE'} (forma della pagina singola). La DOPPIA PAGINA è sempre un rettangolo LARGO (orizzontale, 2 pagine affiancate).`,
      chronoStrict
        ? 'IMPORTANTE: le foto arrivano GIÀ IN ORDINE CRONOLOGICO DI SCATTO (orario reale). RISPETTA rigorosamente questa sequenza: è il racconto del giorno.'
        : "Le foto arrivano in ordine cronologico di scatto come RIFERIMENTO, ma per lo stile scelto PRIORITIZZA il criterio dello stile (sotto) sull'ordine temporale: puoi raggruppare per soggetto/tema/impatto anche foto non consecutive.",
      'Ragiona in due passi:',
      chronoStrict
        ? '1) Scorri la sequenza cronologica e individua dove CAMBIA scena/momento (usa m e s).'
        : '1) Raggruppa le foto secondo il criterio dello stile (soggetto/tema/impatto), usando m e s.',
      `2) Forma "tavole" (doppie pagine) da 1 a ${maxPer} foto: ogni tavola è UNA scena/tema coerente — NON mischiare cose diverse nella stessa tavola.`,
      'Per ogni tavola puoi indicare "layout": "double" = 1 sola foto a doppia pagina (full-bleed); "full" = 1 foto dominante a pagina intera + poche piccole; altrimenti ometti (griglia).',
      'PROPORZIONI (regola FERREA, sennò l\'album viene sbagliato):',
      '• "double" (doppia pagina, area LARGA) → SOLO una foto ORIZZONTALE (o=H). MAI verticali (o=V) o quadrate o gruppi a doppia pagina: una verticale su doppia pagina viene tagliata (teste mozzate) o lascia enormi bande vuote.',
      ...(body.albumOrient !== 'orizzontale' ? [
        '• "full" (una foto che riempie una PAGINA SINGOLA, che qui è VERTICALE) → SOLO una foto VERTICALE (o=V). Una orizzontale da sola su pagina verticale spreca metà pagina.',
        '• Nelle tavole normali (griglia): NON mettere UNA SOLA foto orizzontale da sola su una pagina verticale. Le orizzontali (o=H) accoppiale a due (una sopra l\'altra) o in strisce/griglia; le verticali (o=V) stanno bene singole o affiancate a coppie; le quadrate ovunque.',
      ] : [
        '• "full" (una foto che riempie una PAGINA SINGOLA, qui ORIZZONTALE) → preferisci una foto ORIZZONTALE (o=H).',
      ]),
      ...(targetDouble > 0 ? [`Fai circa ${targetDouble} tavole "double": scegli le foto ORIZZONTALI (o=H) più forti/importanti (imp/h alti). Se non ci sono abbastanza orizzontali forti, fanne MENO — non forzare mai una verticale a doppia pagina.`] : []),
      ...(targetFull > 0 ? [`Fai circa ${targetFull} tavole "full" con una foto forte ${body.albumOrient !== 'orizzontale' ? 'VERTICALE (o=V)' : 'ORIZZONTALE (o=H)'}.`] : []),
      ...(targetDouble === 0 && targetFull === 0 ? ['Valorizza gli scatti forti: qualcuno da solo a doppia pagina ("double"), con parsimonia.'] : []),
      'Bilancia orizzontali e verticali. La "note" dice il momento (1-4 parole).',
      'NON tagliare né spremere le foto: se una scena ha bisogno di spazio, usa tavole con POCHE foto (o una sola). Meglio PIÙ tavole che foto sacrificate.',
      ...(maxSpreads > 0 ? [`Non superare ${maxSpreads} tavole in totale (${maxSpreads * 2} pagine): se le foto sono tante, aumenta le foto per tavola per rientrare nel limite.`] : []),
      ...(body.groupBw ? ['Le foto in BIANCO E NERO (bw=1) vanno tenute INSIEME e NON mischiate col colore: tavole dedicate.'] : []),
      ...(styleG ? [`Stile: ${styleG.hint}`] : []),
      ...(body.learnedStyle ? [`STILE APPRESO DAI SUOI ALBUM VERI (media su più album, imitalo fedelmente): in media ${body.learnedStyle.avgPhotos ?? '?'} foto per tavola; ${body.learnedStyle.fullbleedPct ?? 0}% delle tavole sono una foto a doppia pagina full-bleed; respiro/bianco ${((body.learnedStyle.whiteAvg ?? 0) >= 0.5) ? 'abbondante' : (body.learnedStyle.whiteAvg ?? 0) >= 0.25 ? 'medio' : 'contenuto'}${(body.learnedStyle.vertPct ?? 0) + (body.learnedStyle.horizPct ?? 0) > 0 ? `; usa circa ${body.learnedStyle.vertPct ?? 0}% foto verticali e ${body.learnedStyle.horizPct ?? 0}% orizzontali (rispetta l'orientamento reale delle foto, non forzare verticali in slot orizzontali)` : ''}.`] : []),
      styleHint,
      'Ogni foto UNA sola volta; usa SOLO gli id ricevuti. Rispondi SOLO JSON: {"tavole":[{"photoIds":["id"],"note":"...","layout":"double|full"}]} (layout opzionale).',
    ].join('\n')
    const likeById = new Map(photos.map((p) => [p.id, Math.max(0, Math.round(p.likes ?? 0))]))
    // o = orientamento della foto dal suo aspetto reale: H orizzontale, V verticale, Q quadrata.
    const orientOf = (asp: number) => (asp >= 1.15 ? 'H' : asp <= 0.87 ? 'V' : 'Q')
    const aspById = new Map(photos.map((p) => [p.id, typeof p.aspect === 'number' && p.aspect > 0 ? p.aspect : 1]))
    const compact = analyses.map((a) => ({ id: a.id, m: a.moment, c: a.caption, s: a.subjects ?? '', ppl: a.people ?? 0, bw: a.bw ? 1 : 0, h: a.hero ? 1 : 0, o: orientOf(aspById.get(a.id) ?? 1), imp: likeById.get(a.id) ?? 0 }))
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
