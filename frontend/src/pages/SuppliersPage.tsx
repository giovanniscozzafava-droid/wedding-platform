import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, UserPlus, Mail, PackageSearch, ImageIcon, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { useInviteSupplier, useRevokeCollaboration, useSuppliers } from '@/hooks/useSuppliers'

const SUBROLE_TONE: Record<string, 'gold' | 'sage' | 'rose' | 'sky' | 'amber' | 'neutral'> = {
  fioraio: 'rose',
  fotografo: 'sky',
  catering: 'amber',
  musicisti: 'sage',
}

export default function SuppliersPage() {
  const { data, isLoading } = useSuppliers()
  const invite = useInviteSupplier()
  const revoke = useRevokeCollaboration()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')

  async function submitInvite() {
    try {
      await invite.mutateAsync(email)
      toast.success('Invito inviato. Collaboration in attesa.')
      setInviteOpen(false)
      setEmail('')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Rete"
          title="I tuoi fornitori"
          description="Lista delle collaborazioni attive. Apri un fornitore per vedere il suo catalogo dedicato."
          actions={
            <Button variant="gold" onClick={() => setInviteOpen(true)} data-testid="invite-btn">
              <UserPlus /> Invita fornitore
            </Button>
          }
        />

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

        {!isLoading && (data ?? []).length === 0 && (
          <Card className="p-12 text-center max-w-xl mx-auto">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
              <UserPlus size={20} />
            </span>
            <h3 className="font-display text-xl mb-1">Nessun fornitore collegato</h3>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Inizia invitando i tuoi fornitori per costruire la rete.
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
              Inserisci l&apos;email del fornitore. In v1 deve essere già registrato sulla piattaforma.
              In v2 l&apos;invito generera` un magic link via email.
            </p>
            <div className="space-y-3">
              <Input type="email" placeholder="email@fornitore.it"
                value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="flex items-center gap-2 text-xs text-[rgb(var(--fg-subtle))]">
                <Mail size={12} /> <span>Suggerimento: cerca per nome utente seed (es. "anna" → Fioreria Bianchi)</span>
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
