// Eseguito dal cron 1x/giorno. Trova gli eventi con foto consegnate da oltre 3 mesi dove il cliente
// NON ha ancora chiuso la selezione album (nessuna approvazione) e gli manda una email che lo spinge
// a completarla. Ri-nudge al massimo ogni 30 giorni. Best-effort, niente PII nei log.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { sendEmail } from '../_shared/ses.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const APP_BASE = Deno.env.get('APP_BASE_URL') ?? 'https://planfully.it'
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })
const esc = (x: string) => (x ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string))
const DAY = 86400000

Deno.serve(async () => {
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })
  const now = Date.now()
  const cutoff3m = new Date(now - 90 * DAY).toISOString()   // evento più vecchio di 3 mesi
  const cutoff12m = new Date(now - 365 * DAY).toISOString()  // ...ma non oltre 12 mesi (no blast su eventi vecchissimi)
  const reNudge = now - 30 * DAY

  // eventi con galleria + data evento oltre 3 mesi fa
  const { data: galleries } = await admin.from('event_galleries').select('entry_id').limit(1000)
  const entryIds = [...new Set((galleries ?? []).map((g: any) => g.entry_id).filter(Boolean))]
  if (!entryIds.length) return json({ ok: true, candidates: 0 })

  const [{ data: entries }, { data: approvals }, { data: nudges }] = await Promise.all([
    admin.from('calendar_entries').select('id, title, date_from').in('id', entryIds).lt('date_from', cutoff3m).gt('date_from', cutoff12m),
    admin.from('album_layout_approval').select('entry_id').in('entry_id', entryIds),
    admin.from('album_nudges').select('entry_id, last_nudge_at').in('entry_id', entryIds),
  ])
  const approved = new Set((approvals ?? []).map((a: any) => a.entry_id))
  const nudgedAt = new Map((nudges ?? []).map((n: any) => [n.entry_id, new Date(n.last_nudge_at).getTime()]))

  const candidates = (entries ?? []).filter((e: any) =>
    !approved.has(e.id) && (!nudgedAt.has(e.id) || (nudgedAt.get(e.id) as number) < reNudge),
  ).slice(0, 200)
  if (!candidates.length) return json({ ok: true, candidates: 0 })

  const candIds = candidates.map((e: any) => e.id)
  const { data: members } = await admin.from('wedding_couple_members').select('entry_id, email').in('entry_id', candIds)
  const emailsByEntry = new Map<string, string[]>()
  for (const m of (members ?? []) as any[]) {
    if (!m.email) continue
    const a = emailsByEntry.get(m.entry_id) ?? []; a.push(m.email); emailsByEntry.set(m.entry_id, a)
  }

  let sent = 0
  for (const e of candidates as any[]) {
    const emails = emailsByEntry.get(e.id)
    if (!emails?.length) continue
    const title = esc(e.title || 'il tuo evento')
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1714;max-width:520px">
      <h2 style="font-size:19px;margin:0 0 6px">Il tuo album ti aspetta — manca solo la tua scelta</h2>
      <p style="margin:0 0 14px;color:#555;font-size:15px;line-height:1.5">Le foto di <strong>${title}</strong> sono pronte da un po'. Per stamparlo serve l'ultimo passo: <strong>scegli le foto e conferma l'impaginazione</strong>. Bastano pochi minuti.</p>
      <p style="margin:18px 0"><a href="${APP_BASE}" style="display:inline-block;background:#c9a227;color:#1a2e4f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">Apri "Il tuo album"</a></p>
      <p style="font-size:13px;color:#888;line-height:1.5">Puoi cambiare le tue scelte quando vuoi finché l'album non va in stampa. Se hai dubbi, scrivi al tuo fotografo.</p>
    </div>`
    try {
      await sendEmail({ to: emails, subject: `Manca poco al tuo album di ${title}`, html })
      await admin.from('album_nudges').upsert({ entry_id: e.id, last_nudge_at: new Date().toISOString(), count: ((nudgedAt.has(e.id) ? 1 : 0) + 1) }, { onConflict: 'entry_id' })
      sent++
    } catch { /* best-effort */ }
  }
  return json({ ok: true, candidates: candidates.length, sent })
})
