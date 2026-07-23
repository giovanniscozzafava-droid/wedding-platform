import { type FormEvent, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, X, Plus, Trash2, Sparkles, Link as LinkIcon, Loader2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useAddModifier, useCategories, useCreateService, useRemoveModifier, useUpdateService,
  useUploadPhoto, useDeletePhoto, useDeleteService, type ServiceWithExtras,
} from '@/hooks/useCatalog'
import { presetsFor, type ServicePreset } from '@/lib/service-presets'
import { CategoryPicker } from '@/components/catalog/CategoryPicker'
import type { Database } from '@/lib/database.types'

type Unit = Database['public']['Enums']['service_unit']
type ModType = Database['public']['Enums']['modifier_type']

type Props = {
  subrole: string | null
  service: ServiceWithExtras | null
  onClose: (saved: boolean) => void
}

export function ServiceForm({ subrole, service, onClose }: Props) {
  const create = useCreateService()
  const update = useUpdateService()
  const addMod = useAddModifier()
  const remMod = useRemoveModifier()
  const upPhoto = useUploadPhoto()
  const delPhoto = useDeletePhoto()
  const { data: cats } = useCategories(subrole)

  const [form, setForm] = useState({
    name: service?.name ?? '',
    description: service?.description ?? '',
    base_price: service?.base_price?.toString() ?? '',
    unit: (service?.unit ?? 'PEZZO') as Unit,
    category_id: service?.category_id ?? '',
    is_active: service?.is_active ?? true,
    tags: ((service as { tags?: string[] } | null)?.tags ?? []).join(', '),
  })
  const [busy, setBusy] = useState(false)
  const [photoProg, setPhotoProg] = useState<{ done: number; total: number; name?: string; pct?: number } | null>(null)
  const [savedId, setSavedId] = useState<string | null>(service?.id ?? null)
  const [newMod, setNewMod] = useState({ name: '', type: 'PERCENT' as ModType, value: '', date_from: '', date_to: '' })
  // Foto tracciate localmente: la prop `service` non si aggiorna dopo la creazione,
  // quindi la griglia mostrerebbe "Nessuna foto" anche dopo l'upload. Con questo stato
  // le foto appena aggiunte compaiono subito e il gate "foto obbligatoria" è coerente.
  const [localPhotos, setLocalPhotos] = useState<{ id: string; thumbnail_url: string }[]>(
    (service?.service_photos ?? []).map((p) => ({ id: p.id, thumbnail_url: p.thumbnail_url })),
  )
  const photoCount = localPhotos.length
  // La foto è obbligatoria solo in CREAZIONE: modificando un servizio legacy senza foto
  // non blocchiamo (e non offriamo "elimina", che cancellerebbe un servizio reale).
  const isNew = service === null
  const delService = useDeleteService()
  const photoSectionRef = useRef<HTMLDivElement | null>(null)

  // Auto-suggerimento categoria dal titolo: niente più default su cats[0]
  // (che sceglieva una categoria a caso). Se il titolo combacia con una
  // categoria e nessuna è ancora scelta, la impostiamo automaticamente.
  useEffect(() => {
    if (form.category_id || !cats?.length) return
    const n = form.name.trim().toLowerCase()
    if (n.length < 3) return
    let best: { id: string; name: string } | null = null
    let bestLen = 0
    for (const c of cats) {
      const cn = c.name.toLowerCase()
      if (n.includes(cn) || cn.includes(n)) {
        const len = Math.min(cn.length, n.length)
        if (len > bestLen) { best = c; bestLen = len }
      }
    }
    if (best) setForm((f) => ({ ...f, category_id: best!.id }))
  }, [cats, form.category_id, form.name])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      if (!form.category_id) throw new Error('Scegli una categoria per il servizio (campo “Categoria” qui sopra).')
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        base_price: Number(form.base_price),
        unit: form.unit,
        category_id: form.category_id,
        is_active: form.is_active,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      } as any
      if (Number.isNaN(payload.base_price) || payload.base_price < 0) {
        throw new Error('Prezzo non valido')
      }
      if (savedId) {
        await update.mutateAsync({ id: savedId, patch: payload })
        toast.success('Servizio aggiornato')
      } else {
        const created = await create.mutateAsync(payload)
        setSavedId(created.id)
        toast.success('Servizio creato — ora aggiungi una foto (obbligatoria)')
        setTimeout(() => photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
        // Onboarding: marca first_offer_created sul profilo
        const { data: me } = await supabase.auth.getUser()
        if (me.user) {
          const { data: prof } = await supabase.from('profiles').select('tutorial_state').eq('id', me.user.id).single()
          const state = (prof?.tutorial_state ?? {}) as Record<string, unknown>
          if (!state.first_offer_created) {
            await supabase.from('profiles').update({
              tutorial_state: { ...state, first_offer_created: true },
            }).eq('id', me.user.id)
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddMod() {
    if (!savedId || !newMod.name.trim()) return
    try {
      await addMod.mutateAsync({
        service_id: savedId, name: newMod.name.trim(),
        modifier_type: newMod.type, value: Number(newMod.value || 0),
        date_from: newMod.date_from || null, date_to: newMod.date_to || newMod.date_from || null,
      } as any)
      setNewMod({ name: '', type: 'PERCENT', value: '', date_from: '', date_to: '' })
      toast.success('Modificatore aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  const [importUrl, setImportUrl] = useState('')
  const [importing, setImporting] = useState(false)

  async function handleImportUrl() {
    if (!savedId) { toast.error('Salva prima il servizio'); return }
    const url = importUrl.trim()
    if (!url || !/^https?:\/\//.test(url)) { toast.error('Incolla un URL valido (Instagram, Pinterest, qualsiasi blog)'); return }
    setImporting(true)
    try {
      // 1. Estrai og:image + scarica byte lato server (bypass CORS browser)
      const { data: meta, error } = await supabase.functions.invoke('import-pin-url', { body: { url, fetch_image: true } })
      if (error) {
        // La funzione mette un messaggio utile nel body JSON (es. "Instagram blocca
        // l'estrazione, salva la foto e usa Carica file"). Lo recuperiamo dal Response
        // invece di mostrare il generico "Edge Function returned a non-2xx status code".
        let msg = (error as { message?: string }).message || 'Import non riuscito'
        try { const body = await ((error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.()); if (body?.error) msg = body.error } catch { /* ignore */ }
        throw new Error(msg)
      }
      const m = meta as any
      if (!m?.image) throw new Error('Nessuna immagine trovata in quella pagina')

      // 2. Ricostruisci Blob da base64 (il server l'ha gia scaricato per noi)
      if (!m.image_base64) {
        const ig = /instagram\./i.test(url)
        throw new Error(
          ig
            ? 'Instagram blocca il download di questa foto. Apri il post, scarica la foto sul dispositivo e caricala con «Carica file». È l\'unica soluzione affidabile.'
            : 'Impossibile scaricare l\'immagine dalla pagina. Scarica la foto sul dispositivo e caricala con «Carica file».'
        )
      }
      const ct = m.image_content_type ?? 'image/jpeg'
      const bin = atob(m.image_base64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
      const file = new File([arr], `import-${Date.now()}.${ext}`, { type: ct })

      // 3. Riutilizza useUploadPhoto (resize browser-side WebP + upload bucket + insert riga)
      const r = await upPhoto.mutateAsync({ serviceId: savedId, file })
      setLocalPhotos((ps) => [...ps, { id: r.photo.id, thumbnail_url: r.photo.thumbnail_url }])
      toast.success('Foto importata')
      setImportUrl('')
    } catch (e) { toast.error((e as Error).message) }
    finally { setImporting(false) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const imgs = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (imgs.length === 0 || !savedId) return
    setPhotoProg({ done: 0, total: imgs.length, name: imgs[0]!.name })
    let ok = 0
    for (let i = 0; i < imgs.length; i++) {
      const f = imgs[i]!
      setPhotoProg({ done: i, total: imgs.length, name: f.name, pct: 0 })
      try {
        const r = await upPhoto.mutateAsync({ serviceId: savedId, file: f, onProgress: (pct) => setPhotoProg((p) => (p ? { ...p, pct } : p)) })
        setLocalPhotos((ps) => [...ps, { id: r.photo.id, thumbnail_url: r.photo.thumbnail_url }])
        ok++
      }
      catch (err) { toast.error(`«${f.name}»: ${err instanceof Error ? err.message : 'Upload fallito'}`) }
    }
    setPhotoProg(null)
    if (ok) toast.success(ok === 1 ? 'Foto caricata' : `${ok} foto caricate`)
    e.target.value = ''
  }

  // Foto obbligatoria: un servizio senza foto non è utile al cliente. Se provano a
  // chiudere senza foto, non chiudo — li porto alla sezione foto (upload o link).
  function requestClose() {
    if (isNew && savedId && photoCount === 0) {
      toast.error('Aggiungi almeno una foto: carica un file o incolla un link Instagram/Pinterest. È obbligatoria.')
      photoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    onClose(!!savedId)
  }
  // Via di fuga senza restare intrappolati: elimina il servizio appena creato ed esci.
  async function deleteAndClose() {
    if (!savedId) { onClose(false); return }
    try {
      await delService.mutateAsync(savedId)
      toast.success('Servizio eliminato')
      onClose(false)
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={requestClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          className="relative w-full max-w-2xl max-h-[90vh] surface surface-lift overflow-hidden flex flex-col">
          <header className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <div>
              <h2 className="font-display text-xl">{savedId ? 'Modifica servizio' : 'Nuovo servizio'}</h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">{savedId ? 'Aggiorna i dettagli' : 'Compila i campi base, poi aggiungi modificatori e foto'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={requestClose} data-testid="close-modal">
              <X size={18} />
            </Button>
          </header>

          <div className="overflow-y-auto px-6 py-5 space-y-6">
            {!savedId && presetsFor(subrole).length > 0 && (
              <div className="rounded-xl p-4 border" style={{ borderColor: 'rgb(var(--gold-500))', background: 'rgb(var(--bg-sunken))' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-[rgb(var(--gold-600))]" />
                  <p className="text-sm font-medium">Servizi rapidi per {subrole}</p>
                </div>
                <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
                  Clicca un preset per compilare automaticamente i campi. Puoi modificare tutto prima di salvare.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {presetsFor(subrole).map((p: ServicePreset) => (
                    <button key={p.name} type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          name: p.name,
                          description: p.description,
                          base_price: p.base_price.toString(),
                          unit: p.unit,
                        }))
                      }}
                      className="rounded-full px-2.5 py-1 text-xs font-medium border bg-[rgb(var(--bg-elev))] hover:bg-[rgb(var(--gold-500))] hover:text-[rgb(var(--bg))] hover:border-transparent transition-colors"
                      style={{ borderColor: 'rgb(var(--border))' }}
                      title={`€ ${p.base_price} / ${p.unit.toLowerCase()}`}>
                      {p.name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-2.5">
                  Oppure compila i campi qui sotto da zero per un servizio personalizzato.
                </p>
              </div>
            )}
            <form onSubmit={handleSave} className="space-y-4" data-testid="service-form">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Sii specifico: cosa offri + un dettaglio chiave. Es. “Servizio fotografico full day · 12 ore” anziché solo “Foto”. Più è chiaro, più ti trovano.</p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cat">Categoria</Label>
                  {(cats?.length ?? 0) <= 1 ? (
                    // Specializzazione unica già dichiarata all'iscrizione: non la
                    // richiediamo di nuovo, la mostriamo solo come riferimento.
                    <div id="cat" className="h-10 px-3 flex items-center rounded-lg border text-sm text-[rgb(var(--fg-muted))]"
                      style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
                      {cats?.[0]?.name ?? subrole ?? 'La tua specializzazione'}
                    </div>
                  ) : (
                    <CategoryPicker
                      cats={(cats ?? []) as { id: string; name: string; subrole?: string | null }[]}
                      value={form.category_id}
                      onChange={(id) => setForm((f) => ({ ...f, category_id: id }))}
                      nameHint={form.name}
                    />
                  )}
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))]">È così che il servizio viene raggruppato e cercato nella rete: scegli la categoria che un cliente userebbe per cercarlo.</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea id="description" rows={3}
                  value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Spiega cosa è incluso e cosa no, per chi è adatto, durata e numero di persone, eventuali trasferte. Frasi brevi: aiuta il cliente a capire e a confrontare.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="tags">Tag di ricerca</Label>
                <Input id="tags" value={form.tags} placeholder="es. noleggio, pedana, allestimento, palco"
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Parole chiave separate da virgola. Aiutano a trovare questo servizio in Catalogo e in Scopri.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="price">Prezzo (€)</Label>
                  <Input id="price" type="number" min="0" step="0.01" required value={form.base_price}
                    onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit">Unità</Label>
                  <Select id="unit" value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Unit }))}>
                    <option value="PEZZO">Pezzo</option>
                    <option value="PERSONA">Persona</option>
                    <option value="ORA">Ora</option>
                    <option value="EVENTO">Evento</option>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm self-end pb-2.5">
                  <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                    checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                  Attivo
                </label>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? 'Salvataggio...' : savedId ? 'Aggiorna' : 'Crea'}
                </Button>
              </div>
            </form>

            {!savedId && (
              <div className="border-t pt-5 mt-4" style={{ borderColor: 'rgb(var(--border))' }}>
                <div className="rounded-lg p-4 text-sm" style={{ background: 'rgb(var(--bg-sunken))', border: '1px dashed rgb(var(--border-strong))' }}>
                  <p className="font-medium mb-1">Foto e modificatori di prezzo</p>
                  <p className="text-[rgb(var(--fg-muted))] text-xs leading-relaxed">
                    Compila i campi qui sopra e clicca <strong>"Salva"</strong>. Subito dopo apparirà la sezione per caricare fino a <strong>10 foto</strong> e aggiungere modificatori di prezzo (sconti / supplementi).
                  </p>
                </div>
              </div>
            )}

            {savedId && (
              <>
                <div className="border-t pt-5" style={{ borderColor: 'rgb(var(--border))' }}>
                  <h3 className="font-medium text-sm mb-1">Modificatori prezzo</h3>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] mb-3">Variazioni opzionali sul prezzo base (in % o in €): es. supplemento weekend, alta stagione, urgenza, oppure sconti.</p>
                  <ul className="space-y-2 mb-4">
                    {(service?.service_modifiers ?? []).map((m) => (
                      <li key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">
                            {m.modifier_type === 'PERCENT' ? `${m.value}%` : `€ ${m.value}`}
                            {(m as { date_from?: string | null }).date_from && (
                              <> · solo dal {new Date((m as { date_from?: string }).date_from!).toLocaleDateString('it-IT')} al {new Date(((m as { date_to?: string; date_from?: string }).date_to ?? (m as { date_from?: string }).date_from)!).toLocaleDateString('it-IT')}</>
                            )}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remMod.mutate(m.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-12 gap-2">
                    <Input className="col-span-6" placeholder="Es. Supplemento weekend" value={newMod.name}
                      onChange={(e) => setNewMod((m) => ({ ...m, name: e.target.value }))} />
                    <Select className="col-span-3" value={newMod.type}
                      onChange={(e) => setNewMod((m) => ({ ...m, type: e.target.value as ModType }))}>
                      <option value="PERCENT">%</option>
                      <option value="FIXED">€ fisso</option>
                    </Select>
                    <Input className="col-span-2" type="number" step="0.01" placeholder="Valore" value={newMod.value}
                      onChange={(e) => setNewMod((m) => ({ ...m, value: e.target.value }))} />
                    <Button type="button" variant="outline" size="icon" className="col-span-1" onClick={handleAddMod}>
                      <Plus size={16} />
                    </Button>
                    <div className="col-span-12 flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--fg-muted))]">
                      <span>Solo in un periodo (facoltativo): se la data dell’evento cade qui, il supplemento entra da solo nel preventivo.</span>
                      <Input type="date" className="h-8 w-auto" value={newMod.date_from} onChange={(e) => setNewMod((m) => ({ ...m, date_from: e.target.value }))} />
                      <span>→</span>
                      <Input type="date" className="h-8 w-auto" value={newMod.date_to} onChange={(e) => setNewMod((m) => ({ ...m, date_to: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div ref={photoSectionRef} className="border-t pt-5" style={{ borderColor: 'rgb(var(--border))' }}>
                  {isNew && photoCount === 0 && (
                    <div className="mb-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs"
                      style={{ background: 'rgb(var(--amber-100))', color: 'rgb(var(--amber-800))' }}>
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span><strong>Foto obbligatoria.</strong> Aggiungi almeno una foto del servizio: <strong>carica un file</strong> oppure <strong>incolla un link Instagram/Pinterest</strong> qui sotto. Senza foto il servizio non è utile al cliente.</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="font-medium text-sm">Foto (max 10) <span style={{ color: 'rgb(var(--rose-500))' }}>*</span></h3>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors border"
                      style={{ borderColor: 'rgb(var(--border-strong))' }}>
                      <Plus size={14} /> Carica file
                      <input type="file" className="hidden" accept="image/*,.heic,.heif" multiple
                        onChange={handleFile} data-testid="photo-upload" />
                    </label>
                  </div>
                  {photoProg && (() => {
                    const overall = Math.min(100, Math.round(((photoProg.done + (photoProg.pct ?? 0) / 100) / photoProg.total) * 100))
                    return (
                      <div className="mb-3">
                        <div className="flex justify-between items-center text-[11px] text-[rgb(var(--fg-muted))] mb-1">
                          <span className="truncate pr-2">{photoProg.name ? `Carico «${photoProg.name}»` : 'Caricamento…'}{photoProg.total > 1 ? ` (${Math.min(photoProg.done + 1, photoProg.total)}/${photoProg.total})` : ''}</span>
                          <span className="tabular-nums shrink-0 font-medium text-[rgb(var(--fg))]">{overall}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
                          <div className="h-full bg-[rgb(var(--gold-500))] transition-all duration-150" style={{ width: `${overall}%` }} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Import da URL Instagram/Pinterest/blog */}
                  <div className="rounded-lg border-2 border-dashed p-3 mb-3"
                    style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <LinkIcon size={13} className="text-[rgb(var(--gold-600))]" />
                      <p className="text-xs font-medium">Oppure incolla URL da Instagram, Pinterest, blog</p>
                    </div>
                    <div className="flex gap-2">
                      <Input value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="https://www.instagram.com/p/..."
                        className="flex-1 text-xs h-8"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleImportUrl() } }} />
                      <Button type="button" variant="outline" size="sm" onClick={handleImportUrl} disabled={importing || !importUrl.trim()}>
                        {importing ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        {importing ? 'Importo' : 'Importa'}
                      </Button>
                    </div>
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1.5">
                      Estraggo l'immagine principale del post. Funziona bene su Pinterest, blog, news, articoli.
                    </p>
                    {/^https?:\/\/(www\.)?instagram\./i.test(importUrl) && (
                      <p className="text-[10px] mt-1.5 px-2 py-1.5 rounded-md" style={{ background: 'rgb(var(--amber-100))', color: 'rgb(var(--amber-800))' }}>
                        <strong>Instagram blocca spesso il download delle foto.</strong> Se l'import non riesce, apri il post su Instagram, <strong>scarica la foto</strong> (tieni premuto / salva immagine) e caricala con <strong>«Carica file»</strong> qui sopra. È l'unica soluzione affidabile.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {localPhotos.map((p) => (
                      <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group bg-[rgb(var(--bg-sunken))]">
                        <img src={p.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <button type="button" onClick={() => { delPhoto.mutate(p.id); setLocalPhotos((ps) => ps.filter((x) => x.id !== p.id)) }}
                          className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {photoCount === 0 && (
                      <div className="col-span-4 rounded-lg border border-dashed py-8 text-center" style={{ borderColor: 'rgb(var(--border))' }}>
                        <ImageIcon size={20} className="mx-auto text-[rgb(var(--fg-subtle))]" />
                        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">Nessuna foto ancora</p>
                      </div>
                    )}
                  </div>
                  {isNew && photoCount === 0 && (
                    <button type="button" onClick={deleteAndClose}
                      className="mt-3 text-[11px] text-[rgb(var(--fg-subtle))] underline hover:text-[rgb(var(--rose-500))]">
                      Non voglio aggiungere una foto ora: elimina il servizio ed esci
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
