import { type FormEvent, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ShieldAlert, Trash2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { ComuneInput } from '@/components/ComuneInput'
import { CodiceFiscaleInput } from '@/components/CodiceFiscaleInput'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useNuovoModello, useSetNuovoModello } from '@/hooks/useNuovoModello'

export default function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const nuovoModello = useNuovoModello()
  const setNuovoModello = useSetNuovoModello()
  const [togglingFlag, setTogglingFlag] = useState(false)
  const [form, setForm] = useState({
    full_name: '', business_name: '', phone: '', subrole: '',
    work_style: '', offers_full_dining: false,
    // Dati fiscali — riusati su ogni contratto generato
    business_legal_name: '',
    legal_form: '',
    vat_number: '', fiscal_code: '',
    address: '', city: '', zip: '', province: '', country: 'Italia',
    sdi_code: '', pec_email: '',
  })
  const [busy, setBusy] = useState(false)
  const [deletionPending, setDeletionPending] = useState<boolean>(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from('profiles') as any)
        .select('full_name, business_name, phone, subrole, work_style, offers_full_dining, deletion_requested_at, business_legal_name, legal_form, vat_number, fiscal_code, address, city, zip, province, country, sdi_code, pec_email')
        .eq('id', user.id).maybeSingle()
      if (data) {
        setForm({
          full_name: data.full_name ?? '',
          business_name: data.business_name ?? '',
          phone: data.phone ?? '',
          subrole: data.subrole ?? '',
          work_style: (data as any).work_style ?? '',
          offers_full_dining: !!(data as any).offers_full_dining,
          business_legal_name: (data as any).business_legal_name ?? '',
          legal_form: (data as any).legal_form ?? '',
          vat_number: (data as any).vat_number ?? '',
          fiscal_code: (data as any).fiscal_code ?? '',
          address: (data as any).address ?? '',
          city: (data as any).city ?? '',
          zip: (data as any).zip ?? '',
          province: (data as any).province ?? '',
          country: (data as any).country ?? 'Italia',
          sdi_code: (data as any).sdi_code ?? '',
          pec_email: (data as any).pec_email ?? '',
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
        business_legal_name: form.business_legal_name || null,
        legal_form: form.legal_form || null,
        vat_number: form.vat_number || null,
        fiscal_code: form.fiscal_code || null,
        address: form.address || null,
        city: form.city || null,
        zip: form.zip || null,
        province: form.province || null,
        country: form.country || null,
        sdi_code: form.sdi_code || null,
        pec_email: form.pec_email || null,
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
                  <Label htmlFor="business_name">Nome pubblico / brand</Label>
                  <Input id="business_name" value={form.business_name}
                    onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                    placeholder="es. Black Mamba · Villa Klopè · Gisko Photographer" />
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Compare su preventivi, vetrina e PDF. La ragione sociale legale è nei "Dati fiscali" sotto.</p>
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

              {/* === Dati fiscali — riusati su ogni contratto === */}
              <div className="pt-4 mt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <h3 className="font-display text-base mb-1">Dati fiscali</h3>
                <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
                  Vengono compilati automaticamente in ogni contratto e fattura che generi. Compilali una volta, ti accompagnano per sempre.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="legal_form">Forma giuridica</Label>
                    <select
                      id="legal_form"
                      value={form.legal_form}
                      onChange={(e) => setForm((f) => ({ ...f, legal_form: e.target.value }))}
                      className="flex h-10 w-full rounded-lg border bg-[rgb(var(--bg-elev))] px-3 py-2 text-sm"
                      style={{ borderColor: 'rgb(var(--border-strong))' }}
                    >
                      <option value="">Seleziona…</option>
                      <option value="INDIVIDUAL">Ditta individuale / Libero professionista</option>
                      <option value="SRL">SRL</option>
                      <option value="SRLS">SRLS</option>
                      <option value="SPA">SPA</option>
                      <option value="SAS">SAS</option>
                      <option value="SNC">SNC</option>
                      <option value="COOPERATIVE">Cooperativa</option>
                      <option value="ASSOCIATION">Associazione / ASD</option>
                      <option value="OTHER">Altro</option>
                    </select>
                    {form.legal_form === 'ASSOCIATION' && (
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))]">P.IVA opzionale per ASD/Associazioni non tenute.</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="business_legal_name">Ragione sociale completa</Label>
                    <Input id="business_legal_name" value={form.business_legal_name}
                      placeholder={form.legal_form === 'ASSOCIATION' ? 'Es. ASD Black Mamba'
                        : form.legal_form === 'INDIVIDUAL' ? 'Es. Mario Rossi · Ditta individuale'
                        : 'Es. Fuyue Srl'}
                      onChange={(e) => setForm((f) => ({ ...f, business_legal_name: e.target.value }))} />
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Nome legale dell&apos;impresa per atti e contratti.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="vat_number">Partita IVA</Label>
                    <Input id="vat_number" value={form.vat_number}
                      placeholder="01234567890"
                      onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value.toUpperCase() }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fiscal_code">Codice fiscale</Label>
                    <CodiceFiscaleInput
                      id="fiscal_code"
                      value={form.fiscal_code}
                      onChange={(v) => setForm((f) => ({ ...f, fiscal_code: v }))}
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="address">Sede / Indirizzo</Label>
                    <Input id="address" value={form.address}
                      placeholder="Via Roma 12"
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="city">Comune</Label>
                    <ComuneInput
                      id="city"
                      value={form.city}
                      onChange={({ city, cap, province }) =>
                        setForm((f) => ({
                          ...f,
                          city,
                          zip: cap || f.zip,
                          province: province || f.province,
                        }))
                      }
                      placeholder="es. Botricello"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="zip">CAP</Label>
                      <Input id="zip" value={form.zip}
                        placeholder="87100"
                        onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="province">Provincia</Label>
                      <Input id="province" value={form.province}
                        placeholder="CS"
                        maxLength={2}
                        onChange={(e) => setForm((f) => ({ ...f, province: e.target.value.toUpperCase() }))} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="country">Paese</Label>
                    <Input id="country" value={form.country}
                      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sdi_code">Codice SDI</Label>
                    <Input id="sdi_code" value={form.sdi_code}
                      placeholder="ABCDE12"
                      maxLength={7}
                      onChange={(e) => setForm((f) => ({ ...f, sdi_code: e.target.value.toUpperCase() }))} />
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">7 caratteri per fattura elettronica B2B.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pec_email">PEC</Label>
                    <Input id="pec_email" type="email" value={form.pec_email}
                      placeholder="azienda@pec.it"
                      onChange={(e) => setForm((f) => ({ ...f, pec_email: e.target.value }))} />
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Alternativa a SDI per ricezione fatture.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? 'Salvataggio...' : 'Salva modifiche'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Tutorial — solo fornitori */}
          {profile?.role === 'FORNITORE' && (
            <Card className="p-6 mt-6">
              <h3 className="font-display text-lg mb-1">Tutorial di benvenuto</h3>
              <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">
                Le card che ti guidano nei primi passi su Planfully. Se le hai chiuse e vuoi rivederle, riattivale qui.
              </p>
              <Button variant="outline" size="sm" onClick={async () => {
                if (!user) return
                await supabase.from('profiles').update({
                  tutorial_state: { dismissed: false, completed_steps: [], first_offer_created: false, started_at: new Date().toISOString() }
                }).eq('id', user.id)
                location.reload()
              }}>
                Riattiva tutorial
              </Button>
            </Card>
          )}

          {/* Feature flag — Nuovo modello (workflow guidato) */}
          <Card className="p-6 mt-6">
            <div className="flex items-start gap-3">
              <Sparkles className="text-[rgb(var(--gold-600))] shrink-0 mt-0.5" size={20} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg">Nuovo modello</h3>
                    <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                      Attiva il workflow guidato: prossima mossa, salute evento, riconciliazione menu/ospiti,
                      chat evento, scadenzario, cambiamenti evento.
                    </p>
                    {profile?.role !== 'ADMIN' && (
                      <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">
                        Funzionalita` in anteprima. Puoi disattivarla in qualunque momento.
                      </p>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none min-h-[44px]"
                    aria-label={nuovoModello ? 'Disattiva nuovo modello' : 'Attiva nuovo modello'}>
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={nuovoModello}
                      disabled={togglingFlag}
                      onChange={async (e) => {
                        const next = e.target.checked
                        setTogglingFlag(true)
                        try {
                          await setNuovoModello(next)
                          toast.success(next ? 'Nuovo modello attivato' : 'Nuovo modello disattivato')
                        } catch (err) {
                          toast.error((err as Error).message)
                        } finally {
                          setTogglingFlag(false)
                        }
                      }}
                    />
                    <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-[rgb(var(--bg-sunken))] peer-checked:bg-[rgb(var(--gold-500))] transition-colors ring-1 ring-[rgb(var(--border-strong))] peer-disabled:opacity-60">
                      <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
                        style={{ transform: nuovoModello ? 'translateX(20px)' : 'translateX(0)' }} />
                    </span>
                    <span className="text-sm font-medium">
                      {nuovoModello ? 'Attivo' : 'Disattivo'}
                    </span>
                  </label>
                </div>
                {profile?.role === 'ADMIN' && (
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-3">
                    Sei admin: vedi e gestisci questo flag globalmente. Per attivarlo su altri profili,
                    aggiorna `profiles.nuovo_modello_attivo` dal pannello admin.
                  </p>
                )}
              </div>
            </div>
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
