// Edge: ical-import
// Importa un calendario esterno via URL .ics (Google/Apple/Outlook…). Per ogni feed: scarica,
// legge i VEVENT, e ricrea i blocchi "occupato" (calendar_entries source=ICAL) sulle date, senza
// toccare gli eventi creati a mano. Strategia per-feed: delete+insert → prune automatico dei rimossi.
//   - Bearer utente → sincronizza SOLO i feed del chiamante (o un feed specifico via body.feed_id).
//   - x-cron-secret → sincronizza TUTTI i feed (uso da cron giornaliero).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })

// ── Parser ICS minimale ma robusto ────────────────────────────────────────────
// Deunfold: le righe continuate iniziano con spazio/tab (RFC5545).
function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const l of lines) {
    if ((l.startsWith(' ') || l.startsWith('\t')) && out.length) out[out.length - 1] += l.slice(1)
    else out.push(l)
  }
  return out
}
// 'YYYYMMDD...' → 'YYYY-MM-DD' (prende i primi 8 caratteri, ovunque sia il valore).
function toISODate(val: string): string | null {
  const m = val.match(/(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
function addDays(iso: string, n: number): string {
  const [y, mo, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, mo - 1, d))
  dt.setUTCDate(dt.getUTCDate() + n)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}
type Ev = { uid: string; title: string; date_from: string; date_to: string }
function parseIcs(raw: string): Ev[] {
  const lines = unfold(raw)
  const evs: Ev[] = []
  let cur: Record<string, { val: string; allDay: boolean }> | null = null
  let idx = 0
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') {
      if (cur) {
        const dsRaw = cur['DTSTART']; const deRaw = cur['DTEND'] ?? cur['DUE']
        const from = dsRaw ? toISODate(dsRaw.val) : null
        if (from) {
          let to = from
          if (deRaw) {
            const endIso = toISODate(deRaw.val)
            if (endIso) to = deRaw.allDay ? addDays(endIso, -1) : endIso  // DTEND all-day e' esclusivo
            if (to < from) to = from
          }
          const uid = (cur['UID']?.val || `${from}-${idx}`).slice(0, 300)
          const title = (cur['SUMMARY']?.val || 'Impegno (iCal)').slice(0, 200)
          evs.push({ uid, title, date_from: from, date_to: to })
          idx++
        }
      }
      cur = null; continue
    }
    if (!cur) continue
    const ci = line.indexOf(':'); if (ci < 0) continue
    const left = line.slice(0, ci); const val = line.slice(ci + 1)
    const name = left.split(';')[0]!.toUpperCase()
    if (['UID', 'SUMMARY', 'DTSTART', 'DTEND', 'DUE'].includes(name)) {
      cur[name] = { val, allDay: /VALUE=DATE(?!-TIME)/i.test(left) || (!val.includes('T') && /^\d{8}$/.test(val.trim())) }
    }
  }
  return evs
}

async function syncFeed(admin: any, feed: { id: string; user_id: string; url: string }): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const r = await fetch(feed.url, { headers: { 'User-Agent': 'Planfully-iCal/1.0', accept: 'text/calendar,*/*' } })
    if (!r.ok) throw new Error(`http_${r.status}`)
    const text = await r.text()
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('not_ical')
    const evs = parseIcs(text).slice(0, 2000) // tetto di sicurezza
    // Ricrea i blocchi del feed (prune automatico dei rimossi).
    await admin.from('calendar_entries').delete().eq('ical_feed_id', feed.id)
    if (evs.length) {
      const rows = evs.map((e) => ({
        owner_id: feed.user_id, source: 'ICAL', ical_feed_id: feed.id, external_uid: e.uid,
        title: e.title, date_from: e.date_from, date_to: e.date_to, status: 'CONFERMATA', event_kind: 'altro',
      }))
      // insert a blocchi da 500
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from('calendar_entries').insert(rows.slice(i, i + 500))
        if (error) throw new Error(error.message.slice(0, 120))
      }
    }
    await admin.from('user_ical_feeds').update({ last_synced_at: new Date().toISOString(), last_status: 'ok', last_count: evs.length }).eq('id', feed.id)
    return { ok: true, count: evs.length }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 140)
    await admin.from('user_ical_feeds').update({ last_synced_at: new Date().toISOString(), last_status: `error:${msg}` }).eq('id', feed.id)
    return { ok: false, error: msg }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  let body: { feed_id?: string } = {}
  try { body = await req.json() } catch { /* opzionale */ }

  const cronHeader = req.headers.get('x-cron-secret') ?? ''
  const isCron = !!CRON_SECRET && cronHeader === CRON_SECRET

  let feeds: { id: string; user_id: string; url: string }[] = []
  if (isCron) {
    const { data } = await admin.from('user_ical_feeds').select('id, user_id, url')
    feeds = (data ?? []) as any[]
  } else {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)
    const { data: au } = await admin.auth.getUser(authHeader.slice(7))
    const uid = au?.user?.id
    if (!uid) return json({ error: 'unauthorized' }, 401)
    let q = admin.from('user_ical_feeds').select('id, user_id, url').eq('user_id', uid)
    if (body.feed_id) q = q.eq('id', body.feed_id)
    const { data } = await q
    feeds = (data ?? []) as any[]
  }

  let total = 0, ok = 0, failed = 0
  const results: unknown[] = []
  for (const f of feeds) {
    const res = await syncFeed(admin, f)
    if (res.ok) { ok++; total += res.count ?? 0 } else failed++
    results.push({ feed_id: f.id, ...res })
  }
  return json({ ok: true, feeds: feeds.length, imported: total, synced_ok: ok, failed, results })
})
