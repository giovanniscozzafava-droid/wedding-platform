import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ImagePlus, X, AtSign, Globe, Users as UsersIcon, Lock, Send, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Visibility = 'PUBLIC' | 'NETWORK' | 'FOLLOWERS'

type TaggedSupplier = { id: string; full_name: string | null; business_name: string | null; brand_logo_url: string | null; subrole: string | null }

type Props = {
  onPosted: () => void
}

export function PostComposer({ onPosted }: Props) {
  const { profile, user } = useAuth()
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC')
  const [tagQuery, setTagQuery] = useState('')
  const [tagResults, setTagResults] = useState<TaggedSupplier[]>([])
  const [tagged, setTagged] = useState<TaggedSupplier[]>([])
  const [tagOpen, setTagOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!tagOpen) return
    let cancelled = false
    const t = setTimeout(async () => {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> })
        .rpc('search_suppliers_for_tag', { p_query: tagQuery, p_limit: 8 })
      if (!cancelled && !error) setTagResults((data as TaggedSupplier[]) ?? [])
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [tagQuery, tagOpen])

  async function uploadFile(file: File) {
    if (!user) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`
      const { error } = await supabase.storage.from('post-media').upload(path, file, { cacheControl: '3600', upsert: false })
      if (error) throw error
      const { data: pub } = supabase.storage.from('post-media').getPublicUrl(path)
      setMedia((m) => [...m, pub.publicUrl])
    } catch (e) { toast.error((e as Error).message) }
    finally { setUploading(false) }
  }

  function addTag(s: TaggedSupplier) {
    if (tagged.find((t) => t.id === s.id)) return
    setTagged((arr) => [...arr, s])
    setTagQuery('')
  }

  function removeTag(id: string) {
    setTagged((arr) => arr.filter((t) => t.id !== id))
  }

  async function submit() {
    if (!user) return
    if (!body.trim() && media.length === 0) {
      toast.error('Aggiungi un testo o un\'immagine')
      return
    }
    setPosting(true)
    try {
      const { error } = await (supabase as unknown as { from: (t: string) => { insert: (p: Record<string, unknown>) => Promise<{ error: Error | null }> } })
        .from('posts').insert({
          author_id:           user.id,
          body:                body.trim(),
          media_urls:          media,
          tagged_supplier_ids: tagged.map((t) => t.id),
          visibility,
        })
      if (error) throw error
      toast.success('Post pubblicato')
      setBody(''); setMedia([]); setTagged([]); setOpen(false); setVisibility('PUBLIC')
      onPosted()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setPosting(false)
    }
  }

  const initials = ((profile?.business_name ?? profile?.full_name ?? '?').charAt(0).toUpperCase())

  return (
    <div className="surface surface-elev p-4 mb-6">
      {!open ? (
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen(true)}
            className="flex-1 flex items-center gap-3 text-left px-3 py-3 rounded-full hover:bg-[rgb(var(--bg-sunken))] transition-colors">
            {profile?.brand_logo_url ? (
              <img src={profile.brand_logo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-display"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                {initials}
              </div>
            )}
            <span className="text-sm text-[rgb(var(--fg-muted))]">Condividi un evento, una foto, un dietro le quinte...</span>
          </button>
          <Link to="/feed/nuovo-articolo"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border hover:bg-[rgb(var(--bg-sunken))] transition-colors whitespace-nowrap"
            style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
            <FileText size={13} /> Scrivi articolo
          </Link>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-start gap-3">
            {profile?.brand_logo_url ? (
              <img src={profile.brand_logo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-display"
                style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                {initials}
              </div>
            )}
            <Textarea autoFocus rows={3} value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Cosa hai realizzato di recente? Racconta..."
              className="flex-1 resize-none" />
          </div>

          {/* Tagged suppliers chips */}
          {tagged.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-12">
              {tagged.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                  style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                  @{t.business_name ?? t.full_name}
                  <button onClick={() => removeTag(t.id)} className="hover:opacity-70"><X size={10} /></button>
                </span>
              ))}
            </div>
          )}

          {/* Media preview */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pl-12">
              {media.map((url, i) => (
                <div key={i} className="relative group aspect-square overflow-hidden rounded-lg">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setMedia((m) => m.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Tag picker popover */}
          {tagOpen && (
            <div className="pl-12">
              <div className="relative">
                <input type="text" autoFocus
                  value={tagQuery} onChange={(e) => setTagQuery(e.target.value)}
                  placeholder="Cerca fornitori da taggare..."
                  className="w-full h-9 px-3 rounded-md border text-sm bg-[rgb(var(--bg-elev))]"
                  style={{ borderColor: 'rgb(var(--border))' }} />
                {tagResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 surface surface-lift max-h-64 overflow-auto z-30">
                    {tagResults.map((s) => (
                      <button key={s.id} onClick={() => addTag(s)}
                        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[rgb(var(--bg-sunken))]">
                        {s.brand_logo_url ? (
                          <img src={s.brand_logo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-display"
                            style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                            {(s.business_name ?? s.full_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.business_name ?? s.full_name}</p>
                          {s.subrole && <p className="text-[10px] text-[rgb(var(--fg-subtle))] truncate">{s.subrole}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between pl-12 pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center gap-1">
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { Array.from(e.target.files ?? []).forEach(uploadFile); e.currentTarget.value = '' }} />
              <ToolBtn onClick={() => fileRef.current?.click()} title="Aggiungi foto" disabled={uploading}>
                <ImagePlus size={16} />
              </ToolBtn>
              <ToolBtn onClick={() => setTagOpen((v) => !v)} title="Tag fornitori" active={tagOpen}>
                <AtSign size={16} />
              </ToolBtn>
              {/* Visibility selector */}
              <div className="ml-2 inline-flex items-center gap-0.5 text-xs">
                <VisBtn current={visibility} v="PUBLIC" onSet={setVisibility} label="Pubblico" icon={Globe} />
                <VisBtn current={visibility} v="NETWORK" onSet={setVisibility} label="Network" icon={UsersIcon} />
                <VisBtn current={visibility} v="FOLLOWERS" onSet={setVisibility} label="Follower" icon={Lock} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setBody(''); setMedia([]); setTagged([]) }}>
                Annulla
              </Button>
              <Button variant="gold" size="sm" disabled={posting || (!body.trim() && media.length === 0)} onClick={submit}>
                <Send size={14} /> {posting ? 'Pubblico…' : 'Pubblica'}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function ToolBtn({ onClick, title, children, active, disabled }: { onClick: () => void; title: string; children: React.ReactNode; active?: boolean; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled}
      className="inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors disabled:opacity-50"
      style={{
        background: active ? 'rgb(var(--fg))' : 'transparent',
        color: active ? 'rgb(var(--bg-elev))' : 'rgb(var(--fg-muted))',
      }}>
      {children}
    </button>
  )
}

function VisBtn({ current, v, onSet, label, icon: Icon }: { current: string; v: Visibility; onSet: (v: Visibility) => void; label: string; icon: typeof Globe }) {
  const active = current === v
  return (
    <button type="button" onClick={() => onSet(v)} title={label}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] transition-colors"
      style={{
        background: active ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))',
        color: active ? 'white' : 'rgb(var(--fg-muted))',
      }}>
      <Icon size={11} /> {label}
    </button>
  )
}
