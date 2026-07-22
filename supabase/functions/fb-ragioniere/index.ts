// RAGIONIERE AI di una LOCATION: legge i dati gestionali di un evento (coperti, menu, food cost,
// preventivo) e FA QUADRARE I CONTI. I NUMERI sono calcolati qui (esatti, niente allucinazioni);
// l'AI fa il CONTROLLER: verdetto, scostamenti, rischi, consigli. Wallet AI a token (come fb-read-bolla).
// AI via layer unificato: Qwen primario, fallback OpenAI/Claude (_shared/ai.ts).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { aiChat, firstJson } from '../_shared/ai.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })
const eur = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100)

const SYS = `Sei il RAGIONIERE / controller di gestione di una location di ricevimenti. Ricevi i CONTI GIÀ
CALCOLATI di un evento (coperti previsti/confermati, food cost totale e per coperto, ricavo da preventivo,
costo preventivo, margine, incidenza food cost sul ricavo, dettaglio menu e diete). NON ricalcolare né
inventare numeri: usa SOLO quelli forniti. Il tuo compito è "far quadrare i conti": valutare la coerenza,
individuare SCOSTAMENTI e RISCHI (es. coperti confermati molto sotto i previsti; food cost troppo alto sul
ricavo — soglia sana ~28-35%; menu senza food cost calcolato; margine risicato; diete non coperte dal menu),
e dare CONSIGLI operativi concreti da controller. Parla italiano, founder-voice, diretto, niente fronzoli.
Rispondi ESCLUSIVAMENTE con JSON valido: {"verdetto":"ok|attenzione|critico","sintesi":"1-2 frasi",
"alert":["..."],"consigli":["..."],"incidenza_giudizio":"1 frase sul food cost % sul ricavo"}.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const auth = req.headers.get('Authorization') ?? ''
  const { data: caller } = await admin.auth.getUser(auth.slice(7))
  const loc = caller?.user?.id
  if (!loc) return json({ ok: false, error: 'auth' })
  const { data: prof } = await admin.from('profiles').select('role').eq('id', loc).maybeSingle()
  const isAdmin = prof?.role === 'ADMIN'
  if (!prof || !['LOCATION', 'ADMIN'].includes(prof.role)) return json({ ok: false, error: 'forbidden' })

  let body: { entry_id?: string }
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const entryId = body.entry_id
  if (!entryId) return json({ ok: false, error: 'no_entry' })

  // EVENTO (con verifica proprietà)
  const { data: entry } = await admin.from('calendar_entries')
    .select('id, owner_id, title, date_from, status, quote_id').eq('id', entryId).maybeSingle()
  if (!entry) return json({ ok: false, error: 'not_found' })
  if (entry.owner_id !== loc && !isAdmin) return json({ ok: false, error: 'forbidden' })

  // CREDITO wallet
  const { data: balance } = await admin.rpc('fb_ai_precheck', { p_location: entry.owner_id })
  if ((balance ?? 0) <= 0) return json({ ok: false, error: 'no_credit', balance: balance ?? 0 })

  // PREVENTIVO (ricavo/costo/margine + coperti previsti): calendar_entries.quote_id → quotes
  let ricavo: number | null = null, costoPrev: number | null = null, margine: number | null = null, copertiPrevisti: number | null = null
  if (entry.quote_id) {
    const { data: q } = await admin.from('quotes').select('total_client, total_cost, margin_amount, guest_count').eq('id', entry.quote_id).maybeSingle()
    if (q) {
      ricavo = q.total_client != null ? Number(q.total_client) : null
      costoPrev = q.total_cost != null ? Number(q.total_cost) : null
      margine = q.margin_amount != null ? Number(q.margin_amount) : null
      copertiPrevisti = q.guest_count != null ? Number(q.guest_count) : null
    }
  }

  // INVITATI / COPERTI
  const { data: guests } = await admin.from('event_guests').select('party_size, rsvp, diet').eq('entry_id', entryId)
  const g = guests ?? []
  const sum = (pred: (x: { rsvp: string | null }) => boolean) => g.filter(pred).reduce((s, x) => s + (x.party_size ?? 1), 0)
  const confermati = sum((x) => x.rsvp === 'YES')
  const inAttesa = sum((x) => x.rsvp === 'PENDING' || x.rsvp === 'MAYBE')
  const rifiutati = sum((x) => x.rsvp === 'NO')
  const diete: Record<string, number> = {}
  for (const x of g) { const d = (x as { diet?: string | null }).diet; if (d && d.trim()) diete[d.trim()] = (diete[d.trim()] ?? 0) + ((x.party_size as number) ?? 1) }

  // MENU + FOOD COST
  const { data: ems } = await admin.from('fb_event_menus').select('menu_id, covers').eq('entry_id', entryId)
  const menus: { nome: string; coperti: number; food_cost_totale: number | null; food_cost_coperto: number | null }[] = []
  let foodTotal = 0; let foodComputable = true
  for (const em of ems ?? []) {
    const covers = (em.covers as number) ?? copertiPrevisti ?? confermati ?? 0
    const { data: mn } = await admin.from('fb_menus').select('name').eq('id', em.menu_id).maybeSingle()
    const { data: fc } = await admin.rpc('fb_menu_foodcost', { p_menu_id: em.menu_id, p_covers: covers })
    const row = Array.isArray(fc) ? fc[0] : fc
    const tot = row?.total_cost != null ? Number(row.total_cost) : null
    const per = row?.cost_per_cover != null ? Number(row.cost_per_cover) : null
    if (tot != null) foodTotal += tot; else foodComputable = false
    menus.push({ nome: mn?.name ?? 'Menu', coperti: covers, food_cost_totale: eur(tot), food_cost_coperto: eur(per) })
  }

  const baseCoperti = copertiPrevisti || confermati || 0
  const conti = {
    evento: { titolo: entry.title, data: entry.date_from, stato: entry.status },
    coperti: { previsti: copertiPrevisti, confermati, in_attesa: inAttesa, rifiutati, scostamento: copertiPrevisti != null ? confermati - copertiPrevisti : null },
    food_cost: { totale_eur: eur(foodTotal), per_coperto_eur: baseCoperti ? eur(foodTotal / baseCoperti) : null, calcolato_su_coperti: baseCoperti, completo: foodComputable, per_menu: menus },
    ricavo: { preventivo_eur: eur(ricavo), costo_preventivo_eur: eur(costoPrev), margine_eur: eur(margine), margine_pct: ricavo ? Math.round((margine ?? 0) / ricavo * 1000) / 10 : null },
    incidenza_food_cost_pct: ricavo ? Math.round(foodTotal / ricavo * 1000) / 10 : null,
    diete,
  }

  try {
    const res = await aiChat({ system: SYS, parts: [{ text: `Conti dell'evento (numeri già calcolati, usali così):\n${JSON.stringify(conti)}` }], maxTokens: 1500 })
    if (!res.ok) return json({ ok: false, error: 'ai_error', attempts: res.attempts, conti })
    const inTok = res.usage.inTok, outTok = res.usage.outTok
    const { data: price } = await admin.from('fb_ai_pricing').select('input_eur_per_mtok, output_eur_per_mtok').eq('id', 1).maybeSingle()
    const cost = (inTok * (price?.input_eur_per_mtok ?? 9) + outTok * (price?.output_eur_per_mtok ?? 45)) / 1_000_000
    const { data: newBal } = await admin.rpc('fb_ai_charge', { p_location: entry.owner_id, p_cost: cost, p_in: inTok, p_out: outTok, p_fn: 'fb-ragioniere' })
    const analisi = firstJson(res.text)
    return json({ ok: true, provider: res.provider, conti, analisi: analisi ?? { verdetto: 'attenzione', sintesi: res.text.slice(0, 300), alert: [], consigli: [], incidenza_giudizio: '' }, cost, balance: newBal })
  } catch (e) {
    return json({ ok: false, error: 'exception', detail: String(e).slice(0, 300), conti }, 500)
  }
})
