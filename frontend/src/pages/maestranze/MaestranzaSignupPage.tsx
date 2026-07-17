import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Camera, Check, ChevronRight, ChevronLeft, ShieldAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import {
  type Skill, type Provincia, REGIMI, TOS_VERSION, DISCLAIMER,
  loadSkills, loadProvince, groupByFamiglia, signedPhoto,
} from '@/lib/maestranze'

type Step = 1 | 2 | 3 | 4

/**
 * Creazione account per chi arriva dal link e un account non ce l'ha.
 *
 * Il ruolo va passato in `options.data`: il profilo nasce così, all'INSERT, con
 * role='MAESTRANZA'. NON si può assegnare con un UPDATE successivo dal client —
 * il lock SEC-01 (trg_lock_profile_privileged, BEFORE UPDATE su profiles) fa
 * `new.role := old.role` e lo reverte IN SILENZIO, senza errore.
 *
 * Niente codice invito: il gate beta esiste per i professionisti che vendono sulla
 * piattaforma. Le maestranze sono gratuite e la bacheca vive solo se si riempie —
 * chiuderla a chiave sarebbe chiudere la porta di casa propria dall'interno.
 */
function CreaAccount() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!nome.trim()) { toast.error('Serve il tuo nome'); return }
    if (password.length < 8) { toast.error('La password deve avere almeno 8 caratteri'); return }
    if (!terms) { toast.error('Devi accettare le condizioni per iscriverti'); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: {
          data: { role: 'MAESTRANZA', full_name: nome.trim(), platform_terms: true },
          emailRedirectTo: `${window.location.origin}/maestranze/iscriviti`,
        },
      })
      if (error) throw error
      toast.success('Account creato. Ora costruisci il tuo profilo.')
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-lg mx-auto px-6 py-14">
        <Card className="p-8">
          <h1 className="text-2xl font-medium mb-2" style={{ color: 'rgb(var(--fg))' }}>
            Il tuo mestiere ha un nome.
          </h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
            Fatti trovare da chi organizza gli eventi della tua zona. È gratis, e resta gratis:
            Planfully non prende commissioni su quello che guadagni.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Nome e cognome</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Come ti chiami" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="la-tua@email.it" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider block mb-1"
                style={{ color: 'rgb(var(--fg-subtle))' }}>Password</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 8 caratteri" />
            </div>
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
              <span className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
                Accetto le condizioni di Planfully e l’informativa privacy.
              </span>
            </label>
          </div>
          <Button variant="gold" className="w-full mt-5" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Creo l’account…' : 'Iscriviti alla bacheca'}
          </Button>
          <div className="flex gap-2.5 rounded-lg border p-3 mt-5"
            style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
            <ShieldAlert className="size-4 shrink-0 mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>{DISCLAIMER}</p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function MaestranzaSignupPage() {
  const { session, profile } = useAuth()
  const nav = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [skills, setSkills] = useState<Skill[]>([])
  const [province, setProvince] = useState<Provincia[]>([])
  const [saving, setSaving] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [provincia, setProvincia] = useState('')
  const [raggio, setRaggio] = useState<'PROVINCIA' | 'REGIONE' | 'NAZIONALE'>('PROVINCIA')
  const [anni, setAnni] = useState<number | ''>('')
  const [bio, setBio] = useState('')
  const [note, setNote] = useState('')
  const [fascia, setFascia] = useState('')
  const [skillIds, setSkillIds] = useState<string[]>([])
  const [skillQuery, setSkillQuery] = useState('')
  const [openFam, setOpenFam] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [regime, setRegime] = useState<string>('')

  useEffect(() => {
    void (async () => {
      try {
        const [sk, pr] = await Promise.all([loadSkills(), loadProvince()])
        setSkills(sk); setProvince(pr)
      } catch (e) { toast.error((e as Error).message) }
    })()
  }, [])

  // Se ha già un profilo maestranza, riprendilo invece di ricrearlo.
  useEffect(() => {
    if (!session?.user?.id) return
    void (async () => {
      const { data } = await supabase.from('maestranze_profiles')
        .select('*').eq('id', session.user.id).maybeSingle()
      if (!data) {
        setDisplayName(profile?.full_name ?? '')
        return
      }
      setDisplayName(data.display_name ?? '')
      setProvincia(data.provincia ?? '')
      setRaggio((data.raggio_disponibilita as typeof raggio) ?? 'PROVINCIA')
      setAnni(data.anni_esperienza ?? '')
      setBio(data.bio ?? '')
      setNote(data.disponibilita_note ?? '')
      setFascia(data.fascia_prezzo ?? '')
      setPhotoPath(data.photo_path ?? null)
      if (data.photo_path) setPhotoUrl(await signedPhoto(data.photo_path))
      const { data: ps } = await supabase.from('maestranze_profile_skills')
        .select('skill_id').eq('profile_id', session.user.id)
      setSkillIds((ps ?? []).map((r) => r.skill_id))
    })()
  }, [session?.user?.id, profile?.full_name])

  const famiglie = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    return groupByFamiglia(q ? skills.filter((s) => s.name.toLowerCase().includes(q)) : skills)
  }, [skills, skillQuery])
  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills])

  if (!session) return <CreaAccount />


  async function uploadPhoto(file: File) {
    if (!session?.user?.id) return
    setSaving(true)
    try {
      const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
      const path = `${session.user.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('maestranze-photos')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      setPhotoPath(path)
      setPhotoUrl(await signedPhoto(path))
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }

  function toggleSkill(id: string) {
    setSkillIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
  }

  /** Salva il profilo NON pubblicato. La pubblicazione avviene solo dallo step 4,
   *  insieme alla dichiarazione: è l'unico posto da cui si entra in bacheca. */
  async function saveDraft(): Promise<boolean> {
    if (!session?.user?.id) return false
    if (!displayName.trim()) { toast.error('Serve il tuo nome'); return false }
    if (!provincia) { toast.error('Serve la provincia'); return false }
    setSaving(true)
    try {
      const { error } = await supabase.from('maestranze_profiles').upsert({
        id: session.user.id,
        display_name: displayName.trim(),
        provincia,
        raggio_disponibilita: raggio,
        anni_esperienza: anni === '' ? null : anni,
        bio: bio.trim() || null,
        disponibilita_note: note.trim() || null,
        fascia_prezzo: fascia.trim() || null,
        photo_path: photoPath,
      })
      if (error) throw error
      await supabase.from('maestranze_profile_skills').delete().eq('profile_id', session.user.id)
      if (skillIds.length) {
        const { error: e2 } = await supabase.from('maestranze_profile_skills')
          .insert(skillIds.map((skill_id) => ({ profile_id: session.user.id, skill_id })))
        if (e2) throw e2
      }
      return true
    } catch (e) { toast.error((e as Error).message); return false } finally { setSaving(false) }
  }

  async function publish() {
    if (!regime) { toast.error('Scegli la tua posizione: è obbligatorio'); return }
    if (!photoPath) { toast.error('Serve una foto per pubblicare'); return }
    if (!skillIds.length) { toast.error('Scegli almeno un mestiere'); return }
    if (!(await saveDraft())) return
    setSaving(true)
    try {
      const chosen = REGIMI.find((r) => r.value === regime)!
      // Snapshot immutabile: salviamo il testo ESATTO che ha letto e la versione dei T&C.
      // Se domani cambiamo il testo, questa dichiarazione resta quella di oggi.
      const { error: eDecl } = await supabase.from('maestranze_declarations').insert({
        profile_id: session!.user.id,
        regime,
        checkbox_text: chosen.label,
        tos_version: TOS_VERSION,
      })
      if (eDecl) throw eDecl
      const { error: ePub } = await supabase.from('maestranze_profiles')
        .update({ is_published: true }).eq('id', session!.user.id)
      if (ePub) throw ePub
      toast.success('Sei in bacheca. Il tuo profilo è visibile ai professionisti della tua zona.')
      nav('/maestranze/profilo')
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }

  const stepOk: Record<Step, boolean> = {
    1: !!displayName.trim() && !!provincia,
    2: skillIds.length > 0,
    3: !!photoPath,
    4: !!regime,
  }

  return (
    <div className="min-h-full">
      <div className="max-w-2xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader title="Iscriviti alla bacheca"
          description="Quattro passi. Nessun costo, nessuna commissione: Planfully non prende niente su quello che guadagni." />

        {/* progressione */}
        <div className="flex gap-1.5 mb-6">
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div key={s} className="h-1 flex-1 rounded-full"
              style={{ background: s <= step ? 'rgb(var(--gold-500))' : 'rgb(var(--bg-sunken))' }} />
          ))}
        </div>

        <Card className="p-6">
          {/* ------------------------------------------------- 1. chi sei */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: 'rgb(var(--fg))' }}>Chi sei e dove lavori</h2>
              <div>
                <label className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>Nome e cognome</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Come vuoi essere chiamato" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-wider block mb-1"
                    style={{ color: 'rgb(var(--fg-subtle))' }}>La tua provincia</label>
                  <select value={provincia} onChange={(e) => setProvincia(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border text-sm bg-transparent"
                    style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
                    <option value="">Scegli…</option>
                    {province.map((p) => <option key={p.provincia} value={p.provincia}>{p.nome} ({p.provincia})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider block mb-1"
                    style={{ color: 'rgb(var(--fg-subtle))' }}>Fin dove ti sposti</label>
                  <select value={raggio} onChange={(e) => setRaggio(e.target.value as typeof raggio)}
                    className="w-full h-10 px-3 rounded-lg border text-sm bg-transparent"
                    style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
                    <option value="PROVINCIA">Resto in provincia</option>
                    <option value="REGIONE">Tutta la regione</option>
                    <option value="NAZIONALE">Tutta Italia</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>Da quanti anni fai questo lavoro</label>
                <Input type="number" min={0} max={60} value={anni}
                  onChange={(e) => setAnni(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Facoltativo" />
              </div>
            </div>
          )}

          {/* --------------------------------------------- 2. cosa sai fare */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: 'rgb(var(--fg))' }}>Cosa sai fare</h2>
              <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>
                Scegli tutti i mestieri che fai davvero. Sono {skills.length}: se non trovi il tuo, cercalo.
              </p>
              <div className="relative">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgb(var(--fg-subtle))' }} />
                <Input value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)}
                  placeholder="es. cameriere, organetto, truccatore" className="pl-9" />
              </div>
              {skillIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {skillIds.map((id) => (
                    <button key={id} onClick={() => toggleSkill(id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
                      {skillById.get(id)?.name} <X className="size-3" />
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {famiglie.map(([fam, list]) => {
                  const open = openFam === fam || !!skillQuery
                  const sel = list.filter((s) => skillIds.includes(s.id)).length
                  return (
                    <div key={fam} className="rounded-lg border" style={{ borderColor: 'rgb(var(--border))' }}>
                      <button onClick={() => setOpenFam(open && !skillQuery ? null : fam)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left text-sm"
                        style={{ color: 'rgb(var(--fg))' }}>
                        <span>{fam}<span className="ml-2 text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>
                          {list.length}{sel > 0 && ` · ${sel} scelti`}</span></span>
                        <ChevronRight className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`}
                          style={{ color: 'rgb(var(--fg-subtle))' }} />
                      </button>
                      {open && (
                        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                          {list.map((s) => {
                            const active = skillIds.includes(s.id)
                            return (
                              <button key={s.id} onClick={() => toggleSkill(s.id)}
                                className="px-2.5 py-1 rounded-full text-xs border"
                                style={active
                                  ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' }
                                  : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                                {s.name}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ------------------------------------------------- 3. foto e voce */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: 'rgb(var(--fg))' }}>La tua faccia e le tue parole</h2>
              <div className="flex items-center gap-4">
                {photoUrl
                  ? <img src={photoUrl} alt="" className="size-20 rounded-full object-cover" />
                  : <div className="size-20 rounded-full grid place-items-center"
                      style={{ background: 'rgb(var(--bg-sunken))' }}>
                      <Camera className="size-6" style={{ color: 'rgb(var(--fg-subtle))' }} />
                    </div>}
                <div>
                  <label>
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhoto(f) }} />
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm cursor-pointer"
                      style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
                      <Camera className="size-4" /> {photoPath ? 'Cambia foto' : 'Carica una foto'}
                    </span>
                  </label>
                  <p className="text-[11px] mt-2" style={{ color: 'rgb(var(--fg-subtle))' }}>
                    La vedono solo i professionisti registrati. Non è pubblica e non finisce sui motori di ricerca.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>Due righe su di te (facoltativo)</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 1200))} rows={4}
                  placeholder="Da quanto lavori, con chi hai lavorato, cosa ti riesce meglio."
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-transparent"
                  style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }} />
                <p className="text-[10px] mt-1 text-right" style={{ color: 'rgb(var(--fg-subtle))' }}>{bio.length}/1200</p>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>Quando sei disponibile (facoltativo)</label>
                <Input value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))}
                  placeholder="es. weekend, alta stagione, anche infrasettimanale" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider block mb-1"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>Fascia indicativa (facoltativo)</label>
                <Input value={fascia} onChange={(e) => setFascia(e.target.value.slice(0, 80))}
                  placeholder="es. da concordare, a giornata, a servizio" />
                <p className="text-[11px] mt-1" style={{ color: 'rgb(var(--fg-subtle))' }}>
                  È solo un’indicazione tua: non è un filtro di ricerca e Planfully non tratta compensi.
                </p>
              </div>
            </div>
          )}

          {/* ---------------------------------------- 4. dichiarazione + pubblica */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium" style={{ color: 'rgb(var(--fg))' }}>Come lavori</h2>

              <div className="flex gap-2.5 rounded-lg border p-3"
                style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
                <ShieldAlert className="size-4 shrink-0 mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }} />
                <p className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>{DISCLAIMER}</p>
              </div>

              <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>
                Dicci come lavori. Non ti chiediamo documenti e non verifichiamo niente: serve a te e a chi
                ti ingaggia per sapere subito di cosa state parlando.
              </p>

              <div className="space-y-2">
                {REGIMI.map((r) => {
                  const active = regime === r.value
                  return (
                    <button key={r.value} onClick={() => setRegime(r.value)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors"
                      style={active
                        ? { borderColor: 'rgb(var(--gold-500))', background: 'rgb(var(--bg-sunken))' }
                        : { borderColor: 'rgb(var(--border))' }}>
                      <span className="size-4 rounded-full border grid place-items-center shrink-0 mt-0.5"
                        style={{ borderColor: active ? 'rgb(var(--gold-500))' : 'rgb(var(--border-strong))' }}>
                        {active && <span className="size-2 rounded-full" style={{ background: 'rgb(var(--gold-500))' }} />}
                      </span>
                      <span className="text-sm" style={{ color: 'rgb(var(--fg))' }}>{r.label}</span>
                    </button>
                  )
                })}
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: 'rgb(var(--fg-subtle))' }}>
                Pubblicando il profilo accetti i Termini (versione {TOS_VERSION}) e acconsenti a mostrare i tuoi
                dati ai professionisti registrati. Puoi togliere il profilo dalla bacheca quando vuoi, con effetto
                immediato. La tua scelta qui sopra viene registrata così com’è scritta, con data e ora.
              </p>
            </div>
          )}

          {/* -------------------------------------------------------- navigazione */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t"
            style={{ borderColor: 'rgb(var(--border))' }}>
            <Button variant="ghost" disabled={step === 1 || saving}
              onClick={() => setStep((s) => (s - 1) as Step)}><ChevronLeft /> Indietro</Button>
            {step < 4 ? (
              <Button variant="outline" disabled={!stepOk[step] || saving}
                onClick={async () => { if (step === 3 || step === 1) { if (!(await saveDraft())) return } setStep((s) => (s + 1) as Step) }}>
                Avanti <ChevronRight />
              </Button>
            ) : (
              <Button variant="gold" disabled={!stepOk[4] || saving} onClick={() => void publish()}>
                <Check /> {saving ? 'Pubblico…' : 'Pubblica il profilo'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
