import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, Check, Sparkles, Images } from 'lucide-react'
import { loadByToken, setFavorite, type LookClientData } from '@/lib/provaLook'

export default function ProvaLookClientPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<LookClientData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fav, setFav] = useState<string | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      if (!token) { setErr('Link non valido'); setLoading(false); return }
      try {
        const d = await loadByToken(token)
        if (d.error) { setErr(d.error); return }
        setData(d); setFav(d.proposals.find((p) => p.favorite)?.id ?? null)
      } catch { setErr('network') } finally { setLoading(false) }
    })()
  }, [token])

  async function choose(id: string) {
    if (!token) return
    setFav(id)
    await setFavorite(token, id)
  }

  if (loading) return <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg))]"><Loader2 className="animate-spin text-[rgb(var(--fg-subtle))]" size={26} /></div>
  if (err || !data) {
    const msg = err === 'not_found' ? 'Proposte non trovate: il link potrebbe essere errato o revocato.'
      : err === 'not_ready' ? 'Le proposte non sono ancora pronte. Il professionista te le invierà a breve.'
      : 'Al momento non riusciamo ad aprire le proposte.'
    return (
      <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg))] px-6 text-center">
        <div><Images size={40} className="mx-auto text-[rgb(var(--fg-subtle))]" /><p className="mt-4 font-display text-2xl">Un momento…</p><p className="mt-2 text-[rgb(var(--fg-muted))] max-w-sm mx-auto">{msg}</p></div>
      </div>
    )
  }

  const studio = data.studio || 'Il professionista'
  const kindLabel = data.kind === 'hair' ? 'acconciatura' : data.kind === 'flowers' ? 'allestimento' : data.kind === 'pyro' ? 'spettacolo' : 'trucco'

  return (
    <div className="min-h-screen bg-[rgb(var(--bg))] text-[rgb(var(--fg))]">
      <header className="max-w-5xl mx-auto px-6 sm:px-10 pt-16 pb-8 text-center">
        {data.logo && <img src={data.logo} alt={studio} className="h-9 mx-auto mb-7 opacity-80" />}
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[rgb(var(--gold-700))] mb-4 inline-flex items-center gap-2"><Sparkles size={12} /> Prova {kindLabel} · Beta</p>
        <h1 className="font-display text-4xl sm:text-5xl leading-[1.06]">{data.client_label ? `${data.client_label}, ecco le vostre proposte` : 'Le vostre proposte'}</h1>
        <p className="font-display italic text-lg text-[rgb(var(--fg-muted))] mt-4">Preparate da {studio}. Tocca il cuore sulla vostra preferita.</p>
      </header>

      <main className="max-w-5xl mx-auto px-6 sm:px-10 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {data.proposals.map((p) => {
            const chosen = fav === p.id
            return (
              <figure key={p.id} className="group relative">
                <button onClick={() => setZoom(p.image_url)} className={`block w-full overflow-hidden rounded-lg bg-[rgb(var(--bg-sunken))] ${chosen ? 'ring-2 ring-[rgb(var(--gold-500))] ring-offset-2 ring-offset-[rgb(var(--bg))]' : ''}`}>
                  <img src={p.image_url} alt={p.title ?? ''} loading="lazy" className="w-full h-auto object-contain" />
                </button>
                <figcaption className="mt-3 flex items-center justify-between gap-3">
                  <span className="font-display text-lg">{p.title || 'Proposta'}</span>
                  <button onClick={() => choose(p.id)} aria-pressed={chosen} aria-label={chosen ? 'La tua preferita' : 'Scegli questa'}
                    className={`inline-flex items-center gap-1.5 rounded-full h-9 px-3.5 font-mono text-[11px] uppercase tracking-[0.12em] ${chosen ? 'bg-[rgb(var(--gold-500))] text-white' : 'border border-[rgb(var(--border-strong))] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'}`}>
                    <Check size={14} /> {chosen ? 'Preferita' : 'Scegli'}
                  </button>
                </figcaption>
              </figure>
            )
          })}
        </div>
        {data.proposals.length === 0 && <p className="text-center text-[rgb(var(--fg-muted))] mt-10">Nessuna proposta ancora.</p>}
      </main>

      <footer className="border-t border-[rgb(var(--border))]">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 py-9 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-display italic text-[rgb(var(--fg-muted))]">Realizzato con Planfully</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[rgb(var(--fg-subtle))]">Anteprima AI · indicativa · Beta</p>
        </div>
      </footer>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-[#0E1116] grid place-items-center p-4" role="dialog" aria-modal="true" onClick={() => setZoom(null)}>
          <img src={zoom} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
