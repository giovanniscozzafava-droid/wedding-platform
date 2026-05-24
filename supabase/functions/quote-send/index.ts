// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@wedding-platform.test'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'http://localhost:5173'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

async function sendResend(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return { skipped: true as const }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  return r.ok ? { ok: true as const } : { error: await r.text() }
}

async function sendResendCustom(opts: { from: string; to: string; subject: string; html: string; replyTo?: string }) {
  if (!RESEND_API_KEY) return { skipped: true as const }
  const body: Record<string, unknown> = { from: opts.from, to: [opts.to], subject: opts.subject, html: opts.html }
  if (opts.replyTo) body.reply_to = opts.replyTo
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify(body),
  })
  if (!r.ok) return { error: await r.text() }
  const j = await r.json()
  return { ok: true as const, id: j.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as {
    quote_id?: string
    override_reason?: string  // motivo modifica forzata post-firma
    force_resend?: boolean    // se true, non cambia status (resta ACCETTATO)
  }
  if (!body.quote_id) return json({ error: 'quote_id required' }, 400)

  // Propaga JWT user del caller (quote-generate-pdf richiede JWT user, non SERVICE_KEY)
  const callerAuth = req.headers.get('Authorization') ?? `Bearer ${SERVICE_KEY}`

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1. genera PDF (riusa Edge Function). Header apikey serve a Kong gateway.
  const pdfRes = await fetch(`${SUPABASE_URL}/functions/v1/quote-generate-pdf`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: callerAuth,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify({ quote_id: body.quote_id }),
  })
  if (!pdfRes.ok) {
    return json({ error: 'pdf generation failed', detail: await pdfRes.text() }, 500)
  }
  const pdfJson = await pdfRes.json()

  // 2. carica quote (con eventuale token gia` esistente)
  const { data: q } = await admin.from('quotes').select('*').eq('id', body.quote_id).single()
  if (!q) return json({ error: 'quote not found' }, 404)

  let accessToken = q.access_token as string | null
  if (!accessToken) {
    accessToken = crypto.randomUUID()
  }

  // 3. update status + access_token
  // Se force_resend (modifica forzata post-firma), NON cambia status
  const updatePayload: Record<string, unknown> = {
    access_token: accessToken,
    sent_at: new Date().toISOString(),
    sent_email_log: [
      ...((q.sent_email_log ?? []) as any[]),
      {
        at: new Date().toISOString(),
        to: q.client_email,
        revision: q.revision,
        ...(body.override_reason ? { override_reason: body.override_reason } : {}),
      },
    ],
  }
  if (!body.force_resend) updatePayload.status = 'INVIATO'
  await admin.from('quotes').update(updatePayload).eq('id', body.quote_id)

  // 4. crea calendar_entry IN_TRATTATIVA se non esiste + agganci participants
  if (q.event_date) {
    const { data: existing } = await admin
      .from('calendar_entries')
      .select('id')
      .eq('quote_id', body.quote_id)
      .maybeSingle()
    let entryId = existing?.id as string | undefined
    if (!entryId) {
      const created = await admin.from('calendar_entries').insert({
        owner_id: q.owner_id,
        title: q.title,
        client_name: q.client_name,
        client_email: q.client_email,
        date_from: q.event_date,
        date_to: q.event_date,
        status: 'IN_TRATTATIVA',
        value_amount: q.total_client,
        quote_id: body.quote_id,
      }).select('id').single()
      entryId = created.data?.id
    }
    if (entryId) {
      const { data: suppliers } = await admin
        .from('quote_items')
        .select('supplier_id')
        .eq('quote_id', body.quote_id)
        .not('supplier_id', 'is', null)
      const uniq = new Set<string>()
      for (const s of (suppliers ?? []) as any[]) {
        if (s.supplier_id) uniq.add(s.supplier_id as string)
      }
      if (uniq.size > 0) {
        const rows = Array.from(uniq).map((uid) => ({
          entry_id: entryId!,
          user_id: uid,
          role_in_entry: 'fornitore',
        }))
        await admin.from('calendar_entry_participants').upsert(rows, { onConflict: 'entry_id,user_id' })
      }
    }
  }

  // 5. invia email cliente — branded WP, Pinterest aesthetic
  let emailResult: any = { skipped: true }
  if (q.client_email) {
    // Recupera info WP per personalizzazione email
    const { data: owner } = await admin.from('profiles')
      .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, phone, city, bio, subscription_tier')
      .eq('id', q.owner_id).maybeSingle()
    const { data: ownerAuth } = await admin.auth.admin.getUserById(q.owner_id)
    const ownerEmail = ownerAuth?.user?.email ?? null
    const isPremium = owner?.subscription_tier === 'PREMIUM'

    const wpName = owner?.full_name ?? 'Il tuo wedding planner'
    const wpBiz = owner?.business_name ?? null
    const primaryColor = isPremium && owner?.brand_primary_color ? owner.brand_primary_color : '#1A2E4F'
    const accentColor = isPremium && owner?.brand_secondary_color ? owner.brand_secondary_color : '#C49A5C'
    const logoUrl = isPremium && owner?.brand_logo_url ? owner.brand_logo_url : 'https://planfully.it/brand/planfully-symbol.png'

    const totFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(q.total_client))
    const eventDateFmt = q.event_date ? new Date(q.event_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null
    const isOverride = !!body.override_reason

    // Determina link:
    // - Se client_email NON e' un utente registrato → invito coppia con registrazione
    //   (crea wedding_couple_members con token; dopo signup li trova nella loro dashboard)
    // - Se utente esiste → link preview pubblico standard
    let link = `${APP_BASE}/p/preview/${accessToken}`
    let isNewCouple = false
    try {
      const { data: { users: allUsers } } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const userExists = allUsers?.some((u: any) => u.email?.toLowerCase() === q.client_email!.toLowerCase())
      if (!userExists && q.event_date) {
        // Trova/crea calendar_entry per il quote
        const { data: entry } = await admin.from('calendar_entries').select('id').eq('quote_id', q.id).maybeSingle()
        if (entry?.id) {
          // Crea membro coppia con invite_token (idempotente su (entry_id, email))
          const { data: existing } = await admin.from('wedding_couple_members')
            .select('invite_token').eq('entry_id', entry.id).eq('email', q.client_email).maybeSingle()
          let inviteToken = existing?.invite_token
          if (!inviteToken) {
            const ins = await admin.from('wedding_couple_members').insert({
              entry_id: entry.id, email: q.client_email,
              full_name: q.client_name ?? q.client_email.split('@')[0],
              role: 'SPOSA',
            }).select('invite_token').single()
            inviteToken = ins.data?.invite_token
          }
          if (inviteToken) {
            link = `${APP_BASE}/invito-coppia/${inviteToken}`
            isNewCouple = true
          }
        }
      }
    } catch { /* fallback al link preview standard */ }

    const subject = isOverride
      ? `Modifica al preventivo · ${q.title}`
      : `Il vostro preventivo per ${q.title} · da ${wpName}`

    // Items preview: prime 5 voci
    const { data: itemsPreview } = await admin.from('quote_items').select('name_snapshot, line_client').eq('quote_id', body.quote_id).order('sort_order').limit(5)
    const itemsHtml = (itemsPreview ?? []).map((it: any) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EFEAE0;color:#1A1714;font-size:14px">${escapeHtml(it.name_snapshot)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #EFEAE0;color:#1A1714;font-size:14px;text-align:right;font-weight:600">${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(it.line_client))}</td>
      </tr>`).join('')

    const customNote = isOverride ? body.override_reason ?? '' : ''

    const html = `<!doctype html>
<html lang="it">
<body style="font-family:Georgia,'Times New Roman',serif;background:#F8F5EE;margin:0;padding:0;color:#1A1714">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F8F5EE;padding:32px 16px">
  <tr><td align="center">

    <!-- MAIN CARD -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#FDFBF6;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(26,23,20,0.08)">

      <!-- TOP ACCENT BAR -->
      <tr><td style="background:${accentColor};height:4px;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="background:${primaryColor};height:1px;font-size:0;line-height:0">&nbsp;</td></tr>

      <!-- HEADER: logo + WP name -->
      <tr><td style="padding:36px 40px 24px 40px">
        <table role="presentation" width="100%"><tr>
          <td style="vertical-align:middle">
            <img src="${logoUrl}" alt="${escapeHtml(wpBiz ?? wpName)}" width="56" height="56" style="display:block;border-radius:8px;border:0" />
          </td>
          <td style="vertical-align:middle;padding-left:14px">
            <div style="font-family:Georgia,serif;font-size:18px;color:#1A1714;font-weight:700;letter-spacing:-0.02em">${escapeHtml(wpBiz ?? wpName)}</div>
            ${owner?.city ? `<div style="font-family:Arial,sans-serif;font-size:11px;color:#A59C8E;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px">${escapeHtml(owner.city)}</div>` : ''}
          </td>
          <td style="vertical-align:middle;text-align:right">
            <div style="font-family:Arial,sans-serif;font-size:10px;color:#A59C8E;letter-spacing:1.5px;text-transform:uppercase">Revisione</div>
            <div style="font-family:Georgia,serif;font-size:16px;color:#1A1714;font-weight:700">v${q.revision}</div>
          </td>
        </tr></table>
      </td></tr>

      <!-- DIVIDER ORNAMENT -->
      <tr><td style="padding:0 40px 28px 40px;text-align:center">
        <table role="presentation" width="100%"><tr>
          <td style="border-bottom:1px solid #E4DED2;height:0;line-height:0">&nbsp;</td>
          <td style="width:24px;text-align:center;padding:0 8px">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${accentColor}"></span>
          </td>
          <td style="border-bottom:1px solid #E4DED2;height:0;line-height:0">&nbsp;</td>
        </tr></table>
      </td></tr>

      ${isOverride ? `
      <!-- OVERRIDE BANNER -->
      <tr><td style="padding:0 40px 24px 40px">
        <div style="background:#FFF8EB;border-left:3px solid ${accentColor};border-radius:6px;padding:14px 16px">
          <div style="font-family:Arial,sans-serif;font-size:10px;color:${accentColor};letter-spacing:1.5px;text-transform:uppercase;font-weight:700;margin-bottom:6px">Modifica al preventivo già accettato</div>
          <div style="font-family:Georgia,serif;font-size:14px;color:#1A1714;line-height:1.5;font-style:italic">"${escapeHtml(customNote)}"</div>
        </div>
      </td></tr>` : ''}

      <!-- EYEBROW + TITLE -->
      <tr><td style="padding:0 40px 8px 40px;text-align:center">
        <div style="font-family:Arial,sans-serif;font-size:11px;color:${accentColor};letter-spacing:3px;text-transform:uppercase;font-weight:600">${isOverride ? 'Preventivo aggiornato per' : 'Preventivo per'}</div>
      </td></tr>
      <tr><td style="padding:8px 40px 0 40px;text-align:center">
        <h1 style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:36px;line-height:1.15;color:#1A1714;margin:0;letter-spacing:-0.02em">${escapeHtml(q.title)}</h1>
      </td></tr>
      ${eventDateFmt ? `
      <tr><td style="padding:14px 40px 0 40px;text-align:center">
        <div style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#787164">${escapeHtml(eventDateFmt)}</div>
      </td></tr>` : ''}

      ${isNewCouple ? `
      <!-- INVITO REGISTRAZIONE: niente totale, niente voci. Solo invito a creare account -->
      <tr><td style="padding:24px 40px 8px 40px;text-align:center">
        <p style="font-family:Georgia,serif;font-size:15px;color:#4a5568;line-height:1.7;margin:0">
          Il tuo preventivo personalizzato è pronto.<br>
          Crea il tuo account riservato per visualizzarlo nel dettaglio,<br>
          accettarlo digitalmente e seguire l'organizzazione del giorno-X.
        </p>
      </td></tr>
      <tr><td style="padding:18px 40px 0 40px;text-align:center">
        <div style="display:inline-block;padding:14px 22px;border-radius:10px;background:#F8F5EE;border:1px solid #E4DED2">
          <div style="font-family:Arial,sans-serif;font-size:10px;color:${accentColor};letter-spacing:2px;text-transform:uppercase;font-weight:600;margin-bottom:6px">Cosa trovi nella tua area</div>
          <div style="font-family:Georgia,serif;font-size:13px;color:#1A1714;line-height:1.7">
            Preventivo dettagliato · Firma sicura · Programma e scaletta<br>
            Tavoli e invitati · Alloggi e trasporti · Mood board
          </div>
        </div>
      </td></tr>
      ` : `
      <!-- TOTALE HERO -->
      <tr><td style="padding:36px 40px 32px 40px;text-align:center">
        <div style="font-family:Arial,sans-serif;font-size:10px;color:#A59C8E;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:10px">Investimento totale</div>
        <div style="font-family:Georgia,serif;font-size:42px;font-weight:700;color:${primaryColor};letter-spacing:-0.02em">${totFmt}</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:#A59C8E;margin-top:6px;font-style:italic">IVA inclusa salvo diversa indicazione</div>
      </td></tr>

      ${itemsHtml ? `
      <!-- ITEMS PREVIEW -->
      <tr><td style="padding:0 40px 16px 40px">
        <div style="font-family:Arial,sans-serif;font-size:10px;color:${accentColor};letter-spacing:2.5px;text-transform:uppercase;font-weight:600;margin-bottom:14px">Cosa è incluso</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
        ${(itemsPreview?.length ?? 0) >= 5 ? `<div style="text-align:center;padding-top:14px;font-family:Georgia,serif;font-size:12px;color:#A59C8E;font-style:italic">...e altre voci nel dettaglio</div>` : ''}
      </td></tr>` : ''}
      `}

      <!-- CTA -->
      <tr><td style="padding:32px 40px;text-align:center">
        <a href="${link}" style="display:inline-block;background:${primaryColor};color:#FDFBF6;padding:16px 40px;border-radius:50px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:1.5px;text-transform:uppercase">${isNewCouple ? 'Crea il tuo account · vedi il preventivo' : 'Apri il preventivo'}</a>
        <div style="margin-top:16px;font-family:Arial,sans-serif;font-size:11px;color:#A59C8E">${isNewCouple ? 'Crea un account in 30 secondi → troverai il preventivo nella tua area personale, potrai accettarlo con firma sicura' : 'Potrai accettarlo digitalmente con firma sicura'}</div>
      </td></tr>

      <!-- PERSONAL SIGNATURE WP -->
      <tr><td style="padding:0 40px 36px 40px;text-align:center">
        <table role="presentation" width="100%"><tr>
          <td style="border-bottom:1px solid #E4DED2">&nbsp;</td>
        </tr></table>
        <div style="margin-top:24px;font-family:Georgia,serif;font-style:italic;font-size:13px;color:#787164;line-height:1.6">
          ${owner?.bio ? escapeHtml(owner.bio).slice(0, 280) + (owner.bio.length > 280 ? '…' : '') : 'A presto, per il tuo giorno più importante.'}
        </div>
        <div style="margin-top:18px;font-family:Georgia,serif;font-size:14px;color:#1A1714;font-weight:700">— ${escapeHtml(wpName)}</div>
        <div style="font-family:Arial,sans-serif;font-size:11px;color:#A59C8E;letter-spacing:1px;text-transform:uppercase;margin-top:4px">${escapeHtml(wpBiz ?? 'Wedding planner')}</div>
        ${ownerEmail || owner?.phone ? `
        <div style="margin-top:14px;font-family:Arial,sans-serif;font-size:12px;color:#787164">
          ${ownerEmail ? `<a href="mailto:${escapeHtml(ownerEmail)}" style="color:#787164;text-decoration:none">${escapeHtml(ownerEmail)}</a>` : ''}
          ${ownerEmail && owner?.phone ? '  ·  ' : ''}
          ${owner?.phone ? escapeHtml(owner.phone) : ''}
        </div>` : ''}
      </td></tr>

      <!-- BOTTOM ACCENT -->
      <tr><td style="background:${accentColor};height:3px;font-size:0;line-height:0">&nbsp;</td></tr>
    </table>

    <!-- POWERED BY -->
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;margin-top:20px">
      <tr><td style="text-align:center;font-family:Arial,sans-serif;font-size:10px;color:#A59C8E;letter-spacing:1.5px">
        <a href="https://planfully.it" style="color:#A59C8E;text-decoration:none">Powered by Planfully · Un progetto Fuyue Srl</a>
      </td></tr>
    </table>

  </td></tr>
</table>
</body></html>`

    const fromName = wpBiz ? `${wpName} · ${wpBiz}` : wpName
    const fromAddr = (FROM.match(/<(.+)>/)?.[1]) ?? FROM
    const fromHeader = `${fromName} via Planfully <${fromAddr}>`

    emailResult = await sendResendCustom({
      from: fromHeader,
      to: q.client_email,
      subject,
      html,
      replyTo: ownerEmail ?? undefined,
    })
  }

  return json({
    ok: true,
    access_token: accessToken,
    pdf_url: pdfJson.url,
    email_result: emailResult,
  })
})
