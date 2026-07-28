import { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { Plus, Trash2, CalendarRange, CalendarClock, Percent, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsTabs } from '@/components/settings/SettingsTabs'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Kind = 'WEEKEND' | 'SEASON' | 'DATES' | 'DISTANCE'
type Rule = { id: string; label: string; kind: Kind; percent: number | null; date_from: string | null; date_to: string | null; active: boolean; per_km?: number | null; free_km?: number | null; base_place?: string | null }
const psb = () => (supabase.from as any)('price_surcharges')
const KIND_LABEL: Record<Kind, string> = { WEEKEND: 'Weekend (sab/dom)', SEASON: 'Stagione (ogni anno)', DATES: 'Date specifiche', DISTANCE: 'Trasferta (per km)' }
const num = (s: string) => Number(String(s).replace(',', '.'))

// Regole di MAGGIORAZIONE prezzo del professionista. Il compilatore le applica in automatico in base
// alla data dell'evento e le somma; compaiono come voce nel preventivo. Motore: price_surcharges.
export default function MaggiorazioniSettingsPage() {
  const { user } = useAuth()
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState<{ label: string; kind: Kind; percent: string; date_from: string; date_to: string; per_km: string; free_km: string; base_place: string }>({
    label: '', kind: 'WEEKEND', percent: '10', date_from: '', date_to: '', per_km: '0,50', free_km: '30', base_place: '',
  })

  async function load() {
    const { data } = await psb().select('id, label, kind, percent, date_from, date_to, active, per_km, free_km, base_place').order('created_at')
    setRules((data as Rule[]) ?? [])
    setLoading(false)
  }
  useEffect(() => { void load() }, [user?.id])

  async function add() {
    if (!form.label.trim()) return toast.error('Dai un nome alla regola')
    if (!user) return
    // TRASFERTA (per km)
    if (form.kind === 'DISTANCE') {
      const perKm = num(form.per_km), freeKm = num(form.free_km) || 0
      if (!(perKm > 0)) return toast.error('Imposta la tariffa €/km')
      if (!form.base_place.trim()) return toast.error('Indica il punto di partenza')
      setBusy(true)
      try {
        const { error } = await psb().insert({ fornitore_id: user.id, label: form.label.trim(), kind: 'DISTANCE', percent: null, per_km: perKm, free_km: freeKm, base_place: form.base_place.trim() })
        if (error) throw error
        setForm((f) => ({ ...f, label: '', percent: '10', date_from: '', date_to: '' }))
        await load(); toast.success('Regola aggiunta')
      } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
      return
    }
    // MAGGIORAZIONE % (data)
    const pct = num(form.percent)
    if (!(pct > 0 && pct <= 100)) return toast.error('Percentuale tra 0 e 100')
    if (form.kind !== 'WEEKEND' && (!form.date_from || !form.date_to)) return toast.error('Imposta il periodo (dal / al)')
    setBusy(true)
    try {
      const { error } = await psb().insert({
        fornitore_id: user.id, label: form.label.trim(), kind: form.kind, percent: pct,
        date_from: form.kind === 'WEEKEND' ? null : form.date_from,
        date_to: form.kind === 'WEEKEND' ? null : form.date_to,
      })
      if (error) throw error
      setForm((f) => ({ ...f, label: '', kind: 'WEEKEND', percent: '10', date_from: '', date_to: '' }))
      await load()
      toast.success('Regola aggiunta')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function toggle(r: Rule) {
    try { const { error } = await psb().update({ active: !r.active }).eq('id', r.id); if (error) throw error; await load() }
    catch (e) { toast.error((e as Error).message) }
  }
  async function del(id: string) {
    if (!window.confirm('Eliminare questa regola?')) return
    try { const { error } = await psb().delete().eq('id', id); if (error) throw error; await load() }
    catch (e) { toast.error((e as Error).message) }
  }

  const fmtRange = (r: Rule) => r.kind === 'DISTANCE' ? `Oltre ${r.free_km ?? 0} km gratuiti · da ${r.base_place ?? '—'}`
    : r.kind === 'WEEKEND' ? 'Ogni sabato e domenica'
    : `${r.date_from ? new Date(r.date_from).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '—'} → ${r.date_to ? new Date(r.date_to).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : '—'}${r.kind === 'SEASON' ? ' (ogni anno)' : ''}`

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <SettingsTabs />
      <PageHeader title="Maggiorazioni" description="Sovrapprezzi automatici: per data evento (weekend, alta stagione, date) e per trasferta (€/km dal tuo punto di partenza). Il preventivo li calcola e li mostra da solo." />

      <Card className="p-4 mb-4">
        <p className="text-sm font-medium mb-3 inline-flex items-center gap-2"><Plus size={15} /> Nuova regola</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[rgb(var(--fg-muted))]">Nome
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Es. Weekend / Alta stagione" className="mt-1" /></label>
          <label className="text-xs text-[rgb(var(--fg-muted))]">Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}
              className="mt-1 h-10 w-full px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))] text-sm">
              {(['WEEKEND', 'SEASON', 'DATES', 'DISTANCE'] as Kind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select></label>

          {form.kind === 'DISTANCE' ? (
            <>
              <label className="text-xs text-[rgb(var(--fg-muted))] sm:col-span-2">Punto di partenza (dove ti trovi)
                <Input value={form.base_place} onChange={(e) => setForm({ ...form, base_place: e.target.value })} placeholder="Es. Cosenza (CS)" className="mt-1" /></label>
              <label className="text-xs text-[rgb(var(--fg-muted))]">Km gratuiti
                <Input value={form.free_km} onChange={(e) => setForm({ ...form, free_km: e.target.value })} placeholder="30" className="mt-1" /></label>
              <label className="text-xs text-[rgb(var(--fg-muted))]">Tariffa €/km
                <Input value={form.per_km} onChange={(e) => setForm({ ...form, per_km: e.target.value })} placeholder="0,50" className="mt-1" /></label>
            </>
          ) : (
            <>
              <label className="text-xs text-[rgb(var(--fg-muted))]">Maggiorazione %
                <Input value={form.percent} onChange={(e) => setForm({ ...form, percent: e.target.value })} placeholder="10" className="mt-1" /></label>
              {form.kind !== 'WEEKEND' && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-[rgb(var(--fg-muted))]">Dal
                    <Input type="date" value={form.date_from} onChange={(e) => setForm({ ...form, date_from: e.target.value })} className="mt-1" /></label>
                  <label className="text-xs text-[rgb(var(--fg-muted))]">Al
                    <Input type="date" value={form.date_to} onChange={(e) => setForm({ ...form, date_to: e.target.value })} className="mt-1" /></label>
                </div>
              )}
            </>
          )}
        </div>
        {form.kind === 'SEASON' && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">Stagione: conta solo giorno e mese, vale ogni anno.</p>}
        {form.kind === 'DISTANCE' && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">Trasferta = (km − km gratuiti) × €/km. I km si inseriscono nel preventivo. Compare come voce trasferta.</p>}
        <Button variant="gold" size="sm" className="mt-3" onClick={() => void add()} disabled={busy}><Plus size={14} /> Aggiungi</Button>
      </Card>

      {loading ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">Carico…</p>
      ) : rules.length === 0 ? (
        <Card className="p-6 text-center text-sm text-[rgb(var(--fg-muted))]">Nessuna maggiorazione. Aggiungine una qui sopra.</Card>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <Card key={r.id} className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-[rgb(var(--bg-sunken))] p-2">
                {r.kind === 'DISTANCE' ? <Navigation size={16} /> : r.kind === 'WEEKEND' ? <CalendarClock size={16} /> : <CalendarRange size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{r.label} {r.kind === 'DISTANCE'
                  ? <span className="inline-flex items-center gap-0.5 text-[rgb(var(--gold-700))]">{r.per_km}€/km</span>
                  : <span className="inline-flex items-center gap-0.5 text-[rgb(var(--gold-700))]"><Percent size={11} />{r.percent}</span>}</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">{fmtRange(r)}</p>
              </div>
              <button onClick={() => void toggle(r)} className={`text-[11px] px-2 py-1 rounded-full font-medium ${r.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {r.active ? 'Attiva' : 'Sospesa'}
              </button>
              <button onClick={() => void del(r.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={15} /></button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
