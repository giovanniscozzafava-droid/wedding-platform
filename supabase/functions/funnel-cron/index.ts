// deno-lint-ignore-file no-explicit-any
// Automazione funnel preventivi — eseguita ogni giorno (pg_cron → questa fn).
//  * Follow-up a +3 / +7 / +14 giorni dall'invio (se non accettato).
//  * Archiviazione dopo 30 giorni senza risposta.
//  * Email "data contesa": stessa data, altro preventivo, solo se non accettato.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail, htmlToText } from '../_shared/resend.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FROM = Deno.env.get('SES_FROM_EMAIL') ?? Deno.env.get('RESEND_FROM_EMAIL') ?? 'Planfully <noreply@planfully.it>'
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const DAY = 86_400_000
const SCHEDULE = [3, 7, 14]      // giorni dei follow-up
const ARCHIVE_DAYS = 30

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const ownerCache = new Map<string, any>()
async function loadOwner(id: string) {
  if (ownerCache.has(id)) return ownerCache.get(id)
  const { data: p } = await admin.from('profiles')
    .select('full_name, business_name, brand_primary_color, phone').eq('id', id).maybeSingle()
  const { data: au } = await admin.auth.admin.getUserById(id)
  const o = { ...p, email: au?.user?.email ?? null }
  ownerCache.set(id, o)
  return o
}

async function sendBranded(q: any, subject: string, intro: string, cta: string) {
  if (!q.client_email) return
  const o = await loadOwner(q.owner_id)
  const wpName = o?.business_name ?? o?.full_name ?? 'Il tuo referente'
  const primary = o?.brand_primary_color ?? '#1A2E4F'
  // Atterra sulla dashboard aggregata del cliente (tutte le offerte insieme), previo accesso.
  const link = `${APP_BASE}/area-cliente/accedi?next=${encodeURIComponent('/area-cliente')}`
  const fromAddr = (FROM.match(/<(.+)>/)?.[1]) ?? FROM
  const totFmt = q.total_client != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(q.total_client)) : ''
  const html = `<!doctype html><html lang="it"><body style="font-family:Georgia,serif;background:#F8F5EE;margin:0;padding:30px 16px;color:#1A1714">
<table role="presentation" width="100%"><tr><td align="center">
  <table role="presentation" width="560" style="max-width:560px;background:#FDFBF6;border-radius:14px;overflow:hidden">
    <tr><td style="background:${primary};height:4px"></td></tr>
    <tr><td style="padding:30px 34px">
      <img src="https://planfully.it/brand/planfully-symbol.png" width="38" height="38" style="display:block;border-radius:8px;border:0" alt="Planfully" />
      <h1 style="font-size:22px;margin:16px 0 6px;color:${primary}">${esc(q.title)}</h1>
      ${totFmt ? `<p style="font-size:13px;color:#787164;margin:0 0 16px">${totFmt}</p>` : ''}
      <p style="font-size:15px;line-height:1.7;margin:0 0 22px">${intro}</p>
      <a href="${link}" style="display:inline-block;background:${primary};color:#FDFBF6;padding:13px 30px;border-radius:40px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px">${esc(cta)}</a>
      <p style="margin:24px 0 0;font-size:13px;color:#787164">— ${esc(wpName)}${o?.phone ? ' · ' + esc(o.phone) : ''}</p>
    </td></tr>
    <tr><td style="background:${primary};height:3px"></td></tr>
  </table>
  <p style="font-size:10px;color:#A59C8E;margin-top:14px">Powered by Planfully · Un progetto Fuyue Srl</p>
</td></tr></table></body></html>`
  await sendEmail({
    to: q.client_name ? `${String(q.client_name).replace(/[",;<>\r\n]/g, ' ')} <${q.client_email}>` : q.client_email,
    subject,
    html,
    text: htmlToText(html),
    from: `${wpName.replace(/[",;<>\r\n]/g, ' ').slice(0, 60)} via Planfully <${fromAddr}>`,
    reply_to: o?.email ?? undefined,
    headers: {
      'List-Unsubscribe': `<mailto:${o?.email ?? fromAddr}?subject=unsubscribe>`,
      'X-Entity-Ref-ID': String(q.id),
    },
  })
}

function followupCopy(step: number, opened: boolean) {
  if (step === 1) return opened
    ? { s: 'Hai dato un’occhiata al preventivo?', i: 'Ho visto che hai aperto il preventivo: sono qui per qualsiasi dubbio o modifica. Vuoi che ne parliamo?', c: 'Rivedi il preventivo' }
    : { s: 'Hai ricevuto il preventivo?', i: 'Volevo assicurarmi che ti sia arrivato il preventivo. Se hai domande o vuoi modificare qualcosa, sono a disposizione.', c: 'Apri il preventivo' }
  if (step === 2) return { s: 'Stai ancora valutando?', i: 'So che è una decisione importante. Resto a disposizione per dubbi, modifiche o per parlarne con calma. Fammi sapere come posso aiutarti.', c: 'Rivedi il preventivo' }
  return { s: 'Ti tengo ancora la data?', i: 'Per non farti perdere la disponibilità, ti scrivo un ultimo promemoria: se vuoi procedere posso bloccarti la data. Altrimenti nessun problema, fammi solo sapere.', c: 'Conferma il preventivo' }
}

Deno.serve(async (req) => {
  // Fail-closed: senza CRON_SECRET configurato la funzione NON deve girare;
  // e l'header deve combaciare. (Prima, se il secret mancava, il gate veniva saltato.)
  if (!CRON_SECRET) {
    return new Response('cron secret not configured', { status: 401 })
  }
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return new Response('unauthorized', { status: 401 })
  }
  const now = Date.now()
  const result = { followups: 0, archived: 0, contested: 0 }

  // ── Follow-up + archiviazione ────────────────────────────────────────────
  const { data: actives } = await admin.from('quotes')
    .select('id, title, client_name, client_email, event_date, access_token, sent_at, open_count, owner_id, total_client, followup_count')
    .eq('status', 'INVIATO').is('accepted_at', null).is('archived_at', null)
    .eq('funnel_paused', false).not('sent_at', 'is', null)

  for (const q of (actives ?? []) as any[]) {
    const days = (now - new Date(q.sent_at).getTime()) / DAY
    if (days >= ARCHIVE_DAYS) {
      await admin.from('quotes').update({ archived_at: new Date().toISOString() }).eq('id', q.id)
      result.archived++
      continue
    }
    const fc = q.followup_count ?? 0
    if (fc < SCHEDULE.length && days >= SCHEDULE[fc]) {
      const copy = followupCopy(fc + 1, Number(q.open_count ?? 0) > 0)
      try {
        await sendBranded(q, copy.s, copy.i, copy.c)
        await admin.from('quotes').update({ followup_count: fc + 1, last_followup_at: new Date().toISOString() }).eq('id', q.id)
        result.followups++
      } catch (_e) { /* continua col prossimo */ }
    }
  }

  // ── Email "data contesa" ─────────────────────────────────────────────────
  // Stessa data + stesso owner + altro preventivo; solo se questo è ancora in
  // fase NON accettata (BOZZA/INVIATO) e non già notificato.
  const { data: cand } = await admin.from('quotes')
    .select('id, title, client_name, client_email, event_date, access_token, owner_id, total_client')
    .in('status', ['BOZZA', 'INVIATO']).is('accepted_at', null).is('archived_at', null)
    .is('date_contested_notified_at', null).not('event_date', 'is', null).eq('funnel_paused', false)

  for (const q of (cand ?? []) as any[]) {
    const { count } = await admin.from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', q.owner_id).eq('event_date', q.event_date).neq('id', q.id)
    if ((count ?? 0) > 0 && q.client_email) {
      const dateFmt = new Date(q.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
      try {
        await sendBranded(q,
          `La data del ${dateFmt} sta diventando richiesta`,
          `La data che stai valutando (<strong>${esc(dateFmt)}</strong>) sta ricevendo richieste anche da altri. Non posso tenerla bloccata a lungo: se vuoi assicurartela, ti basta confermare il preventivo.`,
          'Blocca la data')
        await admin.from('quotes').update({ date_contested_notified_at: new Date().toISOString() }).eq('id', q.id)
        result.contested++
      } catch (_e) { /* skip */ }
    }
  }

  return new Response(JSON.stringify({ ok: true, ...result }), { headers: { 'content-type': 'application/json' } })
})
