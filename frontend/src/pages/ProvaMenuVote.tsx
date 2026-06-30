import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Pagina pubblica: gli ospiti della prova menu votano i menu (1–5) senza login, via token.
const COURSE_LABEL: Record<string, string> = { APERITIVO: 'Aperitivo & isole', ANTIPASTO: 'Antipasti', PRIMO: 'Primi piatti', SECONDO: 'Secondi piatti', CONTORNO: 'Contorni', FRUTTA: 'Frutta', DOLCE: 'Dolci', BEVANDE: 'Vini & bevande' }
type Portata = { course: string; voci: string[] }
type PublicMenu = { menu_id: string; nome: string; portate: Portata[] }
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

  if (loading) return <div className="min-h-screen grid place-items-center text-stone-500">Carico la prova menu…</div>
  if (!data || data.error) return <div className="min-h-screen grid place-items-center text-stone-500 px-6 text-center">Link non valido o prova non trovata.</div>
  if (done) return (
    <div className="min-h-screen grid place-items-center bg-stone-50 px-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center mx-auto mb-4"><Check size={30} /></div>
        <h1 className="text-2xl font-semibold mb-2">Grazie!</h1>
        <p className="text-stone-500">Il tuo voto è stato registrato. Aiuterà gli sposi a scegliere il menu.</p>
      </div>
    </div>
  )

  const when = data.quando ? new Date(data.quando).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' }) : null
  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <div className="bg-stone-900 text-white px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-300 mb-1">Prova menu</p>
        <h1 className="text-2xl font-semibold">{data.titolo || 'Degustazione'}</h1>
        {(when || data.sala) && <p className="text-stone-300 text-sm mt-1">{when}{data.sala ? ` · ${data.sala}` : ''}</p>}
        <p className="text-stone-400 text-xs mt-3">Assaggia e dai un voto a ogni menu. Decidono gli sposi.</p>
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <input value={voter} onChange={(e) => setVoter(e.target.value)} placeholder="Il tuo nome (facoltativo)" className="w-full rounded-xl border border-stone-200 px-4 py-3 bg-white" />
        {data.menu.map((m) => (
          <div key={m.menu_id} className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
            <h2 className="font-semibold text-lg">{m.nome}</h2>
            {(m.portate ?? []).length > 0 && (
              <div className="mt-2 space-y-1.5">
                {m.portate.map((p) => (
                  <div key={p.course}>
                    <p className="text-[11px] uppercase tracking-wide text-amber-700 font-medium">{COURSE_LABEL[p.course] ?? p.course}</p>
                    <p className="text-stone-600 text-sm">{p.voci.join(' · ')}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setScores((s) => ({ ...s, [m.menu_id]: n }))} className="p-1" aria-label={`${n} stelle`}>
                  <Star size={28} className={(scores[m.menu_id] ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'} />
                </button>
              ))}
              {scores[m.menu_id] && <span className="ml-2 text-sm text-stone-500">{scores[m.menu_id]}/5</span>}
            </div>
            <input value={comments[m.menu_id] || ''} onChange={(e) => setComments((c) => ({ ...c, [m.menu_id]: e.target.value }))} placeholder="Un commento (facoltativo)" className="w-full mt-3 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
          </div>
        ))}
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 p-4">
        <button onClick={submit} disabled={busy} className="max-w-lg mx-auto block w-full bg-stone-900 text-white rounded-xl py-3.5 font-medium disabled:opacity-50">{busy ? 'Invio…' : 'Invia i miei voti'}</button>
      </div>
    </div>
  )
}
