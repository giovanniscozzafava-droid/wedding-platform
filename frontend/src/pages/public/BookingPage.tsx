import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Calendar, Clock, Loader2, Check, Video, Phone, MapPin, Download, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Cfg = {
  professional_id: string; name: string; title: string; description: string | null
  slot_minutes: number; advance_days: number; min_notice_hours: number; timezone: string
  location_type: 'CALL' | 'VIDEO' | 'INPERSON'; location_detail: string | null; color: string
}
type Slot = { iso: string; date: string; label: string }

const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })

export default function BookingPage() {
  const { slug = '' } = useParams()
  const [cfg, setCfg] = useState<Cfg | null>(null)
  const [state, setState] = useState<'load' | 'ready' | 'error'>('load')
  const [slots, setSlots] = useState<Slot[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [picked, setPicked] = useState<Slot | null>(null)
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ when: string; gcal: string; ics: string; whatsapp: string | null; location: string; pro_name: string } | null>(null)

  useEffect(() => {
    void (async () => {
      const { data, error } = await (supabase as any).rpc('booking_public_config', { p_slug: slug })
      if (error || !data) { setState('error'); return }
      const c = data as Cfg; setCfg(c); setState('ready')
      const from = new Date().toISOString().slice(0, 10)
      const to = new Date(Date.now() + Math.min(c.advance_days, 30) * 86400000).toISOString().slice(0, 10)
      const { data: sl } = await (supabase as any).rpc('booking_free_slots', { p_slug: slug, p_from: from, p_to: to })
      const list = (Array.isArray(sl) ? sl : []) as Slot[]
      setSlots(list)
      if (list[0]) setDay(list[0].date)
    })()
  }, [slug])

  const days = useMemo(() => Array.from(new Set(slots.map((s) => s.date))), [slots])
  const daySlots = useMemo(() => slots.filter((s) => s.date === day), [slots, day])

  async function book() {
    if (!picked || !cfg) return
    if (name.trim().length < 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error('Inserisci nome ed email validi'); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('book-appointment', {
        body: { slug, iso: picked.iso, date: picked.date, label: picked.label, name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, note: note.trim() || undefined },
      })
      if (error || (data as any)?.error) {
        const e = (data as any)?.error
        throw new Error(e === 'slot_taken' ? 'Questo orario è appena stato preso. Scegline un altro.' : e === 'too_soon' ? 'Troppo a ridosso: scegli un orario più avanti.' : 'Prenotazione non riuscita.')
      }
      setDone(data as any)
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  function downloadIcs() {
    if (!done) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([done.ics], { type: 'text/calendar' }))
    a.download = 'appuntamento.ics'; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }

  const accent = cfg?.color || '#C9A227'
  const LocIcon = cfg?.location_type === 'VIDEO' ? Video : cfg?.location_type === 'INPERSON' ? MapPin : Phone

  if (state === 'load') return <Shell><div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))] justify-center py-16"><Loader2 className="animate-spin" size={16} /> Carico…</div></Shell>
  if (state === 'error' || !cfg) return <Shell><p className="text-center text-sm text-[rgb(var(--fg-muted))] py-16">Prenotazioni non disponibili per questo profilo.</p></Shell>

  if (done) return (
    <Shell>
      <div className="text-center py-6">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-3" style={{ background: accent, color: '#fff' }}><Check size={28} /></span>
        <h1 className="font-display text-2xl">Prenotato!</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Appuntamento con <strong>{done.pro_name}</strong></p>
        <p className="text-base mt-2"><strong>{done.when}</strong></p>
        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">{done.location}</p>
        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-3">Ti abbiamo inviato l'email di conferma a <strong>{email}</strong>.</p>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          <Button variant="outline" size="sm" onClick={downloadIcs}><Download size={14} /> Aggiungi al calendario (.ics)</Button>
          <a href={done.gcal} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><Calendar size={14} /> Google Calendar</Button></a>
          {done.whatsapp && <a href={done.whatsapp} target="_blank" rel="noreferrer"><Button size="sm" style={{ background: '#25D366', color: '#fff' }}><MessageCircle size={14} /> WhatsApp</Button></a>}
        </div>
      </div>
    </Shell>
  )

  return (
    <Shell>
      <div className="text-center mb-5">
        <h1 className="font-display text-2xl">{cfg.title}</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">con <strong>{cfg.name}</strong></p>
        {cfg.description && <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">{cfg.description}</p>}
        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2 inline-flex items-center gap-1"><Clock size={12} /> {cfg.slot_minutes} min · <LocIcon size={12} /> {cfg.location_type === 'VIDEO' ? 'Video' : cfg.location_type === 'INPERSON' ? 'Di persona' : 'Telefono'}</p>
      </div>

      {days.length === 0 ? (
        <p className="text-center text-sm text-[rgb(var(--fg-muted))] py-8">Nessuno slot disponibile al momento.</p>
      ) : !picked ? (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
            {days.map((d) => (
              <button key={d} onClick={() => setDay(d)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm border ${d === day ? 'text-white border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}
                style={d === day ? { background: accent } : undefined}>{fmtDay(d)}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {daySlots.map((s) => (
              <button key={s.iso} onClick={() => setPicked(s)}
                className="rounded-lg border border-[rgb(var(--border))] py-2 text-sm hover:border-[rgb(var(--gold-500))] hover:bg-[rgb(var(--bg-sunken))]">{s.label}</button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-[rgb(var(--bg-sunken))] p-3 text-sm flex items-center justify-between">
            <span><strong>{fmtDay(picked.date)}</strong> alle <strong>{picked.label}</strong></span>
            <button onClick={() => setPicked(null)} className="text-xs text-[rgb(var(--gold-700))] hover:underline">cambia</button>
          </div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome e cognome" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="La tua email" />
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefono / WhatsApp (facoltativo)" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note (facoltativo)" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
          <Button className="w-full !py-3" style={{ background: accent, color: '#fff' }} disabled={busy} onClick={book}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Conferma appuntamento
          </Button>
        </div>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-start justify-center p-4" style={{ background: 'rgb(var(--bg))' }}>
      <div className="w-full max-w-md mt-6 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] shadow-[var(--shadow-lift)] p-5">
        {children}
        <p className="text-center text-[10px] text-[rgb(var(--fg-subtle))] mt-5">Prenotazioni con <a href="https://planfully.it" target="_blank" rel="noreferrer" className="underline">Planfully</a></p>
      </div>
    </div>
  )
}
