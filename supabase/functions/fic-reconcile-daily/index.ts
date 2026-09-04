// «Sistema dei pagamenti, sempre tramite Fatture in Cloud traccia i pagamenti
// e li riconcilia ogni giorno in automatico» (Giovanni, 04/09/2026).
//
// Chiamata dal cron (fic_reconcile_kick → pg_net, stesso schema di
// album-nudge-daily): per ogni rata già fatturata ma non ancora segnata come
// incassata, guarda su Fatture in Cloud se nel frattempo è stata confermata
// (Giovanni la conferma lì, non qui) e allinea contract_payments.
// Nessun professionista viene bloccato dagli altri: un errore su uno non ferma
// il giro degli altri.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { getFicAccessToken } from '../_shared/fic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cors = { 'Access-Control-Allow-Origin': '*' }
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'content-type': 'application/json' } })

type Payment = { id: string; contract_id: string; owner_id: string; label: string; amount: number; fic_invoice_id: string }
type FicPaymentItem = { amount?: number; status?: string; paid_date?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } })

  const { data: connections } = await admin.from('fic_connections').select('professional_id, company_id')
  const byProfessional = new Map((connections ?? []).map((c) => [c.professional_id as string, c.company_id as string]))
  if (byProfessional.size === 0) return json({ ok: true, professionals: 0, checked: 0, updated: 0 })

  const { data: pending } = await admin.from('contract_payments')
    .select('id, contract_id, owner_id, label, amount, fic_invoice_id')
    .not('fic_invoice_id', 'is', null).eq('paid', false)
    .in('owner_id', [...byProfessional.keys()])
  const rows = (pending ?? []) as Payment[]

  let checked = 0, updated = 0
  const errors: Record<string, string> = {}

  // Un professionista alla volta: il token FIC è per-professionista, così si
  // rinnova al massimo una volta a testa invece che a ogni rata.
  const byOwner = new Map<string, Payment[]>()
  for (const r of rows) byOwner.set(r.owner_id, [...(byOwner.get(r.owner_id) ?? []), r])

  for (const [ownerId, payments] of byOwner) {
    const companyId = byProfessional.get(ownerId)
    if (!companyId) continue
    const tok = await getFicAccessToken(admin, ownerId)
    if (!tok.ok) { errors[ownerId] = tok.error; continue }

    for (const p of payments) {
      checked++
      try {
        const r = await fetch(`https://api-v2.fattureincloud.it/c/${companyId}/issued_documents/${p.fic_invoice_id}`, {
          headers: { Authorization: `Bearer ${tok.accessToken}` },
        })
        if (!r.ok) { errors[p.id] = `HTTP ${r.status}`; continue }
        const d = await r.json().catch(() => null)
        const paymentsList: FicPaymentItem[] = Array.isArray(d?.data?.payments_list) ? d.data.payments_list : []
        // Una sola rata Planfully = un solo incasso FIC (la fattura non ha voci
        // multiple): basta che il primo (unico) risulti pagato.
        const paidItem = paymentsList.find((x) => x.status === 'paid')
        if (!paidItem) continue

        const { error } = await admin.from('contract_payments').update({
          paid: true,
          paid_at: paidItem.paid_date ? paidItem.paid_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          paid_amount: paidItem.amount ?? p.amount,
          method: 'Fatture in Cloud',
          updated_at: new Date().toISOString(),
        }).eq('id', p.id).eq('paid', false) // idempotente: se un giro parallelo l'ha già segnata, non sovrascrive
        if (error) { errors[p.id] = error.message; continue }
        updated++
      } catch (e) {
        errors[p.id] = (e as Error).message
      }
    }
  }

  if (Object.keys(errors).length > 0) console.error('fic_reconcile_errors', JSON.stringify(errors).slice(0, 2000))
  return json({ ok: true, professionals: byOwner.size, checked, updated, errors: Object.keys(errors).length })
})
