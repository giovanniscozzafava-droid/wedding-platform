// Centralizzato invio email — implementato adesso con Resend (sandbox SES
// di AWS in attesa di production access). Mantiene la stessa firma del
// vecchio helper SES per non toccare le 6 edge functions che lo importano.
//
// Quando AWS approva production access, basta swappare l'implementazione
// interna a SES (codice precedente in git history).
//
// Required env vars (Supabase Edge Function Secrets):
//   RESEND_API_KEY    — API key da https://resend.com/api-keys
//   SES_FROM_EMAIL    — mittente default (riusiamo lo stesso nome del SES helper)
//                       formato: "Planfully <noreply@planfully.it>"

const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('SES_FROM_EMAIL')
  ?? Deno.env.get('RESEND_FROM_EMAIL')
  ?? 'Planfully <noreply@planfully.it>'

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
 * Invia una email transazionale via Resend.
 * Per allegati il payload è in base64, Resend supporta nativamente.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!RESEND_KEY) {
    console.warn('Resend: missing RESEND_API_KEY, email skipped')
    return { ok: false, reason: 'no_credentials' }
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to]

  const payload: Record<string, unknown> = {
    from: input.from ?? FROM,
    to: recipients,
    subject: input.subject,
    html: input.html,
  }
  if (input.reply_to) payload.reply_to = input.reply_to
  if (input.attachments && input.attachments.length > 0) {
    payload.attachments = input.attachments.map((a) => ({
      filename: a.filename,
      content: a.content_base64,
      content_type: a.content_type,
    }))
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const errText = await res.text()
      console.error('Resend error:', res.status, errText)
      return { ok: false, reason: 'api_error', error: errText }
    }
    const json = await res.json().catch(() => ({} as { id?: string }))
    return { ok: true, message_id: (json as { id?: string }).id ?? '' }
  } catch (e) {
    console.error('Resend fetch error:', e)
    return { ok: false, reason: 'api_error', error: (e as Error).message }
  }
}

/**
 * Alias retro-compatibile: nel vecchio helper SES esisteva un sendRawEmail
 * separato per i payload con allegati. Resend gestisce tutto in un'unica
 * chiamata, quindi sendRawEmail e sendEmail sono equivalenti.
 */
export const sendRawEmail = sendEmail
