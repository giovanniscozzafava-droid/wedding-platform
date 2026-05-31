// Risolve l'URL pulito planfully.it/<slug> alla landing pubblica giusta
// (wedding planner / location vs fornitore). Montato come ULTIMA route prima
// del catch-all 404, cosi` non oscura nessuna route applicativa.
//
// Se lo slug non corrisponde ad alcun profilo pubblico → redirect a "/".

import { lazy, Suspense, useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const PublicWpPage = lazy(() => import('@/pages/public/PublicWpPage'))
const PublicSupplierPage = lazy(() => import('@/pages/public/PublicSupplierPage'))

type Resolved = { slug: string; kind: 'wp' | 'fornitore'; role: string; display_name: string | null }

export default function PublicSlugResolver() {
  const { slug } = useParams<{ slug: string }>()
  const [state, setState] = useState<{ loading: boolean; resolved: Resolved | null }>({ loading: true, resolved: null })

  useEffect(() => {
    if (!slug) { setState({ loading: false, resolved: null }); return }
    let cancelled = false
    void (async () => {
      const { data } = await (supabase.rpc as any)('resolve_public_slug', { p_slug: slug })
      if (cancelled) return
      setState({ loading: false, resolved: (data ?? null) as Resolved | null })
    })()
    return () => { cancelled = true }
  }, [slug])

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
        <p className="text-sm text-[rgb(var(--fg-subtle))]">Carico…</p>
      </div>
    )
  }

  // Slug sconosciuto → home pubblica (niente 404 secco per gli URL personali).
  if (!state.resolved) return <Navigate to="/" replace />

  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }} />}>
      {state.resolved.kind === 'fornitore' ? <PublicSupplierPage /> : <PublicWpPage />}
    </Suspense>
  )
}
