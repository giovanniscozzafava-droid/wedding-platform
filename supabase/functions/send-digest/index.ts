// Edge function: send-digest
// Invia il digest giornaliero delle notifiche PENDING via Resend.
// Chiamata in due modi:
//   1) Senza body (o body vuoto): legge la vista v_notifiche_digest_per_utente
//      per la data corrente e invia un'email per ogni destinatario.
//   2) Con body { destinatario_id, totale, primi_10 }: invia il digest per
//      quel singolo utente (chiamata da invia_digest_giornaliero() via pg_net).

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  })
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  )
}

type DigestItem = {
  id: string
  evento_id?: string | null
  tipo: string
  titolo: string
  descrizione?: string | null
  link_action?: string | null
  priorita?: number | null
  scadenza_il?: string | null
}

type DigestPayload = {
  destinatario_id: string
  totale: number
  primi_10: DigestItem[]
}

function renderDigestHtml(displayName: string | null, items: DigestItem[], totale: number): string {
  const greeting = displayName ? `Ciao ${esc(displayName)},` : 'Ciao,'
  const itemsHtml = items
    .map((it) => {
      const link = it.link_action ? `${APP_BASE}${it.link_action}` : `${APP_BASE}/notifiche`
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #eee;">
            <div style="font-weight:600;color:#111;">${esc(it.titolo)}</div>
            ${it.descrizione ? `<div style="color:#555;font-size:14px;margin-top:4px;">${esc(it.descrizione)}</div>` : ''}
            <div style="margin-top:8px;">
              <a href="${link}" style="color:#b08a3e;text-decoration:none;font-size:14px;">Apri →</a>
            </div>
          </td>
        </tr>`
    })
    .join('')

  const altre = Math.max(0, totale - items.length)
  const altreHtml = altre > 0
    ? `<p style="color:#777;font-size:13px;">…e altre ${altre} notifiche nel pannello.</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8"><title>Planfully — Promemoria di oggi</title></head>
<body style="margin:0;padding:0;background:#fafaf7;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf7;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #eaeaea;border-radius:8px;padding:32px;">
        <tr><td>
          <h1 style="margin:0 0 12px 0;font-size:22px;color:#111;font-weight:500;">Promemoria di oggi</h1>
          <p style="margin:0 0 16px 0;color:#444;font-size:15px;">${greeting}</p>
          <p style="margin:0 0 24px 0;color:#444;font-size:15px;">
            Hai <strong>${totale}</strong> notifich${totale === 1 ? 'a' : 'e'} che richiedono attenzione oggi.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${itemsHtml}
          </table>
          ${altreHtml}
          <div style="margin-top:32px;">
            <a href="${APP_BASE}/notifiche"
               style="display:inline-block;background:#111;color:#fff;padding:12px 24px;
                      text-decoration:none;border-radius:4px;font-size:14px;">
              Apri pannello notifiche
            </a>
          </div>
          <p style="margin-top:32px;color:#999;font-size:12px;border-top:1px solid #eee;padding-top:16px;">
            Planfully — il tuo wedding cockpit. Per gestire le preferenze accedi al pannello.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

async function sendDigestForUser(
  admin: ReturnType<typeof createClient>,
  payload: DigestPayload,
): Promise<{ ok: boolean; email?: string; reason?: string }> {
  if (!payload.destinatario_id) return { ok: false, reason: 'missing_destinatario_id' }
  if (!payload.totale || payload.totale <= 0) return { ok: false, reason: 'empty_digest' }

  // 1) Email destinatario.
  // deno-lint-ignore no-explicit-any
  const { data: userResp } = await admin.auth.admin.getUserById(payload.destinatario_id).catch(() => ({ data: null } as any))
  const userEmail: string | undefined = userResp?.user?.email
  if (!userEmail) return { ok: false, reason: 'no_email' }

  // 2) Display name (best-effort).
  const { data: profile } = await admin.from('profiles')
    .select('full_name,business_name')
    .eq('id', payload.destinatario_id)
    .maybeSingle()
  const displayName = (profile?.business_name ?? profile?.full_name ?? null) as string | null

  const items = Array.isArray(payload.primi_10) ? payload.primi_10 : []
  const html = renderDigestHtml(displayName, items, payload.totale)

  const result = await sendEmail({
    to: userEmail,
    subject: `Planfully — Hai ${payload.totale} promemoria oggi`,
    html,
  })

  if (!result.ok) return { ok: false, email: userEmail, reason: result.reason }
  return { ok: true, email: userEmail }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  let body: Partial<DigestPayload> & { dry_run?: boolean } = {}
  try { body = await req.json() } catch { body = {} }

  // Modo 2: single-user (chiamata da SQL via pg_net).
  // SICUREZZA: NON ci fidiamo del contenuto passato nel body (totale/primi_10): se la funzione
  // fosse raggiungibile pubblicamente, chiunque potrebbe inviare un'email brandizzata Planfully
  // con testo e link arbitrari a un utente noto (phishing). Rileggiamo il digest dal DB per quel
  // destinatario e usiamo SOLO quei dati.
  if (body.destinatario_id) {
    const { data: row } = await admin
      .from('v_notifiche_digest_per_utente')
      .select('destinatario_id,totale,primi_10')
      .eq('destinatario_id', body.destinatario_id)
      .eq('data_digest', new Date().toISOString().slice(0, 10))
      .maybeSingle()
    if (!row || !row.totale) return json({ ok: false, reason: 'empty_digest' }, 400)
    const res = await sendDigestForUser(admin, {
      destinatario_id: row.destinatario_id as string,
      totale: row.totale as number,
      primi_10: (row.primi_10 ?? []) as DigestItem[],
    })
    return json(res, res.ok ? 200 : 400)
  }

  // Modo 1: scan view.
  const { data, error } = await admin
    .from('v_notifiche_digest_per_utente')
    .select('destinatario_id,totale,primi_10,data_digest')
    .eq('data_digest', new Date().toISOString().slice(0, 10))

  if (error) return json({ error: 'view_query_failed', detail: error.message }, 500)

  const results: Array<{ ok: boolean; destinatario_id: string; email?: string; reason?: string }> = []
  for (const row of (data ?? [])) {
    if (body.dry_run) {
      results.push({ ok: true, destinatario_id: row.destinatario_id })
      continue
    }
    const r = await sendDigestForUser(admin, {
      destinatario_id: row.destinatario_id,
      totale: row.totale,
      primi_10: (row.primi_10 ?? []) as DigestItem[],
    })
    results.push({ destinatario_id: row.destinatario_id, ...r })
  }

  return json({ ok: true, sent: results.filter((r) => r.ok).length, total: results.length, results })
})
