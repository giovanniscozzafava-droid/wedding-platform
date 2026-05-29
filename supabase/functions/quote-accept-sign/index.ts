// deno-lint-ignore-file no-explicit-any
// Accetta un preventivo via token con firma elettronica semplice.
// Cattura tutti i dati richiesti per evidenza legale (FES — art. 20 CAD,
// art. 1326 c.c.). Genera PDF atto di accettazione controfirmato.
//
// POST body:
//   { token, signer_name, signer_phone?, doc_type, doc_number, doc_issued_by?,
//     signature_data_url, consent_terms, consent_privacy }
//
// Salva firma PNG su storage 'quote-signatures' + riga quote_acceptances +
// segna quote.status = 'ACCETTATO' + email a WP e cliente.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsPDF } from 'npm:jspdf@2.5.2'
import { sendEmail as sendEmailSES } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  opts?: {
    from?: string
    reply_to?: string
    attachments?: Array<{ filename: string; content_base64: string; content_type: string }>
  },
) {
  return sendEmailSES({
    to,
    subject,
    html,
    from: opts?.from,
    reply_to: opts?.reply_to,
    attachments: opts?.attachments,
  })
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json', ...cors } })
}

function safeText(s: any): string { return String(s ?? '').trim() }

async function sha256(data: ArrayBuffer): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const m = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/)
  if (!m) throw new Error('signature_data_url non valido')
  const bin = atob(m[2])
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const body = (await req.json().catch(() => ({}))) as {
    token?: string
    signer_name?: string
    signer_phone?: string
    doc_type?: 'CARTA_IDENTITA' | 'PASSAPORTO' | 'PATENTE'
    doc_number?: string
    doc_issued_by?: string
    signature_data_url?: string
    consent_terms?: boolean
    consent_privacy?: boolean
    // Dati fiscali del cliente (raccolti pre-firma per il contratto)
    fiscal?: {
      fiscal_code?: string
      vat_number?: string
      business_name?: string
      address?: string
      city?: string
      zip?: string
      province?: string
      country?: string
      sdi_code?: string
      pec_email?: string
    }
  }

  if (!body.token) return json({ error: 'token required' }, 400)
  if (!body.signer_name?.trim()) return json({ error: 'Nome e cognome obbligatori' }, 400)
  if (!body.doc_type) return json({ error: 'Tipo documento obbligatorio' }, 400)
  if (!body.doc_number?.trim()) return json({ error: 'Numero documento obbligatorio' }, 400)
  if (!body.signature_data_url) return json({ error: 'Firma obbligatoria' }, 400)
  if (!body.consent_terms || !body.consent_privacy) return json({ error: 'Devi accettare termini e privacy' }, 400)
  if (!body.fiscal?.fiscal_code?.trim()) return json({ error: 'Codice fiscale obbligatorio per la stipula del contratto' }, 400)
  if (!body.fiscal?.address?.trim() || !body.fiscal?.city?.trim()) return json({ error: 'Indirizzo e città obbligatori' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

  // 1. Recupera quote dal token (read-only, prima del gate atomico)
  const { data: quote } = await admin.from('quotes').select('*').eq('access_token', body.token).maybeSingle()
  if (!quote) return json({ error: 'token non valido' }, 404)
  if (quote.status === 'RIFIUTATO' || quote.status === 'SCADUTO') {
    return json({ error: `Preventivo in stato ${quote.status}, non più accettabile` }, 409)
  }
  if (quote.status === 'ACCETTATO' || quote.status === 'CONVERTITO_IN_CONTRATTO') {
    return json({ error: 'Preventivo già accettato. Non è possibile firmarlo una seconda volta.' }, 409)
  }
  if (!quote.client_email) return json({ error: 'preventivo senza email cliente' }, 400)

  // 1a-bis. Auto-invio: il trigger quotes_validate_status_transition vieta il
  // salto diretto BOZZA -> ACCETTATO. Se la coppia firma su un quote ancora
  // BOZZA (atterrata direttamente sull'accept page senza passare per quote-send),
  // promuoviamo prima BOZZA -> INVIATO. Il consenso del cliente equivale a
  // ricezione del preventivo, l'invio implicito e' legittimo.
  if (quote.status === 'BOZZA') {
    // Usa SQL raw via RPC per evitare ambiguita' di tipo PostgREST sul cast enum.
    const { error: promErr } = await admin.rpc('quote_promote_to_inviato', { p_quote_id: quote.id })
    if (promErr) {
      return json({ error: 'db error', detail: 'autoinvio fallito: ' + promErr.message }, 500)
    }
  }

  // 1b. ATOMIC GATE: tenta di transitare quote a ACCETTATO solo se ancora INVIATO/BOZZA.
  // Se un'altra request concorrente l'ha gia' fatto, qui non trova righe -> 409.
  // Questo elimina la race condition che permetteva 5 firme parallele.
  const { data: claimed, error: claimErr } = await admin
    .from('quotes')
    .update({
      status: 'ACCETTATO',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', quote.id)
    .in('status', ['INVIATO', 'BOZZA'])
    .select('id')
    .maybeSingle()
  if (claimErr) {
    return json({ error: 'db error', detail: claimErr.message }, 500)
  }
  if (!claimed) {
    // Qualcun altro ha gia' completato la firma (race) — rifiutiamo come 409.
    return json({ error: 'Preventivo già firmato da un\'altra sessione. Ricarica la pagina.' }, 409)
  }

  // 2. Hash del PDF preventivo corrente (per integrità)
  let pdfHash: string | null = null
  if (quote.pdf_url) {
    try {
      const pdfResp = await fetch(quote.pdf_url)
      if (pdfResp.ok) {
        const buf = await pdfResp.arrayBuffer()
        pdfHash = await sha256(buf)
      }
    } catch { /* hash opzionale, non blocca */ }
  }

  // 3. Salva firma PNG in storage
  const signatureBytes = dataUrlToBytes(body.signature_data_url)
  const sigKey = `${quote.id}/v${quote.revision}/signature-${Date.now()}.png`
  const upSig = await admin.storage.from('quote-signatures').upload(sigKey, signatureBytes, {
    contentType: 'image/png', upsert: false,
  })
  if (upSig.error) return json({ error: 'upload firma fallito', detail: upSig.error.message }, 500)
  const { data: sigSigned } = await admin.storage.from('quote-signatures').createSignedUrl(sigKey, 60 * 60 * 24 * 365 * 10)
  const signatureUrl = sigSigned?.signedUrl ?? sigKey

  // 4. IP + User-Agent
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? req.headers.get('cf-connecting-ip') ?? null
  const ua = req.headers.get('user-agent') ?? null

  // 5. Insert quote_acceptances (con snapshot fiscale del cliente)
  const f = body.fiscal ?? {}
  const { data: acceptance, error: insErr } = await admin.from('quote_acceptances').insert({
    quote_id: quote.id,
    access_token: body.token,
    quote_revision: quote.revision,
    quote_pdf_hash: pdfHash,
    signer_name: safeText(body.signer_name),
    signer_email: quote.client_email,
    signer_phone: body.signer_phone ? safeText(body.signer_phone) : null,
    doc_type: body.doc_type,
    doc_number: safeText(body.doc_number),
    doc_issued_by: body.doc_issued_by ? safeText(body.doc_issued_by) : null,
    signature_url: signatureUrl,
    ip_address: ip,
    user_agent: ua,
    consent_terms: true,
    consent_privacy: true,
    client_fiscal_code:    f.fiscal_code ? safeText(f.fiscal_code).toUpperCase() : null,
    client_vat_number:     f.vat_number ? safeText(f.vat_number).toUpperCase() : null,
    client_business_name:  f.business_name ? safeText(f.business_name) : null,
    client_address:        f.address ? safeText(f.address) : null,
    client_city:           f.city ? safeText(f.city) : null,
    client_zip:            f.zip ? safeText(f.zip) : null,
    client_province:       f.province ? safeText(f.province).toUpperCase() : null,
    client_country:        f.country ? safeText(f.country) : null,
    client_sdi_code:       f.sdi_code ? safeText(f.sdi_code).toUpperCase() : null,
    client_pec_email:      f.pec_email ? safeText(f.pec_email) : null,
  }).select().single()
  if (insErr) return json({ error: 'insert acceptance failed', detail: insErr.message }, 500)

  // 6. Aggiorna quote log (status già transitato atomicamente nello step 1b).
  // Append-only sul client_response_log: best-effort, race accettabile sul log.
  await admin.from('quotes').update({
    client_response_log: [
      ...((quote.client_response_log ?? []) as any[]),
      { event: 'accepted_signed', at: new Date().toISOString(), acceptance_id: acceptance.id, ip, signer: body.signer_name },
    ],
  }).eq('id', quote.id)

  // 7. Aggiorna calendar_entries → OPZIONATA
  await admin.from('calendar_entries').update({ status: 'OPZIONATA', updated_at: new Date().toISOString() })
    .eq('quote_id', quote.id).in('status', ['IN_TRATTATIVA', 'OPZIONATA'])

  // 7b. Propaga dati fiscali ai contracts collegati (se già esistenti)
  await admin.from('contracts').update({
    client_fiscal_code:    f.fiscal_code ? safeText(f.fiscal_code).toUpperCase() : null,
    client_vat_number:     f.vat_number ? safeText(f.vat_number).toUpperCase() : null,
    client_business_name:  f.business_name ? safeText(f.business_name) : null,
    client_address:        f.address ? safeText(f.address) : null,
    client_city:           f.city ? safeText(f.city) : null,
    client_zip:            f.zip ? safeText(f.zip) : null,
    client_province:       f.province ? safeText(f.province).toUpperCase() : null,
    client_country:        f.country ? safeText(f.country) : null,
    client_sdi_code:       f.sdi_code ? safeText(f.sdi_code).toUpperCase() : null,
    client_pec_email:      f.pec_email ? safeText(f.pec_email) : null,
  }).eq('quote_id', quote.id)

  // 7c. Per fornitori standalone, propaga al supplier_clients per riuso futuro
  if (quote.direct_client_id) {
    await admin.from('supplier_clients').update({
      fiscal_code:   f.fiscal_code ? safeText(f.fiscal_code).toUpperCase() : null,
      vat_number:    f.vat_number ? safeText(f.vat_number).toUpperCase() : null,
      business_name: f.business_name ? safeText(f.business_name) : null,
      address:       f.address ? safeText(f.address) : null,
      city:          f.city ? safeText(f.city) : null,
      zip:           f.zip ? safeText(f.zip) : null,
      province:      f.province ? safeText(f.province).toUpperCase() : null,
      country:       f.country ? safeText(f.country) : null,
      sdi_code:      f.sdi_code ? safeText(f.sdi_code).toUpperCase() : null,
      pec_email:     f.pec_email ? safeText(f.pec_email) : null,
    }).eq('id', quote.direct_client_id)
  }

  // 8. Genera PDF atto di accettazione
  const actPdfUrl = await generateAcceptancePdf(admin, quote, acceptance, signatureBytes, ip, ua, pdfHash)
  if (actPdfUrl) {
    await admin.from('quote_acceptances').update({ acceptance_pdf_url: actPdfUrl }).eq('id', acceptance.id)
  }

  // 9. Email WP + cliente
  await sendEmails(admin, quote, acceptance, actPdfUrl)

  return json({ ok: true, acceptance_id: acceptance.id, acceptance_pdf_url: actPdfUrl })
})

async function generateAcceptancePdf(
  admin: any, quote: any, a: any, signatureBytes: Uint8Array,
  ip: string | null, ua: string | null, pdfHash: string | null,
): Promise<string | null> {
  try {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const M = 50

    // Header brand
    doc.setFillColor(26, 46, 79)
    doc.rect(0, 0, W, 6, 'F')
    doc.setFillColor(196, 154, 92)
    doc.rect(0, 6, W, 1.5, 'F')

    doc.setFontSize(11)
    doc.setTextColor(196, 154, 92)
    doc.setFont('helvetica', 'bold')
    doc.text('ATTO DI ACCETTAZIONE', M, 50)

    doc.setFontSize(22)
    doc.setTextColor(26, 23, 20)
    doc.text('Conferma preventivo', M, 80)

    doc.setFontSize(11)
    doc.setTextColor(110, 110, 110)
    doc.setFont('helvetica', 'normal')
    doc.text(`Preventivo: ${safeText(quote.title)} · revisione v${quote.revision}`, M, 100)
    doc.text(`Data accettazione: ${new Date(a.accepted_at).toLocaleString('it-IT')}`, M, 116)

    let y = 150

    // Dati firmatario
    doc.setFontSize(11)
    doc.setTextColor(196, 154, 92)
    doc.setFont('helvetica', 'bold')
    doc.text('DATI DEL FIRMATARIO', M, y); y += 16

    doc.setFontSize(10)
    doc.setTextColor(26, 23, 20)
    doc.setFont('helvetica', 'normal')
    const fields = [
      ['Nome e cognome', a.signer_name],
      ['Email', a.signer_email],
      ['Telefono', a.signer_phone ?? '—'],
      ['Documento', `${a.doc_type.replace('_', ' ')} · n° ${a.doc_number}`],
      ['Rilasciato da', a.doc_issued_by ?? '—'],
    ]
    for (const [k, v] of fields) {
      doc.setTextColor(110, 110, 110); doc.text(k, M, y)
      doc.setTextColor(26, 23, 20); doc.text(safeText(v), M + 130, y)
      y += 16
    }

    y += 12

    // Importo totale
    doc.setFontSize(11)
    doc.setTextColor(196, 154, 92)
    doc.setFont('helvetica', 'bold')
    doc.text('IMPORTO ACCETTATO', M, y); y += 16
    doc.setFontSize(20)
    doc.setTextColor(26, 23, 20)
    const totFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(quote.total_client))
    doc.text(totFmt, M, y); y += 28

    // Firma
    doc.setFontSize(11)
    doc.setTextColor(196, 154, 92)
    doc.setFont('helvetica', 'bold')
    doc.text('FIRMA', M, y); y += 12
    doc.addImage(signatureBytes, 'PNG', M, y, 200, 80, undefined, 'FAST')
    doc.setDrawColor(225, 222, 216)
    doc.line(M, y + 84, M + 200, y + 84)
    y += 100

    // Evidenza digitale (audit trail)
    doc.setFontSize(9)
    doc.setTextColor(196, 154, 92)
    doc.setFont('helvetica', 'bold')
    doc.text('EVIDENZA DIGITALE (FIRMA ELETTRONICA SEMPLICE)', M, y); y += 14
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.setFont('helvetica', 'normal')
    const audit = [
      `Timestamp: ${a.accepted_at}`,
      `IP indirizzo: ${ip ?? 'non disponibile'}`,
      `User agent: ${(ua ?? '').slice(0, 80)}`,
      `Hash SHA-256 preventivo: ${pdfHash ?? 'non calcolato'}`,
      `Token sessione: ${a.access_token}`,
      `ID accettazione: ${a.id}`,
    ]
    for (const line of audit) { doc.text(line, M, y); y += 11 }

    y += 14

    // Disclaimer legale
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.setFont('helvetica', 'italic')
    const disclaimer = doc.splitTextToSize(
      'Il firmatario dichiara di aver letto e accettato integralmente il preventivo identificato dall\'hash sopra riportato. ' +
      'La presente accettazione costituisce firma elettronica semplice ai sensi dell\'art. 20 del CAD (D.Lgs. 82/2005) e ' +
      'manifesta volontà contrattuale ex art. 1326 c.c. I dati di identificazione sono trattati secondo l\'informativa privacy ' +
      'di Planfully (planfully.it/privacy) ai sensi del GDPR.',
      W - M * 2,
    )
    for (const l of disclaimer) { doc.text(l, M, y); y += 11 }

    // Footer
    doc.setFillColor(196, 154, 92)
    doc.rect(0, 838, W, 4, 'F')

    const pdfBytes = new Uint8Array(doc.output('arraybuffer'))
    const key = `${quote.id}/v${quote.revision}/acceptance-${Date.now()}.pdf`
    const up = await admin.storage.from('quote-signatures').upload(key, pdfBytes, {
      contentType: 'application/pdf', upsert: false,
    })
    if (up.error) return null
    const { data: signed } = await admin.storage.from('quote-signatures').createSignedUrl(key, 60 * 60 * 24 * 365 * 10)
    return signed?.signedUrl ?? null
  } catch { return null }
}

async function sendEmails(admin: any, quote: any, a: any, actPdfUrl: string | null) {
  const { data: owner } = await admin.from('profiles').select('full_name, business_name, role, subrole').eq('id', quote.owner_id).maybeSingle()
  const { data: ownerAuth } = await admin.auth.admin.getUserById(quote.owner_id)
  const ownerEmail = ownerAuth?.user?.email

  const totFmt = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(quote.total_client))
  // Display name owner: business_name > full_name > email local part (mai email piena)
  const cleanName = (s: string | null | undefined): string | null => {
    if (!s) return null
    const t = s.trim()
    if (!t || t.includes('@')) return null
    return t
  }
  const ownerEmailLocal = ownerEmail ? ownerEmail.split('@')[0].replace(/\+.*$/, '').replace(/[._-]+/g, ' ').trim() : null
  const wpName = cleanName(owner?.business_name) ?? cleanName(owner?.full_name) ?? cleanName(ownerEmailLocal) ?? 'Il tuo fornitore'
  const safeName = (s: string) => s.replace(/[",;<>\r\n]/g, ' ').trim().slice(0, 80) || 'Planfully'
  const fromAddr = (RESEND_FROM.match(/<(.+)>/)?.[1]) ?? RESEND_FROM
  const fromHeader = `${safeName(wpName)} via Planfully <${fromAddr}>`
  const toClient = cleanName(a.signer_name) ? `${safeName(a.signer_name)} <${quote.client_email}>` : quote.client_email
  const toOwner = ownerEmail ? (cleanName(owner?.business_name ?? owner?.full_name) ? `${safeName(owner?.business_name ?? owner?.full_name)} <${ownerEmail}>` : ownerEmail) : null

  // Email cliente
  const clientHtml = `<!doctype html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f4ef;padding:24px;color:#1A1714">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.06)">
  <div style="background:linear-gradient(135deg,#1A1714 0%,#7E6633 100%);padding:32px;text-align:center;color:#F3EEE4">
    <h1 style="margin:0;font-size:24px">Accettazione confermata</h1>
    <p style="margin:6px 0 0;opacity:0.85;font-size:13px">${safeText(quote.title)}</p>
  </div>
  <div style="padding:28px">
    <p style="line-height:1.6">Grazie ${safeText(a.signer_name)}, abbiamo ricevuto la tua accettazione del preventivo per <strong>${totFmt}</strong>.</p>
    <p style="line-height:1.6;color:#4a5568">${safeText(wpName)} ti contatterà a breve per i prossimi passi.</p>
    ${actPdfUrl ? `<p style="margin:24px 0"><a href="${actPdfUrl}" style="display:inline-block;background:#C49A5C;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600">Scarica atto firmato</a></p>` : ''}
    <p style="font-size:12px;color:#a0aec0;margin-top:24px">Il link al documento ha validità decennale. Conservalo per i tuoi atti.</p>
  </div>
  <div style="background:#f6f4ef;padding:16px;text-align:center;font-size:11px;color:#a0aec0;border-top:1px solid #e2e8f0">Un progetto Fuyue Srl · planfully.it</div>
</div></body>`

  await sendEmail(toClient, `Accettazione preventivo confermata · ${quote.title}`, clientHtml, {
    from: fromHeader,
    reply_to: ownerEmail ?? undefined,
  }).catch(() => null)

  // Email WP
  if (ownerEmail) {
    const wpHtml = `<!doctype html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f6f4ef;padding:24px;color:#1A1714">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.06)">
  <div style="background:linear-gradient(135deg,#1A2E4F 0%,#C49A5C 100%);padding:28px;color:#fff">
    <h1 style="margin:0;font-size:22px">🎉 Preventivo accettato</h1>
    <p style="margin:6px 0 0;opacity:0.9;font-size:13px">${safeText(quote.title)} · revisione v${quote.revision}</p>
  </div>
  <div style="padding:24px">
    <p><strong>${safeText(a.signer_name)}</strong> ha firmato il preventivo per <strong>${totFmt}</strong>.</p>
    <table style="width:100%;font-size:13px;margin:16px 0;border-collapse:collapse">
      <tr><td style="color:#6E6E6E;padding:4px 0">Documento</td><td>${a.doc_type.replace('_',' ')} n° ${safeText(a.doc_number)}</td></tr>
      <tr><td style="color:#6E6E6E;padding:4px 0">Email cliente</td><td>${safeText(a.signer_email)}</td></tr>
      ${a.signer_phone ? `<tr><td style="color:#6E6E6E;padding:4px 0">Telefono</td><td>${safeText(a.signer_phone)}</td></tr>` : ''}
      <tr><td style="color:#6E6E6E;padding:4px 0">Quando</td><td>${new Date(a.accepted_at).toLocaleString('it-IT')}</td></tr>
      <tr><td style="color:#6E6E6E;padding:4px 0">IP</td><td>${a.ip_address ?? '—'}</td></tr>
    </table>
    ${actPdfUrl ? `<p><a href="${actPdfUrl}" style="display:inline-block;background:#C49A5C;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Apri atto firmato</a></p>` : ''}
    <p style="font-size:12px;color:#a0aec0;margin-top:20px">Hash PDF preventivo: <code>${(a.quote_pdf_hash ?? '—').slice(0,32)}…</code></p>
  </div>
</div></body>`

    await sendEmail(toOwner ?? ownerEmail, `🎉 ${a.signer_name} ha firmato · ${quote.title}`, wpHtml, {
      from: `Planfully <${fromAddr}>`,
    }).catch(() => null)
  }
}
