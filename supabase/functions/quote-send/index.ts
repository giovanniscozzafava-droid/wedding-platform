// deno-lint-ignore-file no-explicit-any
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail as sendEmailSES } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
  const r = await sendEmailSES({ to, subject, html, from: FROM })
  if (r.ok) return { ok: true as const }
  if (r.reason === 'no_credentials') return { skipped: true as const }
  return { error: r.error ?? 'api_error' }
}

async function sendResendCustom(opts: { from: string; to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string> }) {
  const r = await sendEmailSES({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    from: opts.from,
    reply_to: opts.replyTo,
    headers: opts.headers,
  })
  if (r.ok) return { ok: true as const, id: r.message_id }
  if (r.reason === 'no_credentials') return { skipped: true as const }
  return { error: r.error ?? 'api_error' }
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

  // Propaga JWT user del caller (quote-generate-pdf richiede JWT user, non SERVICE_KEY).
  // NIENTE fallback a SERVICE_KEY: senza un JWT valido la funzione non deve agire (altrimenti
  // chiunque la chiamasse senza Authorization opererebbe con privilegi service-role).
  const callerAuth = req.headers.get('Authorization') ?? ''
  if (!callerAuth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401)

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
        date_from: q.event_date,
        date_to: q.event_date,
        status: 'IN_TRATTATIVA',
        quote_id: body.quote_id,
      }).select('id').single()
      entryId = created.data?.id
      // Campi sensibili (cliente + valore TOTALE) nella tabella privata (split P5).
      if (entryId) {
        await admin.from('calendar_entries_private').upsert({
          entry_id: entryId, client_name: q.client_name, client_email: q.client_email, value_amount: q.total_client,
        })
      }
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
        // Avvisa via EMAIL i fornitori che è stata chiesta la loro disponibilità per la data
        // (la notifica in-app + campanella la crea il trigger su quote_items). Best-effort: un
        // fallimento email non blocca l'invio del preventivo. Solo al primo invio (non sui re-send).
        if (!body.force_resend) {
          const dateStr = q.event_date ? new Date(q.event_date).toLocaleDateString('it-IT') : ''
          const link = `${APP_BASE}/lavori-da-confermare`
          for (const uid of uniq) {
            if (uid === q.owner_id) continue
            try {
              const { data: au } = await admin.auth.admin.getUserById(uid)
              const to = au?.user?.email
              if (!to) continue
              const subject = `Conferma la tua disponibilità · ${q.title ?? 'evento'}${dateStr ? ` (${dateStr})` : ''}`
              const html = emailShell({
                eyebrow: 'Disponibilità richiesta',
                title: 'Confermi la tua disponibilità?',
                bodyHtml: `<p style="margin:0">Sei stato inserito in un preventivo per <strong>${escapeHtml(q.title ?? 'un evento')}</strong>${dateStr ? ` del <strong>${escapeHtml(dateStr)}</strong>` : ''}.</p>`,
                cta: { href: link, label: 'Conferma la disponibilità' },
              })
              await sendResend(to, subject, html)
            } catch (_e) { /* best-effort */ }
          }
        }
      }
    }
  }

  // 5. invia email cliente — branded WP, Pinterest aesthetic
  let emailResult: any = { skipped: true }
  if (q.client_email) {
    // Recupera info WP per personalizzazione email
    const { data: owner } = await admin.from('profiles')
      .select('full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, phone, city, bio, subscription_tier, role, subrole')
      .eq('id', q.owner_id).maybeSingle()
    const { data: ownerAuth } = await admin.auth.admin.getUserById(q.owner_id)
    const ownerEmail = ownerAuth?.user?.email ?? null
    const isPremium = owner?.subscription_tier === 'PREMIUM'

    // Display name dell'owner: priorita business_name > full_name > parte locale email
    // (mai mostrare l'indirizzo email completo come "from name").
    const cleanName = (s: string | null | undefined): string | null => {
      if (!s) return null
      const t = s.trim()
      if (!t) return null
      // Se contiene @ probabilmente e una email (no nome reale)
      if (t.includes('@')) return null
      return t
    }
    const roleFallback = owner?.role === 'FORNITORE'
      ? (owner?.subrole ? owner.subrole.charAt(0).toUpperCase() + owner.subrole.slice(1) : 'Il tuo fornitore')
      : owner?.role === 'LOCATION' ? 'La tua location'
      : 'Il tuo wedding planner'
    const ownerEmailLocal = ownerEmail ? ownerEmail.split('@')[0].replace(/\+.*$/, '').replace(/[._-]+/g, ' ').trim() : null
    const wpName = cleanName(owner?.business_name) ?? cleanName(owner?.full_name) ?? cleanName(ownerEmailLocal) ?? roleFallback
    const wpBiz = cleanName(owner?.business_name)
    // Accento white-label: colore del pro (premium) oppure cipresso (default brand).
    const primaryColor = isPremium && owner?.brand_primary_color ? owner.brand_primary_color : '#25402F'

    const totFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(q.total_client))
    const eventDateFmt = q.event_date ? new Date(q.event_date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null
    const isOverride = !!body.override_reason

    // Determina link:
    // - Se client_email NON e' un utente registrato → invito coppia con registrazione
    //   (crea wedding_couple_members con token; dopo signup li trova nella loro dashboard)
    // - Se utente esiste → link preview pubblico standard
    // Regola: niente cifre/accettazione fuori dalla piattaforma. Il link porta SEMPRE
    // all'accesso cliente, poi atterra sulla DASHBOARD aggregata (tutte le offerte di tutti
    // i fornitori nella stessa area), da cui apre/firma il singolo preventivo.
    let link = `${APP_BASE}/area-cliente/accedi?next=${encodeURIComponent('/area-cliente')}`
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
      : `Il tuo preventivo per ${q.title} · da ${wpName}`

    // Frase di chiusura coerente col tipo evento (no "giorno più importante" per una cresima)
    const _ek = String(q.event_kind ?? 'matrimonio').toLowerCase()
    const closingPhrase =
      _ek === 'matrimonio'   ? 'A presto, per il tuo giorno più importante.'
      : _ek === 'compleanno' ? 'A presto, per la tua festa.'
      : _ek === 'laurea'     ? 'A presto, per festeggiare insieme.'
      : _ek === 'corporate'  ? 'A presto, per il vostro evento.'
      : (_ek === 'battesimo' || _ek === 'comunione' || _ek === 'cresima')
                             ? 'A presto, per questo giorno speciale.'
      : 'A presto, per il tuo evento.'

    // Etichetta evento + cosa il cliente trova nella sua area, coerenti col tipo.
    const eventLabel =
      _ek === 'matrimonio'  ? 'matrimonio'
      : _ek === 'corporate' ? 'evento aziendale'
      : _ek === 'compleanno'? 'compleanno'
      : _ek === 'laurea'    ? 'festa di laurea'
      : _ek === 'anniversario' ? 'anniversario'
      : (_ek === 'battesimo' || _ek === 'comunione' || _ek === 'cresima') ? _ek
      : 'evento'
    const areaFeatures = _ek === 'matrimonio'
      ? 'Preventivo dettagliato · Firma sicura · Programma e scaletta<br>Tavoli e invitati · Alloggi e trasporti · Mood board'
      : 'Preventivo dettagliato · Firma sicura · Programma dell’evento<br>Documenti · Aggiornamenti in tempo reale'

    // Items preview: prime 5 voci
    const { data: itemsPreview } = await admin.from('quote_items').select('name_snapshot, line_client').eq('quote_id', body.quote_id).order('sort_order').limit(5)
    const itemsHtml = (itemsPreview ?? []).map((it: any) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #EFEAE0;color:#1A1714;font-size:14px">${escapeHtml(it.name_snapshot)}</td>
        <td style="padding:10px 0;border-bottom:1px solid #EFEAE0;color:#1A1714;font-size:14px;text-align:right;font-weight:600">${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(it.line_client))}</td>
      </tr>`).join('')

    const customNote = isOverride ? body.override_reason ?? '' : ''

    const areaBox = `<div style="margin:16px 0;padding:14px 18px;background:#F4F3EE;border:1px solid #E2DFD4">
      <div style="font-family:'IBM Plex Mono',Consolas,monospace;font-size:10px;color:#25402F;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Cosa trovi nella tua area</div>
      <div style="font-size:13px;line-height:1.8;color:#181F1B">${areaFeatures}</div>
    </div>`
    const overrideBanner = isOverride
      ? `<div style="margin:0 0 16px;padding:12px 16px;background:#F4F3EE;border-left:3px solid ${escapeHtml(primaryColor)}"><div style="font-family:'IBM Plex Mono',Consolas,monospace;font-size:10px;color:${escapeHtml(primaryColor)};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px">Modifica al preventivo già accettato</div><div style="font-style:italic">“${escapeHtml(customNote)}”</div></div>`
      : ''
    const intro = isNewCouple
      ? `<p style="margin:0 0 4px">Il tuo preventivo personalizzato è pronto. Crea il tuo account riservato per visualizzarlo nel dettaglio, accettarlo digitalmente e seguire l'organizzazione ${eventLabel === 'evento' ? "dell'evento" : 'del ' + escapeHtml(eventLabel)}.</p>`
      : `<p style="margin:0 0 4px">Il tuo preventivo${isOverride ? ' aggiornato' : ''} è pronto. Per riservatezza, importi e accettazione sono visibili solo nella tua area riservata. Accedi per vederlo nel dettaglio e accettarlo.</p>`
    const signature = `<span style="font-style:italic">${owner?.bio ? escapeHtml(owner.bio).slice(0, 280) + (owner.bio.length > 280 ? '…' : '') : escapeHtml(closingPhrase)}</span><br><br><strong>— ${escapeHtml(wpName)}</strong><br>${escapeHtml(wpBiz ?? roleFallback)}${ownerEmail || owner?.phone ? `<br>${ownerEmail ? escapeHtml(ownerEmail) : ''}${ownerEmail && owner?.phone ? ' · ' : ''}${owner?.phone ? escapeHtml(owner.phone) : ''}` : ''}`
    const html = emailShell({
      accent: primaryColor,
      eyebrow: isOverride ? 'Preventivo aggiornato' : 'Preventivo per',
      title: q.title,
      subtitleHtml: eventDateFmt ? escapeHtml(eventDateFmt) : undefined,
      bodyHtml: `${overrideBanner}${intro}${areaBox}<p style="margin:14px 0 0;font-size:12px;color:#6B6B63">${isNewCouple ? 'Crea un account in 30 secondi → troverai il preventivo nella tua area personale e potrai accettarlo con firma sicura.' : 'Potrai accettarlo digitalmente con firma sicura.'}</p>`,
      cta: { href: link, label: isNewCouple ? 'Crea il tuo account e apri il preventivo' : 'Apri il preventivo' },
      contactHtml: signature,
    })

    // ── Template SOBRIO (text-forward) per i provider Microsoft (Outlook/Hotmail/
    //    Live/MSN): SmartScreen penalizza l'HTML "promozionale" (immagini grandi,
    //    bottoni colorati). Stessi contenuti, ma minimale: pesa molto meno sullo
    //    spam-score e arriva in inbox anche con dominio giovane.
    const recipientDomain = (q.client_email.split('@')[1] ?? '').toLowerCase()
    const isMicrosoftInbox = /(^|\.)(hotmail|outlook|live|msn|passport|windowslive)\./.test(recipientDomain + '.')
      || ['hotmail.it','hotmail.com','outlook.it','outlook.com','live.it','live.com','msn.com','hotmail.co.uk','outlook.es','outlook.fr','outlook.de'].includes(recipientDomain)

    const itemsText = (itemsPreview ?? []).map((it: any) =>
      `• ${escapeHtml(it.name_snapshot)} — ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(it.line_client))}`
    ).join('<br>')

    const soberHtml = `<!doctype html>
<html lang="it"><body style="font-family:Arial,Helvetica,sans-serif;color:#1A1714;background:#ffffff;margin:0;padding:24px 16px;font-size:15px;line-height:1.6">
<div style="max-width:560px;margin:0 auto">
  <p style="margin:0 0 16px">Ciao${cleanName(q.client_name) ? ' ' + escapeHtml(cleanName(q.client_name)!) : ''},</p>
  ${isNewCouple ? `
  <p style="margin:0 0 16px">${escapeHtml(wpName)} ti ha preparato il preventivo per <strong>${escapeHtml(q.title)}</strong>${eventDateFmt ? ` (${escapeHtml(eventDateFmt)})` : ''}.</p>
  <p style="margin:0 0 16px">Per vederlo nel dettaglio, accettarlo con firma e seguire l'organizzazione, crea il tuo account riservato qui:</p>
  <p style="margin:0 0 20px"><a href="${link}" style="color:#25402F;font-weight:bold">Crea l'account e apri il preventivo →</a></p>
  ` : `
  <p style="margin:0 0 16px">${escapeHtml(wpName)} ti ha inviato il preventivo per <strong>${escapeHtml(q.title)}</strong>${eventDateFmt ? ` (${escapeHtml(eventDateFmt)})` : ''}.</p>
  <p style="margin:0 0 16px">Per riservatezza, importi e accettazione sono visibili solo nella tua area riservata.</p>
  <p style="margin:0 0 20px"><a href="${link}" style="color:#25402F;font-weight:bold">Accedi e apri il preventivo →</a></p>
  `}
  ${isOverride && customNote ? `<p style="margin:0 0 16px">Nota di aggiornamento: ${escapeHtml(customNote)}</p>` : ''}
  <p style="margin:0 0 4px">${escapeHtml(closingPhrase)}</p>
  <p style="margin:0 0 2px">— ${escapeHtml(wpName)}${wpBiz ? `, ${escapeHtml(wpBiz)}` : ''}</p>
  ${ownerEmail || owner?.phone ? `<p style="margin:0 0 16px;color:#787164;font-size:13px">${ownerEmail ? escapeHtml(ownerEmail) : ''}${ownerEmail && owner?.phone ? ' · ' : ''}${owner?.phone ? escapeHtml(owner.phone) : ''}</p>` : ''}
  <p style="margin:24px 0 0;color:#6B6B63;font-size:12px">Planfully · il gestionale della filiera wedding. Se non ti aspettavi questa email, ignorala pure.</p>
</div>
</body></html>`

    // From: usa SOLO business_name se presente, altrimenti wpName. NO email-like.
    // Format: "Nome Business via Planfully <noreply@planfully.it>"
    // Escape virgolette nel display name per evitare header injection.
    const safeName = (s: string) => s.replace(/[",;<>\r\n]/g, ' ').trim().slice(0, 80) || 'Planfully'
    const fromName = safeName(wpBiz ?? wpName)
    const fromAddr = (FROM.match(/<(.+)>/)?.[1]) ?? FROM
    const fromHeader = `${fromName} via Planfully <${fromAddr}>`

    // To: usa "Nome Cliente <email>" se abbiamo client_name (cliente vede il proprio nome).
    const toClientName = cleanName(q.client_name)
    const toHeader = toClientName ? `${safeName(toClientName)} <${q.client_email}>` : q.client_email

    // Header anti-spam: List-Unsubscribe (Outlook/Hotmail lo premiano fortemente)
    // + one-click RFC 8058. Riduce drasticamente il rischio "finisce in spam".
    const unsubMail = ownerEmail ?? fromAddr
    emailResult = await sendResendCustom({
      from: fromHeader,
      to: toHeader,
      subject,
      // Microsoft (Outlook/Hotmail/Live): versione sobria text-forward → inbox.
      html: isMicrosoftInbox ? soberHtml : html,
      replyTo: ownerEmail ?? undefined,
      headers: {
        'List-Unsubscribe': `<mailto:${unsubMail}?subject=unsubscribe>, <${APP_BASE}/unsubscribe?e=${encodeURIComponent(q.client_email)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'X-Entity-Ref-ID': String(q.id),
      },
    })
  }

  return json({
    ok: true,
    access_token: accessToken,
    pdf_url: pdfJson.url,
    email_result: emailResult,
  })
})
