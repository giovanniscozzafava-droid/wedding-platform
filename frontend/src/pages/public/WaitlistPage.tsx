import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Check, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// Lista d'attesa (pre-lancio): sostituisce la registrazione pubblica. La registrazione
// diretta /register resta per chi viene invitato. Scrive via RPC waitlist_submit.
const ACTIVITIES = ['Wedding Planner', 'Location', 'Fornitore', 'Altro']

export default function WaitlistPage() {
  const [sp] = useSearchParams()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [activity, setActivity] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!name.trim()) { setErr('Scrivi il tuo nome'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setErr('Email non valida'); return }
    setBusy(true)
    try {
      const { data, error } = await (supabase.rpc as any)('waitlist_submit', {
        p_name: name.trim(), p_email: email.trim(), p_activity: activity || null, p_city: city.trim() || null, p_source: sp.get('from') || 'web',
      })
      if (error || (data as any)?.error) throw new Error((data as any)?.error === 'bad_email' ? 'Email non valida' : 'Iscrizione non riuscita, riprova')
      setDone(true)
    } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[rgb(var(--bg-sunken))] px-5 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center font-display text-xl mb-6">Planfully</Link>
        <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 sm:p-8 shadow-xl">
          {done ? (
            <div className="text-center py-4">
              <div className="mx-auto h-12 w-12 rounded-full grid place-items-center bg-[rgb(var(--gold-100))] mb-3"><Check className="text-[rgb(var(--gold-700))]" /></div>
              <h1 className="font-display text-2xl">Ci sei.</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">Ti abbiamo messo in lista. Ti scriviamo appena apriamo gli accessi. Grazie per l'interesse.</p>
              <Link to="/" className="inline-block mt-5 text-sm text-[rgb(var(--gold-700))] hover:underline">Torna alla home</Link>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--gold-600))] flex items-center gap-1.5"><Sparkles size={14} /> Accesso su invito</p>
              <h1 className="font-display text-2xl sm:text-3xl mt-1">Entra nella lista d'attesa</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">Stiamo aprendo Planfully a poche realtà per volta. Lascia i tuoi contatti: ti avvisiamo appena tocca a te.</p>
              <form onSubmit={submit} className="mt-5 space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e attività" className="w-full h-11 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 text-sm" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full h-11 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={activity} onChange={(e) => setActivity(e.target.value)} className="h-11 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 text-sm text-[rgb(var(--fg-muted))]">
                    <option value="">Tipo attività</option>
                    {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Città" className="h-11 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 text-sm" />
                </div>
                {err && <p className="text-sm text-[rgb(var(--rose-500))]">{err}</p>}
                <Button type="submit" variant="gold" className="w-full" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : 'Iscrivimi alla lista'}</Button>
              </form>
              <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-3 text-center">Hai già un invito? <Link to="/register" className="text-[rgb(var(--gold-700))] hover:underline">Registrati qui</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
