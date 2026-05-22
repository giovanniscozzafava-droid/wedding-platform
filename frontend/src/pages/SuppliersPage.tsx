import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, UserPlus, Mail, PackageSearch, ImageIcon, ArrowUpRight, Clock, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  useInviteSupplier, useRevokeCollaboration, useSuppliers,
  useSupplierInvites, useCancelSupplierInvite,
} from '@/hooks/useSuppliers'

const SUBROLE_TONE: Record<string, 'gold' | 'sage' | 'rose' | 'sky' | 'amber' | 'neutral'> = {
  fioraio: 'rose', fotografo: 'sky', catering: 'amber', musicisti: 'sage', musica: 'sage',
}

const SUBROLE_OPTS = [
  { v: '', l: 'Qualsiasi' },
  { v: 'fotografo', l: 'Fotografo' },
  { v: 'videomaker', l: 'Videomaker' },
  { v: 'fioraio', l: 'Fioraio / Allestimenti' },
  { v: 'catering', l: 'Catering' },
  { v: 'pasticcere', l: 'Pasticceria' },
  { v: 'musica', l: 'Musica / DJ / Band' },
  { v: 'location', l: 'Location / Villa' },
  { v: 'allestimenti', l: 'Allestimenti' },
  { v: 'auto', l: 'Auto / Trasporti' },
  { v: 'animazione', l: 'Animazione' },
  { v: 'make_up', l: 'Make-up & Hair' },
  { v: 'abiti', l: 'Atelier abiti' },
  { v: 'celebrante', l: 'Celebrante' },
  { v: 'altro', l: 'Altro' },
]

export default function SuppliersPage() {
  const { data, isLoading } = useSuppliers()
  const { data: invites } = useSupplierInvites()
  const invite = useInviteSupplier()
  const cancelInvite = useCancelSupplierInvite()
  const revoke = useRevokeCollaboration()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [subrole, setSubrole] = useState('')
  const [message, setMessage] = useState('')

  async function submitInvite() {
    try {
      const r = await invite.mutateAsync({ email, subrole: subrole || undefined, message: message || undefined })
      if (r.mode === 'email_sent') toast.success(`Invito inviato a ${email}. Riceverà email da Supabase.`)
      else toast.success(`${email} è già su Planfully — collaboration creata in PENDING.`)
      setInviteOpen(false); setEmail(''); setSubrole(''); setMessage('')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const pending = (invites ?? []).filter((i) => i.status === 'PENDING')

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Rete"
          title="I tuoi fornitori"
          description="Collaborazioni attive + inviti in attesa. Apri un fornitore per il suo catalogo dedicato."
          actions={
            <Button variant="gold" onClick={() => setInviteOpen(true)} data-testid="invite-btn">
              <UserPlus /> Invita fornitore
            </Button>
          }
        />

        {pending.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))] mb-2">Inviti in attesa ({pending.length})</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {pending.map((p) => (
                <Card key={p.id} className="p-4 flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                    style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                    <Mail size={14} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.email}</p>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-[rgb(var(--fg-subtle))]">
                      <Clock size={11} />
                      <span>Scade {new Date(p.expires_at).toLocaleDateString('it-IT')}</span>
                      {p.subrole_hint && <Badge tone={SUBROLE_TONE[p.subrole_hint] ?? 'neutral'}>{p.subrole_hint}</Badge>}
                    </div>
                  </div>
                  <button onClick={() => {
                    if (!confirm(`Annullare invito a ${p.email}?`)) return
                    cancelInvite.mutate(p.id, {
                      onSuccess: () => toast.success('Invito annullato'),
                      onError: (e) => toast.error((e as Error).message),
                    })
                  }}
                    className="h-7 w-7 rounded-full hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center text-[rgb(var(--fg-muted))]"
                    title="Annulla invito">
                    <X size={12} />
                  </button>
                </Card>
              ))}
            </div>
          </section>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-48" />)}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(data ?? []).map((s, idx) => (
            <motion.div key={s.id}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}>
              <Card className="hover:shadow-[var(--shadow-lift)] transition-shadow overflow-hidden">
                <Link to={`/suppliers/${s.id}`} className="block p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="h-14 w-14 rounded-full overflow-hidden shrink-0 bg-[rgb(var(--bg-sunken))]">
                      <img src={s.avatar_url} alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium leading-snug truncate">
                        {s.business_name ?? s.full_name}
                      </h3>
                      <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{s.full_name}</p>
                      <div className="flex gap-1 mt-1.5">
                        {s.subrole && <Badge tone={SUBROLE_TONE[s.subrole] ?? 'neutral'}>{s.subrole}</Badge>}
                        <Badge status={s.collaboration_status} />
                      </div>
                    </div>
                    <ArrowUpRight className="text-[rgb(var(--fg-subtle))] shrink-0" size={16} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                    <div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))]">
                      <PackageSearch size={14} /> <span><strong>{s.service_count}</strong> servizi</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[rgb(var(--fg-muted))]">
                      <ImageIcon size={14} /> <span><strong>{s.photo_count}</strong> foto</span>
                    </div>
                  </div>
                </Link>
                {s.collaboration_status === 'ACTIVE' && (
                  <div className="px-5 pb-4">
                    <Button variant="ghost" size="sm"
                      onClick={() => {
                        if (!confirm(`Revocare collaborazione con ${s.business_name ?? s.full_name}?`)) return
                        revoke.mutate(s.collaboration_id, {
                          onSuccess: () => toast.success('Revocata'),
                          onError: (e) => toast.error((e as Error).message),
                        })
                      }}>
                      Revoca
                    </Button>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
        </div>

        {!isLoading && (data ?? []).length === 0 && pending.length === 0 && (
          <Card className="p-12 text-center max-w-xl mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <UserPlus size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Nessun fornitore collegato</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Inizia invitando i tuoi fornitori — basta un'email.
            </p>
            <Button variant="gold" onClick={() => setInviteOpen(true)}>
              <Plus /> Invita il primo
            </Button>
          </Card>
        )}
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="surface surface-lift w-full max-w-md p-6">
            <h2 className="font-display text-xl mb-1">Invita un fornitore</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Riceverà un'email con magic link per registrarsi e completare il profilo.
              Se è già su Planfully, creiamo direttamente la collaborazione.
            </p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="invite-email">Email *</Label>
                <Input id="invite-email" type="email" placeholder="email@fornitore.it"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-subrole">Categoria suggerita</Label>
                <Select id="invite-subrole" value={subrole} onChange={(e) => setSubrole(e.target.value)}>
                  {SUBROLE_OPTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="invite-msg">Messaggio (opzionale)</Label>
                <Textarea id="invite-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder="Es. Ciao Anna, vorrei collegarti come fioraia di fiducia su Planfully." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setInviteOpen(false)}>Annulla</Button>
                <Button variant="gold" onClick={submitInvite} disabled={!email || invite.isPending}>
                  {invite.isPending ? 'Invio...' : 'Invita'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
