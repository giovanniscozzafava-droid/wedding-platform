// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function pad(n: number) { return n < 10 ? `0${n}` : String(n) }
function fmtICalDate(d: string) {
  return d.replace(/-/g, '')
}
function fmtICalDateTime(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token) {
    return new Response('token required', { status: 400, headers: { 'content-type': 'text/plain' } })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const { data: tk } = await admin
    .from('calendar_export_tokens')
    .select('user_id, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()
  if (!tk || tk.revoked_at || new Date(tk.expires_at) < new Date()) {
    return new Response('token invalid or expired', { status: 401, headers: { 'content-type': 'text/plain' } })
  }

  // Eventi visibili al destinatario: owner OR participant. RLS bypass: filtriamo lato server.
  const owned = await admin
    .from('calendar_entries')
    .select('id, title, date_from, date_to, status, notes')
    .eq('owner_id', tk.user_id)

  const participantIds = await admin
    .from('calendar_entry_participants')
    .select('entry_id')
    .eq('user_id', tk.user_id)
  const ids = (participantIds.data ?? []).map((r: any) => r.entry_id as string)
  const participated = ids.length
    ? await admin
        .from('calendar_entries')
        .select('id, title, date_from, date_to, status')
        .in('id', ids)
    : { data: [] as any[] }

  const all = [
    ...((owned.data ?? []) as any[]).map((e) => ({ ...e, _role: 'owner' as const })),
    ...((participated.data ?? []) as any[]).map((e) => ({ ...e, _role: 'participant' as const })),
  ]
  // dedup by id (owner has precedence)
  const seen = new Set<string>()
  const events = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))

  const now = fmtICalDateTime(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Platform//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]
  for (const e of events) {
    const summary = e._role === 'participant' ? `[Evento] ${e.title}` : e.title
    const dtStart = fmtICalDate(e.date_from)
    // iCal DTEND date is exclusive: aggiungiamo 1 giorno alla data fine
    const endDate = new Date(`${e.date_to}T00:00:00Z`)
    endDate.setUTCDate(endDate.getUTCDate() + 1)
    const dtEnd = `${endDate.getUTCFullYear()}${pad(endDate.getUTCMonth() + 1)}${pad(endDate.getUTCDate())}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@wedding-platform`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${summary.replace(/\n/g, ' ')}`,
      `STATUS:${e.status === 'CONFERMATA' || e.status === 'OPZIONATA' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="wedding-platform.ics"',
    },
  })
})
