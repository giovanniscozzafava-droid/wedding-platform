import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { HardDrive, Check, ExternalLink, RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { getDriveToken } from '@/lib/driveUpload'

const fmtGB = (b?: number | null) => (b == null ? '—' : `${(b / 1073741824).toFixed(b < 10 * 1073741824 ? 1 : 0)} GB`)

// Consegna foto: il cloud è del professionista. Qui collega il suo Google Drive
// (scope drive.file). I file restano sul suo Drive; Planfully tiene solo il token
// cifrato + i riferimenti + i metadati chi-vede-cosa.
export function DriveConnectCard() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [quota, setQuota] = useState<{ limit: number | null; usage: number; usageInDrive: number } | null>(null)
  const [quotaBusy, setQuotaBusy] = useState(false)

  // legge lo spazio del Drive del professionista (about.get → storageQuota, ok con scope drive.file)
  async function loadQuota() {
    setQuotaBusy(true)
    try {
      const token = await getDriveToken()
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('quota')
      const q = ((await res.json()) as { storageQuota?: { limit?: string; usage?: string; usageInDrive?: string } }).storageQuota ?? {}
      setQuota({ limit: q.limit ? Number(q.limit) : null, usage: Number(q.usage ?? 0), usageInDrive: Number(q.usageInDrive ?? 0) })
    } catch { setQuota(null) } finally { setQuotaBusy(false) }
  }
  useEffect(() => { if (connected) void loadQuota() }, [connected])

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

  // Google blocca l'OAuth dentro i browser in-app (WhatsApp/Instagram/Facebook):
  // "disallowed_useragent". Va aperto nel browser di sistema (Safari/Chrome).
  function isInAppBrowser() {
    const ua = navigator.userAgent || ''
    return /FBAN|FBAV|FB_IAB|Instagram|Line\/|WhatsApp|Snapchat|Pinterest|Twitter|; wv\)/i.test(ua)
  }

  async function connect() {
    if (isInAppBrowser()) {
      try { await navigator.clipboard.writeText(`${window.location.origin}/profile`) } catch { /* ignore */ }
      toast.error('Per collegare Google Drive apri planfully.it in Safari o Chrome (non funziona dentro WhatsApp/Instagram). Link copiato.', { duration: 8000 })
      return
    }
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

          {connected && (
            <div className="mt-3 rounded-lg border border-[rgb(var(--border))] p-3">
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium inline-flex items-center gap-1.5"><HardDrive size={13} className="text-[rgb(var(--gold-600))]" /> Spazio del tuo Google Drive</span>
                <button type="button" onClick={() => void loadQuota()} disabled={quotaBusy}
                  className="text-[11px] text-[rgb(var(--gold-700))] hover:underline inline-flex items-center gap-1 disabled:opacity-50">
                  <RefreshCw size={11} className={quotaBusy ? 'animate-spin' : ''} /> Aggiorna
                </button>
              </div>
              {quota ? (() => {
                const pct = quota.limit ? Math.min(100, Math.round((quota.usage / quota.limit) * 100)) : 0
                const full = quota.limit != null && pct >= 90
                return (
                  <>
                    {quota.limit != null && (
                      <div className="h-2.5 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, background: full ? 'rgb(var(--rose-500))' : 'rgb(var(--gold-500))' }} />
                      </div>
                    )}
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1.5">
                      {quota.limit != null
                        ? <><strong className="text-[rgb(var(--fg))]">{fmtGB(quota.limit - quota.usage)}</strong> liberi · {fmtGB(quota.usage)} usati di {fmtGB(quota.limit)}{full ? <span className="text-[rgb(var(--rose-600))] font-medium"> · quasi pieno!</span> : null}</>
                        : <><strong className="text-[rgb(var(--fg))]">{fmtGB(quota.usage)}</strong> usati (account senza limite fisso / spazio condiviso)</>}
                      {quota.usageInDrive ? <> · {fmtGB(quota.usageInDrive)} in file Drive</> : null}
                    </p>
                  </>
                )
              })() : (
                <p className="text-[11px] text-[rgb(var(--fg-subtle))]">{quotaBusy ? 'Leggo lo spazio…' : 'Spazio non disponibile al momento.'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
