import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Check, Lock } from 'lucide-react'
import { eventTerm } from '@/lib/eventKind'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

// RANGE DI SELEZIONE (min/max foto) + SCADENZA + CHIUDI/RIAPRI: il fotografo decide quante foto
// la coppia deve scegliere per l'album (default per tipo evento), la data massima (avvisi email) e
// può chiudere/riaprire la selezione. Salvato per QUESTA galleria. La coppia vede il traguardo
// min–max e può confermare solo dentro il range. Estratto da EventGalleryTab per poterlo
// incorporare anche nel pannello Impostazioni galleria (stesso galleryId, stesso pubblico owner).
export function SelectionRangeControl({ galleryId }: { galleryId: string }) {
  const [min, setMin] = useState<number | ''>('')
  const [max, setMax] = useState<number | ''>('')
  const [kind, setKind] = useState('matrimonio')
  const [deadline, setDeadline] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [reopenReq, setReopenReq] = useState(false)   // la coppia ha chiesto di riaprire
  const [reopening, setReopening] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  useEffect(() => {
    let alive = true
    void (async () => {
      const { data } = await (supabase.rpc as any)('gallery_get_range', { p_gallery: galleryId })
      if (!alive) return
      const d = data as { min?: number; max?: number; event_kind?: string; submitted?: boolean; deadline?: string | null; reopen_requested?: boolean; error?: string } | null
      if (d && !d.error && typeof d.min === 'number') { setMin(d.min); setMax(d.max ?? d.min); setKind(d.event_kind ?? 'matrimonio'); setSubmitted(!!d.submitted); setDeadline(d.deadline ?? ''); setReopenReq(!!d.reopen_requested) }
      setLoaded(true)
    })()
    return () => { alive = false }
  }, [galleryId])
  async function save() {
    const mn = Number(min), mx = Number(max)
    if (!mn || !mx || mn < 1 || mx < mn) { toast.error('Controlla i numeri: minimo ≥ 1 e massimo ≥ minimo.'); return }
    setSaving(true)
    try {
      const { data, error } = await (supabase.rpc as any)('gallery_set_range', { p_gallery: galleryId, p_min: mn, p_max: mx })
      const err = (data as { error?: string } | null)?.error
      if (error || err) throw new Error(err ?? error?.message ?? 'errore')
      toast.success(`Traguardo salvato: ${mn}–${mx} foto · default per «${eventTerm(kind).label}»`)
    } catch (e) { toast.error(`Non salvato: ${(e as Error).message}`) } finally { setSaving(false) }
  }
  async function saveDeadline(val: string) {
    setDeadline(val)
    const { data, error } = await (supabase.rpc as any)('gallery_set_deadline', { p_gallery: galleryId, p_deadline: val || null })
    const err = (data as { error?: string } | null)?.error
    if (error || err) { toast.error(`Data non salvata: ${err ?? error?.message}`); return }
    toast.success(val ? `Data massima: ${new Date(val + 'T00:00:00').toLocaleDateString('it-IT')} · avvisi email attivi` : 'Data massima rimossa')
  }
  async function forceClose() {
    if (!window.confirm('Chiudere ORA la selezione con le foto attualmente tenute dalla coppia (anche se fuori dal range)? Diventeranno le scelte definitive e la coppia non potrà più modificarle.')) return
    setClosing(true)
    try {
      const { data, error } = await (supabase.rpc as any)('gallery_force_close', { p_gallery: galleryId })
      const err = (data as { error?: string } | null)?.error
      if (error || err) throw new Error(err ?? error?.message ?? 'errore')
      const kept = (data as { kept?: number } | null)?.kept
      setSubmitted(true)
      toast.success(`Selezione chiusa${typeof kept === 'number' ? ` · ${kept} foto scelte` : ''}`)
    } catch (e) { toast.error(`Non chiusa: ${(e as Error).message}`) } finally { setClosing(false) }
  }
  // RIAPRI: nuovo giro sulle tenute correnti → la coppia riprende a scremare da dov'era.
  async function reopen() {
    setReopening(true)
    try {
      const { data, error } = await (supabase.rpc as any)('gallery_selection_reopen', { p_gallery: galleryId })
      const err = (data as { error?: string } | null)?.error
      if (error || err) throw new Error(err ?? error?.message ?? 'errore')
      setSubmitted(false); setReopenReq(false)
      toast.success('Selezione riaperta · la coppia può continuare a scremare')
    } catch (e) { toast.error(`Non riaperta: ${(e as Error).message}`) } finally { setReopening(false) }
  }
  if (!loaded) return null
  return (
    <div className="w-full mt-1 border-t border-[rgb(var(--border))] pt-3 space-y-3">
      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--fg))]"><Check size={13} className="text-[rgb(var(--gold-600))]" /> Quante foto devono scegliere</p>
        <p className="mt-0.5 text-[11px] text-[rgb(var(--fg-muted))]">Alla coppia mostriamo il traguardo: possono confermare la selezione solo tra il <b>minimo</b> e il <b>massimo</b>. Diventa il default per gli eventi «{eventTerm(kind).label}».</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Minimo<Input type="number" min={1} value={min} onChange={(e) => setMin(e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value))))} className="mt-0.5 w-20" /></label>
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Massimo<Input type="number" min={1} value={max} onChange={(e) => setMax(e.target.value === '' ? '' : Math.max(1, Math.floor(Number(e.target.value))))} className="mt-0.5 w-20" /></label>
          <Button variant="outline" size="sm" disabled={saving} onClick={() => void save()}><Check size={14} /> {saving ? 'Salvo…' : 'Salva traguardo'}</Button>
        </div>
      </div>
      <div className="border-t border-[rgb(var(--border))] pt-3">
        <p className="text-xs font-medium text-[rgb(var(--fg))]">Scadenza e chiusura</p>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Data massima selezione<Input type="date" value={deadline} onChange={(e) => void saveDeadline(e.target.value)} className="mt-0.5" /></label>
          {!submitted
            ? <Button variant="outline" size="sm" disabled={closing} onClick={() => void forceClose()}><Lock size={14} /> {closing ? 'Chiudo…' : 'Chiudi selezione ora'}</Button>
            : <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] text-[rgb(var(--emerald-600))]">Selezione chiusa.</span>
                <Button variant="outline" size="sm" disabled={reopening} onClick={() => void reopen()}>{reopening ? 'Riapro…' : 'Riapri la selezione'}</Button>
                {reopenReq && <span className="text-[10px] font-medium text-[rgb(var(--gold-700))]">· la coppia ha chiesto di riaprire</span>}
              </div>}
        </div>
        <p className="mt-1.5 text-[10px] text-[rgb(var(--fg-subtle))]">Con una data massima partono gli <b>avvisi email</b> alla coppia (7/3/1 giorni prima, il giorno stesso e se scade). <b>Chiudi selezione ora</b> blocca la selezione con le foto attuali, anche se la coppia è ancora fuori dal range.</p>
      </div>
    </div>
  )
}
