import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddModifier, useCategories, useCreateService, useRemoveModifier, useUpdateService, useUploadPhoto, useDeletePhoto, type ServiceWithExtras } from '@/hooks/useCatalog'
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
  const [error, setError] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(service?.id ?? null)
  const [newMod, setNewMod] = useState({ name: '', type: 'PERCENT' as ModType, value: '' })

  useEffect(() => {
    if (!form.category_id && cats?.length) {
      setForm((f) => ({ ...f, category_id: cats[0]!.id }))
    }
  }, [cats, form.category_id])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
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
      } else {
        const created = await create.mutateAsync(payload)
        setSavedId(created.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddMod() {
    if (!savedId || !newMod.name.trim()) return
    await addMod.mutateAsync({
      service_id: savedId,
      name: newMod.name.trim(),
      modifier_type: newMod.type,
      value: Number(newMod.value || 0),
    })
    setNewMod({ name: '', type: 'PERCENT', value: '' })
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !savedId) return
    try {
      await upPhoto.mutateAsync({ serviceId: savedId, file: f })
      e.target.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload fallito')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{savedId ? 'Modifica servizio' : 'Nuovo servizio'}</h2>
          <Button variant="ghost" onClick={() => onClose(!!savedId)} data-testid="close-modal">Chiudi</Button>
        </div>
        <div className="p-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-4" data-testid="service-form">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <textarea id="description" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm" rows={3}
                value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="price">Prezzo (€)</Label>
                <Input id="price" type="number" min="0" step="0.01" required value={form.base_price}
                  onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unità</Label>
                <select id="unit" value={form.unit}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as Unit }))}>
                  <option value="PEZZO">Pezzo</option>
                  <option value="PERSONA">Persona</option>
                  <option value="ORA">Ora</option>
                  <option value="EVENTO">Evento</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat">Categoria</Label>
                <select id="cat" value={form.category_id} required
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
                  {(cats ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Servizio attivo
            </label>
            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
            <Button type="submit" disabled={busy}>{busy ? 'Salvataggio...' : savedId ? 'Aggiorna' : 'Crea'}</Button>
          </form>

          {savedId && (
            <>
              <hr />
              <div className="space-y-3">
                <h3 className="font-medium">Modificatori</h3>
                <ul className="space-y-1 text-sm">
                  {(service?.service_modifiers ?? []).map((m) => (
                    <li key={m.id} className="flex justify-between border border-slate-200 rounded px-3 py-2">
                      <span>{m.name} ({m.modifier_type === 'PERCENT' ? `${m.value}%` : `€ ${m.value}`})</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remMod.mutate(m.id)}>×</Button>
                    </li>
                  ))}
                </ul>
                <div className="grid grid-cols-4 gap-2">
                  <Input placeholder="Nome modificatore" value={newMod.name}
                    onChange={(e) => setNewMod((m) => ({ ...m, name: e.target.value }))} />
                  <select className="rounded-md border border-slate-200 px-2 text-sm" value={newMod.type}
                    onChange={(e) => setNewMod((m) => ({ ...m, type: e.target.value as ModType }))}>
                    <option value="PERCENT">%</option>
                    <option value="FIXED">€ fisso</option>
                  </select>
                  <Input type="number" step="0.01" placeholder="Valore" value={newMod.value}
                    onChange={(e) => setNewMod((m) => ({ ...m, value: e.target.value }))} />
                  <Button type="button" onClick={handleAddMod}>+ Aggiungi</Button>
                </div>
              </div>

              <hr />
              <div className="space-y-3">
                <h3 className="font-medium">Foto (max 10)</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(service?.service_photos ?? []).map((p) => (
                    <div key={p.id} className="relative">
                      <img src={p.thumbnail_url} alt="" className="w-full h-24 object-cover rounded-md" />
                      <Button type="button" variant="destructive" size="sm" className="absolute top-1 right-1"
                        onClick={() => delPhoto.mutate(p.id)}>×</Button>
                    </div>
                  ))}
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} data-testid="photo-upload" />
                {upPhoto.isPending && <p className="text-sm text-slate-500">Caricamento in corso...</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
