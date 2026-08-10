// Recupero password ROBUSTO. Bypassa l'SMTP interno di Supabase (inaffidabile e
// rate-limited: la causa per cui "il link non arriva mai") e spedisce il link via
// Resend, la pipeline email già collaudata della piattaforma.
//
// Due percorsi, entrambi utili per una persona vera:
//   • account esistente → email "Reimposta la password" con action_link di recovery
//   • nessun account    → email "Non risulti registrato" (così chi ha sbagliato
//     indirizzo/casella capisce, invece di aspettare all'infinito un'email fantasma —
//     esattamente il caso che ci ha segnalato l'utente)
//
// La RISPOSTA HTTP è SEMPRE { ok: true }: nessuna enumerazione degli account via API.
// Chi non possiede la casella non scopre nulla; solo il proprietario legge l'esito.
//
// POST { email, redirectTo } -> { ok: true }
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell, esc } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

// Solo host Planfully: l'endpoint è pubblico, quindi normalizziamo il redirect per
// non farne un vettore verso domini terzi. (Supabase filtra comunque contro la sua
// allowlist di redirect, ma non ci fidiamo del solo lato server.)
function safeRedirect(r?: string): string {
  const fallback = 'https://planfully.it/reset-password'
  if (!r) return fallback
  try {
    const u = new URL(r)
    const okHost = u.hostname === 'planfully.it' || u.hostname === 'www.planfully.it' || u.hostname === 'localhost' || u.hostname === '127.0.0.1'
    if ((u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1') && okHost && u.pathname === '/reset-password') return r
  } catch { /* url non valido → fallback */ }
  return fallback
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as { email?: string; redirectTo?: string }
  const email = (body.email ?? '').trim().toLowerCase()
  const redirectTo = safeRedirect(body.redirectTo)
  // Input malformato: rispondiamo ok lo stesso (niente segnali all'esterno).
  if (!email.includes('@') || email.length > 254) return json({ ok: true })

  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  // Throttle anti-abuso per IP: max 8 richieste / 15 min. Evita che l'endpoint
  // venga usato per bombardare di email una vittima. Non blocca l'uso legittimo.
  const ip = (req.headers.get('x-forwarded-for')?.split(',')[0] ?? '').trim() || 'unknown'
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await admin.from('public_form_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'pwreset').eq('ip', ip).gte('created_at', since)
  if ((count ?? 0) >= 8) return json({ ok: true })
  await admin.from('public_form_attempts').insert({ kind: 'pwreset', ip })

  // generateLink (admin): a differenza di resetPasswordForEmail, se l'account NON
  // esiste restituisce un errore esplicito → possiamo dare un feedback utile.
  const link = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  })

  const errText = ((link.error?.message ?? '') + ' ' + ((link.error as { code?: string } | null)?.code ?? '')).toLowerCase()
  const notFound = !!link.error && /not.?found|no.?user|user_not_found|unable to|does not exist/.test(errText)

  if (link.error && !notFound) {
    // Errore inatteso (rate limit interno, ecc.): logga ma non rivelare nulla.
    console.error('password-reset generateLink error:', link.error)
    return json({ ok: true })
  }

  if (notFound || !link.data?.properties?.action_link) {
    // Nessun account con questa email. Mandiamo comunque una mail chiara: solo il
    // proprietario della casella la riceve, quindi nessuna enumerazione reale.
    const html = emailShell({
      eyebrow: 'Recupero accesso',
      title: 'Non risulti ancora registrato',
      subtitleHtml: `Richiesta ricevuta per <b>${esc(email)}</b>.`,
      bodyHtml: `Abbiamo ricevuto una richiesta per reimpostare la password su Planfully, ma <b>non troviamo un account</b> con questa email.<br><br>Le cause più comuni:<br>• ti sei registrato con un <b>indirizzo email diverso</b> (controlla le altre caselle);<br>• stai aspettando l'<b>invito del tuo professionista</b>: sarà il primo preventivo/link che ti manda a farti impostare la password.<br><br>Se pensi che sia un errore, rispondi a questa email e ti aiutiamo.`,
      cta: { href: 'https://planfully.it/area-cliente', label: "Vai all'accesso" },
    })
    await sendEmail({ to: email, subject: 'Recupero accesso Planfully', html })
    return json({ ok: true })
  }

  // Account esistente → mandiamo il link di reset (valido 1 ora, monouso).
  const actionLink = link.data.properties.action_link
  const html = emailShell({
    eyebrow: 'Reimposta la password',
    title: 'Reimposta la tua password',
    subtitleHtml: "Hai chiesto di recuperare l'accesso al tuo account.",
    bodyHtml: `Clicca il pulsante qui sotto per scegliere una nuova password. Il link è valido <b>per 1 ora</b> e utilizzabile <b>una sola volta</b>.<br><br>Se non hai richiesto tu il recupero, ignora pure questa email: nessuna modifica verrà fatta al tuo account.`,
    cta: { href: actionLink, label: 'Reimposta la password' },
  })
  const sent = await sendEmail({ to: email, subject: 'Reimposta la tua password — Planfully', html })
  if (!sent.ok) console.error('password-reset resend failed:', sent)
  return json({ ok: true })
})
