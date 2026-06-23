import { useState } from 'react'
import { toast } from 'sonner'
import { Mail, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

// Invia un'email agli sposi con il link per registrarsi (lato cliente) o accedere e vedere le foto.
export function InviteCouplePhotos({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  async function send() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { toast.error('Email non valida'); return }
    setBusy(true)
    try {
      const { data, error } = await supabase.functions.invoke('invite-couple-photos', { body: { entry_id: entryId, email: email.trim(), full_name: name.trim() || undefined } })
      if (error || (data as any)?.error) throw new Error((data as any)?.error === 'forbidden' ? 'Solo il proprietario della galleria può invitare gli sposi.' : 'Invio non riuscito.')
      toast.success('Email inviata agli sposi 📸')
      setOpen(false); setEmail(''); setName('')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  if (!open) return <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Mail size={14} /> Invia email agli sposi</Button>
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-[11px] text-[rgb(var(--fg-muted))]">Email sposi<Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="sposi@email.com" className="mt-0.5 w-56" /></label>
      <label className="text-[11px] text-[rgb(var(--fg-muted))]">Nome (facolt.)<Input value={name} onChange={(e) => setName(e.target.value)} className="mt-0.5 w-36" /></label>
      <Button size="sm" disabled={busy} onClick={send}><Send size={14} /> {busy ? 'Invio…' : 'Invia'}</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
    </div>
  )
}
