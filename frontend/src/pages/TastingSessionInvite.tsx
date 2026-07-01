import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Check, X, CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Pagina pubblica (no login): il cliente invitato alla prova menu sceglie una data e conferma (RSVP).
// Confermando, sulla sua dashboard si sblocca la scelta del menu (parte dalla degustazione).
type Data = { id: string; quando: string; sala: string | null }
type Invite = { ok?: boolean; error?: string; invite_id: string; cliente: string; rsvp: string; chosen_date_id: string | null; sessione: string; stagione: string | null; note: string | null; location: string; date: Data[] }

export default function TastingSessionInvite() {
  const { token = '' } = useParams()
  const [inv, setInv] = useState<Invite | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateId, setDateId] = useState<string>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<'YES' | 'NO' | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await (supabase as any).rpc('fb_tasting_invite_public', { p_token: token })
      if (alive) {
        setInv(data)
        if (data?.chosen_date_id) setDateId(data.chosen_date_id)
        if (data?.rsvp === 'YES' || data?.rsvp === 'NO') setDone(data.rsvp)
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [token])

  async function respond(rsvp: 'YES' | 'NO') {
    if (rsvp === 'YES' && !dateId) { alert('Scegli una data'); return }
    setBusy(true)
    try {
      const { data, error } = await (supabase as any).rpc('fb_tasting_invite_respond', { p_token: token, p_rsvp: rsvp, p_date_id: rsvp === 'YES' ? dateId : null, p_note: note || null })
      if (error || data?.error) throw new Error()
      setDone(rsvp)
    } catch { alert('Qualcosa è andato storto, riprova.') } finally { setBusy(false) }
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-stone-500">Carico l'invito…</div>
  if (!inv || inv.error) return <div className="min-h-screen grid place-items-center text-stone-500 px-6 text-center">Invito non valido o non trovato.</div>

  const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short' })

  if (done) return (
    <div className="min-h-screen grid place-items-center bg-stone-50 px-6">
      <div className="text-center max-w-sm">
        <div className={`w-16 h-16 rounded-full grid place-items-center mx-auto mb-4 ${done === 'YES' ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-200 text-stone-500'}`}>
          {done === 'YES' ? <Check size={30} /> : <X size={30} />}
        </div>
        <h1 className="text-2xl font-semibold mb-2">{done === 'YES' ? 'Presenza confermata!' : 'Risposta registrata'}</h1>
        <p className="text-stone-500">
          {done === 'YES'
            ? 'Ci vediamo alla prova menu. Da adesso, sulla vostra dashboard Planfully si è attivata la scelta del menu: partite dalla degustazione.'
            : 'Grazie per averci avvisati. Se cambiate idea, riaprite questo link.'}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      <div className="bg-stone-900 text-white px-6 py-8 text-center">
        <p className="text-xs uppercase tracking-widest text-amber-300 mb-1">Invito prova menu · {inv.location}</p>
        <h1 className="text-2xl font-semibold">{inv.cliente}, siete invitati alla degustazione</h1>
        <p className="text-stone-300 text-sm mt-1">{inv.sessione}{inv.stagione ? ` · ${inv.stagione.toLowerCase()}` : ''}</p>
        {inv.note && <p className="text-stone-400 text-xs mt-2 max-w-md mx-auto">{inv.note}</p>}
      </div>
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm">
          <p className="font-medium mb-3 flex items-center gap-2"><CalendarClock size={18} /> Scegli la data che preferisci</p>
          <div className="space-y-2">
            {inv.date.length === 0 && <p className="text-sm text-stone-500 italic">Date in via di definizione, vi ricontatteremo.</p>}
            {inv.date.map((d) => (
              <label key={d.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${dateId === d.id ? 'border-amber-400 bg-amber-50' : 'border-stone-200'}`}>
                <input type="radio" name="data" className="mt-1" checked={dateId === d.id} onChange={() => setDateId(d.id)} />
                <span className="text-sm">
                  <span className="font-medium block">{when(d.quando)}</span>
                  {d.sala && <span className="text-stone-500">{d.sala}</span>}
                </span>
              </label>
            ))}
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (allergie, n° persone, …) — facoltativo" className="w-full mt-3 rounded-lg border border-stone-200 px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <button onClick={() => respond('NO')} disabled={busy} className="px-4 py-3.5 rounded-xl border border-stone-300 text-stone-600 font-medium disabled:opacity-50">Non possiamo</button>
          <button onClick={() => respond('YES')} disabled={busy} className="flex-1 bg-stone-900 text-white rounded-xl py-3.5 font-medium disabled:opacity-50">{busy ? '…' : 'Confermiamo la presenza'}</button>
        </div>
      </div>
    </div>
  )
}
