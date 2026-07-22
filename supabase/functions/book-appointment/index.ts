// Prenotazione pubblica di un appuntamento. La pagina /prenota/<slug> chiama questa funzione.
// Valida lo slot, lo inserisce in bookings + lo segna BUSY nel calendario del professionista
// (supplier_availability_slots → UN SOLO calendario), invia email di conferma a cliente e
// professionista, e restituisce link WhatsApp + Google Calendar.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } })
const esc = (x: string) => x.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
const digits = (s?: string | null) => (s ? s.replace(/[^\d]/g, '').replace(/^00/, '') : '')
const addMin = (hm: string, m: number) => { const [h, mi] = hm.split(':').map(Number); const t = (h! * 60 + mi! + m); return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` }
const gcalStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  let b: { slug?: string; iso?: string; date?: string; label?: string; name?: string; email?: string; phone?: string; note?: string }
  try { b = await req.json() } catch { return json({ error: 'bad_json' }, 400) }
  const slug = (b.slug ?? '').trim()
  const iso = b.iso ?? ''
  const date = b.date ?? ''        // YYYY-MM-DD locale
  const label = b.label ?? ''      // HH:MM locale
  const name = (b.name ?? '').trim()
  const email = (b.email ?? '').trim().toLowerCase()
  if (!slug || !iso || !date || !/^\d{2}:\d{2}$/.test(label) || name.length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'bad_input' }, 400)
  }

  const { data: prof } = await admin.from('profiles').select('id, business_name, full_name').eq('slug', slug).maybeSingle()
  if (!prof) return json({ error: 'not_found' }, 404)
  const { data: s } = await admin.from('booking_settings').select('*').eq('professional_id', prof.id).maybeSingle()
  if (!s || !s.enabled) return json({ error: 'disabled' }, 400)

  const startsAt = new Date(iso)
  if (isNaN(startsAt.getTime())) return json({ error: 'bad_time' }, 400)
  const endsAt = new Date(startsAt.getTime() + s.slot_minutes * 60000)
  // preavviso minimo
  if (startsAt.getTime() < Date.now() + s.min_notice_hours * 3600000) return json({ error: 'too_soon' }, 400)

  // anti doppia prenotazione: nessuna prenotazione CONFIRMED che si sovrappone
  const { data: clash } = await admin.from('bookings').select('id')
    .eq('professional_id', prof.id).eq('status', 'CONFIRMED')
    .lt('starts_at', endsAt.toISOString()).gt('ends_at', startsAt.toISOString()).limit(1)
  if (clash && clash.length) return json({ error: 'slot_taken' }, 409)

  // segna BUSY nel calendario (un solo calendario)
  const endLabel = addMin(label, s.slot_minutes)
  const { data: slot } = await admin.from('supplier_availability_slots')
    .insert({ fornitore_id: prof.id, date, start_time: label, end_time: endLabel, status: 'BUSY', label: `Appuntamento · ${name}` })
    .select('id').single()

  const { data: bk, error: bkErr } = await admin.from('bookings').insert({
    professional_id: prof.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
    client_name: name, client_email: email, client_phone: b.phone ?? null, note: b.note ?? null, avail_slot_id: slot?.id ?? null,
  }).select('id').single()
  if (bkErr) {
    if (slot?.id) await admin.from('supplier_availability_slots').delete().eq('id', slot.id)
    return json({ error: 'insert_failed', detail: bkErr.message }, 500)
  }

  const proName = (prof.business_name || prof.full_name || 'Il professionista') as string
  const { data: proAuth } = await admin.auth.admin.getUserById(prof.id)
  const proEmail = proAuth?.user?.email ?? null
  const whenIt = startsAt.toLocaleString('it-IT', { timeZone: s.timezone, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const locTxt = s.location_type === 'VIDEO' ? `Videochiamata${s.location_detail ? ' · ' + s.location_detail : ''}`
    : s.location_type === 'INPERSON' ? `Di persona${s.location_detail ? ' · ' + s.location_detail : ''}`
    : `Telefonata${s.location_detail ? ' · ' + s.location_detail : ''}`
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Appuntamento con ${proName}`)}&dates=${gcalStamp(iso)}/${gcalStamp(endsAt.toISOString())}&details=${encodeURIComponent(locTxt + (b.note ? '\n' + b.note : ''))}`
  const waPro = digits(s.whatsapp) ? `https://wa.me/${digits(s.whatsapp)}?text=${encodeURIComponent(`Ciao ${proName}, ho prenotato un appuntamento per ${whenIt}. Sono ${name}.`)}` : null
  const waClient = digits(b.phone) ? `https://wa.me/${digits(b.phone)}?text=${encodeURIComponent(`Ciao ${name}, confermo il nostro appuntamento di ${whenIt}. — ${proName}`)}` : null

  // email al cliente
  const clientHtml = emailShell({
    eyebrow: 'Prenotazione confermata',
    title: 'Il tuo appuntamento è confermato',
    subtitleHtml: `Con <strong>${esc(proName)}</strong>`,
    bodyHtml: `<p style="margin:0">Ciao ${esc(name.split(' ')[0] ?? name)}, ecco i dettagli.</p><p style="font-size:16px;margin:14px 0"><strong>${esc(whenIt)}</strong><br><span style="color:#6B6B63">${esc(locTxt)}</span></p>${waPro ? `<p style="margin:14px 0 0;font-size:13px"><a href="${waPro}" style="color:#181F1B;text-decoration:underline">Scrivi su WhatsApp</a></p>` : ''}<p style="font-size:12px;color:#6B6B63;margin:16px 0 0">Per disdire o spostare, rispondi a questa email.</p>`,
    cta: { href: gcal, label: 'Aggiungi al calendario' },
  })
  await sendEmail({ to: email, subject: `Prenotazione confermata · ${proName} · ${whenIt}`, html: clientHtml })

  // email al professionista
  if (proEmail) {
    const proHtml = emailShell({
      eyebrow: 'Nuova prenotazione',
      title: name,
      subtitleHtml: `<strong>${esc(whenIt)}</strong> · ${esc(locTxt)}`,
      bodyHtml: `<p style="margin:0">${esc(email)}${b.phone ? '<br>' + esc(b.phone) : ''}</p>${b.note ? `<p style="margin:12px 0;padding:10px;background:#F4F3EE;border-radius:8px">${esc(b.note)}</p>` : ''}${waClient ? `<p style="margin:14px 0 0;font-size:13px"><a href="${waClient}" style="color:#181F1B;text-decoration:underline">WhatsApp al cliente</a></p>` : ''}<p style="font-size:12px;color:#6B6B63;margin:16px 0 0">È già nel tuo calendario (slot occupato).</p>`,
      cta: { href: gcal, label: 'Aggiungi al calendario' },
    })
    await sendEmail({ to: proEmail, subject: `Nuova prenotazione · ${name} · ${whenIt}`, html: proHtml })
  }

  // .ics universale (Apple Calendar / Outlook / Google): scaricabile dalla pagina di conferma
  const icsEsc = (x: string) => x.replace(/\\/g, '\\\\').replace(/[,;]/g, ' ').replace(/\r?\n/g, '\\n')
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Planfully//Prenotazioni//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${bk.id}@planfully.it`, `DTSTAMP:${gcalStamp(new Date().toISOString())}`,
    `DTSTART:${gcalStamp(iso)}`, `DTEND:${gcalStamp(endsAt.toISOString())}`,
    `SUMMARY:${icsEsc(`Appuntamento con ${proName}`)}`,
    `DESCRIPTION:${icsEsc(locTxt + (b.note ? '\n' + b.note : ''))}`,
    `LOCATION:${icsEsc(s.location_detail || locTxt)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')

  return json({ ok: true, booking_id: bk.id, when: whenIt, gcal, ics, whatsapp: waPro, location: locTxt, pro_name: proName })
})
