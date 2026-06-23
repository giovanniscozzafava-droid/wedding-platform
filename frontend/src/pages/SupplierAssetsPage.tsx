import { useRef, useState } from 'react'
import { Image as ImageIcon, Upload, X, Plus, Loader2, Tag as TagIcon, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/auth'
import { suggestedStyleTags } from '@/lib/styleTags'
import { useSupplierAssets, useSupplierAssetMutations, assetDisplayUrl, type SupplierAsset } from '@/hooks/useSupplierAssets'

const EVENT_KINDS = ['', 'matrimonio', 'battesimo', 'comunione', 'cresima', 'compleanno', 'anniversario', 'laurea', 'corporate', 'altro']

export default function SupplierAssetsPage() {
  const { data: assets, isLoading } = useSupplierAssets()
  const { upload, addByLink, update, remove } = useSupplierAssetMutations()
  const { profile } = useAuth()
  const suggested = suggestedStyleTags((profile as { subrole?: string | null } | null)?.subrole)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [prog, setProg] = useState<{ done: number; total: number; name?: string; pct?: number } | null>(null)
  const [linkUrl, setLinkUrl] = useState('')

  async function addLink() {
    const u = linkUrl.trim()
    if (!u) return
    try { await addByLink.mutateAsync({ url: u }); setLinkUrl(''); toast.success('Immagine aggiunta dal link. Aggiungi i tag.') }
    catch (e) { toast.error((e as Error).message) }
  }

  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    setBusy(true); setProg({ done: 0, total: imgs.length, name: imgs[0]!.name })
    let ok = 0
    for (let i = 0; i < imgs.length; i++) {
      const f = imgs[i]!
      setProg({ done: i, total: imgs.length, name: f.name, pct: 0 })
      try { await upload.mutateAsync({ file: f, onProgress: (pct) => setProg((p) => (p ? { ...p, pct } : p)) }); ok++ }
      catch (e) { toast.error(`«${f.name}»: ${(e as Error).message}`) }
    }
    setBusy(false); setProg(null)
    if (ok) toast.success(`${ok} foto caricate. Aggiungi i tag.`)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Profilo · Portfolio"
          title="Portfolio (i tuoi lavori)"
          description="Carica le foto dei tuoi lavori e taggale (obbligatorio: descrivi cosa si vede). Da qui partono le foto per i giochi di scelta nel preventivo e, in futuro, pagine e siti generati dal tuo portfolio."
        />

        <Card className="p-5 mb-6 border-dashed"
          onDragOver={(e) => { e.preventDefault() }}
          onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files) }}>
          <div className="flex flex-col items-center justify-center text-center gap-2 py-4">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]"><Upload size={20} /></span>
            <p className="text-sm text-[rgb(var(--fg-muted))]">Trascina qui le foto, oppure</p>
            <Button variant="gold" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Carica foto</Button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
            {prog && (() => {
              const overall = Math.min(100, Math.round(((prog.done + (prog.pct ?? 0) / 100) / prog.total) * 100))
              return (
                <div className="w-full max-w-sm mt-1">
                  <div className="flex justify-between items-center text-[11px] text-[rgb(var(--fg-muted))] mb-1">
                    <span className="truncate pr-2">{prog.name ? `Carico «${prog.name}»` : 'Caricamento…'}{prog.total > 1 ? ` (${Math.min(prog.done + 1, prog.total)}/${prog.total})` : ''}</span>
                    <span className="tabular-nums shrink-0 font-medium text-[rgb(var(--fg))]">{overall}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
                    <div className="h-full bg-[rgb(var(--gold-500))] transition-all duration-150" style={{ width: `${overall}%` }} />
                  </div>
                </div>
              )
            })()}
          </div>
          <div className="border-t border-[rgb(var(--border))] pt-3 mt-1">
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-1.5 flex items-center gap-1.5"><Link2 size={13} /> …oppure aggiungi da un <strong>link</strong> (Pinterest, Instagram, qualsiasi pagina) — utile se non vuoi caricare file.</p>
            <div className="flex gap-2">
              <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addLink() }} placeholder="https://pinterest.com/pin/…  oppure  https://instagram.com/p/…" className="flex-1" />
              <Button variant="outline" disabled={addByLink.isPending || !linkUrl.trim()} onClick={() => void addLink()}>{addByLink.isPending ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Aggiungi</Button>
            </div>
          </div>
        </Card>

        {isLoading && <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-56" />)}</div>}

        {!isLoading && (assets ?? []).length === 0 && (
          <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">
            <ImageIcon size={20} className="mx-auto mb-2 opacity-60" />
            Ancora nessun asset. Carica le foto dei tuoi lavori migliori e taggale (es. <em>peonie, romantico, pastello</em>).
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {(assets ?? []).map((a) => (
            <AssetCard key={a.id} a={a} suggested={suggested}
              onTags={(tags) => update.mutate({ id: a.id, patch: { tags } })}
              onCaption={(caption) => update.mutate({ id: a.id, patch: { caption } })}
              onEventKind={(event_kind) => update.mutate({ id: a.id, patch: { event_kind: event_kind || null } })}
              onPublic={(is_public) => update.mutate({ id: a.id, patch: { is_public } })}
              onRemove={() => { if (window.confirm('Eliminare questo asset?')) remove.mutate(a) }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function AssetCard({ a, suggested, onTags, onCaption, onEventKind, onPublic, onRemove }: {
  a: SupplierAsset
  suggested: string[]
  onTags: (tags: string[]) => void
  onCaption: (caption: string) => void
  onEventKind: (event_kind: string) => void
  onPublic: (is_public: boolean) => void
  onRemove: () => void
}) {
  const [tagDraft, setTagDraft] = useState('')
  const [caption, setCaption] = useState(a.caption ?? '')

  function addTag() {
    const t = tagDraft.trim().toLowerCase()
    if (!t) return
    if (!a.tags.includes(t)) onTags([...a.tags, t])
    setTagDraft('')
  }

  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="relative aspect-square bg-[rgb(var(--bg-sunken))]">
        <img src={assetDisplayUrl(a)} alt={a.caption ?? ''} className="absolute inset-0 w-full h-full object-contain" loading="lazy" />
        {a.image_url && <span className="absolute top-1.5 left-1.5 text-[10px] bg-black/55 text-white rounded px-1.5 py-0.5 inline-flex items-center gap-1"><Link2 size={10} /> link</span>}
        <button onClick={onRemove} title="Elimina" className="absolute top-1.5 right-1.5 h-7 w-7 rounded-full bg-black/55 text-white flex items-center justify-center hover:bg-black/75"><X size={14} /></button>
        {!a.is_public && <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/60 text-white rounded px-1.5 py-0.5">nascosto</span>}
      </div>
      <div className="p-2.5 space-y-2">
        <Input value={caption} onChange={(e) => setCaption(e.target.value)} onBlur={() => caption !== (a.caption ?? '') && onCaption(caption)} placeholder="Didascalia (facoltativa)" className="text-xs h-8" />
        <div className="flex flex-wrap gap-1">
          {a.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">
              {t}<button onClick={() => onTags(a.tags.filter((x) => x !== t))} className="hover:text-[rgb(var(--rose-500))]"><X size={10} /></button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <TagIcon size={12} className="text-[rgb(var(--fg-subtle))] shrink-0" />
          <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="aggiungi tag + Invio" className="flex-1 min-w-0 text-[11px] bg-transparent outline-none border-b border-[rgb(var(--border))] py-0.5" />
        </div>
        {/* tag-categoria suggeriti per la tua professione: clic per applicarli */}
        {suggested.filter((s) => !a.tags.includes(s)).length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {suggested.filter((s) => !a.tags.includes(s)).slice(0, 8).map((s) => (
              <button key={s} onClick={() => onTags([...a.tags, s])} title="Aggiungi questa categoria"
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-[rgb(var(--border-strong))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]">+ {s}</button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <select value={a.event_kind ?? ''} onChange={(e) => onEventKind(e.target.value)} className="text-[11px] bg-transparent border border-[rgb(var(--border))] rounded px-1 py-0.5">
            {EVENT_KINDS.map((k) => <option key={k} value={k}>{k === '' ? 'ogni evento' : k}</option>)}
          </select>
          <label className="text-[11px] flex items-center gap-1 cursor-pointer select-none">
            <input type="checkbox" checked={a.is_public} onChange={(e) => onPublic(e.target.checked)} className="h-3.5 w-3.5 accent-[rgb(var(--gold-600))]" /> nel gioco
          </label>
        </div>
      </div>
    </Card>
  )
}
