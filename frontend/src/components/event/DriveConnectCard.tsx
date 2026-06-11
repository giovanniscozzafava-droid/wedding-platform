import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HardDrive, Check, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'

// Consegna foto: il cloud è del professionista. Qui collega il suo Google Drive
// (scope drive.file). I file restano sul suo Drive; Planfully tiene solo il token
// cifrato + i riferimenti + i metadati chi-vede-cosa.
export function DriveConnectCard() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('drive')
    if (p === 'connected') toast.success('Google Drive collegato')
    else if (p === 'nokey') toast.error('Drive non configurato lato server (manca DRIVE_TOKEN_KEY).')
    else if (p === 'no_google_app') toast.error('App Google non configurata (manca GOOGLE_DRIVE_CLIENT_ID).')
    else if (p && p.length) toast.error('Collegamento Drive non riuscito.')
    void (async () => {
      const me = (await supabase.auth.getUser()).data.user?.id
      if (!me) { setConnected(false); return }
      const { data } = await (supabase.from as unknown as (t: string) => {
        select: (s: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } }
      })('drive_connections').select('id').eq('professional_id', me).maybeSingle()
      setConnected(!!data)
    })()
  }, [])

  async function connect() {
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('drive-oauth-start', { body: {} })
      if (error) throw error
      const r = data as { url?: string; error?: string; hint?: string }
      if (r?.error) { toast.error(r.hint ?? r.error); return }
      if (r?.url) { window.location.href = r.url; return }
      toast.error('Risposta inattesa')
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <Card className="p-6 mt-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-md shrink-0"
          style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
          <HardDrive size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg flex items-center gap-2">
            Consegna foto · Google Drive
            {connected && <Badge className="bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))]"><Check size={11} /> Collegato</Badge>}
          </h2>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
            I tuoi file restano sul <strong>tuo</strong> Drive — Planfully ne mostra solo le anteprime e gestisce
            chi-vede-cosa. Accesso minimo (<code>drive.file</code>): solo le cartelle che scegli di condividere.
          </p>
          <div className="mt-3">
            {connected === null ? (
              <span className="text-xs text-[rgb(var(--fg-subtle))]">…</span>
            ) : (
              <Button variant={connected ? 'outline' : 'gold'} disabled={busy} onClick={connect}>
                <ExternalLink size={14} /> {busy ? 'Apro Google…' : connected ? 'Ricollega Google Drive' : 'Collega Google Drive'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}
