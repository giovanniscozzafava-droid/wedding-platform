// deno-lint-ignore-file no-explicit-any
// ============================================================================
// Iscrizione alla lista d'attesa Maestranze.
//
// Endpoint PUBBLICO (la pagina deve convertire da Instagram, senza login), ma:
//  - la tabella è chiusa al client: qui si scrive con service_role, mai dal browser
//  - ogni validazione è rifatta server-side. Il client non è una fonte attendibile:
//    quella del form serve solo a non far perdere tempo alla persona.
//  - honeypot + rate limit per IP al posto del captcha (che su mobile fa perdere gente)
// ============================================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail, htmlToText } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'

const RATE_MAX = 5           // submit per IP...
const RATE_WINDOW_MIN = 60   // ...in questa finestra (minuti)

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

const DISPONIBILITA_OK = ['WEEKEND', 'FESTIVI', 'SERA', 'GIORNO', 'SU_CHIAMATA']

/** Telefono IT: tiene solo le cifre, tollera +39 / 0039 / spazi / trattini. */
function normalizzaTelefono(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, '')
  if (d.startsWith('+39')) d = d.slice(3)
  else if (d.startsWith('0039')) d = d.slice(4)
  else if (d.startsWith('39') && d.length > 11) d = d.slice(2)
  d = d.replace(/\D/g, '')
  if (d.length < 9 || d.length > 11) return null
  return d
}

/** Instagram: accetta @nome, nome, o URL completa → sempre e solo lo username. */
function normalizzaInstagram(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  let u = v
  const m = v.match(/instagram\.com\/([A-Za-z0-9._]+)/i)
  if (m) u = m[1]
  u = u.replace(/^@/, '').replace(/\/+$/, '').trim()
  if (!/^[A-Za-z0-9._]{1,30}$/.test(u)) return null
  return u
}

function portfolioValido(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.toString()
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const b = (await req.json().catch(() => ({}))) as Record<string, any>

  // Honeypot: campo invisibile nel form. Un umano non lo vede, un bot lo riempie.
  // Rispondiamo 200 come se tutto fosse andato bene: il bot non impara niente.
  if (typeof b.website === 'string' && b.website.trim() !== '') {
    return json({ ok: true })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // ------------------------------------------------------------ rate limit
  // Contiamo le iscrizioni RIUSCITE, non i tentativi: chi sbaglia l'email tre volte
  // dal telefono non deve restare chiuso fuori un'ora (non tornerebbe mai più). Ciò
  // che va limitato è quello che costa — insert + invio email — non un typo.
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sconosciuto'
  const since = new Date(Date.now() - RATE_WINDOW_MIN * 60_000).toISOString()
  const { count: recenti } = await admin.from('maestranze_waitlist_attempts')
    .select('*', { count: 'exact', head: true }).eq('ip', ip).gte('created_at', since)
  if ((recenti ?? 0) >= RATE_MAX) {
    return json({ error: 'Troppe iscrizioni da questo dispositivo. Riprova tra un’ora.' }, 429)
  }

  // ------------------------------------------------------------ validazioni
  const nome = String(b.nome ?? '').trim()
  if (nome.length < 3) return json({ error: 'Scrivi il tuo nome e cognome.' }, 400)
  if (nome.length > 120) return json({ error: 'Il nome è troppo lungo.' }, 400)
  if (/https?:\/\/|www\.|\d/.test(nome)) return json({ error: 'Nel nome non ci vanno link né numeri.' }, 400)

  const email = String(b.email ?? '').trim().toLowerCase()
  const email2 = String(b.email_conferma ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json({ error: 'L’email non sembra valida.' }, 400)
  if (email !== email2) return json({ error: 'Le due email non coincidono.' }, 400)

  const telefono = normalizzaTelefono(String(b.telefono ?? ''))
  if (!telefono) return json({ error: 'Il telefono non sembra valido (9-11 cifre).' }, 400)

  const provincia = String(b.provincia ?? '').trim().toUpperCase()
  const { data: prov } = await admin.from('province_regioni').select('provincia').eq('provincia', provincia).maybeSingle()
  if (!prov) return json({ error: 'Scegli la tua provincia.' }, 400)

  // Mestiere: dal vocabolario reale (263 voci) oppure testo libero se non c'è.
  const skillId = b.skill_id ? String(b.skill_id) : null
  const altro = String(b.professione_altro ?? '').trim().slice(0, 80)
  if (!skillId && !altro) return json({ error: 'Dicci che mestiere fai.' }, 400)
  if (skillId) {
    const { data: sk } = await admin.from('maestranze_skills').select('id').eq('id', skillId).maybeSingle()
    if (!sk) return json({ error: 'Mestiere non riconosciuto.' }, 400)
  }

  const disponibilita: string[] = Array.isArray(b.disponibilita)
    ? [...new Set(b.disponibilita.map((x: unknown) => String(x)))].filter((x) => DISPONIBILITA_OK.includes(x))
    : []

  const instagram = b.instagram ? normalizzaInstagram(String(b.instagram)) : null
  if (b.instagram && String(b.instagram).trim() && !instagram) {
    return json({ error: 'Il profilo Instagram non sembra valido.' }, 400)
  }
  const portfolio = b.portfolio ? portfolioValido(String(b.portfolio)) : null
  if (b.portfolio && String(b.portfolio).trim() && !portfolio) {
    return json({ error: 'Il link al portfolio non sembra valido.' }, 400)
  }

  if (b.privacy !== true) return json({ error: 'Serve il consenso privacy per iscriverti.' }, 400)
  const privacyVersion = String(b.privacy_version ?? '').trim()
  if (!privacyVersion) return json({ error: 'Versione informativa mancante.' }, 400)

  const source = String(b.source ?? 'direct').trim().slice(0, 40).toLowerCase() || 'direct'

  // ------------------------------------------------------------ insert
  const { data: row, error } = await admin.from('maestranze_waitlist').insert({
    nome, email, telefono, skill_id: skillId, professione_altro: altro || null,
    provincia, disponibilita, instagram, portfolio, source,
    privacy_version: privacyVersion,
  }).select('id, nome, confirm_token').single()

  if (error) {
    // 23505 = unique_violation. Messaggio specifico: la persona deve capire cosa è
    // successo, non vedere "errore".
    if ((error as any).code === '23505') {
      const dup = String((error as any).message ?? '')
      if (dup.includes('telefono')) return json({ error: 'Questo numero è già in lista.' }, 400)
      return json({ error: 'Questa email è già iscritta.' }, 400)
    }
    return json({ error: 'Non siamo riusciti a registrarti. Riprova.' }, 500)
  }

  // Iscrizione riuscita: ORA pesa sul rate limit (vedi sopra).
  await admin.from('maestranze_waitlist_attempts').insert({ ip })

  // ------------------------------------------------------------ email conferma
  const confirmUrl = `${APP_BASE}/maestranze/conferma?token=${row.confirm_token}`
  const shareUrl = `${APP_BASE}/maestranze/lista-attesa?source=share`
  const html = emailShell({
    eyebrow: 'Lista d’attesa',
    title: 'Conferma la tua iscrizione',
    subtitleHtml: `Ciao <strong>${esc(row.nome)}</strong>`,
    bodyHtml:
      `<p style="margin:0 0 14px">Grazie per esserti iscritto alla lista d’attesa di <strong>Maestranze</strong>, ` +
      `la bacheca di Planfully dove i professionisti del wedding si fanno trovare.</p>` +
      `<p style="margin:0 0 6px"><strong>Cosa succede adesso</strong></p>` +
      `<p style="margin:0 0 14px;font-size:14px;line-height:1.7">` +
      `Da oggi raccogliamo i professionisti della prima ondata.<br>` +
      `Dopo l’estate apriamo la bacheca: sarai tra i primi a entrare.<br>` +
      `Ti scriveremo noi con il link per attivare il tuo profilo.</p>` +
      `<p style="margin:0 0 14px;font-size:14px">Se conosci colleghi del settore — camerieri, assistenti, ` +
      `musicisti, coordinatori — giraglielo: <a href="${shareUrl}">${shareUrl}</a></p>` +
      `<p style="margin:0;font-size:12px;color:#6b6b6b">Planfully non è un’agenzia e non intermedia rapporti ` +
      `di lavoro: è una bacheca dove farsi trovare. Nessuna commissione, mai.</p>`,
    cta: { href: confirmUrl, label: 'Conferma la tua email' },
  })

  const r = await sendEmail({
    to: email,
    subject: 'Conferma la tua iscrizione a Maestranze',
    html,
    text: htmlToText(html),
    from: FROM,
    headers: { 'X-Entity-Ref-ID': String(row.id) },
  })
  // Se l'email non parte, la riga resta: la persona ha fatto la sua parte e non
  // deve ricompilare. Lo diciamo, invece di fingere che sia tutto a posto.
  if (!r.ok) return json({ ok: true, email_inviata: false })

  return json({ ok: true, email_inviata: true })
})
