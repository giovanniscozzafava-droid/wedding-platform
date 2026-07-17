// Centralizzato invio email — implementato con RESEND. (Un tempo si chiamava
// ses.ts perché nato come helper AWS SES; il nome sbagliato inganna chi legge, quindi
// il file è stato rinominato resend.ts il 17/07/2026. Il codice SES sta in git history,
// se un giorno AWS desse production access.)
//
// Required env vars (Supabase Edge Function Secrets):
//   RESEND_API_KEY    — API key da https://resend.com/api-keys
//   SES_FROM_EMAIL    — mittente default (nome storico, tenuto per compatibilità con i
//                       secret già impostati); formato: "Planfully <noreply@planfully.it>"

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
  text?: string
  from?: string
  reply_to?: string
  attachments?: EmailAttachment[]
  headers?: Record<string, string>
}

// Genera un fallback testo da HTML (riduce lo spam-score: gli HTML-only
// vengono penalizzati da Outlook/Hotmail/SpamAssassin).
export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|tr|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim()
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
    // Parte testo sempre presente → migliora deliverability (multipart/alternative).
    text: input.text ?? htmlToText(input.html),
  }
  if (input.reply_to) payload.reply_to = input.reply_to
  if (input.headers && Object.keys(input.headers).length > 0) payload.headers = input.headers
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
