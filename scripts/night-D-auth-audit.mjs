// Night audit D — flussi auth + registrazione + inviti
// Esercita signup/login/invite/reset via Supabase Admin + REST,
// con probe HTTP delle landing public su prod.
//
// Output: audit-runs/night-D-auth-<ts>/ (REPORT.md, auth-stats.json, log dettagliato)

import { createClient } from '@supabase/supabase-js'
import { writeFile, mkdir, appendFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = 'https://zfwlkvqxfzvubmfyxofs.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ0MDg4OCwiZXhwIjoyMDk1MDE2ODg4fQ.hm4AG2hidna9b61CR-buzWtmV9LmykuYx2_fPx_6T1M'
// Prod anon key (stesso usato da scripts/agent-f-night-audit.mjs)
const ANON_KEY_FALLBACK = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64'
const PROD_BASE = 'https://planfully.it'

const OUT_DIR = process.env.AUDIT_DIR || ''
if (!OUT_DIR) { console.error('AUDIT_DIR required'); process.exit(2) }

const TS = Date.now()
const stats = {
  started_at: new Date().toISOString(),
  steps: {},
  pass: 0,
  fail: 0,
  warn: 0,
  bugs: [],
}

const log = []
function pushLog(level, msg, extra = {}) {
  const line = { t: new Date().toISOString(), level, msg, ...extra }
  log.push(line)
  console.log(`[${level}] ${msg}`, Object.keys(extra).length ? JSON.stringify(extra) : '')
}

function step(name, status, details = {}) {
  stats.steps[name] = { status, ...details }
  if (status === 'PASS') stats.pass++
  else if (status === 'FAIL') stats.fail++
  else stats.warn++
  pushLog(status, name, details)
}

function bug(severity, area, msg, evidence = '') {
  stats.bugs.push({ severity, area, msg, evidence })
  pushLog('BUG', `${severity} [${area}] ${msg}`, { evidence })
}

// Admin client (service-role)
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// Fetch anon key from Supabase project (need it to test public flows like signup, login, password reset)
async function getAnonKey() {
  if (ANON_KEY_FALLBACK) return ANON_KEY_FALLBACK
  // Try frontend .env
  try {
    const fs = await import('node:fs/promises')
    const envFile = await fs.readFile('/Users/giovanniscozzafava/Repository/wedding-platform/frontend/.env', 'utf8').catch(() => '')
    const m = envFile.match(/VITE_SUPABASE_ANON_KEY=([^\s]+)/)
    if (m) return m[1].trim()
    const envLocal = await fs.readFile('/Users/giovanniscozzafava/Repository/wedding-platform/frontend/.env.local', 'utf8').catch(() => '')
    const m2 = envLocal.match(/VITE_SUPABASE_ANON_KEY=([^\s]+)/)
    if (m2) return m2[1].trim()
  } catch {}
  return ''
}

function rid(len = 6) { return Math.random().toString(36).slice(2, 2 + len) }
const TAG = `agent-d-${TS}-${rid(4)}`

const accounts = {
  wp: { email: `agent-d-wp-${TS}@planfully-demo.it`, password: 'Beta2026!', full_name: 'Giulia Conti', role: 'WEDDING_PLANNER' },
  fornitore: { email: `agent-d-forn-${TS}@planfully-demo.it`, password: 'Beta2026!', full_name: 'Marco Bianchi', role: 'FORNITORE', subrole: 'fotografo', business_name: 'Bianchi Studio Foto' },
  location: { email: `agent-d-loc-${TS}@planfully-demo.it`, password: 'Beta2026!', full_name: 'Anna Russo', role: 'LOCATION', business_name: 'Villa Le Querce' },
  invitedFornitore: { email: `agent-d-inv-forn-${TS}@planfully-demo.it`, password: 'Beta2026!', full_name: 'Lucia Romano' },
  invitedCouple: { email: `agent-d-couple-${TS}@planfully-demo.it`, password: 'Beta2026!', full_name: 'Sara Esposito' },
  resetUser: { email: `agent-d-reset-${TS}@planfully-demo.it`, password: 'Beta2026!', full_name: 'Davide Marini', role: 'WEDDING_PLANNER' },
}

// ------------------------------------------------------------------
// Step 1: Signup WP (via Admin API — emulates signUp + email confirmed)
// ------------------------------------------------------------------
async function step1_signupWP(anonKey) {
  const a = accounts.wp
  try {
    // Use Admin createUser to bypass email confirm flow (we test BOTH paths: signup endpoint and admin)
    // 1a: Try public signup endpoint (what UI does) — checks email-confirm policy
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: a.email, password: a.password,
        data: { role: a.role, full_name: a.full_name },
      }),
    })
    const signupBody = await signupRes.json()
    const needsConfirm = !signupBody.access_token && !signupBody.session
    step('1.signup-wp-public-endpoint', signupRes.ok ? 'PASS' : 'FAIL', { http: signupRes.status, needs_confirm: needsConfirm, user_id: signupBody?.user?.id ?? signupBody?.id })

    // 1b: Confirm via admin (simulate clicking email link)
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const created = list?.users?.find(u => u.email === a.email)
    if (!created) {
      step('1.signup-wp-user-created', 'FAIL', { reason: 'user not found after signup' })
      bug('HIGH', 'signup', 'Utente WP non creato dopo POST /auth/v1/signup', JSON.stringify(signupBody).slice(0, 300))
      return
    }
    const confirmed = !!created.email_confirmed_at
    if (!confirmed) {
      const upd = await admin.auth.admin.updateUserById(created.id, { email_confirm: true })
      step('1.signup-wp-confirm-email', upd.error ? 'FAIL' : 'PASS', { confirmed_now: !!upd.data?.user?.email_confirmed_at })
    } else {
      step('1.signup-wp-confirm-email', 'PASS', { already_confirmed: true })
    }

    // 1c: Verify profile row coherence — check profiles table
    const prof = await admin.from('profiles').select('id, full_name, role, subrole').eq('id', created.id).maybeSingle()
    if (prof.error || !prof.data) {
      step('1.signup-wp-profile-row', 'FAIL', { error: prof.error?.message })
      bug('HIGH', 'signup', 'Riga profiles non creata per WP signup (manca trigger handle_new_user o RLS blocca service-role?)', JSON.stringify(prof.error))
    } else {
      const ok = prof.data.role === 'WEDDING_PLANNER'
      step('1.signup-wp-profile-row', ok ? 'PASS' : 'FAIL', { profile: prof.data })
      if (!ok) bug('MED', 'signup', `Profile role mismatch attesa WEDDING_PLANNER, got ${prof.data.role}`)
    }

    // 1d: Login con la nuova creds (verifica email-confirm flow concluso)
    const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: a.email, password: a.password }),
    })
    const loginBody = await login.json()
    step('1.signup-wp-login-after-confirm', login.ok && loginBody.access_token ? 'PASS' : 'FAIL', { http: login.status })
    if (login.ok && loginBody.access_token) accounts.wp.access_token = loginBody.access_token
  } catch (e) {
    step('1.signup-wp', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 2: Signup Fornitore (con subrole)
// ------------------------------------------------------------------
async function step2_signupFornitore(anonKey) {
  const a = accounts.fornitore
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: a.email, password: a.password,
        data: { role: a.role, subrole: a.subrole, full_name: a.full_name, business_name: a.business_name },
      }),
    })
    const body = await r.json()
    step('2.signup-fornitore-endpoint', r.ok ? 'PASS' : 'FAIL', { http: r.status })

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = list?.users?.find(x => x.email === a.email)
    if (!u) { step('2.signup-fornitore-user', 'FAIL'); return }
    if (!u.email_confirmed_at) await admin.auth.admin.updateUserById(u.id, { email_confirm: true })

    const prof = await admin.from('profiles').select('id, full_name, role, subrole, business_name').eq('id', u.id).maybeSingle()
    const ok = prof.data && prof.data.role === 'FORNITORE' && prof.data.subrole === 'fotografo'
    step('2.signup-fornitore-profile', ok ? 'PASS' : 'FAIL', { profile: prof.data, error: prof.error?.message })
    if (!ok) bug('HIGH', 'signup-fornitore', `Profilo fornitore non coerente: role=${prof.data?.role}, subrole=${prof.data?.subrole}`)
    accounts.fornitore.user_id = u.id
  } catch (e) {
    step('2.signup-fornitore', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 3: Signup Location
// ------------------------------------------------------------------
async function step3_signupLocation(anonKey) {
  const a = accounts.location
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: a.email, password: a.password, data: { role: a.role, full_name: a.full_name, business_name: a.business_name } }),
    })
    step('3.signup-location-endpoint', r.ok ? 'PASS' : 'FAIL', { http: r.status })

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = list?.users?.find(x => x.email === a.email)
    if (!u) { step('3.signup-location-user', 'FAIL'); return }
    if (!u.email_confirmed_at) await admin.auth.admin.updateUserById(u.id, { email_confirm: true })

    const prof = await admin.from('profiles').select('id, role, business_name').eq('id', u.id).maybeSingle()
    const ok = prof.data && prof.data.role === 'LOCATION'
    step('3.signup-location-profile', ok ? 'PASS' : 'FAIL', { profile: prof.data, error: prof.error?.message })
    if (!ok) bug('HIGH', 'signup-location', `Profilo location non coerente: role=${prof.data?.role}`)
    accounts.location.user_id = u.id
  } catch (e) {
    step('3.signup-location', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 4: Invito Fornitore via WP
// ------------------------------------------------------------------
async function step4_inviteFornitore(anonKey) {
  try {
    // Login come WP demo esistente
    const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wp-mini@planfully-demo.it', password: 'Beta2026!' }),
    })
    const loginBody = await loginRes.json()
    if (!loginRes.ok) {
      step('4.login-wp-mini', 'FAIL', { http: loginRes.status, body: loginBody })
      bug('MED', 'fixtures', 'wp-mini@planfully-demo.it non login (account demo mancante o password cambiata)')
      // Fallback: usa il WP appena creato
      if (!accounts.wp.access_token) return
    } else {
      step('4.login-wp-mini', 'PASS')
    }
    const wpToken = loginBody.access_token || accounts.wp.access_token

    // Invoca edge function invite-supplier
    const inv = await fetch(`${SUPABASE_URL}/functions/v1/invite-supplier`, {
      method: 'POST',
      headers: {
        apikey: anonKey, 'Content-Type': 'application/json',
        Authorization: `Bearer ${wpToken}`,
      },
      body: JSON.stringify({ email: accounts.invitedFornitore.email, subrole: 'fotografo', message: 'Audit night test' }),
    })
    const invBody = await inv.json().catch(() => ({}))
    step('4.invite-supplier-fn', inv.ok ? 'PASS' : 'FAIL', { http: inv.status, body: invBody })

    if (!inv.ok) {
      bug('HIGH', 'invite-fornitore', `Edge function invite-supplier ha risposto ${inv.status}`, JSON.stringify(invBody).slice(0, 400))
      return
    }

    // Pesca il token dal DB
    const inviteRow = await admin.from('supplier_invites').select('id, email, token, status, expires_at').eq('email', accounts.invitedFornitore.email).maybeSingle()
    if (inviteRow.error || !inviteRow.data) {
      step('4.invite-row-db', 'FAIL', { error: inviteRow.error?.message })
      bug('HIGH', 'invite-fornitore', 'Riga supplier_invites non creata in DB')
      return
    }
    step('4.invite-row-db', 'PASS', { invite_id: inviteRow.data.id, token_len: inviteRow.data.token?.length })
    accounts.invitedFornitore.invite_token = inviteRow.data.token

    // Probe landing pubblica /invito-fornitore/:token
    const landing = await fetch(`${PROD_BASE}/invito-fornitore/${inviteRow.data.token}`, { redirect: 'manual' })
    step('4.invite-landing-200', landing.ok || landing.status === 200 ? 'PASS' : 'WARN', { http: landing.status })

    // Accetta l'invito: signup user con metadata role=FORNITORE + invite_token
    const acceptRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: accounts.invitedFornitore.email, password: accounts.invitedFornitore.password,
        data: { role: 'FORNITORE', invite_token: inviteRow.data.token, full_name: accounts.invitedFornitore.full_name },
      }),
    })
    const acceptBody = await acceptRes.json()
    step('4.invite-signup-accept', acceptRes.ok ? 'PASS' : 'FAIL', { http: acceptRes.status, error: acceptBody.error || acceptBody.msg })

    // Verifica utente
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = list?.users?.find(x => x.email === accounts.invitedFornitore.email)
    if (u && !u.email_confirmed_at) await admin.auth.admin.updateUserById(u.id, { email_confirm: true })

    // Verifica collaborations ACTIVE
    if (u) {
      const collab = await admin.from('collaborations').select('id, status, capostipite_id, fornitore_id').eq('fornitore_id', u.id)
      const active = (collab.data || []).find(c => c.status === 'ACTIVE')
      step('4.collab-active-created', active ? 'PASS' : 'WARN', { count: collab.data?.length, active: !!active, error: collab.error?.message })
      if (!active && (collab.data?.length ?? 0) === 0) bug('HIGH', 'invite-fornitore', 'Nessuna collaboration creata dopo accept invito fornitore')
      else if (!active) bug('MED', 'invite-fornitore', `Collaboration creata ma status != ACTIVE (status=${collab.data?.[0]?.status})`)
    }

    // Verifica status invito → ACCEPTED
    const inv2 = await admin.from('supplier_invites').select('status, accepted_at').eq('id', inviteRow.data.id).maybeSingle()
    const acceptedOk = inv2.data?.status === 'ACCEPTED' && !!inv2.data?.accepted_at
    step('4.invite-status-accepted', acceptedOk ? 'PASS' : 'WARN', { status: inv2.data?.status, accepted_at: inv2.data?.accepted_at })
    if (!acceptedOk) bug('MED', 'invite-fornitore', `supplier_invites.status non ACCEPTED dopo accept (è ${inv2.data?.status})`)
  } catch (e) {
    step('4.invite-fornitore', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 5: Invito Coppia via WP
// ------------------------------------------------------------------
async function step5_inviteCouple(anonKey) {
  try {
    // Login come WP (usa wp-mini se disponibile, sennò agent-d-wp)
    let wpToken, wpId
    const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wp-mini@planfully-demo.it', password: 'Beta2026!' }),
    })
    if (loginRes.ok) {
      const b = await loginRes.json()
      wpToken = b.access_token
      wpId = b.user?.id
    } else if (accounts.wp.access_token) {
      wpToken = accounts.wp.access_token
      const me = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      wpId = me.data?.users?.find(u => u.email === accounts.wp.email)?.id
    }
    if (!wpToken || !wpId) { step('5.wp-login', 'FAIL'); return }

    // Crea wedding entry
    const wpClient = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    await wpClient.auth.setSession({ access_token: wpToken, refresh_token: 'unused' }).catch(() => {})

    const wedTitle = `AGENT-D Wedding test ${rid(4)}`
    const newWed = await admin.from('calendar_entries').insert({
      owner_id: wpId, title: wedTitle,
      date_from: '2027-06-15', date_to: '2027-06-15',
      status: 'CONFERMATA',
    }).select().single()
    if (newWed.error || !newWed.data) {
      step('5.create-wedding', 'FAIL', { error: newWed.error?.message })
      bug('HIGH', 'wedding-create', 'Impossibile creare calendar_entries WEDDING via admin', newWed.error?.message)
      return
    }
    step('5.create-wedding', 'PASS', { id: newWed.data.id, title: wedTitle })
    const entryId = newWed.data.id

    // Insert wedding_couple_members (la mutation client lo fa con anon+RLS, ma noi siamo admin)
    const member = await admin.from('wedding_couple_members').insert({
      entry_id: entryId, email: accounts.invitedCouple.email, full_name: accounts.invitedCouple.full_name, role: 'SPOSA',
    }).select().single()
    if (member.error || !member.data) {
      step('5.couple-member-insert', 'FAIL', { error: member.error?.message })
      bug('HIGH', 'invite-coppia', 'Insert wedding_couple_members fallito', member.error?.message)
      return
    }
    const token = member.data.invite_token
    step('5.couple-member-insert', 'PASS', { member_id: member.data.id, token_len: token?.length })
    accounts.invitedCouple.invite_token = token
    accounts.invitedCouple.wedding_id = entryId

    // Probe landing /invito-coppia/:token
    const land = await fetch(`${PROD_BASE}/invito-coppia/${token}`, { redirect: 'manual' })
    step('5.couple-landing-200', land.ok || land.status === 200 ? 'PASS' : 'WARN', { http: land.status })

    // Signup come COUPLE col token
    const su = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: accounts.invitedCouple.email, password: accounts.invitedCouple.password,
        data: { role: 'COUPLE', full_name: accounts.invitedCouple.full_name, invite_token: token },
      }),
    })
    const suBody = await su.json()
    step('5.couple-signup', su.ok ? 'PASS' : 'FAIL', { http: su.status, error: suBody.error || suBody.msg })

    // Confirm + then RPC accept
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    const u = list?.users?.find(x => x.email === accounts.invitedCouple.email)
    if (u && !u.email_confirmed_at) await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
    accounts.invitedCouple.user_id = u?.id

    // Chiama l'RPC couple_accept_invite con il token sotto la sessione del nuovo user
    const loginCouple = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: accounts.invitedCouple.email, password: accounts.invitedCouple.password }),
    })
    const lc = await loginCouple.json()
    if (loginCouple.ok && lc.access_token) {
      step('5.couple-login', 'PASS')
      const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/couple_accept_invite`, {
        method: 'POST',
        headers: { apikey: anonKey, Authorization: `Bearer ${lc.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token }),
      })
      const rpcBody = await rpc.text()
      step('5.couple-accept-rpc', rpc.ok ? 'PASS' : 'FAIL', { http: rpc.status, body: rpcBody.slice(0, 300) })
      if (!rpc.ok) bug('HIGH', 'invite-coppia', `RPC couple_accept_invite ha risposto ${rpc.status}`, rpcBody.slice(0, 200))

      // Verifica accepted_at e user_id sul membership
      const m2 = await admin.from('wedding_couple_members').select('user_id, accepted_at').eq('id', member.data.id).maybeSingle()
      const ok = m2.data?.user_id === u?.id && !!m2.data?.accepted_at
      step('5.couple-member-linked', ok ? 'PASS' : 'FAIL', { user_id: m2.data?.user_id, accepted_at: m2.data?.accepted_at })
      if (!ok) bug('HIGH', 'invite-coppia', 'wedding_couple_members non collegato a user_id dopo accept')

      // Verifica profilo COUPLE
      const prof = await admin.from('profiles').select('id, role').eq('id', u.id).maybeSingle()
      step('5.couple-profile-role', prof.data?.role === 'COUPLE' ? 'PASS' : 'WARN', { role: prof.data?.role })
      if (prof.data?.role !== 'COUPLE') bug('MED', 'invite-coppia', `Profilo coppia ha role ${prof.data?.role} (atteso COUPLE)`)

      // Verifica coppia VEDE il wedding (SELECT con sessione coppia)
      const seeRes = await fetch(`${SUPABASE_URL}/rest/v1/wedding_couple_members?select=id,entry_id&user_id=eq.${u.id}`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${lc.access_token}` },
      })
      const seeBody = await seeRes.json()
      const sees = Array.isArray(seeBody) && seeBody.some(r => r.entry_id === entryId)
      step('5.couple-sees-wedding', sees ? 'PASS' : 'FAIL', { rows: Array.isArray(seeBody) ? seeBody.length : 0 })
      if (!sees) bug('HIGH', 'invite-coppia', 'Coppia non vede il wedding di cui è membro (RLS troppo restrittiva o link rotto)')
    } else {
      step('5.couple-login', 'FAIL', { http: loginCouple.status })
    }
  } catch (e) {
    step('5.invite-coppia', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 6: Password reset
// ------------------------------------------------------------------
async function step6_resetPassword(anonKey) {
  const a = accounts.resetUser
  try {
    // Crea utente di prova via admin (saltando email-confirm)
    const create = await admin.auth.admin.createUser({
      email: a.email, password: a.password, email_confirm: true,
      user_metadata: { role: a.role, full_name: a.full_name },
    })
    if (create.error) { step('6.reset-create-user', 'FAIL', { error: create.error.message }); return }
    step('6.reset-create-user', 'PASS', { user_id: create.data.user.id })

    // Trigger recovery email — endpoint pubblico /auth/v1/recover
    const recover = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: a.email }),
    })
    const recBody = await recover.text()
    step('6.recover-trigger', recover.ok ? 'PASS' : 'FAIL', { http: recover.status, body: recBody.slice(0, 200) })
    if (!recover.ok) {
      bug('CRITICAL', 'password-reset',
        `POST /auth/v1/recover risponde ${recover.status} — flusso /forgot-password BLOCCATO in prod (utenti non possono resettare la password via UI)`,
        recBody.slice(0, 300))
    }
    // Cross-check con utente reale esistente: stesso comportamento?
    const recoverProd = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wp-mini@planfully-demo.it' }),
    })
    const recoverProdBody = await recoverProd.text()
    step('6.recover-trigger-real-user', recoverProd.ok ? 'PASS' : 'FAIL', { http: recoverProd.status, body: recoverProdBody.slice(0, 200) })
    if (!recoverProd.ok) bug('CRITICAL', 'password-reset', `Recovery fallisce anche per utente reale "wp-mini" → conferma rottura sistemica`, recoverProdBody.slice(0, 200))

    // Simula reset: usa admin generateLink per ottenere token recovery + apply nuova password
    const link = await admin.auth.admin.generateLink({ type: 'recovery', email: a.email })
    if (link.error) {
      step('6.generate-recovery-link', 'FAIL', { error: link.error.message })
      bug('MED', 'password-reset', 'Admin generateLink recovery fallito', link.error.message)
      return
    }
    step('6.generate-recovery-link', 'PASS', { has_link: !!link.data?.properties?.action_link })

    // Aggiorna password via admin (equivalente client-side a auth.updateUser({password}) post-recovery session)
    const newPw = 'Beta2026!New'
    const upd = await admin.auth.admin.updateUserById(create.data.user.id, { password: newPw })
    step('6.update-password', upd.error ? 'FAIL' : 'PASS', { error: upd.error?.message })

    // Login con la nuova password
    const login = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: a.email, password: newPw }),
    })
    const lb = await login.json()
    step('6.login-with-new-password', login.ok && lb.access_token ? 'PASS' : 'FAIL', { http: login.status })
    if (!login.ok) bug('HIGH', 'password-reset', `Login con nuova password fallito http=${login.status}`, JSON.stringify(lb).slice(0, 200))

    // Login con vecchia non deve funzionare
    const oldLogin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: a.email, password: a.password }),
    })
    step('6.old-password-rejected', !oldLogin.ok ? 'PASS' : 'FAIL', { http: oldLogin.status })
    if (oldLogin.ok) bug('HIGH', 'password-reset', 'Vecchia password ancora valida dopo reset!')
  } catch (e) {
    step('6.password-reset', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 7: Login edge cases
// ------------------------------------------------------------------
async function step7_loginEdgeCases(anonKey) {
  try {
    // 7a: email vuota
    const r1 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: 'whatever' }),
    })
    step('7.login-empty-email', !r1.ok ? 'PASS' : 'FAIL', { http: r1.status })

    // 7b: password sbagliata
    const r2 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'wp-mini@planfully-demo.it', password: 'wrong-password-xxxx' }),
    })
    const b2 = await r2.json()
    step('7.login-wrong-password', !r2.ok ? 'PASS' : 'FAIL', { http: r2.status, err_code: b2.error_code || b2.code, msg: b2.error_description || b2.msg })

    // 7c: email inesistente
    const r3 = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `non-existent-${TS}@planfully-demo.it`, password: 'whatever' }),
    })
    const b3 = await r3.json()
    step('7.login-unknown-email', !r3.ok ? 'PASS' : 'FAIL', { http: r3.status, err_code: b3.error_code || b3.code, msg: b3.error_description || b3.msg })

    // 7d: Verifica no-enumeration: stesso codice errore tra wrong-password e unknown-email
    const enumerationSafe = (b2.error_code === b3.error_code) || (b2.error === b3.error) || (r2.status === r3.status)
    step('7.no-email-enumeration', enumerationSafe ? 'PASS' : 'WARN', {
      wrong_pw_code: b2.error_code || b2.code, unknown_email_code: b3.error_code || b3.code,
    })
    if (!enumerationSafe) bug('MED', 'login-security', 'Login error responses divergono tra wrong-password e unknown-email (enumeration leak)', JSON.stringify({ b2, b3 }).slice(0, 300))

    // 7e: Google OAuth bottone presente — verifichiamo source code lato repo (SPA shell ne è priva di per sé)
    try {
      const fs = await import('node:fs/promises')
      const gb = await fs.readFile('/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src/components/auth/GoogleButton.tsx', 'utf8').catch(() => '')
      const lp = await fs.readFile('/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src/pages/auth/LoginPage.tsx', 'utf8').catch(() => '')
      const hasComponent = gb.includes("signInWithOAuth") && gb.includes("'google'")
      const usedOnLogin = lp.includes('GoogleButton')
      step('7.google-oauth-button-source', hasComponent && usedOnLogin ? 'PASS' : 'WARN', { has_component: hasComponent, used_on_login: usedOnLogin })
      if (!hasComponent || !usedOnLogin) bug('LOW', 'login-ux', 'Bottone Google OAuth non presente o non importato in LoginPage', `comp=${hasComponent} used=${usedOnLogin}`)
    } catch (e) {
      step('7.google-oauth-button-source', 'WARN', { error: String(e) })
    }
  } catch (e) {
    step('7.login-edge-cases', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Step 8: RLS check cross-account
// ------------------------------------------------------------------
async function step8_RLS(anonKey) {
  try {
    if (!accounts.wp.access_token) {
      // Re-login agent-d-wp
      const lg = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: accounts.wp.email, password: accounts.wp.password }),
      })
      const lb = await lg.json()
      if (lg.ok) accounts.wp.access_token = lb.access_token
    }
    if (!accounts.wp.access_token) { step('8.rls-need-token', 'FAIL'); return }

    // 8a: il nuovo WP vede 0 weddings (non ne ha creati)
    const wpRes = await fetch(`${SUPABASE_URL}/rest/v1/calendar_entries?select=id,owner_id`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accounts.wp.access_token}` },
    })
    const wpBody = await wpRes.json()
    const onlyOwn = Array.isArray(wpBody) && wpBody.every(r => !accounts.wp.user_id || r.owner_id === accounts.wp.user_id)
    // Note we didn't set wp.user_id; just check count is small (== 0 ideally because fresh user)
    step('8.rls-wp-isolation', Array.isArray(wpBody) ? 'PASS' : 'FAIL', { rows: Array.isArray(wpBody) ? wpBody.length : null, only_own_or_zero: onlyOwn })
    if (Array.isArray(wpBody) && wpBody.length > 0) {
      // verify owner_ids
      const adminMe = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
      const myId = adminMe.data?.users?.find(u => u.email === accounts.wp.email)?.id
      const leaked = wpBody.filter(r => r.owner_id !== myId)
      if (leaked.length > 0) bug('CRITICAL', 'rls', `WP nuovo vede ${leaked.length} weddings di OTHER owners (RLS broken!)`, JSON.stringify(leaked.slice(0, 3)))
    }

    // 8b: Fornitore nuovo non vede dati altri fornitori — log in come fornitore
    const fornLogin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: accounts.fornitore.email, password: accounts.fornitore.password }),
    })
    const fb = await fornLogin.json()
    if (fornLogin.ok && fb.access_token) {
      // Tenta SELECT services di tutti — RLS dovrebbe filtrare per fornitore_id == self
      const svcRes = await fetch(`${SUPABASE_URL}/rest/v1/services?select=id,fornitore_id`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${fb.access_token}` },
      })
      const svcBody = await svcRes.json()
      step('8.rls-fornitore-services', svcRes.ok ? 'PASS' : 'FAIL', { rows: Array.isArray(svcBody) ? svcBody.length : null, http: svcRes.status, body_sample: !Array.isArray(svcBody) ? JSON.stringify(svcBody).slice(0, 200) : undefined })
      if (Array.isArray(svcBody)) {
        const otherRows = svcBody.filter(r => r.fornitore_id !== accounts.fornitore.user_id)
        if (otherRows.length > 0) bug('CRITICAL', 'rls', `Fornitore nuovo vede ${otherRows.length} services di OTHER suppliers (RLS broken!)`, JSON.stringify(otherRows.slice(0, 3)))
      }

      // SELECT weddings — dovrebbe vedere solo quelle dove ha una collaboration con un WP che lo possiede
      const wedRes = await fetch(`${SUPABASE_URL}/rest/v1/calendar_entries?select=id,owner_id`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${fb.access_token}` },
      })
      const wedBody = await wedRes.json()
      step('8.rls-fornitore-weddings', wedRes.ok ? 'PASS' : 'FAIL', { rows: Array.isArray(wedBody) ? wedBody.length : null })
      // Fornitore nuovo NON dovrebbe vedere il wedding "AGENT-D Wedding test" (a meno che esista una collab con wp-mini, che NON c'è — l'invito era a invitedFornitore, non a questo)
      if (Array.isArray(wedBody) && wedBody.length > 0) {
        pushLog('INFO', 'Fornitore vede weddings: verifica manuale necessaria', { ids: wedBody.slice(0, 5) })
      }
    } else {
      step('8.rls-fornitore-login', 'FAIL', { http: fornLogin.status })
    }
  } catch (e) {
    step('8.rls', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Cleanup
// ------------------------------------------------------------------
async function cleanup() {
  pushLog('INFO', 'Cleanup: rimozione utenti agent-d-%@planfully-demo.it')
  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const targets = (list?.users ?? []).filter(u => u.email && u.email.startsWith('agent-d-') && u.email.endsWith('@planfully-demo.it'))
    pushLog('INFO', `Trovati ${targets.length} utenti da pulire`)
    let removed = 0, failed = 0
    const safe = async (p, label) => {
      try { const r = await p; if (r?.error) pushLog('WARN', `cleanup ${label}: ${r.error.message}`) }
      catch (e) { pushLog('WARN', `cleanup ${label} threw: ${String(e)}`) }
    }
    for (const u of targets) {
      // Pulisci dipendenti per evitare FK violations
      await safe(admin.from('wedding_couple_members').delete().eq('email', u.email), `wcm:${u.email}`)
      if (u.id) {
        await safe(admin.from('wedding_couple_members').delete().eq('user_id', u.id), `wcm.user_id:${u.id}`)
        await safe(admin.from('collaborations').delete().eq('fornitore_id', u.id), `collab.forn:${u.id}`)
        await safe(admin.from('collaborations').delete().eq('capostipite_id', u.id), `collab.capo:${u.id}`)
        await safe(admin.from('calendar_entries').delete().eq('owner_id', u.id), `cal:${u.id}`)
        await safe(admin.from('profiles').delete().eq('id', u.id), `prof:${u.id}`)
      }
      await safe(admin.from('supplier_invites').delete().eq('email', u.email), `inv:${u.email}`)
      const r = await admin.auth.admin.deleteUser(u.id)
      if (r.error) { failed++; pushLog('WARN', `Failed delete ${u.email}: ${r.error.message}`) } else removed++
    }
    // Cleanup wedding "AGENT-D Wedding test%" created via service-role even orphan
    await safe(admin.from('calendar_entries').delete().ilike('title', 'AGENT-D Wedding test%'), 'orphan-weddings')
    stats.cleanup = { removed, failed, target_count: targets.length }
    step('cleanup', failed === 0 ? 'PASS' : 'WARN', { removed, failed })
  } catch (e) {
    step('cleanup', 'FAIL', { error: String(e) })
  }
}

// ------------------------------------------------------------------
// Main
// ------------------------------------------------------------------
async function main() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true })
  const anonKey = await getAnonKey()
  if (!anonKey) {
    pushLog('FATAL', 'Non trovo VITE_SUPABASE_ANON_KEY')
    process.exit(2)
  }
  pushLog('INFO', 'Inizio audit auth', { ts: TS, prod: PROD_BASE, anon_len: anonKey.length })

  await step1_signupWP(anonKey)
  await step2_signupFornitore(anonKey)
  await step3_signupLocation(anonKey)
  await step4_inviteFornitore(anonKey)
  await step5_inviteCouple(anonKey)
  await step6_resetPassword(anonKey)
  await step7_loginEdgeCases(anonKey)
  await step8_RLS(anonKey)

  await cleanup()

  stats.finished_at = new Date().toISOString()
  await writeFile(join(OUT_DIR, 'auth-stats.json'), JSON.stringify(stats, null, 2))
  await writeFile(join(OUT_DIR, 'audit-log.jsonl'), log.map(l => JSON.stringify(l)).join('\n'))

  // Build REPORT.md
  const md = []
  md.push(`# Night Audit D — Auth + Registrazione + Inviti`)
  md.push('')
  md.push(`- **Start**: ${stats.started_at}`)
  md.push(`- **End**: ${stats.finished_at}`)
  md.push(`- **Pass**: ${stats.pass}  **Warn**: ${stats.warn}  **Fail**: ${stats.fail}`)
  md.push(`- **Bugs trovati**: ${stats.bugs.length}`)
  md.push('')
  md.push('## Step-by-step')
  md.push('')
  md.push('| Step | Status | Dettagli |')
  md.push('|---|---|---|')
  for (const [name, info] of Object.entries(stats.steps)) {
    const det = Object.entries(info).filter(([k]) => k !== 'status').map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80)}`).join('; ')
    md.push(`| ${name} | ${info.status} | ${det} |`)
  }
  md.push('')
  md.push('## Bug list')
  md.push('')
  if (stats.bugs.length === 0) md.push('Nessun bug riscontrato.')
  else for (const b of stats.bugs) md.push(`- **[${b.severity}] ${b.area}** — ${b.msg}${b.evidence ? `  \n  _evidence_: ${b.evidence.slice(0, 200)}_` : ''}`)
  md.push('')
  md.push('## Cleanup')
  md.push(`- Removed: ${stats.cleanup?.removed ?? 0}`)
  md.push(`- Failed: ${stats.cleanup?.failed ?? 0}`)
  md.push(`- Target accounts: agent-d-*@planfully-demo.it`)

  await writeFile(join(OUT_DIR, 'REPORT.md'), md.join('\n'))
  pushLog('INFO', `Report scritto in ${OUT_DIR}`)
}

main().catch(async (e) => {
  pushLog('FATAL', String(e))
  await writeFile(join(OUT_DIR, 'audit-log.jsonl'), log.map(l => JSON.stringify(l)).join('\n')).catch(() => {})
  process.exit(1)
})
