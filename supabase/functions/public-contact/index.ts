// Edge function public-contact:
// Modulo di contatto del profilo pubblico (fornitore o WP). Crea il lead via
// submit_public_lead e, se il cliente arriva da un SUGGERIMENTO (ref_id = id
// della riga supplier_referrals), CERTIFICA il contatto con IP + user-agent +
// timestamp (prova dello scambio tra fornitori). Il referrer è letto server-side
// dal record, mai dall'URL → non falsificabile.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  const slug = String(body.slug ?? '').trim()
  if (!slug) return json({ error: 'slug_required' }, 400)

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('cf-connecting-ip') ?? null
  const ua = req.headers.get('user-agent') ?? null

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1) crea il lead (gestisce sia fornitore sia WP per slug)
  const { data: lead, error: leadErr } = await admin.rpc('submit_public_lead', {
    p_slug: slug,
    p_client_name: body.client_name ?? null,
    p_client_email: body.client_email ?? null,
    p_client_phone: body.client_phone ?? null,
    p_event_kind: body.event_kind ?? null,
    p_event_date: body.event_date ?? null,
    p_event_location: body.event_location ?? null,
    p_guests_estimate: body.guests_estimate ?? null,
    p_budget_range: body.budget_range ?? null,
    p_message: body.message ?? null,
    p_honeypot: body.honeypot ?? null,
    p_source: body.source ?? 'public_form',
    p_profile_answers: body.profile_answers ?? {},
  })
  if (leadErr) return json({ error: 'db_error', detail: leadErr.message }, 500)
  const r = lead as { ok?: boolean; error?: string; id?: string; kind?: string }
  if (r?.error) return json({ error: r.error }, 400)

  // 2) se arriva da un suggerimento, CERTIFICA il contatto (IP + UA + timestamp)
  let receipt: string | null = null
  let certified = false
  const refId = (body.ref_id ?? body.sid) as string | undefined
  if (refId) {
    const { data: cert } = await admin.rpc('certify_referral_contact', {
      p_ref_id: refId, p_suggested_slug: slug, p_lead_id: r?.id ?? null, p_ip: ip, p_ua: ua,
    })
    const c = cert as { ok?: boolean; receipt?: string; certified?: boolean } | null
    if (c?.ok) { receipt = c.receipt ?? null; certified = !!c.certified || !!c.receipt }
  }

  return json({ ok: true, lead_id: r?.id ?? null, kind: r?.kind ?? null, receipt, certified })
})
