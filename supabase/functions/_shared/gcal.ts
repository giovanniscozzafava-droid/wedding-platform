// Helper Google Calendar (sola lettura): refresh access token + free/busy → cache google_calendar_busy.
import { decryptToken } from './drive-crypto.ts'

const CLIENT_ID = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET') ?? ''

export async function freshAccessToken(refreshEncB64: string): Promise<string | null> {
  const refresh = await decryptToken(Uint8Array.from(atob(refreshEncB64), (c) => c.charCodeAt(0)))
  const form = new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh, grant_type: 'refresh_token' })
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
  const d = await r.json().catch(() => ({}))
  return r.ok && d.access_token ? (d.access_token as string) : null
}

// Legge free/busy del calendario primario per i prossimi `days` giorni e RISCRIVE la cache futura.
export async function syncBusy(admin: any, professionalId: string, days = 60): Promise<{ ok: boolean; count?: number; error?: string }> {
  const { data: conn } = await admin.from('google_calendar_connections').select('refresh_token_enc').eq('professional_id', professionalId).maybeSingle()
  if (!conn?.refresh_token_enc) return { ok: false, error: 'not_connected' }
  const access = await freshAccessToken(conn.refresh_token_enc as string)
  if (!access) return { ok: false, error: 'refresh_failed' }

  const timeMin = new Date().toISOString()
  const timeMax = new Date(Date.now() + days * 86400000).toISOString()
  const fb = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
  })
  const fd = await fb.json().catch(() => ({}))
  if (!fb.ok) return { ok: false, error: 'freebusy_failed' }
  const busy = (fd?.calendars?.primary?.busy ?? []) as Array<{ start: string; end: string }>

  await admin.from('google_calendar_busy').delete().eq('professional_id', professionalId).gte('ends_at', timeMin)
  if (busy.length) {
    await admin.from('google_calendar_busy').insert(busy.map((b) => ({ professional_id: professionalId, starts_at: b.start, ends_at: b.end })))
  }
  await admin.from('google_calendar_connections').update({ last_sync_at: new Date().toISOString() }).eq('professional_id', professionalId)
  return { ok: true, count: busy.length }
}
