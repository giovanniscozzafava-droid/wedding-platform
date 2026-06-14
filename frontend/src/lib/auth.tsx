import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AppRole = 'WEDDING_PLANNER' | 'LOCATION' | 'FORNITORE' | 'ADMIN' | 'COUPLE' | 'CLIENT' | 'GUEST'

export type Profile = {
  id: string
  role: AppRole
  subrole: string | null
  full_name: string | null
  business_name: string | null
  phone: string | null
  subscription_tier: 'FREE' | 'PREMIUM'
  brand_logo_url: string | null
  brand_primary_color: string | null
  brand_secondary_color: string | null
  default_markup_percent: number
  onboarding_complete: boolean
  onboarding_completato_il: string | null
  is_support_staff?: boolean
}

type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id, role, subrole, full_name, business_name, phone, subscription_tier, brand_logo_url, brand_primary_color, brand_secondary_color, default_markup_percent, onboarding_complete, onboarding_completato_il, is_support_staff',
    )
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('fetchProfile error', error)
    return null
  }
  return (data as unknown as Profile) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    let lastSessionId: string | undefined
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      lastSessionId = data.session?.user?.id
      if (data.session?.user) {
        void fetchProfile(data.session.user.id).then((p) => mounted && setProfile(p))
      }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (s?.user) {
        lastSessionId = s.user.id
        void fetchProfile(s.user.id).then((p) => setProfile(p))
        // Redeem pending referral code (impostato da RegisterPage se email confirm flow)
        try {
          const pending = localStorage.getItem('pending_ref_code')
          if (pending) {
            void (async () => {
              try {
                await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
                  .rpc('referral_redeem_code', { p_code: pending })
              } catch { /* ignore */ }
              try { localStorage.removeItem('pending_ref_code') } catch { /* ignore */ }
            })()
          }
        } catch { /* ignore */ }
      } else {
        // Logout: distingui tra utente che ha cliccato Esci e session expirata.
        // Se prima c'era una sessione, il browser ha perso il token (tab inattiva,
        // refresh fallito, cookie scaduto…) — notifico l'utente prima del redirect.
        if (event === 'SIGNED_OUT' && lastSessionId) {
          try {
            // dynamic import per evitare cicli
            void import('sonner').then(({ toast }) => {
              toast.info('Sessione scaduta. Effettua di nuovo l\'accesso.', { duration: 6000 })
            })
          } catch { /* ignore */ }
        }
        lastSessionId = undefined
        setProfile(null)
      }
    })

    // Refresh proattivo: quando la tab torna visibile, prova a rinnovare il token.
    // Senza questo, su mobile/tab-suspended il refreshTimer si ferma e la
    // prossima chiamata fa fallire la sessione "nel vuoto".
    function onVisibility() {
      if (document.visibilityState !== 'visible') return
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) return
        const exp = (data.session.expires_at ?? 0) * 1000
        // se manca meno di 5 minuti alla scadenza, refresh subito
        if (exp - Date.now() < 5 * 60 * 1000) {
          void supabase.auth.refreshSession()
        }
      }).catch(() => { /* ignore */ })
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      refreshProfile: async () => {
        if (session?.user) setProfile(await fetchProfile(session.user.id))
      },
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [loading, session, profile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>')
  return ctx
}
