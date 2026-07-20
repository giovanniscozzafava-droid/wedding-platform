import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { type Skill, type Provincia, loadSkills, loadProvince, groupByFamiglia, TOS_VERSION } from '@/lib/maestranze'

const DISPONIBILITA = [
  { v: 'WEEKEND', l: 'Weekend' },
  { v: 'FESTIVI', l: 'Festivi' },
  { v: 'SERA', l: 'Sera (dalle 19)' },
  { v: 'GIORNO', l: 'Giorno (9-17)' },
  { v: 'SU_CHIAMATA', l: 'Su chiamata' },
]


export default function WaitlistPage() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const source = (params.get('source') ?? 'direct').slice(0, 40)

  const [skills, setSkills] = useState<Skill[]>([])
  const [province, setProvince] = useState<Provincia[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [email2, setEmail2] = useState('')
  const [telefono, setTelefono] = useState('')
  const [skillId, setSkillId] = useState<string | null>(null)
  const [altro, setAltro] = useState('')
  const [skillQuery, setSkillQuery] = useState('')
  const [provincia, setProvincia] = useState('')
  const [disp, setDisp] = useState<string[]>([])
  const [instagram, setInstagram] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [website, setWebsite] = useState('') // honeypot

  useEffect(() => {
    void (async () => {
      try {
        const [sk, pr] = await Promise.all([loadSkills(), loadProvince()])
        setSkills(sk); setProvince(pr)
      } catch { /* i filtri restano vuoti: si può sempre scrivere il mestiere a mano */ }
    })()
  }, [])

  const skillById = useMemo(() => new Map(skills.map((s) => [s.id, s])), [skills])
  const risultati = useMemo(() => {
    const q = skillQuery.trim().toLowerCase()
    if (!q) return []
    return skills.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8)
  }, [skills, skillQuery])
  const famiglie = useMemo(() => groupByFamiglia(skills), [skills])

  // Validazione inline: dice le cose mentre digita, non dopo aver premuto invio.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  const emailMatch = email.length > 0 && email.toLowerCase() === email2.toLowerCase()
  const telOk = telefono.replace(/\D/g, '').replace(/^(0039|39)/, '').length >= 9
  const canSubmit = nome.trim().length >= 3 && emailOk && emailMatch && telOk
    && !!provincia && (!!skillId || altro.trim().length > 0) && privacy

  async function submit() {
    setErr(null); setBusy(true)
    try {
      // functions.invoke (non fetch a mano): allega da sé la chiave anon come Bearer,
      // che la funzione richiede. È il pattern già usato dalle altre pagine pubbliche.
      const { data, error } = await supabase.functions.invoke('maestranze-waitlist-signup', {
        body: {
          nome, email, email_conferma: email2, telefono, provincia,
          skill_id: skillId, professione_altro: skillId ? '' : altro,
          disponibilita: disp, instagram, portfolio,
          privacy, privacy_version: TOS_VERSION, source, website,
        },
      })
      // invoke non alza su 4xx: il messaggio vero sta nel corpo della risposta, e
      // alla persona va detto QUELLO ("Questa email è già iscritta"), non "errore".
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        setErr(body?.error ?? 'Non siamo riusciti a registrarti. Riprova.')
        return
      }
      const out = data as { ok?: boolean; email_inviata?: boolean; error?: string }
      if (out?.error) { setErr(out.error); return }
      nav(`/maestranze/benvenuto?stato=${out?.email_inviata === false ? 'no-email' : 'inviata'}`)
    } catch {
      setErr('Connessione fallita. Riprova.')
    } finally { setBusy(false) }
  }

  const label = 'text-[11px] uppercase tracking-wider block mb-1.5 text-[rgb(var(--fg-subtle))]'
  const field = 'w-full h-12 px-3.5 rounded-lg border text-base bg-transparent text-[rgb(var(--fg))]'
  const fieldStyle = { borderColor: 'rgb(var(--border-strong))' }

  return (
    <div className="min-h-screen" style={{ background: 'rgb(var(--bg))' }}>
      <div className="max-w-md mx-auto px-5 py-10">
        <img src="/brand/planfully-logo.svg" alt="Planfully" className="h-7 mb-8" />

        <h1 className="font-display text-4xl leading-[1.1] tracking-tight mb-3" style={{ color: 'rgb(var(--fg))' }}>
          Il tuo mestiere<br />ha un nome.
        </h1>
        <p className="text-[15px] leading-relaxed mb-8" style={{ color: 'rgb(var(--fg-muted))' }}>
          Maestranze è la bacheca dove i professionisti che fanno funzionare gli eventi si fanno
          trovare da chi li organizza. Apre dopo l’estate: mettiti in lista e sarai tra i primi a entrare.
        </p>

        <div className="space-y-5">
          <div>
            <label className={label}>Nome e cognome</label>
            <input className={field} style={fieldStyle} value={nome} onChange={(e) => setNome(e.target.value)}
              autoComplete="name" placeholder="Come ti chiami" />
          </div>

          <div>
            <label className={label}>Email</label>
            <input className={field} style={fieldStyle} type="email" inputMode="email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="la-tua@email.it" />
          </div>
          <div>
            <label className={label}>Ripeti l’email</label>
            <input className={field}
              style={{ borderColor: email2 && !emailMatch ? 'rgb(var(--rose-500))' : 'rgb(var(--border-strong))' }}
              type="email" inputMode="email" value={email2} onChange={(e) => setEmail2(e.target.value)}
              placeholder="la-tua@email.it" />
            {email2 && !emailMatch && (
              <p className="text-xs mt-1.5" style={{ color: 'rgb(var(--rose-500))' }}>Le due email non coincidono.</p>
            )}
          </div>

          <div>
            <label className={label}>Telefono</label>
            <input className={field} style={fieldStyle} type="tel" inputMode="tel" value={telefono}
              onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" placeholder="3XX XXXXXXX" />
          </div>

          {/* ---------------------------------------------------- mestiere */}
          <div>
            <label className={label}>Che mestiere fai</label>
            {skillId ? (
              <button onClick={() => { setSkillId(null); setSkillQuery('') }}
                className="w-full h-12 px-3.5 rounded-lg text-base flex items-center justify-between"
                style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>
                {skillById.get(skillId)?.name}
                <span className="text-xs opacity-80">cambia</span>
              </button>
            ) : (
              <>
                <div className="relative">
                  <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'rgb(var(--fg-subtle))' }} />
                  <input className={`${field} pl-10`} style={fieldStyle} value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    placeholder="Cerca: cameriere, organetto, fonico…" />
                </div>
                {risultati.length > 0 && (
                  <div className="mt-2 rounded-lg border overflow-hidden" style={{ borderColor: 'rgb(var(--border))' }}>
                    {risultati.map((s) => (
                      <button key={s.id} onClick={() => { setSkillId(s.id); setAltro('') }}
                        className="w-full px-3.5 py-3 text-left text-sm flex items-center justify-between border-b last:border-b-0"
                        style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg))' }}>
                        <span>{s.name}</span>
                        <span className="text-[11px]" style={{ color: 'rgb(var(--fg-subtle))' }}>{s.famiglia}</span>
                      </button>
                    ))}
                  </div>
                )}
                {skillQuery.trim().length > 1 && risultati.length === 0 && (
                  <div className="mt-2">
                    <p className="text-xs mb-1.5" style={{ color: 'rgb(var(--fg-muted))' }}>
                      Non è in elenco? Scrivilo tu.
                    </p>
                    <input className={field} style={fieldStyle} value={altro}
                      onChange={(e) => setAltro(e.target.value.slice(0, 80))} placeholder="Il tuo mestiere" />
                  </div>
                )}
                {!skillQuery && (
                  <p className="text-[11px] mt-1.5" style={{ color: 'rgb(var(--fg-subtle))' }}>
                    {skills.length} mestieri in elenco, dal maître al portatore di vara.
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <label className={label}>La tua provincia</label>
            <select className={field} style={fieldStyle} value={provincia} onChange={(e) => setProvincia(e.target.value)}>
              <option value="">Scegli…</option>
              {province.map((p) => <option key={p.provincia} value={p.provincia}>{p.nome} ({p.provincia})</option>)}
            </select>
          </div>

          {/* ------------------------------------------------ disponibilità */}
          <div>
            <label className={label}>Quando lavori</label>
            <div className="grid grid-cols-2 gap-2">
              {DISPONIBILITA.map((d) => {
                const active = disp.includes(d.v)
                return (
                  <button key={d.v}
                    onClick={() => setDisp((p) => active ? p.filter((x) => x !== d.v) : [...p, d.v])}
                    className="h-11 rounded-lg border text-sm transition-colors"
                    style={active
                      ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' }
                      : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                    {d.l}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className={label}>Instagram <span className="normal-case tracking-normal">(facoltativo)</span></label>
            <input className={field} style={fieldStyle} value={instagram}
              onChange={(e) => setInstagram(e.target.value)} placeholder="@iltuonome" autoCapitalize="none" />
          </div>
          <div>
            <label className={label}>Portfolio o sito <span className="normal-case tracking-normal">(facoltativo)</span></label>
            <input className={field} style={fieldStyle} value={portfolio} inputMode="url" autoCapitalize="none"
              onChange={(e) => setPortfolio(e.target.value)} placeholder="https://…" />
          </div>

          {/* Honeypot: invisibile a un umano, irresistibile per un bot. */}
          <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1} autoComplete="off" aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }} />

          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input type="checkbox" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)}
              className="mt-1 size-4 shrink-0" />
            <span className="text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
              Ho letto l’<a href="/privacy" target="_blank" className="underline underline-offset-2"
                style={{ color: 'rgb(var(--fg))' }}>informativa privacy</a> e acconsento al trattamento dei
              dati per l’iscrizione alla lista d’attesa Maestranze.
            </span>
          </label>

          {err && (
            <p className="text-sm rounded-lg p-3" role="alert"
              style={{ background: 'rgb(var(--rose-500) / 0.1)', color: 'rgb(var(--rose-700))' }}>{err}</p>
          )}

          <button disabled={!canSubmit || busy} onClick={() => void submit()}
            className="w-full h-13 py-3.5 rounded-lg text-base font-medium transition-opacity disabled:opacity-40"
            style={{ background: '#25402F', color: '#FAF5EA' }}>
            {busy ? 'Un attimo…' : 'Mi metto in lista'}
          </button>

          <p className="text-[11px] leading-relaxed text-center pt-2" style={{ color: 'rgb(var(--fg-subtle))' }}>
            Planfully è una bacheca informativa, non un’agenzia per il lavoro.
            Nessuna commissione, mai. · <a href="/privacy" className="underline underline-offset-2">Informativa privacy</a>
          </p>
        </div>

        {/* Elenco completo, in coda: chi non sa come si chiama il suo mestiere lo trova qui. */}
        <details className="mt-10">
          <summary className="text-sm cursor-pointer flex items-center gap-1.5"
            style={{ color: 'rgb(var(--fg-muted))' }}>
            <ChevronRight className="size-4" /> Guarda tutti i {skills.length} mestieri
          </summary>
          <div className="mt-4 space-y-4">
            {famiglie.map(([fam, list]) => (
              <div key={fam}>
                <p className="text-[10px] uppercase tracking-wider mb-1.5"
                  style={{ color: 'rgb(var(--fg-subtle))' }}>{fam}</p>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((s) => (
                    <button key={s.id} onClick={() => { setSkillId(s.id); setAltro(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                      className="px-2.5 py-1 rounded-full text-xs border"
                      style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
