// Centralizzato: invio email via Amazon SES v2 API.
// Sostituisce Resend in tutte le edge functions per ridurre costi (~10x meno)
// e dipendere su SES eu-west-1 dove abbiamo gia' l'identity verificata.
//
// Required env vars:
//   AWS_ACCESS_KEY_ID       — chiave IAM con policy ses:SendEmail
//   AWS_SECRET_ACCESS_KEY   — secret
//   AWS_REGION              — default 'eu-west-1'
//   SES_FROM_EMAIL          — default 'Planfully <noreply@planfully.it>'

import { AwsClient } from 'npm:aws4fetch@1.0.20'

const REGION = Deno.env.get('AWS_REGION') ?? 'eu-west-1'
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const ACCESS = Deno.env.get('AWS_ACCESS_KEY_ID') ?? ''
const SECRET = Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? ''

let _client: AwsClient | null = null
function client(): AwsClient | null {
  if (!ACCESS || !SECRET) return null
  if (!_client) {
    _client = new AwsClient({
      accessKeyId: ACCESS,
      secretAccessKey: SECRET,
      service: 'ses',
      region: REGION,
    })
  }
  return _client
}

export type EmailAttachment = {
  filename: string
  content_base64: string
  content_type: string
}

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  from?: string
  reply_to?: string
  attachments?: EmailAttachment[]
}

export type SendEmailResult =
  | { ok: true; message_id: string }
  | { ok: false; reason: 'no_credentials' | 'api_error'; error?: string }

/**
 * Invia una singola email via SES API v2.
 * Per email con allegati o multi-recipient piu' complessi, usa sendRawEmail.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const c = client()
  if (!c) {
    console.warn('SES: missing AWS credentials, email skipped')
    return { ok: false, reason: 'no_credentials' }
  }

  if (input.attachments && input.attachments.length > 0) {
    return sendRawEmail(input)
  }

  const url = `https://email.${REGION}.amazonaws.com/v2/email/outbound-emails`
  const recipients = Array.isArray(input.to) ? input.to : [input.to]

  const body = JSON.stringify({
    FromEmailAddress: input.from ?? FROM,
    Destination: { ToAddresses: recipients },
    Content: {
      Simple: {
        Subject: { Data: input.subject, Charset: 'UTF-8' },
        Body: { Html: { Data: input.html, Charset: 'UTF-8' } },
      },
    },
    ...(input.reply_to ? { ReplyToAddresses: [input.reply_to] } : {}),
  })

  try {
    const res = await c.fetch(url, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('SES error:', res.status, errText)
      return { ok: false, reason: 'api_error', error: errText }
    }
    const json = await res.json().catch(() => ({} as { MessageId?: string }))
    return { ok: true, message_id: (json as { MessageId?: string }).MessageId ?? '' }
  } catch (e) {
    console.error('SES fetch error:', e)
    return { ok: false, reason: 'api_error', error: (e as Error).message }
  }
}

/**
 * Invia raw MIME (necessario per allegati come PDF firmati).
 * Costruisce manualmente il MIME multipart e lo manda a SES.
 */
export async function sendRawEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const c = client()
  if (!c) return { ok: false, reason: 'no_credentials' }

  const recipients = Array.isArray(input.to) ? input.to : [input.to]
  const boundary = `--bd${crypto.randomUUID().replace(/-/g, '')}`

  const parts: string[] = []
  parts.push(`From: ${input.from ?? FROM}`)
  parts.push(`To: ${recipients.join(', ')}`)
  parts.push(`Subject: ${encodeRfc2047(input.subject)}`)
  if (input.reply_to) parts.push(`Reply-To: ${input.reply_to}`)
  parts.push('MIME-Version: 1.0')
  parts.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
  parts.push('')
  parts.push(`--${boundary}`)
  parts.push('Content-Type: text/html; charset=UTF-8')
  parts.push('Content-Transfer-Encoding: 7bit')
  parts.push('')
  parts.push(input.html)

  for (const att of (input.attachments ?? [])) {
    parts.push(`--${boundary}`)
    parts.push(`Content-Type: ${att.content_type}; name="${att.filename}"`)
    parts.push('Content-Transfer-Encoding: base64')
    parts.push(`Content-Disposition: attachment; filename="${att.filename}"`)
    parts.push('')
    // Spezza base64 in righe da 76 char (RFC)
    parts.push(att.content_base64.match(/.{1,76}/g)?.join('\r\n') ?? att.content_base64)
  }
  parts.push(`--${boundary}--`)

  const rawMessage = parts.join('\r\n')
  const rawBase64 = btoa(rawMessage)

  const url = `https://email.${REGION}.amazonaws.com/v2/email/outbound-emails`
  const body = JSON.stringify({
    Content: { Raw: { Data: rawBase64 } },
  })

  try {
    const res = await c.fetch(url, { method: 'POST', body, headers: { 'content-type': 'application/json' } })
    if (!res.ok) {
      const errText = await res.text()
      console.error('SES raw error:', res.status, errText)
      return { ok: false, reason: 'api_error', error: errText }
    }
    const json = await res.json().catch(() => ({} as { MessageId?: string }))
    return { ok: true, message_id: (json as { MessageId?: string }).MessageId ?? '' }
  } catch (e) {
    return { ok: false, reason: 'api_error', error: (e as Error).message }
  }
}

// RFC 2047 encoded-word per subject con caratteri non-ASCII (accentati italiani)
function encodeRfc2047(s: string): string {
  if (/^[\x20-\x7e]*$/.test(s)) return s
  const b64 = btoa(unescape(encodeURIComponent(s)))
  return `=?UTF-8?B?${b64}?=`
}
