import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type AppRole = 'WEDDING_PLANNER' | 'LOCATION' | 'FORNITORE' | 'ADMIN' | 'COUPLE'

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
      'id, role, subrole, full_name, business_name, phone, subscription_tier, brand_logo_url, brand_primary_color, brand_secondary_color, default_markup_percent, onboarding_complete',
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
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) {
        void fetchProfile(data.session.user.id).then((p) => mounted && setProfile(p))
      }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) {
        void fetchProfile(s.user.id).then((p) => setProfile(p))
      } else {
        setProfile(null)
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
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
