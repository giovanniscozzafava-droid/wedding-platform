import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CalendarClock, Check, Copy, Plus, X, Link2, Code, CalendarDays, RefreshCw, CalendarCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

type Interval = [string, string]
type Weekly = Record<string, Interval[]>
type Settings = {
  enabled: boolean; title: string; description: string | null
  slot_minutes: number; buffer_minutes: number; advance_days: number; min_notice_hours: number
  timezone: string; weekly: Weekly; location_type: 'CALL' | 'VIDEO' | 'INPERSON'; location_detail: string | null
  whatsapp: string | null; color: string; feed_token?: string; feed_linked_at?: string | null
}
const DAYS: { k: string; l: string }[] = [
  { k: '1', l: 'Lun' }, { k: '2', l: 'Mar' }, { k: '3', l: 'Mer' }, { k: '4', l: 'Gio' }, { k: '5', l: 'Ven' }, { k: '6', l: 'Sab' }, { k: '0', l: 'Dom' },
]
const DEFAULT: Settings = {
  enabled: false, title: 'Prenota un appuntamento', description: '', slot_minutes: 30, buffer_minutes: 0, advance_days: 30, min_notice_hours: 12,
  timezone: 'Europe/Rome', weekly: { '1': [['09:00', '13:00'], ['14:00', '18:00']], '2': [['09:00', '13:00'], ['14:00', '18:00']], '3': [['09:00', '13:00'], ['14:00', '18:00']], '4': [['09:00', '13:00'], ['14:00', '18:00']], '5': [['09:00', '13:00'], ['14:00', '18:00']] },
  location_type: 'CALL', location_detail: '', whatsapp: '', color: '#C9A227',
}

export function BookingSettingsCard() {
  const [s, setS] = useState<Settings>(DEFAULT)
  const [me, setMe] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [gcal, setGcal] = useState<{ connected: boolean; last?: string | null }>({ connected: false })
  const [gcalBusy, setGcalBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id
      if (!uid) { setLoading(false); return }
      setMe(uid)
      const { data: prof } = await (supabase.from as any)('profiles').select('slug').eq('id', uid).maybeSingle()
      setSlug(prof?.slug ?? null)
      const { data } = await (supabase.from as any)('booking_settings').select('*').eq('professional_id', uid).maybeSingle()
      if (data) setS({ ...DEFAULT, ...data, description: data.description ?? '', location_detail: data.location_detail ?? '', whatsapp: data.whatsapp ?? '' })
      const { data: gc } = await (supabase.from as any)('google_calendar_connections').select('professional_id, last_sync_at').eq('professional_id', uid).maybeSingle()
      setGcal(gc ? { connected: true, last: gc.last_sync_at } : { connected: false })
      setLoading(false)
    })()
    const p = new URLSearchParams(window.location.search)
    if (p.get('gcal') === 'connected') toast.success('Google Calendar collegato — gli orari occupati spariranno dalle prenotazioni')
    if (p.get('gcal') === 'norefresh') toast.error('Collegamento Google non completato: riprova accettando i permessi')
  }, [])

  async function connectGcal() {
    setGcalBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('gcal-oauth-start', { body: {} })
      if (error || !(data as any)?.url) throw new Error('Avvio del collegamento non riuscito')
      window.location.href = (data as any).url
    } catch (e) { toast.error((e as Error).message); setGcalBusy(false) }
  }
  async function disconnectGcal() {
    if (!me) return
    await (supabase.from as any)('google_calendar_connections').delete().eq('professional_id', me)
    await (supabase.from as any)('google_calendar_busy').delete().eq('professional_id', me)
    setGcal({ connected: false })
    toast.success('Google Calendar scollegato')
  }

  async function linkCalendar(webcalUrl: string) {
    if (me) { try { await (supabase.from as any)('booking_settings').update({ feed_linked_at: new Date().toISOString() }).eq('professional_id', me) } catch { /* non blocca */ } }
    setS((p) => ({ ...p, feed_linked_at: new Date().toISOString() }))
    window.location.href = webcalUrl
  }

  function setDay(k: string, intervals: Interval[]) { setS((p) => ({ ...p, weekly: { ...p.weekly, [k]: intervals } })) }

  async function save() {
    setSaving(true)
    try {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) throw new Error('Non autenticato')
      // pulisci le fasce vuote/invalide
      const weekly: Weekly = {}
      for (const { k } of DAYS) { const iv = (s.weekly[k] ?? []).filter(([a, b]) => a && b && a < b); if (iv.length) weekly[k] = iv }
      const { error } = await (supabase.from as any)('booking_settings').upsert({
        professional_id: me, enabled: s.enabled, title: s.title.trim() || 'Prenota un appuntamento', description: s.description || null,
        slot_minutes: s.slot_minutes, buffer_minutes: s.buffer_minutes, advance_days: s.advance_days, min_notice_hours: s.min_notice_hours,
        timezone: s.timezone, weekly, location_type: s.location_type, location_detail: s.location_detail || null, whatsapp: s.whatsapp || null, color: s.color, updated_at: new Date().toISOString(),
      }, { onConflict: 'professional_id' })
      if (error) throw error
      // ricarica per avere il feed_token (se appena creato)
      const { data } = await (supabase.from as any)('booking_settings').select('*').eq('professional_id', me).maybeSingle()
      if (data) setS((p) => ({ ...p, feed_token: data.feed_token }))
      toast.success('Prenotazioni salvate')
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }

  const base = typeof window !== 'undefined' ? window.location.origin : 'https://planfully.it'
  const publicUrl = slug ? `${base}/prenota/${slug}` : null
  const embed = publicUrl ? `<iframe src="${publicUrl}" width="100%" height="760" style="border:0;border-radius:16px" title="Prenota un appuntamento"></iframe>` : ''
  const supaUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? ''
  const feedUrl = s.feed_token && supaUrl ? `${supaUrl}/functions/v1/booking-ics?token=${s.feed_token}` : null
  const copy = (t: string, msg: string) => { void navigator.clipboard.writeText(t).then(() => toast.success(msg)).catch(() => toast(t)) }

  if (loading) return null

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}><CalendarClock size={18} /></span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg flex items-center gap-2">Prenotazioni online {s.enabled && <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))]"><Check size={11} className="inline" /> attive</span>}</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Pubblica le tue disponibilità: i clienti prenotano un appuntamento su uno slot libero. Si integra nel tuo <strong>unico</strong> calendario (slot occupato) e manda email di conferma.</p>

          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
            <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Abilita la pagina di prenotazione
          </label>

          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Titolo<Input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} className="mt-0.5" /></label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">WhatsApp (con prefisso, es. 39333…)<Input value={s.whatsapp ?? ''} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} placeholder="39333…" className="mt-0.5" /></label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Durata slot (min)<Input type="number" value={s.slot_minutes} onChange={(e) => setS({ ...s, slot_minutes: Math.max(5, +e.target.value || 30) })} className="mt-0.5" /></label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Pausa tra slot (min)<Input type="number" value={s.buffer_minutes} onChange={(e) => setS({ ...s, buffer_minutes: Math.max(0, +e.target.value || 0) })} className="mt-0.5" /></label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Prenotabile fino a (giorni)<Input type="number" value={s.advance_days} onChange={(e) => setS({ ...s, advance_days: Math.max(1, +e.target.value || 30) })} className="mt-0.5" /></label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Preavviso minimo (ore)<Input type="number" value={s.min_notice_hours} onChange={(e) => setS({ ...s, min_notice_hours: Math.max(0, +e.target.value || 0) })} className="mt-0.5" /></label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Dove
              <select value={s.location_type} onChange={(e) => setS({ ...s, location_type: e.target.value as Settings['location_type'] })} className="mt-0.5 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-2 text-sm">
                <option value="CALL">Telefono</option><option value="VIDEO">Videochiamata</option><option value="INPERSON">Di persona</option>
              </select>
            </label>
            <label className="text-[11px] text-[rgb(var(--fg-muted))]">Dettaglio luogo / link / numero<Input value={s.location_detail ?? ''} onChange={(e) => setS({ ...s, location_detail: e.target.value })} className="mt-0.5" /></label>
          </div>

          <p className="text-[11px] font-medium text-[rgb(var(--fg-muted))] mt-4 mb-1">Disponibilità settimanale</p>
          <div className="space-y-1.5">
            {DAYS.map(({ k, l }) => {
              const iv = s.weekly[k] ?? []
              return (
                <div key={k} className="flex items-start gap-2">
                  <span className="w-9 text-xs pt-2 text-[rgb(var(--fg-muted))]">{l}</span>
                  <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {iv.length === 0 && <span className="text-[11px] text-[rgb(var(--fg-subtle))] py-1.5">Chiuso</span>}
                    {iv.map(([a, b], i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-[rgb(var(--border))] px-1.5 py-1">
                        <input type="time" value={a} onChange={(e) => setDay(k, iv.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="bg-transparent text-xs outline-none" />
                        <span className="text-[rgb(var(--fg-subtle))]">–</span>
                        <input type="time" value={b} onChange={(e) => setDay(k, iv.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="bg-transparent text-xs outline-none" />
                        <button onClick={() => setDay(k, iv.filter((_, j) => j !== i))} className="text-[rgb(var(--fg-subtle))] hover:text-rose-500"><X size={12} /></button>
                      </span>
                    ))}
                    <button onClick={() => setDay(k, [...iv, ['09:00', '13:00']])} className="text-[11px] text-[rgb(var(--gold-700))] hover:underline inline-flex items-center gap-0.5"><Plus size={11} /> fascia</button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button variant="gold" disabled={saving} onClick={save}>{saving ? '…' : 'Salva prenotazioni'}</Button>
          </div>

          {s.enabled && publicUrl && (
            <div className="mt-4 space-y-2 border-t border-[rgb(var(--border))] pt-3">
              <div className="flex items-center gap-2 text-sm">
                <Link2 size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
                <a href={publicUrl} target="_blank" rel="noreferrer" className="text-[rgb(var(--gold-700))] hover:underline truncate">{publicUrl}</a>
                <button onClick={() => copy(publicUrl, 'Link copiato')} className="ml-auto text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]" title="Copia link"><Copy size={14} /></button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Code size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
                <span className="text-[rgb(var(--fg-muted))] truncate flex-1">Incorpora sul tuo sito (HTML)</span>
                <button onClick={() => copy(embed, 'Codice embed copiato')} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]" title="Copia embed"><Copy size={14} /></button>
              </div>
              {feedUrl && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
                  <span className="text-[rgb(var(--fg-muted))] truncate flex-1">{s.feed_linked_at ? 'Calendario collegato — le prenotazioni arrivano qui in automatico' : 'Collega le prenotazioni al tuo calendario (Apple / Google / Outlook)'}</span>
                  {s.feed_linked_at ? (
                    <>
                      <span className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--emerald-500))] mr-1"><Check size={13} /> Collegato</span>
                      <button onClick={() => linkCalendar(feedUrl.replace(/^https?:/, 'webcal:'))} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]" title="Ricollega al calendario"><RefreshCw size={14} /></button>
                    </>
                  ) : (
                    <button onClick={() => linkCalendar(feedUrl.replace(/^https?:/, 'webcal:'))} className="text-[rgb(var(--gold-700))] hover:underline mr-1">Collega al calendario</button>
                  )}
                  <button onClick={() => copy(feedUrl, 'Link calendario copiato')} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]" title="Copia il link del calendario"><Copy size={14} /></button>
                </div>
              )}
              {/* Blocca slot dagli impegni Google (sola lettura) */}
              <div className="flex items-center gap-2 text-sm">
                <CalendarCheck size={14} className="text-[rgb(var(--gold-600))] shrink-0" />
                <span className="text-[rgb(var(--fg-muted))] truncate flex-1">{gcal.connected ? 'Google Calendar collegato — quando sei occupato lì, lo slot sparisce' : 'Blocca gli slot dai tuoi impegni Google Calendar'}</span>
                {gcal.connected ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--emerald-500))] mr-1"><Check size={13} /> Collegato</span>
                    <button onClick={disconnectGcal} className="text-[11px] text-[rgb(var(--fg-muted))] hover:underline">Scollega</button>
                  </>
                ) : (
                  <button onClick={connectGcal} disabled={gcalBusy} className="text-[rgb(var(--gold-700))] hover:underline">{gcalBusy ? '…' : 'Collega Google'}</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
