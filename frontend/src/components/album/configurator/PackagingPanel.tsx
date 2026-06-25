import { Input } from '@/components/ui/input'
import { BOXES, FINISHES, euro, type Cover } from '../albumCatalog'
import { Chip, SectionLabel, ringOn, ringOff } from './ui'

// Confezione & copie: box, pagine interne, tipo blocco, album genitori, finiture, copie.
export function PackagingPanel({
  cover, set, copies, setCopies,
}: {
  cover: Cover
  set: (patch: Partial<Cover>) => void
  copies: number
  setCopies: (n: number) => void
}) {
  const toggleFinish = (k: string) => {
    const cur = cover.finishes ?? []
    set({ finishes: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] })
  }
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Box / contenitore</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {BOXES.map((b) => (
            <Chip key={b.key} active={cover.box === b.key} onClick={() => set({ box: b.key })} title={b.blurb}>{b.label}</Chip>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-6">
        <div>
          <SectionLabel>Pagine interne</SectionLabel>
          <div className="flex items-center gap-3">
            <Input type="number" min={10} max={80} step={5} value={cover.pages ?? 40}
              onChange={(e) => set({ pages: Math.max(10, Math.min(80, Number(e.target.value) || 40)) })} className="w-24" />
            <span className="text-xs text-[rgb(var(--fg-subtle))]">fogli (10–80)</span>
          </div>
        </div>
        <div>
          <SectionLabel>Blocco interno</SectionLabel>
          <div className="flex gap-2">
            <button type="button" onClick={() => set({ blockType: 'photo' })}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-all ${(cover.blockType ?? 'photo') === 'photo' ? ringOn : ringOff}`}>Stampa foto</button>
            <button type="button" onClick={() => set({ blockType: 'bookflat' })}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition-all ${cover.blockType === 'bookflat' ? ringOn : ringOff}`}>Book flat</button>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-sm cursor-pointer">
        <input type="checkbox" checked={!!cover.parents} onChange={(e) => set({ parents: e.target.checked })}
          className="h-4 w-4 accent-[rgb(var(--gold-500))]" />
        <span>Album genitori <span className="text-[rgb(var(--fg-muted))]">(2 mini coordinati)</span></span>
      </label>

      <div>
        <SectionLabel>Finiture & rifiniture</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {FINISHES.map((f) => (
            <Chip key={f.key} active={(cover.finishes ?? []).includes(f.key)} onClick={() => toggleFinish(f.key)} title={`+ ${euro(f.amount)}`}>
              {f.label} <span className="opacity-55">+{f.amount}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Copie</SectionLabel>
        <Input type="number" min={1} value={copies} onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))} className="w-24" />
      </div>
    </div>
  )
}
