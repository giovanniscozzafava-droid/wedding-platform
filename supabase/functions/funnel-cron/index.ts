// deno-lint-ignore-file no-explicit-any
// Automazione funnel preventivi — eseguita ogni giorno (pg_cron → questa fn).
//  * Follow-up a +3 / +7 / +14 giorni dall'invio (se non accettato).
//  * Archiviazione dopo 30 giorni senza risposta.
//  * Email "data contesa": stessa data, altro preventivo, solo se non accettato.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/resend.ts'
import { emailShell } from '../_shared/emailLayout.ts'

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
    .select('full_name, business_name, brand_primary_color, phone, funnel_followup_enabled, funnel_contested_enabled').eq('id', id).maybeSingle()
  const { data: au } = await admin.auth.admin.getUserById(id)
  const o = { ...p, email: au?.user?.email ?? null }
  ownerCache.set(id, o)
  return o
}

async function sendBranded(q: any, subject: string, intro: string, cta: string) {
  if (!q.client_email) return
  const o = await loadOwner(q.owner_id)
  const wpName = o?.business_name ?? o?.full_name ?? 'Il tuo referente'
  const primary = o?.brand_primary_color ?? '#25402F'
  // Atterra sulla dashboard aggregata del cliente (tutte le offerte insieme), previo accesso.
  const link = `${APP_BASE}/area-cliente/accedi?next=${encodeURIComponent('/area-cliente')}`
  const fromAddr = (FROM.match(/<(.+)>/)?.[1]) ?? FROM
  const totFmt = q.total_client != null ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(q.total_client)) : ''
  const html = emailShell({
    accent: primary, // white-label: colore del professionista
    title: q.title,
    subtitleHtml: totFmt || undefined,
    bodyHtml: `<p style="margin:0">${intro}</p>`,
    cta: { href: link, label: cta },
    contactHtml: `— ${esc(wpName)}${o?.phone ? ' · ' + esc(o.phone) : ''}`,
  })
  await sendEmail({
    to: q.client_name ? `${String(q.client_name).replace(/[",;<>\r\n]/g, ' ')} <${q.client_email}>` : q.client_email,
    subject,
    html,
    from: `${wpName.replace(/[",;<>\r\n]/g, ' ').slice(0, 60)} via Planfully <${fromAddr}>`,
    reply_to: o?.email ?? undefined,
    headers: {
      'List-Unsubscribe': `<mailto:${o?.email ?? fromAddr}?subject=unsubscribe>`,
      'X-Entity-Ref-ID': String(q.id),
    },
  })
}

// Promemoria "opzione data" al CLIENTE: la coppia tiene la data senza firmare e
// la tenuta sta per scadere. Tono caldo, poco invadente; link diretto alla firma.
async function sendOptionReminder(entry: any, q: any, kind: 'soft' | 'final') {
  const to = entry.option_requested_by || q.client_email
  if (!to) return
  const o = await loadOwner(q.owner_id)
  const wpName = o?.business_name ?? o?.full_name ?? 'Il tuo referente'
  const primary = o?.brand_primary_color ?? '#25402F'
  const fromAddr = (FROM.match(/<(.+)>/)?.[1]) ?? FROM
  const dateFmt = entry.date_from ? new Date(entry.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const expFmt = entry.option_expires_at ? new Date(entry.option_expires_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' }) : ''
  const firstName = q.client_name ? esc(String(q.client_name).trim().split(/\s+/)[0]) : ''
  const hi = firstName ? `Ciao ${firstName}, ` : 'Ciao, '
  const body = kind === 'soft'
    ? `${hi}la data del <strong>${esc(dateFmt)}</strong> è ancora riservata per te fino al <strong>${esc(expFmt)}</strong>. Nessuna fretta: quando te la senti, puoi confermarla in un minuto. Se hai qualche dubbio o vuoi cambiare qualcosa, sono qui.`
    : `${hi}la tenuta della data del <strong>${esc(dateFmt)}</strong> sta per scadere (${esc(expFmt)}). Se vuoi assicurartela, ti basta confermare il preventivo: bastano pochi minuti. Se preferisci aspettare ancora, nessun problema — fammelo solo sapere.`
  const html = emailShell({
    accent: primary,
    eyebrow: kind === 'soft' ? 'La tua data è tenuta per te' : 'Ultimo promemoria sulla tua data',
    title: q.title,
    bodyHtml: `<p style="margin:0">${body}</p>`,
    cta: { href: `${APP_BASE}/p/accept/${q.access_token}`, label: kind === 'soft' ? 'Rivedi e conferma' : 'Conferma la data' },
    contactHtml: `— ${esc(wpName)}${o?.phone ? ' · ' + esc(o.phone) : ''}`,
  })
  await sendEmail({
    to: q.client_name ? `${String(q.client_name).replace(/[",;<>\r\n]/g, ' ')} <${to}>` : to,
    subject: kind === 'soft' ? `La tua data del ${dateFmt} è ancora riservata` : `La tenuta della tua data sta per scadere`,
    html,
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
  const result = { followups: 0, archived: 0, contested: 0, suggestion_reminders: 0, option_reminders: 0 }

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
      const owner = await loadOwner(q.owner_id)
      if (owner?.funnel_followup_enabled === false) continue  // il professionista ha spento i follow-up automatici
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
      const owner = await loadOwner(q.owner_id)
      if (owner?.funnel_contested_enabled === false) continue  // il professionista ha spento l'email "data contesa"
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

  // ── Reminder ai FORNITORI SUGGERITI ──────────────────────────────────────
  // Se dopo 48h dal suggerimento il pro non ha ancora inviato il preventivo né declinato, un
  // promemoria (UNO solo, via reminder_sent_at): "invia il preventivo alla coppia, o segnala che
  // non ci sei". Non tocca gli stati QUOTE_SENT/ACCEPTED/DECLINED/EXPIRED (chi ha gia' agito).
  const SUGG_REMINDER_MS = 48 * 60 * 60 * 1000
  const suggCutoff = new Date(now - SUGG_REMINDER_MS).toISOString()
  const { data: pendingSugg } = await admin.from('supplier_suggestions')
    .select('id, supplier_id, referrer_id, event_kind')
    .in('status', ['SENT', 'VIEWED', 'QUOTE_CREATED'])
    .is('reminder_sent_at', null)
    .lt('created_at', suggCutoff)
  for (const s of (pendingSugg ?? []) as any[]) {
    try {
      const stamp = async () => { await admin.from('supplier_suggestions').update({ reminder_sent_at: new Date().toISOString() }).eq('id', s.id) }
      const { data: au } = await admin.auth.admin.getUserById(s.supplier_id)
      const to = au?.user?.email
      if (!to) { await stamp(); continue } // niente email → segna comunque (niente re-tentativi infiniti)
      const ref = await loadOwner(s.referrer_id)
      const refName = ref?.business_name ?? ref?.full_name ?? 'Un collega'
      const html = emailShell({
        eyebrow: 'Un cliente ti aspetta',
        title: `${esc(refName)} ti ha suggerito a una coppia`,
        subtitleHtml: `Per un <strong>${esc(s.event_kind ?? 'evento')}</strong>: invia il tuo preventivo, oppure segnala che non sei disponibile.`,
        bodyHtml: `<p style="margin:0">Se ti interessa, prepara e invia l'offerta dalla tua area <strong>Suggerimenti ricevuti</strong>. Se non sei disponibile, con un clic puoi dire <strong>"Non disponibile"</strong> e liberare la richiesta.</p>`,
        cta: { href: `${APP_BASE}/suggerimenti-ricevuti`, label: 'Vai ai suggerimenti' },
        contactHtml: `Ricevi questa email perché un collega ti ha suggerito a un suo cliente su Planfully.`,
      })
      await sendEmail({ to, subject: `${refName} ti ha suggerito a una coppia — invia il preventivo o segnala che non ci sei`, html, from: FROM })
      await stamp()
      result.suggestion_reminders++
    } catch (_e) { /* continua col prossimo */ }
  }

  // ── Funnel "opzione data": promemoria gentili prima della scadenza ────────
  // La coppia tiene la data (calendar_entries OPZIONATA, option_expires_at futuro)
  // ma il preventivo NON è ancora firmato: 2 tocchi non invadenti — ~5gg e ~1g
  // prima della scadenza — che ricordano che la data è tenuta ed è il momento di
  // firmare. Idempotenza via option_reminder1_at / option_reminder2_at.
  const { data: opts } = await admin.from('calendar_entries')
    .select('id, date_from, option_expires_at, option_requested_by, option_reminder1_at, option_reminder2_at, quote:quotes!calendar_entries_quote_fk(id, title, client_name, client_email, access_token, total_client, status, accepted_at, owner_id, funnel_paused, archived_at)')
    .eq('status', 'OPZIONATA')
    .not('option_expires_at', 'is', null)
    .gt('option_expires_at', new Date(now).toISOString())

  for (const e of (opts ?? []) as any[]) {
    const q = e.quote
    // Solo tenute ancora da firmare: se il preventivo è accettato/archiviato/in
    // pausa o non più "INVIATO", niente promemoria (l'OPZIONATA può derivare anche
    // dalla firma, ma in quel caso accepted_at è valorizzato → escluso qui).
    if (!q || q.accepted_at || q.archived_at || q.funnel_paused || q.status !== 'INVIATO') continue
    if (!e.option_requested_by && !q.client_email) continue
    const daysLeft = (new Date(e.option_expires_at).getTime() - now) / DAY
    const owner = await loadOwner(q.owner_id)
    if (owner?.funnel_followup_enabled === false) continue  // il pro ha spento i follow-up automatici
    try {
      if (daysLeft <= 1.5 && !e.option_reminder2_at) {
        await sendOptionReminder(e, q, 'final')
        await admin.from('calendar_entries').update({ option_reminder2_at: new Date().toISOString() }).eq('id', e.id)
        result.option_reminders++
      } else if (daysLeft <= 5 && !e.option_reminder1_at) {
        await sendOptionReminder(e, q, 'soft')
        await admin.from('calendar_entries').update({ option_reminder1_at: new Date().toISOString() }).eq('id', e.id)
        result.option_reminders++
      }
    } catch (_e) { /* continua col prossimo */ }
  }

  return new Response(JSON.stringify({ ok: true, ...result }), { headers: { 'content-type': 'application/json' } })
})
