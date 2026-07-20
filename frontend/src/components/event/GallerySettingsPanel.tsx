import { useEffect, useState } from 'react'
import { X, Heart, MessageSquare, Share2, FileText, Pin, Shield, Download, Loader2, AlertTriangle, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export type GallerySettings = {
  gallery_id?: string
  allow_favorites: boolean; favorites_color: string; show_favorites_count: boolean; favorites_limit: number | null; favorites_download: string
  allow_comments: boolean; allow_social: boolean; show_filename: boolean; pin_icons: boolean
  watermark_enabled: boolean; watermark_text: string | null
  allow_download_all: boolean; download_hd: boolean
}

export const DEFAULT_GALLERY_SETTINGS: GallerySettings = {
  allow_favorites: true, favorites_color: '#25402F', show_favorites_count: false, favorites_limit: null, favorites_download: 'off',
  allow_comments: true, allow_social: true, show_filename: false, pin_icons: false,
  watermark_enabled: false, watermark_text: null, allow_download_all: false, download_hd: false,
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${on ? 'bg-[rgb(var(--gold-500))]' : 'bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))]'}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function Row({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="text-[rgb(var(--gold-700))] mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {desc && <p className="text-xs text-[rgb(var(--fg-muted))]">{desc}</p>}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function GallerySettingsPanel({ galleryId, onClose, onSaved, onDedup, dedupBusy }: { galleryId: string; onClose: () => void; onSaved?: (s: GallerySettings) => void; onDedup?: () => void; dedupBusy?: boolean }) {
  const [s, setS] = useState<GallerySettings>(DEFAULT_GALLERY_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof GallerySettings>(k: K, v: GallerySettings[K]) => setS((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    void (async () => {
      const { data } = await (supabase.from as any)('gallery_settings').select('*').eq('gallery_id', galleryId).maybeSingle()
      if (data) setS({ ...DEFAULT_GALLERY_SETTINGS, ...data })
      setLoading(false)
    })()
  }, [galleryId])

  async function save() {
    setSaving(true)
    const { error } = await (supabase.from as any)('gallery_settings').upsert({ gallery_id: galleryId, ...s, updated_at: new Date().toISOString() }, { onConflict: 'gallery_id' })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Impostazioni salvate')
    onSaved?.(s); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
          <h3 className="font-display text-lg">Impostazioni galleria</h3>
          <button className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]" onClick={onClose}><X size={18} /></button>
        </div>
        {loading ? (
          <div className="p-10 text-center text-[rgb(var(--fg-muted))]"><Loader2 className="animate-spin mx-auto" /></div>
        ) : (
          <div className="overflow-y-auto p-4 divide-y divide-[rgb(var(--border))]">
            <Row icon={<Heart size={18} />} title="Preferiti" desc="I clienti possono selezionare le foto preferite">
              <Toggle on={s.allow_favorites} onChange={(v) => set('allow_favorites', v)} />
            </Row>
            {s.allow_favorites && (
              <div className="pl-9 py-3 space-y-3">
                <div className="flex items-center justify-between"><span className="text-sm">Numero preferiti in evidenza</span><Toggle on={s.show_favorites_count} onChange={(v) => set('show_favorites_count', v)} /></div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Limite foto scelte</span>
                  <input type="number" min={0} value={s.favorites_limit ?? ''} onChange={(e) => set('favorites_limit', e.target.value ? Number(e.target.value) : null)} placeholder="nessun limite"
                    className="w-32 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5 text-sm" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Colore icona cuore</span>
                  <input type="color" value={s.favorites_color} onChange={(e) => set('favorites_color', e.target.value)} className="h-8 w-12 rounded border border-[rgb(var(--border))]" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">Scarica tutti i preferiti</span>
                  <select value={s.favorites_download} onChange={(e) => set('favorites_download', e.target.value)} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5 text-sm">
                    <option value="off">Off</option><option value="web">Risoluzione web</option><option value="hi">Alta risoluzione</option>
                  </select>
                </div>
              </div>
            )}
            <Row icon={<MessageSquare size={18} />} title="Commenti" desc="I clienti possono commentare ogni foto">
              <Toggle on={s.allow_comments} onChange={(v) => set('allow_comments', v)} />
            </Row>
            <Row icon={<Share2 size={18} />} title="Social network" desc="I clienti possono condividere sui social">
              <Toggle on={s.allow_social} onChange={(v) => set('allow_social', v)} />
            </Row>
            <Row icon={<FileText size={18} />} title="Nome file in evidenza" desc="Mostra il nome del file sulla foto">
              <Toggle on={s.show_filename} onChange={(v) => set('show_filename', v)} />
            </Row>
            <Row icon={<Pin size={18} />} title="Fissa le icone" desc="Icone sempre visibili sopra le foto">
              <Toggle on={s.pin_icons} onChange={(v) => set('pin_icons', v)} />
            </Row>
            <Row icon={<Shield size={18} />} title="Watermark" desc="Sovrimprime un testo sulle anteprime">
              <Toggle on={s.watermark_enabled} onChange={(v) => set('watermark_enabled', v)} />
            </Row>
            {s.watermark_enabled && (
              <div className="pl-9 py-3">
                <input value={s.watermark_text ?? ''} onChange={(e) => set('watermark_text', e.target.value)} placeholder="Testo watermark (es. © Gisko Foto)"
                  className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
              </div>
            )}
            <Row icon={<Download size={18} />} title="Download di tutte le foto" desc="I clienti scaricano tutte le foto in ZIP">
              <Toggle on={s.allow_download_all} onChange={(v) => set('allow_download_all', v)} />
            </Row>
            {s.allow_download_all && (
              <div className="pl-9 py-3 flex items-center justify-between">
                <span className="text-sm">Includi alta risoluzione (HD)</span>
                <Toggle on={s.download_hd} onChange={(v) => set('download_hd', v)} />
              </div>
            )}
          </div>
        )}
        {onDedup && (
          <div className="px-4 pb-2">
            <div className="rounded-lg border border-rose-300 p-3" style={{ background: 'rgb(var(--rose-500) / 0.06)' }}>
              <p className="text-[13px] font-medium text-rose-600 inline-flex items-center gap-1.5"><AlertTriangle size={14} /> Attenzione — pulizia doppioni</p>
              <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1 leading-snug">
                Rimuove le foto caricate più volte (stesso file caricato due volte). Le copie con <strong>like</strong> o <strong>scelta album</strong> restano intatte; i file duplicati finiscono nel <strong>cestino di Drive</strong> (recuperabili 30 giorni). Operazione che modifica la galleria: usala solo se vedi davvero dei doppioni. Ti verrà chiesta conferma con il numero esatto.
              </p>
              <Button variant="outline" size="sm" disabled={dedupBusy} onClick={onDedup}
                className="mt-2 !text-rose-600 !border-rose-300 hover:!bg-rose-50">
                <Trash2 size={14} /> {dedupBusy ? 'Controllo…' : 'Pulisci eventuali doppioni'}
              </Button>
            </div>
          </div>
        )}
        <div className="p-4 border-t border-[rgb(var(--border))] flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button variant="gold" disabled={saving} onClick={save}>{saving ? <Loader2 size={16} className="animate-spin" /> : null} Salva</Button>
        </div>
      </div>
    </div>
  )
}
