import { X, Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { ModelOptions, ModelOption } from '@/hooks/useAlbumCatalog'

// Editor delle OPZIONI di un modello (definite dal fotografo): materiali, colori, logo/personalizzazione
// — ognuno con sovrapprezzo — + foto in copertina. Le opzioni si sommano nel prezzo lato coppia.
const norm = (o: ModelOptions | null | undefined): Required<Pick<ModelOptions, 'materials' | 'colors' | 'logos'>> & ModelOptions => ({
  materials: o?.materials ?? [], colors: o?.colors ?? [], logos: o?.logos ?? [],
  coverPhoto: o?.coverPhoto ?? false, coverPhotoSurcharge: o?.coverPhotoSurcharge ?? 0,
})
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'opt'

function Group({ title, hint, items, onChange }: { title: string; hint: string; items: ModelOption[]; onChange: (v: ModelOption[]) => void }) {
  const set = (i: number, patch: Partial<ModelOption>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-[rgb(var(--fg-muted))]">{title}</p>
        <button onClick={() => onChange([...items, { key: `${slug(title)}-${items.length + 1}`, label: '', surcharge: 0 }])} className="text-[rgb(var(--gold-700))] hover:underline text-xs inline-flex items-center gap-1"><Plus size={12} /> aggiungi</button>
      </div>
      {items.length === 0 ? <p className="text-[11px] text-[rgb(var(--fg-subtle))]">{hint}</p> : items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={it.label} onChange={(e) => set(i, { label: e.target.value, key: slug(e.target.value) || it.key })} placeholder="Nome (es. Pelle)" className="h-8 text-sm flex-1" />
          <Input type="number" min={0} step={5} value={it.surcharge} onChange={(e) => set(i, { surcharge: Math.max(0, Number(e.target.value) || 0) })} placeholder="€" className="h-8 text-sm w-20" title="Sovrapprezzo" />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[rgb(var(--fg-muted))] hover:text-red-500 shrink-0" title="Rimuovi"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}

export function ModelOptionsEditor({ label, value, onChange, onClose }: {
  label: string; value: ModelOptions | null | undefined; onChange: (v: ModelOptions) => void; onClose: () => void
}) {
  const v = norm(value)
  const patch = (p: Partial<ModelOptions>) => onChange({ ...v, ...p })
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-lg truncate">Opzioni · {label || 'Modello'}</h3>
          <button onClick={onClose} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-[11px] text-[rgb(var(--fg-muted))]">Cosa può scegliere il cliente su questo modello. Ogni opzione può avere un sovrapprezzo che si somma al prezzo.</p>
          <Group title="Materiali" hint="Nessun materiale: il cliente non sceglie il materiale." items={v.materials!} onChange={(materials) => patch({ materials })} />
          <Group title="Colori" hint="Nessun colore configurato." items={v.colors!} onChange={(colors) => patch({ colors })} />
          <Group title="Logo / personalizzazione" hint="Es. iniziali, data, numeri." items={v.logos!} onChange={(logos) => patch({ logos })} />
          <div className="pt-2 border-t border-[rgb(var(--border))] space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!v.coverPhoto} onChange={(e) => patch({ coverPhoto: e.target.checked })} />
              Foto in copertina disponibile
            </label>
            {v.coverPhoto && (
              <label className="flex items-center gap-2 text-sm">Sovrapprezzo foto
                <Input type="number" min={0} step={5} value={v.coverPhotoSurcharge ?? 0} onChange={(e) => patch({ coverPhotoSurcharge: Math.max(0, Number(e.target.value) || 0) })} className="h-8 w-24 text-sm" /> €
              </label>
            )}
          </div>
          <Button className="w-full" onClick={onClose}>Fatto</Button>
        </div>
      </div>
    </div>
  )
}
