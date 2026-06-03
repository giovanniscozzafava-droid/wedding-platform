import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus, UserPlus, Mail, PackageSearch, ImageIcon, ArrowUpRight, Clock, X, Link2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarsBadge } from '@/components/social/StarsBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  useInviteSupplier, useRevokeCollaboration, useSuppliers,
  useSupplierInvites, useCancelSupplierInvite,
} from '@/hooks/useSuppliers'
import { SUPPLIER_SUBROLES } from '@/lib/supplierSubroles'

const SUBROLE_TONE: Record<string, 'gold' | 'sage' | 'rose' | 'sky' | 'amber' | 'neutral'> = {
  fioraio: 'rose', fotografo: 'sky', catering: 'amber', musicisti: 'sage', musica: 'sage',
}

// Lista subroles importata da modulo condiviso — sorgente unica con
// ProviderOnboardingWizard e altri form. Vedi lib/supplierSubroles.ts.
const SUBROLE_OPTS = [{ v: '', l: 'Qualsiasi' }, ...SUPPLIER_SUBROLES]

// Messaggio pre-compilato: spiega in poche righe la logica di Planfully.
const DEFAULT_INVITE_MESSAGE = `Ciao! Ti invito su Planfully, lo strumento che uso per organizzare i miei eventi.
Planfully mette in rete chi organizza (wedding planner, location) e i fornitori: gestisci catalogo, preventivi e contratti in un unico posto, e collaboriamo direttamente — niente marketplace, niente commissioni. Per i professionisti è gratis.
Iscriviti dal link qui sotto e ci colleghiamo subito.`

export default function SuppliersPage() {
  const { data, isLoading } = useSuppliers()
  const { data: invites } = useSupplierInvites()
  const invite = useInviteSupplier()
  const cancelInvite = useCancelSupplierInvite()
  const revoke = useRevokeCollaboration()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [subrole, setSubrole] = useState('')
  const [message, setMessage] = useState(DEFAULT_INVITE_MESSAGE)
  const [linkResult, setLinkResult] = useState<{ url: string; email: string } | null>(null)

  async function submitInvite(opts: { skipEmail?: boolean } = {}) {
    try {
      const r = await invite.mutateAsync({
        email, subrole: subrole || undefined, message: message || undefined,
        skip_email: opts.skipEmail,
      })
      if (r.mode === 'collab_direct') {
        toast.success(`${email} è già su Planfully — collaboration creata in PENDING.`)
        setInviteOpen(false); setEmail(''); setSubrole(''); setMessage(DEFAULT_INVITE_MESSAGE)
      } else if (r.accept_url) {
        // link-only o email_sent: in entrambi i casi mostra il link copiabile
        setLinkResult({ url: r.accept_url, email })
        if (r.mode === 'email_sent') toast.success(`Email inviata a ${email}.`)
        else if (r.mode === 'email_failed_link_fallback') toast.message('Email non inviata, usa il link sotto.')
        else toast.success('Link invito generato.')
        setInviteOpen(false); setEmail(''); setSubrole(''); setMessage(DEFAULT_INVITE_MESSAGE)
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiato')
    } catch {
      toast.error('Copia manuale: ' + url)
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
                    void copyLink(`${window.location.origin}/invito-fornitore/${p.token}`)
                  }}
                    className="h-7 w-7 rounded-full hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center text-[rgb(var(--fg-muted))]"
                    title="Copia link invito">
                    <Copy size={12} />
                  </button>
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
                    <div className="h-14 w-14 rounded-full overflow-hidden shrink-0 bg-white border flex items-center justify-center p-1"
                      style={{ borderColor: 'rgb(var(--border))' }}>
                      <img src={s.avatar_url} alt=""
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium leading-snug truncate">
                        {s.business_name ?? s.full_name}
                      </h3>
                      <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">{s.full_name}</p>
                      <div className="flex gap-1 mt-1.5 items-center flex-wrap">
                        {s.subrole && <Badge tone={SUBROLE_TONE[s.subrole] ?? 'neutral'}>{s.subrole}</Badge>}
                        <Badge status={s.collaboration_status} />
                        <StarsBadge userId={s.id} size="sm" />
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
              Genera un link da mandare via WhatsApp/email, oppure invia mail automatica.
              Se l'email è già su Planfully, creiamo subito la collaborazione.
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
              <div className="flex flex-col gap-2 pt-2">
                <Button variant="gold" onClick={() => submitInvite({ skipEmail: true })} disabled={!email || invite.isPending}>
                  <Link2 size={14} /> {invite.isPending ? '…' : 'Genera link (no email)'}
                </Button>
                <Button variant="outline" onClick={() => submitInvite({ skipEmail: false })} disabled={!email || invite.isPending}>
                  <Mail size={14} /> Invia email + link
                </Button>
                <Button variant="ghost" onClick={() => setInviteOpen(false)}>Annulla</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {linkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="surface surface-lift w-full max-w-lg p-6">
            <h2 className="font-display text-xl mb-1">Link invito pronto</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))] mb-4">
              Mandalo a <strong>{linkResult.email}</strong> via WhatsApp, email, SMS o come preferisci.
              Cliccandolo arriverà sulla pagina per creare l'account.
            </p>
            <div className="rounded-lg border p-3 bg-[rgb(var(--bg-sunken))] break-all text-xs font-mono"
              style={{ borderColor: 'rgb(var(--border))' }}>
              {linkResult.url}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button variant="gold" className="flex-1" onClick={() => copyLink(linkResult.url)}>
                <Copy size={14} /> Copia link
              </Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Ciao! Ti ho invitato come fornitore su Planfully. Crea il tuo account qui: ${linkResult.url}`)}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm hover:bg-[rgb(var(--bg-sunken))]">
                WhatsApp
              </a>
              <Button variant="outline" onClick={() => setLinkResult(null)}>Chiudi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
