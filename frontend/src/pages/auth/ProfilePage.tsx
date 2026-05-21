import { type FormEvent, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? '',
        business_name: profile.business_name ?? '',
        phone: profile.phone ?? '',
        subrole: profile.subrole ?? '',
      })
    }
  }, [profile])

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
      }).eq('id', user.id)
      if (err) throw err
      await refreshProfile()
      toast.success('Profilo aggiornato')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally { setBusy(false) }
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
              <div className="flex justify-end">
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? 'Salvataggio...' : 'Salva modifiche'}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
