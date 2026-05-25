import { useState, useEffect } from 'react'
import { Upload, FolderOpen, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

const KINDS = ['CONTRATTO', 'FATTURA', 'RICEVUTA', 'PERMESSO', 'LIBERATORIA', 'OTHER']

export function DocumentsTab({ entryId }: { entryId: string }) {
  const [docs, setDocs] = useState<any[]>([])
  const [kind, setKind] = useState('OTHER')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('event_documents').select('*').eq('entry_id', entryId).order('created_at', { ascending: false })
    setDocs(data ?? [])
  }

  useEffect(() => { load() }, [entryId])

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setBusy(true)
    try {
      // Storage key: ASCII-only per evitare "Invalid key" su nomi con accenti/spazi
      // (Supabase Storage rifiuta caratteri non-ASCII). Manteniamo l'extension
      // originale e il `name` reale del file nella row DB per la UI.
      const dot = f.name.lastIndexOf('.')
      const ext = dot >= 0 ? f.name.slice(dot + 1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'bin'
      const path = `${entryId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext || 'bin'}`
      const up = await supabase.storage.from('event-documents').upload(path, f)
      if (up.error) throw up.error
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('event_documents').insert({
        entry_id: entryId, kind, name: f.name, storage_path: path,
        size_bytes: f.size, mime: f.type, uploaded_by: me.user?.id,
      })
      if (error) throw error
      toast.success('Documento caricato')
      await load()
      e.target.value = ''
    } catch (err) { toast.error((err as Error).message) }
    finally { setBusy(false) }
  }

  async function getUrl(path: string) {
    const { data } = await supabase.storage.from('event-documents').createSignedUrl(path, 3600)
    return data?.signedUrl
  }

  async function remove(id: string, path: string) {
    if (!confirm('Eliminare?')) return
    await supabase.storage.from('event-documents').remove([path])
    await supabase.from('event_documents').delete().eq('id', id)
    toast.success('Eliminato')
    await load()
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Vault documenti</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Contratti firmati, fatture, ricevute, liberatorie. Privati: solo tu (owner).</p>
      </header>

      <Card className="p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select className="sm:w-48" value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
          <label className="inline-flex items-center gap-2 px-4 h-10 rounded-lg cursor-pointer border border-[rgb(var(--border-strong))] hover:bg-[rgb(var(--bg-sunken))]">
            <Upload size={16} /> {busy ? 'Carico...' : 'Carica documento'}
            <input type="file" className="hidden" onChange={upload} disabled={busy} />
          </label>
        </div>
      </Card>

      {docs.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderOpen size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Vault vuoto.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
            {docs.map((d: any) => (
              <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                <FileText size={18} className="text-[rgb(var(--fg-muted))]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{d.name}</p>
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">
                    {Math.round((d.size_bytes ?? 0) / 1024)} KB · {new Date(d.created_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
                <Badge tone="neutral">{d.kind}</Badge>
                <Button variant="ghost" size="sm" onClick={async () => {
                  const url = await getUrl(d.storage_path); if (url) window.open(url, '_blank')
                }}>Apri</Button>
                <Button variant="ghost" size="icon" onClick={() => remove(d.id, d.storage_path)}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
