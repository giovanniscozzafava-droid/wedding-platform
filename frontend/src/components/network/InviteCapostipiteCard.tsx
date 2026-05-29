// Card "Invita un altro capostipite" — slice minimale, no email automatica.
// L'invito genera supplier_invites con target_role=WEDDING_PLANNER|LOCATION e
// alla registrazione del referee creera' un referral per il rewards system.

import { useState } from 'react'
import { UserPlus, Copy, Check, AlertCircle, Award } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useInviteCapostipite, type InviteCapostipiteResult } from '@/hooks/useInviteCapostipite'

export function InviteCapostipiteCard() {
  const invite = useInviteCapostipite()
  const [email, setEmail] = useState('')
  const [targetRole, setTargetRole] = useState<'WEDDING_PLANNER' | 'LOCATION'>('WEDDING_PLANNER')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<InviteCapostipiteResult | null>(null)
  const [copied, setCopied] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    try {
      const r = await invite.mutateAsync({
        email,
        target_role: targetRole,
        message: message || undefined,
      })
      setResult(r)
    } catch {
      // l'errore e' nel mutation state
    }
  }

  function copyLink() {
    if (!result?.accept_url) return
    void navigator.clipboard.writeText(result.accept_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function reset() {
    setResult(null)
    setEmail('')
    setMessage('')
    setTargetRole('WEDDING_PLANNER')
  }

  return (
    <Card className="p-6">
      <header className="mb-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
          <UserPlus size={18} />
        </div>
        <div>
          <h3 className="font-display text-lg">Invita un altro capostipite</h3>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">
            Wedding planner o location: ogni invito accettato attiva un referral nella tua rete e genera rewards.
          </p>
        </div>
      </header>

      {!result ? (
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="cap-email">Email del capostipite</Label>
            <Input id="cap-email" type="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="rosellaelia@gmail.com" />
          </div>

          <div>
            <Label htmlFor="cap-role">Ruolo</Label>
            <Select id="cap-role" value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as 'WEDDING_PLANNER' | 'LOCATION')}>
              <option value="WEDDING_PLANNER">Wedding Planner</option>
              <option value="LOCATION">Location</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="cap-msg">Messaggio (opzionale)</Label>
            <Input id="cap-msg" type="text" maxLength={300}
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Ciao Rosella, ti invito nel network…" />
          </div>

          {invite.isError && (
            <div className="flex items-start gap-2 text-xs text-[rgb(var(--rose-500))] px-3 py-2 rounded-md"
              style={{ background: 'rgb(var(--rose-100))' }}>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{(invite.error as Error)?.message ?? 'Errore'}</span>
            </div>
          )}

          <Button type="submit" variant="gold" disabled={invite.isPending || !email}>
            <UserPlus size={14} /> {invite.isPending ? 'Creazione invito…' : 'Genera link di invito'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="px-3 py-2 rounded-md text-xs"
            style={{ background: 'rgb(34 197 94 / 0.10)', color: 'rgb(34 197 94)' }}>
            ✓ Invito creato per <strong>{result.invite.email}</strong> · {result.invite.target_role === 'WEDDING_PLANNER' ? 'Wedding Planner' : 'Location'}
          </div>

          <div>
            <Label>Link di invito (copia e inviaglielo)</Label>
            <div className="flex gap-2 mt-1">
              <input readOnly value={result.accept_url}
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                className="flex-1 px-3 py-2 text-xs font-mono rounded-md border bg-[rgb(var(--bg-sunken))]"
                style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg))' }} />
              <Button type="button" variant="outline" onClick={copyLink}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copiato' : 'Copia'}
              </Button>
            </div>
            <p className="text-[11px] mt-1.5 text-[rgb(var(--fg-subtle))]">
              Scade il {new Date(result.invite.expires_at).toLocaleDateString('it-IT')}.
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-[rgb(var(--fg-muted))] p-3 rounded-md"
            style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
            <Award size={14} className="shrink-0 mt-0.5" />
            <div>
              Quando {result.invite.email} accetta e si registra, viene creato un <strong>referral</strong> tra te e lei.
              Da quel momento ogni suo lead/upgrade alimenta i tuoi rewards.
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={reset}>
              Invita un altro
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
