import { type FormEvent, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ShieldAlert, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    full_name: '', business_name: '', phone: '', subrole: '',
    work_style: '', offers_full_dining: false,
  })
  const [busy, setBusy] = useState(false)
  const [deletionPending, setDeletionPending] = useState<boolean>(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from('profiles') as any)
        .select('full_name, business_name, phone, subrole, work_style, offers_full_dining, deletion_requested_at')
        .eq('id', user.id).maybeSingle()
      if (data) {
        setForm({
          full_name: data.full_name ?? '',
          business_name: data.business_name ?? '',
          phone: data.phone ?? '',
          subrole: data.subrole ?? '',
          work_style: (data as any).work_style ?? '',
          offers_full_dining: !!(data as any).offers_full_dining,
        })
        setDeletionPending(!!(data as any).deletion_requested_at)
      }
    })()
  }, [user, profile])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    try {
      const { error: err } = await supabase.from('profiles').update({
        full_name: form.full_name,
        business_name: form.business_name || null,
        phone: form.phone || null,
        subrole: form.subrole || null,
        work_style: form.work_style || null,
        offers_full_dining: form.offers_full_dining,
      } as any).eq('id', user.id)
      if (err) throw err
      await refreshProfile()
      toast.success('Profilo aggiornato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally { setBusy(false) }
  }

  async function requestDeletion() {
    if (!confirm(`ATTENZIONE: stai chiedendo la cancellazione del tuo account e di tutti i dati associati.\n\nL'eliminazione avverrà entro 30 giorni (salvo obblighi di legge).\n\nConfermi?`)) return
    try {
      const { error } = await (supabase.rpc as any)('request_account_deletion')
      if (error) throw error
      setDeletionPending(true)
      toast.success('Richiesta cancellazione registrata. Riceverai conferma via email entro 30gg.')
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Profilo"
          title="I tuoi dati"
          description={user?.email}
          actions={
            <div className="flex gap-2">
              <Badge tone="ink">{profile?.role}</Badge>
              <Badge status={profile?.subscription_tier} tone={profile?.subscription_tier === 'PREMIUM' ? 'gold' : 'neutral'} />
            </div>
          }
        />
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="full_name">Nome e cognome</Label>
                  <Input id="full_name" required value={form.full_name}
                    onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="business_name">Ragione sociale</Label>
                  <Input id="business_name" value={form.business_name}
                    onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input id="phone" type="tel" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                {profile?.role === 'FORNITORE' && (
                  <div className="space-y-1">
                    <Label htmlFor="subrole">Tipo fornitore</Label>
                    <Input id="subrole" value={form.subrole}
                      onChange={(e) => setForm((f) => ({ ...f, subrole: e.target.value }))} />
                  </div>
                )}
              </div>

              {(profile?.role === 'FORNITORE' || profile?.role === 'LOCATION') && (
                <div className="space-y-1">
                  <Label htmlFor="work_style">Come lavori (modo di lavorare, filosofia, stile)</Label>
                  <Textarea id="work_style" rows={4} value={form.work_style}
                    onChange={(e) => setForm((f) => ({ ...f, work_style: e.target.value }))}
                    placeholder="Es. Stile reportage naturale, mai posato. Lavoro sempre con luce naturale. Sopralluogo gratuito prima dell'evento. Disponibile per destination wedding in Italia e Europa." />
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Questo testo è visibile ai wedding planner che ti aggiungono in network.</p>
                </div>
              )}

              {profile?.role === 'LOCATION' && (
                <label className="flex items-start gap-3 p-3 rounded-lg border" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
                  <input type="checkbox" className="mt-1" checked={form.offers_full_dining}
                    onChange={(e) => setForm((f) => ({ ...f, offers_full_dining: e.target.checked }))} />
                  <div className="text-sm">
                    <p className="font-medium">Ristorazione interna</p>
                    <p className="text-xs text-[rgb(var(--fg-muted))]">
                      Spunta se la location offre il servizio di ristorazione direttamente (affitto sala + menu inclusi, no catering esterno).
                    </p>
                  </div>
                </label>
              )}

              <div className="flex justify-end">
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? 'Salvataggio...' : 'Salva modifiche'}
                </Button>
              </div>
            </form>
          </Card>

          {/* GDPR */}
          <Card className="p-6 mt-6 border-[rgb(var(--rose-200))]">
            <div className="flex items-start gap-3 mb-3">
              <ShieldAlert className="text-[rgb(var(--rose-500))] shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h3 className="font-display text-lg">Dati personali e privacy</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                  Hai diritto alla cancellazione dei tuoi dati (GDPR art. 17). I matrimoni in corso vengono trasferiti al team oppure cancellati a tua scelta.
                </p>
              </div>
            </div>
            {deletionPending ? (
              <div className="rounded-md bg-[rgb(var(--rose-100))] p-3 text-sm">
                <p className="font-medium">Richiesta di cancellazione registrata.</p>
                <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">L'account e tutti i dati verranno eliminati entro 30 giorni. Per annullare contatta privacy@planfully.it.</p>
              </div>
            ) : (
              <Button variant="outline" onClick={requestDeletion} className="text-[rgb(var(--rose-500))] border-[rgb(var(--rose-200))]">
                <Trash2 size={14} /> Richiedi cancellazione account
              </Button>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
