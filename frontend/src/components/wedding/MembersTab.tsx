import { useState } from 'react'
import { Plus, Mail, Copy, CheckCircle2, Clock, Trash2, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useCoupleMembers, useCoupleMemberMutations } from '@/hooks/useCouple'

export function MembersTab({ entryId }: { entryId: string }) {
  const { data: members } = useCoupleMembers(entryId)
  const { invite, remove } = useCoupleMemberMutations(entryId)
  const [draft, setDraft] = useState({ email: '', full_name: '', role: 'PARTNER' as const })

  async function submit() {
    if (!draft.email) return
    try {
      await invite.mutateAsync(draft)
      setDraft({ email: '', full_name: '', role: 'PARTNER' })
      toast.success('Invito creato. Copia il link sotto e mandalo via WhatsApp/email.')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">I clienti</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Invita i tuoi clienti (e i loro testimoni di fiducia) a vedere il loro evento.
          Avranno un accesso dedicato per consultare programma, alloggi, trasporti e contribuire al mood/playlist.
        </p>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} placeholder="nome@email.it" />
          </div>
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={draft.full_name} onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))} placeholder="Maria Rossi" />
          </div>
          <div className="space-y-1">
            <Label>Ruolo</Label>
            <Select value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value as any }))}>
              <option value="SPOSA">Sposa</option>
              <option value="SPOSO">Sposo</option>
              <option value="PARTNER">Partner</option>
              <option value="PERSONA_DI_FIDUCIA">Persona di fiducia</option>
            </Select>
          </div>
          <Button variant="gold" onClick={submit} disabled={invite.isPending}>
            <Plus /> Invita
          </Button>
        </div>
      </Card>

      {(members ?? []).length === 0 && (
        <Card className="p-10 text-center">
          <Heart size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessun cliente invitato. Inizia dalla casella sopra.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(members ?? []).map((m) => {
          const inviteUrl = `${window.location.origin}/invito-coppia/${m.invite_token}`
          const waText = `Ciao ${m.full_name ?? ''}! Ti invito al vostro evento su Planfully. Apri questo link e crea il tuo account: ${inviteUrl}`
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone="gold">{m.role}</Badge>
                    {m.accepted_at
                      ? <Badge tone="emerald"><CheckCircle2 size={10} /> Accettato</Badge>
                      : <Badge tone="amber"><Clock size={10} /> In attesa</Badge>}
                  </div>
                  <h3 className="font-medium truncate">{m.full_name ?? m.email}</h3>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] flex items-center gap-1">
                    <Mail size={11} /> {m.email}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(m.id)}><Trash2 size={14} /></Button>
              </div>
              {!m.accepted_at && (
                <div className="pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-1">Link invito</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-[rgb(var(--bg-sunken))] px-2 py-1 rounded truncate">
                      {inviteUrl}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => {
                      navigator.clipboard.writeText(inviteUrl)
                      toast.success('Link copiato')
                    }}>
                      <Copy size={12} />
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noreferrer"
                      className="flex-1 text-xs text-center rounded-md border border-[rgb(var(--border))] px-2 py-1.5 hover:bg-[rgb(var(--bg-sunken))]">
                      WhatsApp
                    </a>
                    <a href={`mailto:${m.email}?subject=${encodeURIComponent('Il vostro evento su Planfully')}&body=${encodeURIComponent(waText)}`}
                      className="flex-1 text-xs text-center rounded-md border border-[rgb(var(--border))] px-2 py-1.5 hover:bg-[rgb(var(--bg-sunken))]">
                      Email
                    </a>
                  </div>
                  <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
                    Aprendolo, il cliente crea l'account (o accede se ne ha già uno) e viene collegato all'evento.
                  </p>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
