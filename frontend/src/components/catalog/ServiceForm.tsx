import { type FormEvent, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Image as ImageIcon, X, Plus, Trash2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  useAddModifier, useCategories, useCreateService, useRemoveModifier, useUpdateService,
  useUploadPhoto, useDeletePhoto, type ServiceWithExtras,
} from '@/hooks/useCatalog'
import { presetsFor, type ServicePreset } from '@/lib/service-presets'
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
  })
  const [busy, setBusy] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(service?.id ?? null)
  const [newMod, setNewMod] = useState({ name: '', type: 'PERCENT' as ModType, value: '' })

  useEffect(() => {
    if (!form.category_id && cats?.length) {
      setForm((f) => ({ ...f, category_id: cats[0]!.id }))
    }
  }, [cats, form.category_id])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        base_price: Number(form.base_price),
        unit: form.unit,
        category_id: form.category_id,
        is_active: form.is_active,
      }
      if (Number.isNaN(payload.base_price) || payload.base_price < 0) {
        throw new Error('Prezzo non valido')
      }
      if (savedId) {
        await update.mutateAsync({ id: savedId, patch: payload })
        toast.success('Servizio aggiornato')
      } else {
        const created = await create.mutateAsync(payload)
        setSavedId(created.id)
        toast.success('Servizio creato')
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
      })
      setNewMod({ name: '', type: 'PERCENT', value: '' })
      toast.success('Modificatore aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !savedId) return
    try {
      await upPhoto.mutateAsync({ serviceId: savedId, file: f })
      toast.success('Foto caricata')
      e.target.value = ''
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload fallito')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        role="dialog">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onClose(!!savedId)} />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          className="relative w-full max-w-2xl max-h-[90vh] surface surface-lift overflow-hidden flex flex-col">
          <header className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <div>
              <h2 className="font-display text-xl">{savedId ? 'Modifica servizio' : 'Nuovo servizio'}</h2>
              <p className="text-xs text-[rgb(var(--fg-subtle))]">{savedId ? 'Aggiorna i dettagli' : 'Compila i campi base, poi aggiungi modificatori e foto'}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onClose(!!savedId)} data-testid="close-modal">
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
                </div>
                <div className="space-y-1">
                  <Label htmlFor="cat">Categoria</Label>
                  <Select id="cat" value={form.category_id} required
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                    {(cats ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea id="description" rows={3}
                  value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
                  <p className="font-medium mb-1">📸 Foto e modificatori di prezzo</p>
                  <p className="text-[rgb(var(--fg-muted))] text-xs leading-relaxed">
                    Compila i campi qui sopra e clicca <strong>"Salva"</strong>. Subito dopo apparirà la sezione per caricare fino a <strong>10 foto</strong> e aggiungere modificatori di prezzo (sconti / supplementi).
                  </p>
                </div>
              </div>
            )}

            {savedId && (
              <>
                <div className="border-t pt-5" style={{ borderColor: 'rgb(var(--border))' }}>
                  <h3 className="font-medium text-sm mb-3">Modificatori prezzo</h3>
                  <ul className="space-y-2 mb-4">
                    {(service?.service_modifiers ?? []).map((m) => (
                      <li key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">
                            {m.modifier_type === 'PERCENT' ? `${m.value}%` : `€ ${m.value}`}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remMod.mutate(m.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="grid grid-cols-12 gap-2">
                    <Input className="col-span-6" placeholder="Es. Tema bianco" value={newMod.name}
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
                  </div>
                </div>

                <div className="border-t pt-5" style={{ borderColor: 'rgb(var(--border))' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm">Foto (max 10)</h3>
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors border"
                      style={{ borderColor: 'rgb(var(--border-strong))' }}>
                      <Plus size={14} /> Carica
                      <input type="file" className="hidden" accept="image/*,.heic,.heif"
                        onChange={handleFile} data-testid="photo-upload" />
                    </label>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(service?.service_photos ?? []).map((p) => (
                      <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden group bg-[rgb(var(--bg-sunken))]">
                        <img src={p.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <button type="button" onClick={() => delPhoto.mutate(p.id)}
                          className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {(service?.service_photos ?? []).length === 0 && (
                      <div className="col-span-4 rounded-lg border border-dashed py-8 text-center" style={{ borderColor: 'rgb(var(--border))' }}>
                        <ImageIcon size={20} className="mx-auto text-[rgb(var(--fg-subtle))]" />
                        <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">Nessuna foto ancora</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
