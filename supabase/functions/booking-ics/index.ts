// Feed iCal abbonabile delle prenotazioni di un professionista. Il pro lo aggiunge UNA volta
// al suo calendario (webcal://.../booking-ics?token=<feed_token>) e vede tutte le prenotazioni
// sempre aggiornate, dentro il suo UNICO calendario. Pubblico ma protetto dal token segreto.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const icsEsc = (x: string) => (x ?? '').replace(/\\/g, '\\\\').replace(/[,;]/g, ' ').replace(/\r?\n/g, '\\n')

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  if (!token) return new Response('missing token', { status: 400 })
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  const { data: s } = await admin.from('booking_settings').select('professional_id, timezone').eq('feed_token', token).maybeSingle()
  if (!s) return new Response('not found', { status: 404 })
  const { data: prof } = await admin.from('profiles').select('business_name, full_name').eq('id', s.professional_id).maybeSingle()
  const proName = (prof?.business_name || prof?.full_name || 'Planfully') as string

  // prenotazioni confermate da 30 giorni fa in avanti
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: bks } = await admin.from('bookings')
    .select('id, starts_at, ends_at, client_name, client_email, client_phone, note, status')
    .eq('professional_id', s.professional_id).eq('status', 'CONFIRMED').gte('starts_at', since)
    .order('starts_at').limit(2000)

  const tz = (s.timezone || 'Europe/Rome') as string
  // METHOD:PUBLISH + REFRESH/TTL → i calendari abbonati si risincronizzano da soli (Google/Apple/Outlook).
  // X-WR-TIMEZONE → il calendario mostra gli orari nel fuso giusto.
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'METHOD:PUBLISH', 'PRODID:-//Planfully//Prenotazioni//IT', 'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:Prenotazioni · ${icsEsc(proName)}`, `X-WR-TIMEZONE:${tz}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H']
  for (const b of (bks ?? []) as Array<{ id: string; starts_at: string; ends_at: string; client_name: string; client_email: string; client_phone: string | null; note: string | null }>) {
    lines.push('BEGIN:VEVENT', `UID:${b.id}@planfully.it`, `DTSTAMP:${stamp(new Date().toISOString())}`,
      `DTSTART:${stamp(b.starts_at)}`, `DTEND:${stamp(b.ends_at)}`,
      `SUMMARY:${icsEsc('Appuntamento · ' + b.client_name)}`,
      `DESCRIPTION:${icsEsc(`${b.client_email}${b.client_phone ? ' · ' + b.client_phone : ''}${b.note ? '\n' + b.note : ''}`)}`,
      'END:VEVENT')
  }
  lines.push('END:VCALENDAR')

  return new Response(lines.join('\r\n'), {
    status: 200,
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-cache', 'content-disposition': 'inline; filename="planfully-prenotazioni.ics"' },
  })
})
