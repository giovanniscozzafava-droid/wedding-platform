// Fatture in Cloud: token pronto all'uso, lato server. Le fatture NON le crea il
// browser (a differenza di Drive): un'edge che deve chiamare Fatture in Cloud
// per conto del professionista chiama getFicAccessToken(admin, professionalId)
// e riceve un access_token fresco, rinnovandolo da solo quando serve.
import { encryptToken, decryptToken } from './drive-crypto.ts'

const CLIENT_ID = Deno.env.get('FIC_CLIENT_ID') ?? ''
const CLIENT_SECRET = Deno.env.get('FIC_CLIENT_SECRET') ?? ''
const b64e = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const b64d = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// deno-lint-ignore no-explicit-any
type SB = any

export async function getFicConnection(admin: SB, professionalId: string) {
  const { data } = await admin.from('fic_connections')
    .select('company_id, company_name, access_token_enc, refresh_token_enc, token_expires_at')
    .eq('professional_id', professionalId).maybeSingle()
  return data ?? null
}

// Margine di sicurezza prima della scadenza reale (l'access_token FIC dura 24h).
const RENEW_MARGIN_S = 120

export async function getFicAccessToken(admin: SB, professionalId: string): Promise<
  { ok: true; accessToken: string; companyId: string } | { ok: false; error: string }
> {
  const conn = await getFicConnection(admin, professionalId)
  if (!conn?.access_token_enc || !conn?.refresh_token_enc) return { ok: false, error: 'not_connected' }

  const exp = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0
  if (exp - Date.now() > RENEW_MARGIN_S * 1000) {
    const accessToken = await decryptToken(b64d(conn.access_token_enc as string))
    return { ok: true, accessToken, companyId: conn.company_id }
  }

  const refresh = await decryptToken(b64d(conn.refresh_token_enc as string))
  const r = await fetch('https://api-v2.fattureincloud.it/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grant_type: 'refresh_token', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refresh }),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok || !d.access_token) return { ok: false, error: `refresh_failed: ${r.status}` }

  const accessEnc = b64e(await encryptToken(String(d.access_token)))
  // Fatture in Cloud a volte non ritorna un nuovo refresh_token: si tiene quello valido.
  const refreshEnc = d.refresh_token ? b64e(await encryptToken(String(d.refresh_token))) : (conn.refresh_token_enc as string)
  const expiresAt = new Date(Date.now() + (Number(d.expires_in) || 86400) * 1000).toISOString()
  await admin.from('fic_connections').update({
    access_token_enc: accessEnc, refresh_token_enc: refreshEnc, token_expires_at: expiresAt, updated_at: new Date().toISOString(),
  }).eq('professional_id', professionalId)

  return { ok: true, accessToken: String(d.access_token), companyId: conn.company_id }
}
