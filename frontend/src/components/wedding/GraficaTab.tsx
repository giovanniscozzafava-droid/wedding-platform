import { Link } from 'react-router-dom'
import { Palette, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDesigns } from '@/hooks/useDesignStudio'

// Grafica & stationery dell'evento: apre lo Studio disegno legato a questo evento.
// I progetti (inviti, tableau, menu, segnaposto) restano taggati con l'entry_id.
export function GraficaTab({ entryId }: { entryId: string }) {
  const { data: designs } = useDesigns(entryId)
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-medium">Grafica & stationery</h3>
          <p className="text-xs text-[rgb(var(--fg-subtle))] max-w-md">Progetta inviti, partecipazioni, tableau, menu e segnaposto a mano libera (tavola grafica o tablet). I progetti restano legati a questo evento.</p>
        </div>
        <Link to={`/studio?entry=${entryId}`}><Button variant="gold"><Palette size={15} /> Apri Studio disegno</Button></Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <Link to={`/studio?entry=${entryId}`} className="aspect-square rounded-xl border-2 border-dashed border-[rgb(var(--border))] grid place-items-center text-[rgb(var(--fg-subtle))] hover:border-[rgb(var(--gold-400))] hover:text-[rgb(var(--gold-700))] transition-colors">
          <span className="flex flex-col items-center gap-1.5 text-xs font-medium"><Plus size={22} /> Nuovo progetto</span>
        </Link>
        {(designs ?? []).map((d) => (
          <Link key={d.id} to={`/studio?entry=${entryId}&doc=${d.id}`} className="rounded-xl border border-[rgb(var(--border))] overflow-hidden group hover:border-[rgb(var(--gold-400))]">
            <div className="aspect-square bg-[rgb(var(--bg-sunken))] grid place-items-center">
              {d.thumbnail ? <img src={d.thumbnail} alt={d.title} className="w-full h-full object-contain" /> : <Palette size={20} className="text-[rgb(var(--fg-subtle))]" />}
            </div>
            <div className="px-2 py-1 text-xs truncate">{d.title}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
