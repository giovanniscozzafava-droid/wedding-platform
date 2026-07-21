// deno-lint-ignore-file no-explicit-any
// Richiesta d'accesso dalla landing (pubblica). Valida server-side, scrive con
// service_role (tabella chiusa), manda al richiedente un'email di conferma (brand nuovo).
// La notifica all'admin la fa il trigger DB sull'insert (campanello).
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'

const RATE_MAX = 5
const RATE_WINDOW_MIN = 60
const RUOLI = ['LOCATION', 'WEDDING_PLANNER', 'FORNITORE', 'ALTRO']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const b = (await req.json().catch(() => ({}))) as Record<string, any>

  // Honeypot
  if (typeof b.website === 'string' && b.website.trim() !== '') return json({ ok: true })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // Rate limit per IP (riusa la tabella tentativi della waitlist)
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sconosciuto'
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString()
  const { count: recenti } = await admin.from('maestranze_waitlist_attempts')
    .select('*', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since)
  if ((recenti ?? 0) >= RATE_MAX) return json({ error: 'Troppe richieste da questo dispositivo. Riprova tra un’ora.' }, 429)

  // Validazioni
  const nome = String(b.nome ?? '').trim()
  if (nome.length < 3) return json({ error: 'Scrivi il tuo nome e cognome.' }, 400)
  const attivita = String(b.attivita ?? '').trim()
  if (attivita.length < 2) return json({ error: 'Scrivi il nome della tua attività.' }, 400)
  const ruolo = String(b.ruolo ?? '').trim().toUpperCase()
  if (!RUOLI.includes(ruolo)) return json({ error: 'Scegli il tuo ruolo nella filiera.' }, 400)
  const ruoloAltro = String(b.ruolo_altro ?? '').trim().slice(0, 80)
  if (ruolo === 'ALTRO' && !ruoloAltro) return json({ error: 'Specifica il tuo ruolo.' }, 400)
  const email = String(b.email ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'L’email non sembra valida.' }, 400)
  const telefono = String(b.telefono ?? '').trim().slice(0, 30) || null
  const messaggio = String(b.messaggio ?? '').trim().slice(0, 1000) || null

  let provincia: string | null = String(b.provincia ?? '').trim().toUpperCase() || null
  if (provincia) {
    const { data: pv } = await admin.from('province_regioni').select('provincia').eq('provincia', provincia).maybeSingle()
    if (!pv) provincia = null
  }
  const source = String(b.source ?? 'landing').trim().slice(0, 40).toLowerCase() || 'landing'
  // Provenienza: slug del mondo da cui è partita la CTA (solo lettere, es. "fotografi").
  const mondo = String(b.mondo ?? '').trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 40) || null

  const { data: row, error } = await admin.from('access_requests').insert({
    nome, attivita, ruolo, ruolo_altro: ruolo === 'ALTRO' ? ruoloAltro : null,
    email, telefono, provincia, messaggio, source, mondo,
  }).select('id').single()
  if (error) return json({ error: 'Non siamo riusciti a registrare la richiesta. Riprova.' }, 500)

  await admin.from('maestranze_waitlist_attempts').insert({ ip })

  // Email di conferma al richiedente (brand nuovo, via emailShell)
  const html = emailShell({
    eyebrow: 'Richiesta ricevuta',
    title: 'Abbiamo ricevuto la tua richiesta',
    subtitleHtml: `Ciao <strong>${esc(nome)}</strong>`,
    bodyHtml:
      `<p style="margin:0 0 14px">Grazie per aver chiesto l’accesso a <strong>Planfully</strong>, il gestionale della filiera wedding.</p>` +
      `<p style="margin:0 0 14px">Apriamo la piattaforma a un numero ristretto di location, planner e fornitori che lavorano già insieme. ` +
      `Guardiamo la tua richiesta e ti ricontattiamo di persona: entra chi costruisce lo strumento con noi, non una lista d’attesa.</p>` +
      `<p style="margin:0;font-size:13px;color:#6b6b63">Se non hai richiesto tu l’accesso, ignora pure questa email.</p>`,
  })
  const r = await sendEmail({ to: email, subject: 'La tua richiesta di accesso a Planfully', html, from: FROM, headers: { 'X-Entity-Ref-ID': String(row.id) } })

  return json({ ok: true, email_inviata: r.ok })
})
