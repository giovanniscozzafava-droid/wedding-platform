// Edge function: album-catalog-interpret
// L'AI legge TUTTO il catalogo album del fotografo e ne restituisce l'offerta STRUTTURATA: per ogni
// MODELLO → prezzo, pagine, e le opzioni disponibili PER QUEL modello (materiali, colori, logo, foto
// in copertina) con i relativi SOVRAPPREZZI (le "variazioni": es. +30 per la copertina), rispettando
// le intersezioni. Così il fotografo conferma e il cliente compone semplice.
// AI via layer UNIFICATO (aiChat: Qwen → OpenAI → Claude; i PDF grezzi ricadono su Claude, unico con
// vision nativa su PDF). Niente chiave hard-coded: il layer sceglie il provider disponibile.
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

const PROMPT = `Questo PDF è il CATALOGO ALBUM di uno studio fotografico. Leggi TUTTA l'offerta e restituiscila STRUTTURATA.
Per OGNI MODELLO di album estrai:
- "label": nome del modello come stampato
- "price": prezzo base in euro se presente (solo numero), altrimenti null
- "pages": numero pagine se indicato, altrimenti null
- "materials": i MATERIALI disponibili PER QUEL MODELLO, ognuno {"label":"...","surcharge":<€ sovrapprezzo rispetto al prezzo base, o 0>}
- "colors": i COLORI disponibili per quel modello, ognuno {"label":"...","surcharge":<€ sovrapprezzo o 0>}
- "logos": personalizzazioni disponibili (iniziali, data, targhetta, logo…), ognuna {"label":"...","surcharge":<€ o 0>}
- "coverPhoto": true se il modello prevede una FOTO in copertina, altrimenti false
- "coverPhotoSurcharge": € di sovrapprezzo per la foto in copertina rispetto al prezzo base (es. 30), altrimenti 0
- POSIZIONE del modello sul catalogo, per rendere il riquadro cliccabile:
  "page": numero di pagina (1-based) dove appare il modello (la sua immagine/nome)
  "x","y","w","h": riquadro attorno al modello come FRAZIONI 0..1 della pagina (x,y = angolo alto-sinistra; w,h = larghezza,altezza). Stima al meglio: il fotografo poi lo aggiusta.
REGOLE FONDAMENTALI:
- I SOVRAPPREZZI sono la DIFFERENZA rispetto al prezzo base del modello (es. "copertina +30" → surcharge 30, non il prezzo pieno). Se un'opzione è inclusa/gratuita usa 0.
- Rispetta le INTERSEZIONI del catalogo: associa a ogni modello SOLO i materiali/colori che il catalogo indica per quel modello. Se il catalogo dà materiali/colori validi per tutti i modelli, ripetili per ciascuno.
- Non inventare i dati testuali: se un'informazione non c'è, lascia lista vuota / null / false / 0. (La posizione invece stimala sempre.)
Rispondi SOLO con JSON valido, nessun testo fuori:
{"models":[{"label":"","price":null,"pages":null,"page":1,"x":0.1,"y":0.1,"w":0.3,"h":0.2,"materials":[],"colors":[],"logos":[],"coverPhoto":false,"coverPhotoSurcharge":0}]}`

type Opt = { label?: unknown; surcharge?: unknown }
const cleanOpts = (arr: unknown, withSur: boolean): { key: string; label: string; surcharge: number }[] =>
  Array.isArray(arr)
    ? arr.map((o: Opt) => {
        const label = String(o?.label ?? '').trim()
        const surcharge = withSur ? (Number(o?.surcharge) || 0) : 0
        return { key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'opt', label, surcharge }
      }).filter((x) => x.label)
    : []

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'method' })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const authH = req.headers.get('Authorization') ?? ''
  const { data: cu } = await admin.auth.getUser(authH.slice(7))
  if (!cu?.user) return json({ ok: false, error: 'auth' })

  // Preferiamo l'URL (il PDF viene scaricato dal provider: niente base64, regge cataloghi grandi).
  let body: { url?: string; base64?: string }
  try { body = await req.json() } catch { return json({ ok: false, error: 'bad_json' }) }
  const url = body.url || ''
  const base64 = (body.base64 || '').replace(/^data:[^,]+,/, '')
  if (!url && !base64) return json({ ok: false, error: 'no_file' })

  try {
    const res = await aiChat({
      parts: [url ? { pdfUrl: url } : { pdfBase64: base64 }, { text: PROMPT }],
      maxTokens: 16000,
    })
    if (!res.ok) return json({ ok: false, error: 'ai_error', tried: res.attempts })
    const parsed = firstJson<{ models?: unknown }>(res.text)
    if (!parsed) return json({ ok: false, error: 'parse', raw: res.text.slice(0, 300) })
    const clamp01 = (v: unknown, def: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : def }
    const models = Array.isArray(parsed.models) ? parsed.models.map((x: Record<string, unknown>) => ({
      label: String(x.label ?? '').trim(),
      price: x.price == null || x.price === '' ? null : Number(x.price),
      pages: x.pages == null || x.pages === '' ? null : Number(x.pages),
      page: Math.max(1, Math.round(Number(x.page) || 1)),
      x: clamp01(x.x, 0.05), y: clamp01(x.y, 0.05), w: clamp01(x.w, 0.3), h: clamp01(x.h, 0.2),
      materials: cleanOpts(x.materials, true),
      colors: cleanOpts(x.colors, true),
      logos: cleanOpts(x.logos, true),
      coverPhoto: !!x.coverPhoto,
      coverPhotoSurcharge: Number(x.coverPhotoSurcharge) || 0,
    })).filter((x: { label: string }) => x.label) : []
    return json({ ok: true, models })
  } catch (e) { return json({ ok: false, error: 'exception', detail: String(e).slice(0, 300) }, 500) }
})
