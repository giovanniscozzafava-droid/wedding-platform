import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useDesigns, type DesignMeta } from '@/hooks/useDesignStudio'
import { PRESETS } from './engine'

export function NewDocModal({ onClose, onCreate }: { onClose: () => void; onCreate: (w: number, h: number) => void }) {
  const [w, setW] = useState('1500'); const [h, setH] = useState('1500')
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Nuovo progetto</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => <button key={p.key} onClick={() => onCreate(p.w, p.h)} className="text-left px-3 py-2 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-400))]"><p className="text-sm font-medium">{p.label}</p><p className="text-[11px] text-[rgb(var(--fg-subtle))]">{p.w}×{p.h}px</p></button>)}
        </div>
        <div className="flex items-end gap-2 pt-2 border-t border-[rgb(var(--border))]">
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Largh.<Input value={w} onChange={(e) => setW(e.target.value)} className="h-8 w-24 mt-0.5" /></label>
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Alt.<Input value={h} onChange={(e) => setH(e.target.value)} className="h-8 w-24 mt-0.5" /></label>
          <Button size="sm" onClick={() => onCreate(Number(w) || 1500, Number(h) || 1500)}>Crea personalizzato</Button>
        </div>
      </div>
    </div>
  )
}

export function GalleryModal({ entryId, onClose, onOpen, onDelete }: { entryId: string | null; onClose: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const { data: docs } = useDesigns(entryId)
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] rounded-2xl p-5 w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">I miei progetti{entryId ? ' · evento' : ''}</h3><button onClick={onClose}><X size={18} /></button></div>
        {(docs ?? []).length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">Nessun progetto salvato.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(docs ?? []).map((d: DesignMeta) => (
            <div key={d.id} className="rounded-lg border border-[rgb(var(--border))] overflow-hidden group">
              <button onClick={() => onOpen(d.id)} className="block w-full aspect-square bg-[rgb(var(--bg-sunken))]">{d.thumbnail ? <img src={d.thumbnail} alt={d.title} className="w-full h-full object-contain" /> : <div className="grid place-items-center h-full text-[rgb(var(--fg-subtle))] text-xs">—</div>}</button>
              <div className="px-2 py-1 flex items-center gap-1"><span className="text-xs truncate flex-1">{d.title}</span><button onClick={() => { if (confirm(`Eliminare "${d.title}"?`)) onDelete(d.id) }} className="text-[rgb(var(--rose-500))] opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
