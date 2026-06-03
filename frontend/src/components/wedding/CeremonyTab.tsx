import { useEffect, useMemo, useRef, useState } from 'react'
import { Church, Heart, Sparkles, Building2, Users as UsersIcon, MoreHorizontal, Save, Upload, Trash2, MapPin, CheckCircle2, Clock4, AlertCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useWedding, useUpdateWedding, useMood, useMoodMutations } from '@/hooks/useWedding'
import { ChangeRequestModal } from '@/components/wedding/ChangeRequestModal'
import { Lock } from 'lucide-react'

// Valore per <input type="datetime-local"> in ora LOCALE. Con toISOString() si
// otterrebbe l'ora UTC → in Italia (+1/+2) la cerimonia "tornava indietro" di 1-2h.
function toLocalInput(v: string | null | undefined): string {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

type CeremonyType = 'RELIGIOUS' | 'CIVIL' | 'SYMBOLIC' | 'ELOPEMENT' | 'MIXED' | 'OTHER'
type CeremonyStatus = 'TO_DEFINE' | 'EVALUATING' | 'REQUESTED' | 'BOOKED' | 'CANCELLED'

const TYPES: Array<{ v: CeremonyType; label: string; icon: typeof Church; hint: string }> = [
  { v: 'RELIGIOUS', label: 'Religioso',   icon: Church,       hint: 'Chiesa, sinagoga, moschea, tempio…' },
  { v: 'CIVIL',     label: 'Civile',       icon: Building2,    hint: 'Municipio, sala consiliare, location autorizzata' },
  { v: 'SYMBOLIC',  label: 'Simbolico',    icon: Sparkles,     hint: 'Celebrante laico, rito personale' },
  { v: 'ELOPEMENT', label: 'Elopement',    icon: Heart,        hint: 'Fuga d\'amore, pochi presenti, luogo intimo' },
  { v: 'MIXED',     label: 'Misto',        icon: UsersIcon,    hint: 'Religioso + civile insieme' },
  { v: 'OTHER',     label: 'Altro',        icon: MoreHorizontal, hint: 'Formato non standard' },
]

const STATUS_META: Record<CeremonyStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  TO_DEFINE:  { label: 'Da definire',     color: 'rgb(var(--fg-subtle))', icon: AlertCircle },
  EVALUATING: { label: 'In valutazione',  color: 'rgb(var(--amber-500))', icon: Clock4 },
  REQUESTED:  { label: 'Richiesta inviata', color: 'rgb(var(--gold-600))', icon: Clock4 },
  BOOKED:     { label: 'Prenotato',       color: 'rgb(34 197 94)',        icon: CheckCircle2 },
  CANCELLED:  { label: 'Annullato',       color: 'rgb(var(--rose-500))',  icon: XCircle },
}

const CEREMONY_TAG = 'cerimonia'

export function CeremonyTab({ entryId, readOnly = false }: { entryId: string; readOnly?: boolean }) {
  const { data: wedding } = useWedding(entryId)
  const update = useUpdateWedding(entryId)
  const { data: allImages } = useMood(entryId)
  const { add, remove } = useMoodMutations(entryId)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [form, setForm] = useState({
    ceremony_type: '' as CeremonyType | '',
    ceremony_status: 'TO_DEFINE' as CeremonyStatus,
    ceremony_venue_name: '',
    ceremony_venue_address: '',
    ceremony_city: '',
    ceremony_date: '',
    ceremony_contact_name: '',
    ceremony_contact_phone: '',
    ceremony_contact_email: '',
    ceremony_notes: '',
  })

  // Data evento "ufficiale" (stabilita dal preventivo accettato). La coppia
  // non puo` modificarla direttamente: deve richiedere modifica al WP.
  const eventDateOfficial: string | null = (wedding as any)?.date_from ?? (wedding as any)?.quote?.event_date ?? null

  useEffect(() => {
    if (!wedding) return
    const w = wedding as any
    setForm({
      ceremony_type:    w.ceremony_type ?? '',
      ceremony_status:  w.ceremony_status ?? 'TO_DEFINE',
      ceremony_venue_name: w.ceremony_venue_name ?? '',
      ceremony_venue_address: w.ceremony_venue_address ?? '',
      ceremony_city: w.ceremony_city ?? '',
      ceremony_date: toLocalInput(w.ceremony_date),
      ceremony_contact_name:  w.ceremony_contact_name ?? '',
      ceremony_contact_phone: w.ceremony_contact_phone ?? '',
      ceremony_contact_email: w.ceremony_contact_email ?? '',
      ceremony_notes: w.ceremony_notes ?? '',
    })
  }, [wedding])

  const photos = useMemo(
    () => (allImages ?? []).filter((m: any) => m.tag === CEREMONY_TAG),
    [allImages],
  )

  async function save() {
    try {
      await update.mutateAsync({
        ceremony_type:    form.ceremony_type || null,
        ceremony_status:  form.ceremony_status,
        ceremony_venue_name:    form.ceremony_venue_name || null,
        ceremony_venue_address: form.ceremony_venue_address || null,
        ceremony_city:          form.ceremony_city || null,
        ceremony_date:          form.ceremony_date ? new Date(form.ceremony_date).toISOString() : null,
        ceremony_contact_name:  form.ceremony_contact_name || null,
        ceremony_contact_phone: form.ceremony_contact_phone || null,
        ceremony_contact_email: form.ceremony_contact_email || null,
        ceremony_notes:         form.ceremony_notes || null,
      } as any)
      toast.success('Cerimonia aggiornata')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function uploadFiles(files: FileList) {
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name}: solo immagini`)
          continue
        }
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${entryId}/ceremony/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
        const { error: upErr } = await supabase.storage.from('wedding-photos').upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (upErr) { toast.error(`Upload ${file.name}: ${upErr.message}`); continue }
        const { data: pub } = supabase.storage.from('wedding-photos').getPublicUrl(path)
        await add.mutateAsync({
          url: pub.publicUrl,
          source: 'upload',
          tag: CEREMONY_TAG,
          caption: file.name.replace(/\.[^.]+$/, ''),
          ord: photos.length,
        } as any)
      }
      toast.success('Foto caricate')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function removePhoto(id: string, url: string) {
    if (!confirm('Eliminare questa foto?')) return
    try {
      // best-effort: rimuovi anche dallo Storage
      const m = url.match(/\/wedding-photos\/(.+)$/)
      if (m && m[1]) {
        try { await supabase.storage.from('wedding-photos').remove([m[1]]) } catch { /* ignore */ }
      }
      await remove.mutateAsync(id)
    } catch (e) { toast.error((e as Error).message) }
  }

  const StatusIcon = STATUS_META[form.ceremony_status].icon

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl">Cerimonia</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Tipo di rito, luogo della cerimonia, stato della prenotazione e foto di valutazione.
        </p>
      </header>

      {/* Tipo cerimonia */}
      <Card className="p-6">
        <h3 className="font-display text-lg mb-3">Tipo di rito</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TYPES.map((t) => {
            const Icon = t.icon
            const active = form.ceremony_type === t.v
            return (
              <button
                key={t.v}
                disabled={readOnly}
                onClick={() => setForm((f) => ({ ...f, ceremony_type: t.v }))}
                className={`text-left p-3 rounded-lg border-2 transition-colors ${
                  active
                    ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--bg-sunken))]'
                    : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Icon size={18} className="mb-1 text-[rgb(var(--gold-600))]" />
                <p className="font-medium text-sm">{t.label}</p>
                <p className="text-[10px] text-[rgb(var(--fg-muted))] mt-0.5">{t.hint}</p>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Luogo della cerimonia */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Luogo della cerimonia</h3>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ color: STATUS_META[form.ceremony_status].color, background: 'rgb(var(--bg-sunken))' }}>
            <StatusIcon size={12} />
            {STATUS_META[form.ceremony_status].label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1 md:col-span-2">
            <Label>Nome / titolo del luogo</Label>
            <Input
              disabled={readOnly}
              value={form.ceremony_venue_name}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_venue_name: e.target.value }))}
              placeholder="es. Chiesa di San Francesco di Paola"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Indirizzo</Label>
            <Input
              disabled={readOnly}
              value={form.ceremony_venue_address}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_venue_address: e.target.value }))}
              placeholder="Via, numero civico"
            />
          </div>
          <div className="space-y-1">
            <Label>Città</Label>
            <Input
              disabled={readOnly}
              value={form.ceremony_city}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_city: e.target.value }))}
              placeholder="es. Catanzaro"
            />
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5">
              Data e ora della cerimonia
              {readOnly && eventDateOfficial && <Lock size={11} className="text-[rgb(var(--fg-subtle))]" />}
            </Label>
            <Input
              type="datetime-local"
              disabled={readOnly}
              value={form.ceremony_date || toLocalInput(eventDateOfficial)}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_date: e.target.value }))}
            />
            {readOnly && (
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Stabilita dal preventivo.</p>
                <ChangeRequestModal
                  weddingId={entryId}
                  entityType="EVENT_DATE"
                  defaultAction="UPDATE"
                  prefillTitle="Richiesta modifica data evento/cerimonia"
                />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Stato prenotazione</Label>
            <Select
              disabled={readOnly}
              value={form.ceremony_status}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_status: e.target.value as CeremonyStatus }))}
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Riferimento (parroco, ufficiale di stato civile, celebrante…)</Label>
            <Input
              disabled={readOnly}
              value={form.ceremony_contact_name}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_contact_name: e.target.value }))}
              placeholder="es. Don Marco / Dott.ssa Rossi"
            />
          </div>
          <div className="space-y-1">
            <Label>Telefono referente</Label>
            <Input
              type="tel"
              disabled={readOnly}
              value={form.ceremony_contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_contact_phone: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Email referente</Label>
            <Input
              type="email"
              disabled={readOnly}
              value={form.ceremony_contact_email}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_contact_email: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Note (documenti necessari, scadenze, requisiti…)</Label>
            <Textarea
              rows={3}
              disabled={readOnly}
              value={form.ceremony_notes}
              onChange={(e) => setForm((f) => ({ ...f, ceremony_notes: e.target.value }))}
              placeholder="es. Servono certificati di battesimo e cresima entro 60gg prima."
            />
          </div>
        </div>

        {!readOnly && (
          <div className="flex justify-end mt-4">
            <Button variant="gold" onClick={save} disabled={update.isPending}>
              <Save size={14} /> {update.isPending ? 'Salvataggio…' : 'Salva cerimonia'}
            </Button>
          </div>
        )}
      </Card>

      {/* Foto di valutazione */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-lg">Foto del luogo</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              Carica foto del sopralluogo (chiesa, sala, location) per valutare insieme alla coppia.
            </p>
          </div>
          {!readOnly && (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/heic"
                className="hidden"
                onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
              />
              <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> {uploading ? 'Caricamento…' : 'Carica foto'}
              </Button>
            </>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-10 text-center"
               style={{ borderColor: 'rgb(var(--border))' }}>
            <MapPin className="mx-auto mb-2 text-[rgb(var(--fg-subtle))]" size={24} />
            <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna foto ancora.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p: any) => (
              <div key={p.id} className="relative group rounded-lg overflow-hidden border" style={{ borderColor: 'rgb(var(--border))' }}>
                <img src={p.url} alt={p.caption ?? ''} className="w-full aspect-square object-cover" />
                {p.caption && (
                  <p className="absolute bottom-0 left-0 right-0 px-2 py-1 text-[11px] truncate text-white"
                     style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.6), transparent)' }}>
                    {p.caption}
                  </p>
                )}
                {!readOnly && (
                  <button
                    onClick={() => void removePhoto(p.id, p.url)}
                    className="absolute top-1 right-1 inline-flex items-center justify-center h-7 w-7 rounded-md bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Rimuovi"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
