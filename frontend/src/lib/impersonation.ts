// "Accedi come utente" (impersonation per supporto).
// Salva la sessione dello staff, entra come il target via token magic-link,
// e permette di tornare al proprio account. Tracciato lato server (audit log).
import { supabase } from '@/lib/supabase'

const BACK = 'pf_imp_back'      // tokens dello staff per tornare indietro
const ACTIVE = 'pf_imp_active'  // etichetta utente impersonato (banner)

export function impersonatedLabel(): string | null {
  try { return localStorage.getItem(ACTIVE) } catch { return null }
}

export async function startImpersonation(userId: string): Promise<void> {
  // 1) salva la sessione attuale (staff) per poter tornare.
  const { data: sess } = await supabase.auth.getSession()
  const s = sess.session
  if (!s) throw new Error('Sessione non trovata')
  localStorage.setItem(BACK, JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token }))

  // 2) ottieni un token per il target.
  const { data, error } = await supabase.functions.invoke('admin-impersonate', { body: { user_id: userId } })
  if (error) throw error
  const r = data as { token_hash?: string; label?: string; error?: string }
  if (r.error) throw new Error(r.error)
  if (!r.token_hash) throw new Error('Token non ricevuto')

  // 3) diventa il target.
  const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: r.token_hash, type: 'magiclink' })
  if (vErr) { localStorage.removeItem(BACK); throw vErr }

  localStorage.setItem(ACTIVE, r.label ?? 'utente')
  window.location.href = '/'
}

export async function stopImpersonation(): Promise<void> {
  try {
    const raw = localStorage.getItem(BACK)
    if (raw) {
      const { access_token, refresh_token } = JSON.parse(raw)
      await supabase.auth.setSession({ access_token, refresh_token })
    }
  } catch { /* in ogni caso pulisco e rimando al login */ }
  localStorage.removeItem(BACK)
  localStorage.removeItem(ACTIVE)
  window.location.href = '/admin'
}
