import { type FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, Users, Network, Calendar, FileText, ShieldCheck, Sparkles, ArrowRight, Handshake, Compass, Lock as LockIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [magicMode, setMagicMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: { pathname?: string } }; search?: string }
  // Priorità: ?next= nell'URL (es. atterraggio diretto sul preventivo) → state.from → home.
  const qsNext = new URLSearchParams(loc.search ?? window.location.search).get('next')
  const next = (qsNext && qsNext.startsWith('/')) ? qsNext : (loc.state?.from?.pathname ?? '/')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null); setInfo(null); setBusy(true)
    try {
      if (magicMode) {
        const { error: err } = await supabase.auth.signInWithOtp({
          email, options: { emailRedirectTo: `${window.location.origin}/` },
        })
        if (err) throw err
        setInfo('Ti abbiamo inviato un link via email.')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        nav(next, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally { setBusy(false) }
  }

  return (
    <div>
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-5">
      {/* Brand panel */}
      <div className="hidden lg:flex lg:col-span-3 relative overflow-hidden p-12 text-white"
        style={{ background: 'rgb(var(--bg))' }}>
        <img src="/hero/auth.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(14,17,22,0.6) 0%, rgba(22,40,29,0.4) 100%)' }} />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="relative z-10 flex flex-col justify-between w-full">
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <img src="/brand/planfully-symbol.svg" alt="" className="h-9 w-9 invert" />
            <span className="font-display text-xl">Planfully</span>
          </Link>

          <div className="max-w-md">
            <p className="text-xs uppercase tracking-[0.2em] mb-3 text-white/80">
              Il network dei professionisti degli eventi &middot; Italia
            </p>
            <h1 className="font-display text-4xl xl:text-5xl leading-tight mb-4 text-white">
              Il tuo network di professionisti.<br />In un posto solo.
            </h1>
            <p className="text-white/85 text-base max-w-md">
              Wedding planner, location e i migliori fornitori italiani — tutti collegati.
              Costruisci la tua rete di fiducia, organizza ogni evento, fai crescere il tuo
              business. Senza intermediari, senza commissioni.
            </p>
          </div>

          <ul className="grid grid-cols-2 gap-3 max-w-lg text-sm text-white">
            <li className="rounded-lg p-3 backdrop-blur" style={{ background: 'rgba(255,255,255,0.12)' }}><strong>23</strong> servizi seed pronti per provare</li>
            <li className="rounded-lg p-3 backdrop-blur" style={{ background: 'rgba(255,255,255,0.12)' }}><strong>10+</strong> trigger DB testati in produzione</li>
            <li className="rounded-lg p-3 backdrop-blur" style={{ background: 'rgba(255,255,255,0.12)' }}><strong>PDF</strong> brandizzato per i tuoi clienti</li>
            <li className="rounded-lg p-3 backdrop-blur" style={{ background: 'rgba(255,255,255,0.12)' }}><strong>iCal</strong> per Apple, Google, Outlook</li>
          </ul>
        </motion.div>
      </div>

      {/* Hero mobile (foto + titolo) */}
      <div className="lg:hidden relative h-[40vh] min-h-[260px] overflow-hidden text-white">
        <img src="/hero/auth.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(14,17,22,0.55) 0%, rgba(22,40,29,0.45) 100%)' }} />
        <div className="relative z-10 h-full flex flex-col justify-between p-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <img src="/brand/planfully-symbol.svg" alt="" className="h-8 w-8 invert" />
            <span className="font-display text-lg">Planfully</span>
          </Link>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] mb-2 text-white/80">Network · Italia</p>
            <h1 className="font-display text-2xl leading-tight">Il tuo network di professionisti degli eventi. In un posto solo.</h1>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="lg:col-span-2 flex items-center justify-center p-6 sm:p-10" style={{ background: 'rgb(var(--bg-elev))' }}>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="font-display text-3xl tracking-tight">Bentornat*</h2>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">Accedi con le tue credenziali o un magic link.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                <Input id="email" type="email" autoComplete="email" required value={email}
                  className="pl-9" onChange={(e) => setEmail(e.target.value)} placeholder="tu@esempio.it" />
              </div>
            </div>
            {!magicMode && (
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
                  <Input id="password" type="password" autoComplete="current-password" required={!magicMode} value={password}
                    className="pl-9" onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
            )}
            {error && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert" data-testid="login-error">{error}</p>}
            {info && <p className="text-sm text-[rgb(var(--emerald-500))]" role="status" data-testid="login-info">{info}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={busy}>
              {busy ? 'Attendi...' : magicMode ? 'Invia magic link' : 'Accedi'}
            </Button>
            <div className="flex justify-between text-sm">
              <button type="button" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:underline"
                onClick={() => { setMagicMode((m) => !m); setError(null); setInfo(null) }}>
                {magicMode ? 'Usa password' : 'Usa magic link'}
              </button>
              <Link to="/forgot-password" className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:underline">
                Password dimenticata?
              </Link>
            </div>
            <p className="text-sm text-center text-[rgb(var(--fg-muted))] pt-2">
              Non hai un account?{' '}
              <Link to="/register" className="font-medium text-[rgb(var(--fg))] hover:underline">Registrati</Link>
            </p>
            <p className="text-xs text-center text-[rgb(var(--fg-subtle))]">
              Hai ricevuto un preventivo?{' '}
              <Link to="/area-cliente/accedi" className="font-medium text-[rgb(var(--fg-muted))] hover:underline">Accedi alla tua area cliente</Link>
            </p>
          </form>
          <div className="text-center pt-3">
            <a href="#scopri" className="text-xs text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))] inline-flex items-center gap-1">
              Scopri il progetto <ArrowRight size={11} className="rotate-90" />
            </a>
          </div>
        </motion.div>
      </div>
    </div>

      {/* ── Marketing B2B ─────────────────────────────────────────────── */}
      <section id="scopri" className="relative" style={{ background: 'rgb(var(--bg))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20 sm:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[rgb(var(--gold-600))] mb-4">
                <Sparkles size={12} /> Network indipendente per gli eventi italiani
              </span>
              <h2 className="font-display text-4xl sm:text-5xl tracking-tight leading-[1.05] mb-5">
                Crea il <em className="text-[rgb(var(--gold-600))] not-italic">tuo</em> network professionale.<br />
                Riprenditi il <em className="text-[rgb(var(--gold-600))] not-italic">valore</em> del tuo lavoro.
              </h2>
              <p className="text-lg text-[rgb(var(--fg-muted))] max-w-2xl leading-relaxed">
                Planfully è uno strumento di lavoro per wedding planner, location e fornitori che vogliono
                organizzarsi in rete senza dipendere da grandi piattaforme centralizzate.
              </p>
              <p className="text-base text-[rgb(var(--fg-muted))] max-w-2xl mt-4 leading-relaxed">
                Negli ultimi anni il settore eventi in Italia si è progressivamente concentrato nelle
                mani di pochi grandi marketplace internazionali, che intermediano contatti, dettano
                commissioni e definiscono regole di visibilità. Crediamo che il valore generato dal lavoro
                dei professionisti italiani debba restare ai professionisti italiani: i clienti, le
                relazioni, le foto, i prezzi, i contratti sono <strong>tuoi</strong> e devono rimanere
                <strong> tuoi</strong>.
              </p>
              <p className="text-base text-[rgb(var(--fg-muted))] max-w-2xl mt-4 leading-relaxed">
                Planfully è un'<strong>alternativa indipendente</strong>: un'infrastruttura tecnica
                neutrale che ogni studio può usare per costruire il proprio ecosistema di collaborazioni,
                senza cedere dati, senza pagare commissioni sul singolo evento, senza algoritmi che
                decidono chi vede chi.
              </p>
            </div>

            <aside className="lg:col-span-5 lg:sticky lg:top-8">
              <div className="rounded-2xl border p-6 sm:p-7 backdrop-blur" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev) / 0.7)' }}>
                <p className="text-xs uppercase tracking-[0.2em] text-[rgb(var(--fg-subtle))] mb-3">In sintesi</p>
                <h3 className="font-display text-2xl mb-3">Costruisci la tua rete.</h3>
                <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed mb-4">
                  Nei marketplace tradizionali i fornitori comprano lead, gli sposi scelgono.
                  Qui sei <strong>tu</strong> — Wedding Planner o Location — a costruire la
                  tua rete di professionisti di fiducia. Decidi chi sale a bordo, lavori come
                  un team. Status game, non corsa al ribasso.
                </p>
                <ul className="space-y-2.5 text-sm">
                  <Bullet text="Gratis per tutti i professionisti fino a dicembre 2026" />
                  <Bullet text="Network privato: scegli tu chi fa parte della tua rete" />
                  <Bullet text="Nessuna commissione sugli eventi, nessuna esclusiva" />
                  <Bullet text="I tuoi dati restano tuoi: GDPR-first, export sempre disponibile" />
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ── Per chi ───────────────────────────────────────────────────── */}
      <section className="border-t" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <h2 className="font-display text-3xl sm:text-4xl mb-3">Costruito per chi lavora sul campo.</h2>
          <p className="text-base text-[rgb(var(--fg-muted))] max-w-2xl mb-10">
            Tre ruoli, un'unica piattaforma. Ognuno vede quello che gli serve — niente di più, niente di meno.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <RoleCard
              icon={Compass}
              title="Wedding planner / Location"
              copy="Orchestri l'evento, scegli i fornitori, generi preventivi e contratti, gestisci budget e timeline. La tua rete è privata e nominale."
              points={['Catalogo personale di fornitori fidati', 'Preventivi versionati con PDF brandizzato', 'Tavoli, invitati, scaletta, mood, playlist', 'Stato pagamenti voce-per-voce']}
            />
            <RoleCard
              icon={Network}
              title="Fornitori"
              copy="Catalogo dei tuoi servizi, calendario di disponibilità, suggerimenti di prezzo, calcolatore composizioni. Vedi solo gli eventi dove sei stato invitato."
              points={['Tu decidi quando sei disponibile', 'Aggiungi solo servizi del tuo settore', 'I tuoi tariffari restano privati', 'Materiale foto/video sempre tuo']}
            />
            <RoleCard
              icon={Handshake}
              title="Clienti finali"
              copy="Sito pubblico per gli ospiti, programma e RSVP, foto centrabile in hero. Possono richiedere modifiche al planner — niente caos sui WhatsApp."
              points={['Sito ospiti con dominio dedicato', 'Richieste modifiche tracciate', 'RSVP web → arrivano al planner', 'Trasporti, alloggi, gift registry']}
            />
          </div>
        </div>
      </section>

      {/* ── Funzionalità ──────────────────────────────────────────────── */}
      <section className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-20">
          <h2 className="font-display text-3xl sm:text-4xl mb-3">Cosa c'è dentro.</h2>
          <p className="text-base text-[rgb(var(--fg-muted))] max-w-2xl mb-10">
            Strumenti pensati per il flusso reale di un evento italiano — matrimonio, battesimo, comunione, cresima, anniversario, evento aziendale — dalla prima richiesta al saldo finale.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Feature icon={Users} title="Invitati & RSVP" copy="Gestione tavoli, diete, allergie, sub-eventi. Import CSV." />
            <Feature icon={Calendar} title="Calendario" copy="Disponibilità fornitori sì/forse/no. Blocco automatico." />
            <Feature icon={FileText} title="Preventivi & contratti" copy="Versioning, PDF, link cliente, firma digitale." />
            <Feature icon={ShieldCheck} title="Pagamenti tracciati" copy="Stato per ogni voce: chi paga cosa, quando, come." />
            <Feature icon={Network} title="Rete fornitori" copy="Invito nominale. Loro vedono solo i tuoi eventi." />
            <Feature icon={Sparkles} title="Sito evento" copy="Sito pubblico per ospiti con foto e programma." />
            <Feature icon={LockIcon} title="GDPR-first" copy="Cancellazione account, privacy, export dati." />
            <Feature icon={Compass} title="Finanziamento & polizze" copy="Partner per il cliente finale. Esclusive di rete." />
          </div>
        </div>
      </section>

      {/* ── Come funziona ─────────────────────────────────────────────── */}
      <section className="border-t" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20">
          <h2 className="font-display text-3xl sm:text-4xl mb-3">Come iniziare.</h2>
          <p className="text-base text-[rgb(var(--fg-muted))] mb-8">
            Il modello è semplice. Niente onboarding lungo, niente call obbligatorie.
          </p>
          <ol className="space-y-5">
            <Step n="1" title="Apri il tuo studio" copy="Ti registri come wedding planner o location. Importi i tuoi fornitori abituali con un invito email." />
            <Step n="2" title="I fornitori entrano nella tua rete" copy="Accettano l'invito, popolano il loro catalogo e calendario, restano sempre titolari dei propri dati e prezzi." />
            <Step n="3" title="Costruisci l'evento" copy="Preventivo, contratto, tavoli, scaletta, sito ospiti, pagamenti. Clienti e fornitori vedono solo quello che li riguarda." />
            <Step n="4" title="Mantieni la relazione" copy="Storico cliente, materiali e contatti restano nel tuo account. Se domani cambi piattaforma, te li porti via." />
          </ol>
          <div className="mt-10 p-6 rounded-2xl border" style={{ borderColor: 'rgb(var(--border))' }}>
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              <strong>Prezzi e condizioni commerciali</strong> sono in fase di definizione e vengono
              comunicati in privato ai professionisti che richiedono accesso. Scrivici per una conversazione
              senza impegno.
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Link to="/register">
                <Button variant="gold">Richiedi accesso <ArrowRight size={14} /></Button>
              </Link>
              <a href="mailto:hello@planfully.it">
                <Button variant="outline">Scrivici in privato</Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg))' }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <img src="/brand/planfully-symbol.svg" alt="" className="h-7 w-7" />
              <span className="font-display text-lg">Planfully</span>
            </div>
            <p className="text-[rgb(var(--fg-muted))]">
              Un progetto <strong>Fuyue Srl</strong> — software indipendente per la rete degli eventi italiani.
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Risorse</p>
            <ul className="space-y-1.5">
              <li><Link to="/privacy" className="hover:underline">Privacy</Link></li>
              <li><Link to="/cookie" className="hover:underline">Cookie</Link></li>
              <li><a href="mailto:hello@planfully.it" className="hover:underline">Contatti commerciali</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Società</p>
            <p className="text-[rgb(var(--fg-muted))]">
              Fuyue Srl<br />
              Italia<br />
              <a href="mailto:hello@planfully.it" className="hover:underline">hello@planfully.it</a>
            </p>
          </div>
        </div>
        <div className="border-t py-4 text-center text-xs text-[rgb(var(--fg-subtle))]" style={{ borderColor: 'rgb(var(--border))' }}>
          © {new Date().getFullYear()} Fuyue Srl — Planfully è un marchio Fuyue Srl. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  )
}

function Bullet({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--gold-500))] flex-shrink-0" />
      <span className="text-[rgb(var(--fg))]">{text}</span>
    </li>
  )
}

function RoleCard({ icon: Icon, title, copy, points }: { icon: any; title: string; copy: string; points: string[] }) {
  return (
    <div className="rounded-2xl border p-6 hover:shadow-[var(--shadow-lift)] transition-shadow" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg))' }}>
      <Icon size={20} className="text-[rgb(var(--gold-600))] mb-3" />
      <h3 className="font-display text-xl mb-2">{title}</h3>
      <p className="text-sm text-[rgb(var(--fg-muted))] mb-4 leading-relaxed">{copy}</p>
      <ul className="space-y-1.5 text-sm">
        {points.map((p) => <Bullet key={p} text={p} />)}
      </ul>
    </div>
  )
}

function Feature({ icon: Icon, title, copy }: { icon: any; title: string; copy: string }) {
  return (
    <div className="rounded-xl p-4 border" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg))' }}>
      <Icon size={16} className="text-[rgb(var(--gold-600))] mb-2" />
      <h4 className="font-medium text-sm mb-1">{title}</h4>
      <p className="text-xs text-[rgb(var(--fg-muted))] leading-snug">{copy}</p>
    </div>
  )
}

function Step({ n, title, copy }: { n: string; title: string; copy: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex-shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full font-display text-base"
        style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}>{n}</span>
      <div>
        <h3 className="font-display text-lg mb-0.5">{title}</h3>
        <p className="text-sm text-[rgb(var(--fg-muted))] leading-relaxed">{copy}</p>
      </div>
    </li>
  )
}
