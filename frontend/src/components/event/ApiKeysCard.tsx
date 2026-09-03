import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/toast'
import { KeyRound, Copy, Check, Trash2 } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// Profilo → "API e agenti": le chiavi con cui un agente (Claude, Skorpio, uno script)
// parla con Planfully a nome del professionista. La chiave in chiaro si vede UNA volta,
// alla creazione: dopo, qui resta solo il prefisso. Persa? Se ne fa un'altra.
type ApiKey = {
  id: string; name: string; prefix: string; scopes: string[]
  created_at: string; last_used_at: string | null; revoked_at: string | null; calls_30d: number
}
type Created = { id: string; key: string; name: string; scopes: string[] }

const API_BASE = 'https://planfully.it/api/v1'
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export function ApiKeysCard() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [write, setWrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fresh, setFresh] = useState<Created | null>(null)
  const [copied, setCopied] = useState(false)

  const q = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('api_keys_list')
      if (error) throw error
      return (Array.isArray(data) ? data : []) as ApiKey[]
    },
  })
  const keys = q.data ?? []
  const alive = keys.filter((k) => !k.revoked_at)

  async function create() {
    if (busy) return
    setBusy(true)
    try {
      const { data, error } = await (supabase as any).rpc('api_key_create', {
        p_name: name.trim() || 'Chiave', p_scopes: write ? ['read', 'write'] : ['read'],
      })
      if (error) throw error
      if (data?.error === 'too_many') { toast.error('Hai già 10 chiavi attive: revocane una prima'); return }
      if (!data?.ok) throw new Error(data?.error ?? 'Non riesco a creare la chiave')
      setFresh(data as Created)
      setName(''); setWrite(false); setCopied(false)
      await qc.invalidateQueries({ queryKey: ['api-keys'] })
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function revoke(k: ApiKey) {
    if (!window.confirm(`Revocare «${k.name}»? Chi la usa smette di funzionare subito.`)) return
    const { data, error } = await (supabase as any).rpc('api_key_revoke', { p_id: k.id })
    if (error || !data?.ok) { toast.error('Non riesco a revocarla'); return }
    if (fresh?.id === k.id) setFresh(null)
    toast.success('Chiave revocata')
    await qc.invalidateQueries({ queryKey: ['api-keys'] })
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { toast.error('Copia a mano') }
  }

  return (
    <Card className="p-5" id="api">
      <h3 className="font-display text-lg mb-1 flex items-center gap-2">
        <KeyRound size={18} className="text-[rgb(var(--gold-600))]" /> API e agenti
      </h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
        Una chiave fa entrare un assistente o un altro tuo programma in Planfully <strong>a nome tuo</strong>: vede e fa
        solo ciò che puoi vedere e fare tu. Base: <code className="text-xs">{API_BASE}</code>
        {' · '}contratto in <code className="text-xs">/openapi.json</code>.
      </p>

      {fresh && (
        <div className="rounded-md border border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-50))] p-3 mb-4">
          <p className="text-sm font-medium mb-1">Chiave «{fresh.name}» creata. Copiala adesso: non la mostrerò più.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all select-all">{fresh.key}</code>
            <Button variant="outline" size="sm" onClick={() => void copy(fresh.key)}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Button>
          </div>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-2">
            Prova: <code className="break-all">curl -H "Authorization: Bearer {fresh.key.slice(0, 16)}…" {API_BASE}/me</code>
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end mb-4">
        <div>
          <Label htmlFor="api-name">Nome (per chi è)</Label>
          <Input id="api-name" placeholder="es. Claude Code, Skorpio, script contabilità" value={name}
            onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <label className="flex items-center gap-2 text-sm py-2 cursor-pointer">
          <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
          Può anche scrivere
        </label>
        <Button variant="gold" size="sm" disabled={busy} onClick={() => void create()}>
          {busy ? 'Creo…' : 'Crea chiave'}
        </Button>
      </div>
      <p className="text-xs text-[rgb(var(--fg-muted))] mb-4">
        Senza «può anche scrivere» la chiave legge soltanto: nessun preventivo, evento o contatto può cambiare da lì.
      </p>

      {q.isLoading ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">Carico…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-[rgb(var(--fg-muted))]">Nessuna chiave ancora.</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--border))]">
          {keys.map((k) => (
            <li key={k.id} className={`py-2 flex items-center gap-3 ${k.revoked_at ? 'opacity-50' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {k.name} <code className="text-xs font-normal text-[rgb(var(--fg-muted))]">{k.prefix}…</code>
                </p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">
                  {k.scopes.includes('write') ? 'lettura e scrittura' : 'solo lettura'}
                  {' · '}creata {fmt(k.created_at)}
                  {' · '}{k.last_used_at ? `ultimo uso ${fmt(k.last_used_at)}` : 'mai usata'}
                  {k.calls_30d > 0 ? ` · ${k.calls_30d} chiamate in 30 giorni` : ''}
                  {k.revoked_at ? ` · revocata ${fmt(k.revoked_at)}` : ''}
                </p>
              </div>
              {!k.revoked_at && (
                <Button variant="subtle" size="sm" title="Revoca" onClick={() => void revoke(k)}>
                  <Trash2 size={14} />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {alive.length > 0 && (
        <p className="text-xs text-[rgb(var(--fg-muted))] mt-3">
          Limite: 120 chiamate al minuto per chiave. Ogni chiamata resta registrata.
        </p>
      )}
    </Card>
  )
}
export default ApiKeysCard
