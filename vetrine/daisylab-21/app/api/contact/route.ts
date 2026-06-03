import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { brand } from '@/lib/data'

export const runtime = 'nodejs'

type ContactPayload = {
  name?: string
  email?: string
  phone?: string
  eventDate?: string
  guests?: string
  message?: string
  privacy?: string
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as ContactPayload

  if (!body.name || !body.email || !body.message || !body.privacy) {
    return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  const to = process.env.CONTACT_TO_EMAIL
  const from = process.env.CONTACT_FROM_EMAIL || 'onboarding@resend.dev'

  if (!apiKey || !to) {
    console.warn('[contact] Resend non configurato, log only')
    console.log('[contact]', body)
    return NextResponse.json({ ok: true, mode: 'log-only' })
  }

  const resend = new Resend(apiKey)
  const html = `
    <h2>Nuova richiesta da ${brand.name}</h2>
    <p><strong>Nome:</strong> ${escapeHtml(body.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
    ${body.phone ? `<p><strong>Telefono:</strong> ${escapeHtml(body.phone)}</p>` : ''}
    ${body.eventDate ? `<p><strong>Data evento:</strong> ${escapeHtml(body.eventDate)}</p>` : ''}
    ${body.guests ? `<p><strong>Ospiti:</strong> ${escapeHtml(body.guests)}</p>` : ''}
    <p><strong>Messaggio:</strong></p>
    <p>${escapeHtml(body.message).replace(/\n/g, '<br>')}</p>
  `

  const { error } = await resend.emails.send({
    from: `${brand.name} <${from}>`,
    to: [to],
    replyTo: body.email,
    subject: `[${brand.name}] Nuova richiesta da ${body.name}`,
    html,
  })

  if (error) {
    console.error('[contact] resend error', error)
    return NextResponse.json({ error: 'Invio fallito' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
