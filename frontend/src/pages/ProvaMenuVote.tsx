import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Check, Calendar, MapPin, UtensilsCrossed } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Pagina pubblica: gli ospiti della prova menu votano i menu (1–5) senza login, via token.
type PublicMenu = { menu_id: string; nome: string; piatti: string[] }
type PublicTasting = { ok?: boolean; error?: string; tasting_id: string; titolo: string | null; quando: string | null; sala: string | null; menu: PublicMenu[] }

export default function ProvaMenuVote() {
  const { token = '' } = useParams()
  const [data, setData] = useState<PublicTasting | null>(null)
  const [loading, setLoading] = useState(true)
  const [voter, setVoter] = useState('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comments, setComments] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data: d } = await (supabase as any).rpc('fb_tasting_public', { p_token: token })
      if (alive) { setData(d); setLoading(false) }
    })()
    return () => { alive = false }
  }, [token])

  async function submit() {
    if (!data?.menu?.length) return
    const rated = data.menu.filter((m) => scores[m.menu_id])
    if (!rated.length) { alert('Dai almeno un voto a un menu'); return }
    setBusy(true)
    try {
      for (const m of rated) {
        await (supabase as any).rpc('fb_submit_vote', { p_token: token, p_voter: voter || null, p_menu_id: m.menu_id, p_score: scores[m.menu_id], p_comment: comments[m.menu_id] || null })
      }
      setDone(true)
    } finally { setBusy(false) }
  }

  if (loading) return <div className="min-h-screen grid place-items-center bg-stone-50 text-stone-400">Carico la prova menu…</div>
  if (!data || data.error) return <div className="min-h-screen grid place-items-center bg-stone-50 text-stone-500 px-6 text-center">Link non valido o prova non trovata.</div>
  if (done) return (
    <div className="min-h-screen grid place-items-center bg-stone-50 px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-5"><Check size={30} /></div>
        <h1 className="font-serif text-3xl mb-2">Grazie!</h1>
        <p className="text-stone-500">Il tuo voto è stato registrato. Aiuterà gli sposi a scegliere il menù.</p>
      </div>
    </div>
  )

  const when = data.quando ? new Date(data.quando).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : null
  const total = data.menu.length
  const ratedCount = data.menu.filter((m) => scores[m.menu_id]).length

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      {/* Hero */}
      <header className="relative overflow-hidden bg-gradient-to-b from-stone-900 via-stone-900 to-stone-800 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_50%_-10%,_white,_transparent_55%)]" />
        <div className="relative mx-auto max-w-lg px-6 pt-12 pb-20 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full border border-amber-300/40 text-amber-300">
            <UtensilsCrossed size={24} />
          </div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-amber-300/90">Prova menù</p>
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{data.titolo || 'Degustazione'}</h1>
          {(when || data.sala) && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-stone-300">
              {when && <span className="inline-flex items-center gap-1.5"><Calendar size={14} className="text-amber-300/80" />{when}</span>}
              {data.sala && <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-amber-300/80" />{data.sala}</span>}
            </div>
          )}
          <p className="mx-auto mt-5 max-w-xs text-sm text-stone-400">Assaggia ogni menù e lascia il tuo voto. La scelta finale è degli sposi.</p>
        </div>
      </header>

      {/* Menu board */}
      <main className="relative mx-auto -mt-10 max-w-lg space-y-4 px-4">
        <input
          value={voter}
          onChange={(e) => setVoter(e.target.value)}
          placeholder="Il tuo nome (facoltativo)"
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm outline-none focus:border-stone-400"
        />

        {data.menu.map((m, i) => {
          const score = scores[m.menu_id] ?? 0
          return (
            <article key={m.menu_id} className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-medium text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-xl leading-tight text-stone-800">{m.nome}</h2>
                  {m.piatti?.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.piatti.map((p, j) => (
                        <li key={j} className="flex gap-2 text-sm text-stone-500">
                          <span className="text-amber-400/80">—</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setScores((s) => ({ ...s, [m.menu_id]: n }))} className="p-0.5 transition-transform hover:scale-110" aria-label={`${n} stelle`}>
                      <Star size={26} className={score >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
                    </button>
                  ))}
                </div>
                <span className={`text-sm ${score ? 'font-medium text-stone-600' : 'text-stone-400'}`}>{score ? `${score}/5` : 'Vota'}</span>
              </div>

              <input
                value={comments[m.menu_id] || ''}
                onChange={(e) => setComments((c) => ({ ...c, [m.menu_id]: e.target.value }))}
                placeholder="Un commento (facoltativo)"
                className="mt-3 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-stone-400"
              />
            </article>
          )
        })}
      </main>

      {/* Barra invio */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-lg">
          <p className="mb-2 text-center text-xs text-stone-400">{ratedCount} di {total} menù votati</p>
          <button onClick={submit} disabled={busy} className="block w-full rounded-xl bg-stone-900 py-3.5 font-medium text-white transition-colors hover:bg-stone-800 disabled:opacity-50">
            {busy ? 'Invio…' : 'Invia i miei voti'}
          </button>
        </div>
      </div>
    </div>
  )
}
