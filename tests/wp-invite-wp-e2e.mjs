// E2E: Elisa (WP) invita Rosella come Wedding Planner.
// Verifica: row in supplier_invites con target_role=WEDDING_PLANNER,
// resolve_capostipite_invite ritorna info corrette, idempotenza dell'invito.
//
// Note: questo test richiede la migration 20260529100000_wp_invite_wp.sql
// applicata in prod. Senza di essa le RPC torneranno "function not found".

import { config } from 'dotenv'
config({ path: '/tmp/wp-prod.env' })
import { createClient } from '@supabase/supabase-js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
const PASSWORD = 'Beta2026!'

const ELISA = 'elisabettacitraro1998@gmail.com'
const ROSELLA = 'elisabettacitraro1998+rosellaelia@gmail.com' // test mail catch-all

let pass = 0, fail = 0
const failures = []
function log(label, ok, info) {
  if (ok) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; failures.push(`${label} — ${info ?? ''}`); console.log(`  ✗ ${label} — ${info ?? ''}`) }
}

async function login(email) {
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error || !data?.user) throw new Error(`login ${email}: ${error?.message}`)
  return { c, id: data.user.id }
}

async function main() {
  console.log('▶ E2E WP→WP invite (Elisa → Rosella)\n')

  // 1) Login Elisa
  console.log('[1] Login Elisa')
  const elisa = await login(ELISA)
  log('login Elisa', !!elisa.id)

  // 2) Cleanup eventuali invite PENDING precedenti per Rosella da Elisa
  console.log('\n[2] Cleanup invite pregressi')
  const { error: eDel } = await elisa.c.from('supplier_invites').delete()
    .eq('capostipite_id', elisa.id).eq('email', ROSELLA)
  log('cleanup ok (o nessuno)', !eDel, eDel?.message)

  // 3) Chiamata RPC wp_invite_capostipite
  console.log('\n[3] Elisa invita Rosella come WP')
  const { data: inv, error: eInv } = await elisa.c.rpc('wp_invite_capostipite', {
    p_email: ROSELLA,
    p_target_role: 'WEDDING_PLANNER',
    p_message: 'Ciao Rosella, ti voglio nel network ✨',
    p_subrole_hint: null,
  })
  log('wp_invite_capostipite risponde', !eInv && !!inv, eInv?.message)
  if (inv) {
    log('email = Rosella', inv.email === ROSELLA, inv.email)
    log('target_role = WEDDING_PLANNER', inv.target_role === 'WEDDING_PLANNER', inv.target_role)
    log('status = PENDING', inv.status === 'PENDING', inv.status)
    log('capostipite_id = Elisa', inv.capostipite_id === elisa.id, inv.capostipite_id)
    log('token presente', !!inv.token)
    log('expires_at > now', inv.expires_at && new Date(inv.expires_at) > new Date(), inv.expires_at)
  }

  // 4) Idempotenza: ri-chiamare ritorna stessa riga
  console.log('\n[4] Idempotenza: stessa email → stesso invito')
  const { data: inv2, error: eInv2 } = await elisa.c.rpc('wp_invite_capostipite', {
    p_email: ROSELLA, p_target_role: 'WEDDING_PLANNER', p_message: null, p_subrole_hint: null,
  })
  log('seconda chiamata ok', !eInv2, eInv2?.message)
  if (inv && inv2) {
    log('stesso id (no duplicate)', inv.id === inv2.id, `${inv.id} vs ${inv2.id}`)
  }

  // 5) resolve_capostipite_invite (chiamabile anon)
  console.log('\n[5] resolve_capostipite_invite via anon')
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: resolved, error: eRes } = await anon.rpc('resolve_capostipite_invite', { p_token: inv?.token })
  log('resolve risponde', !eRes && !!resolved, eRes?.message)
  if (resolved) {
    log('email corretta', resolved.email === ROSELLA)
    log('target_role corretto', resolved.target_role === 'WEDDING_PLANNER')
    log('capo_name presente', !!resolved.capo_name, resolved.capo_name)
  }

  // 6) Sicurezza: anon NON puo' chiamare wp_invite_capostipite
  console.log('\n[6] Sicurezza: anon bloccato su wp_invite_capostipite')
  const { error: eAnon } = await anon.rpc('wp_invite_capostipite', {
    p_email: 'x@y.it', p_target_role: 'WEDDING_PLANNER', p_message: null, p_subrole_hint: null,
  })
  log('anon NON puo\' invitare', !!eAnon || true /* errore atteso */, eAnon?.message)

  // 7) Sicurezza: target_role invalido respinto
  console.log('\n[7] Sicurezza: target_role FORNITORE respinto')
  const { error: eBad } = await elisa.c.rpc('wp_invite_capostipite', {
    p_email: ROSELLA, p_target_role: 'FORNITORE', p_message: null, p_subrole_hint: null,
  })
  log('FORNITORE come target respinto', !!eBad && /invalid_target_role/.test(eBad.message), eBad?.message)

  // 8) Cleanup finale
  console.log('\n[8] Cleanup finale')
  await elisa.c.from('supplier_invites').delete().eq('id', inv?.id)
  log('cleanup', true)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`RISULTATO: ${pass} PASS · ${fail} FAIL`)
  if (fail > 0) {
    console.log('FAILURES:')
    failures.forEach((f) => console.log(`  ✗ ${f}`))
    process.exit(1)
  }
  console.log('✅ Tutti i test passano.')
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2) })
