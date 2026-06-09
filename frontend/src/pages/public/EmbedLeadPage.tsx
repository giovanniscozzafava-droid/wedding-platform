import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

// ============================================================================
// Form lead EMBEDDABILE — pensato per girare dentro un <iframe> su siti terzi
// (Wix, Squarespace, WordPress, Webflow, Shopify...). Zero dipendenze dal
// layout/app: solo stili inline, nessuna navigazione dentro l'app, nessun
// funnel login. Auto-resize via postMessage per i builder che lo supportano.
// Personalizzabile via query: ?primary=RRGGBB&bg=transparent&compact=1
// ============================================================================

type AnyRpc = { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }

const EVENT_KINDS: { v: string; l: string }[] = [
  { v: 'matrimonio', l: 'Matrimonio' }, { v: 'battesimo', l: 'Battesimo' },
  { v: 'comunione', l: 'Comunione' }, { v: 'cresima', l: 'Cresima' },
  { v: 'compleanno', l: 'Compleanno' }, { v: 'anniversario', l: 'Anniversario' },
  { v: 'laurea', l: 'Laurea' }, { v: 'corporate', l: 'Evento aziendale' },
  { v: 'altro', l: 'Altro' },
]

const BUDGETS = [
  { v: 'undecided', l: 'Non ancora deciso' }, { v: '<5k', l: 'Sotto i 5.000 €' },
  { v: '5-10k', l: '5.000 – 10.000 €' }, { v: '10-20k', l: '10.000 – 20.000 €' },
  { v: '20-50k', l: '20.000 – 50.000 €' }, { v: '>50k', l: 'Oltre i 50.000 €' },
]

const STYLE_COMMON = ['classico', 'elegante', 'moderno', 'minimal', 'colorato']
const STYLE_BY_KIND: Record<string, string[]> = {
  matrimonio: ['classico', 'elegante', 'romantico', 'boho', 'minimal', 'rustico', 'vintage', 'glamour', 'sul mare'],
  anniversario: ['classico', 'elegante', 'romantico', 'intimo', 'vintage', 'glamour'],
  battesimo: ['classico', 'tenero', 'minimal', 'colorato', 'a tema'],
  comunione: ['classico', 'sobrio', 'colorato', 'a tema', 'campagna'],
  cresima: ['classico', 'sobrio', 'moderno', 'colorato', 'a tema'],
  compleanno: ['festoso', 'a tema', 'elegante', 'colorato', 'anni 80/90', 'minimal'],
  laurea: ['festoso', 'elegante', 'sobrio', 'a tema', 'colorato'],
  corporate: ['professionale', 'minimal', 'moderno', 'elegante', 'brandizzato'],
  altro: STYLE_COMMON,
}
const PRIORITY_BY_KIND: Record<string, string[]> = {
  matrimonio: ['location', 'cibo & catering', 'fotografo', 'video', 'fiori & allestimenti', 'musica & intrattenimento', 'abito', 'viaggio di nozze'],
  anniversario: ['location', 'cibo & catering', 'fotografo', 'musica', 'allestimenti', 'torta'],
  battesimo: ['location', 'cibo & catering', 'fotografo', 'allestimenti', 'torta', 'bomboniere', 'animazione bimbi'],
  comunione: ['location', 'cibo & catering', 'fotografo', 'allestimenti', 'torta', 'bomboniere', 'animazione bimbi'],
  cresima: ['location', 'cibo & catering', 'fotografo', 'allestimenti', 'torta', 'bomboniere'],
  compleanno: ['location', 'cibo & catering', 'intrattenimento', 'torta', 'allestimenti', 'animazione', 'fotografo'],
  laurea: ['location', 'cibo & catering', 'fotografo', 'intrattenimento', 'torta', 'allestimenti'],
  corporate: ['location', 'catering', 'audio/video', 'allestimenti', 'speaker/intrattenimento', 'gadget'],
  altro: ['location', 'cibo & catering', 'fotografo', 'allestimenti', 'intrattenimento'],
}
const styleOptionsFor = (k: string) => STYLE_BY_KIND[k] ?? STYLE_COMMON
const priorityOptionsFor = (k: string) => PRIORITY_BY_KIND[k] ?? PRIORITY_BY_KIND.altro!

export default function EmbedLeadPage() {
  const { slug: slugParam } = useParams<{ slug: string }>()
  const [sp] = useSearchParams()
  const slug = slugParam || sp.get('slug') || ''
  const primary = `#${(sp.get('primary') || 'b08d57').replace(/[^0-9a-fA-F]/g, '').slice(0, 6) || 'b08d57'}`
  const transparent = sp.get('bg') === 'transparent'
  const compact = sp.get('compact') === '1'

  const rootRef = useRef<HTMLDivElement>(null)
  const [proName, setProName] = useState<string>('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [callbackPref, setCallbackPref] = useState('indifferente')
  const [altSent, setAltSent] = useState(false)
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    event_kind: 'matrimonio', event_date: '', event_location: '', guests_estimate: '',
    budget_range: 'undecided', message: '',
    story: '', styles: [] as string[], priorities: [] as string[],
    must_haves: '', no_thanks: '', honeypot: '',
  })

  // Viewport stretto (iframe su mobile): i campi a 2 colonne si impilano.
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const check = () => setNarrow((rootRef.current?.clientWidth ?? window.innerWidth) < 480)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Auto-resize: comunica l'altezza al parent (Wix & co. la usano se supportata)
  useEffect(() => {
    const post = () => {
      const h = rootRef.current?.scrollHeight ?? document.body.scrollHeight
      window.parent?.postMessage({ type: 'planfully:embed-height', height: h }, '*')
    }
    post()
    const ro = new ResizeObserver(post)
    if (rootRef.current) ro.observe(rootRef.current)
    return () => ro.disconnect()
  }, [sent, form.event_kind])

  // Nome del professionista (best-effort, non blocca il form se fallisce)
  useEffect(() => {
    if (!slug) return
    void (async () => {
      for (const fn of ['get_wp_public_profile', 'get_supplier_public_profile']) {
        try {
          const { data, error } = await (supabase as unknown as AnyRpc).rpc(fn, { p_slug: slug })
          const p = data as { business_name?: string | null; full_name?: string | null } | null
          if (!error && p) { setProName(p.business_name || p.full_name || ''); return }
        } catch { /* prova il prossimo */ }
      }
    })()
  }, [slug])

  function toggleChip(key: 'styles' | 'priorities', val: string, max: number) {
    setForm((f) => {
      const cur = f[key]
      if (cur.includes(val)) return { ...f, [key]: cur.filter((x) => x !== val) }
      if (cur.length >= max) return f
      return { ...f, [key]: [...cur, val] }
    })
  }

  async function submit() {
    setError('')
    if (!slug) { setError('Configurazione mancante (slug).'); return }
    if (!form.client_name.trim()) { setError('Inserisci nome e cognome.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.client_email.trim())) { setError('Inserisci un’email valida.'); return }
    if (form.client_phone.trim().replace(/[^\d+]/g, '').length < 6) { setError('Inserisci un numero di telefono.'); return }
    if (!form.event_kind) { setError('Scegli il tipo di evento.'); return }
    if (!form.event_date) { setError('Indica la data dell’evento (anche indicativa).'); return }
    setSending(true)
    try {
      // Il form NON mostra la disponibilità: la verifichiamo in silenzio. Se la
      // data è occupata, dirottiamo sull'email con 2 alternative (lo dice la mail).
      if (form.event_date) {
        try {
          const { data: av } = await (supabase as unknown as AnyRpc).rpc('public_check_availability', { p_slug: slug, p_date: form.event_date })
          const a = av as { available?: boolean; unknown?: boolean }
          if (a?.available === false && !a?.unknown) {
            await supabase.functions.invoke('suggest-alternatives', {
              body: { slug, date: form.event_date, client_name: form.client_name.trim(), client_email: form.client_email.trim(), event_kind: form.event_kind },
            })
            setAltSent(true)
            window.parent?.postMessage({ type: 'planfully:embed-submitted' }, '*')
            setSending(false)
            return
          }
        } catch { /* in caso di errore nel check, procediamo col lead normale */ }
      }
      const { data, error } = await (supabase as unknown as AnyRpc).rpc('submit_public_lead', {
        p_slug: slug,
        p_client_name: form.client_name.trim(),
        p_client_email: form.client_email.trim(),
        p_client_phone: form.client_phone.trim() || null,
        p_event_kind: form.event_kind,
        p_event_date: form.event_date || null,
        p_event_location: form.event_location.trim() || null,
        p_guests_estimate: form.guests_estimate ? Number(form.guests_estimate) : null,
        p_budget_range: form.budget_range || null,
        p_message: form.message.trim() || null,
        p_honeypot: form.honeypot,
        p_source: 'embed_form',
        p_profile_answers: {
          ...(form.story.trim() ? { how_met: form.story.trim() } : {}),
          ...(form.styles.length ? { styles: form.styles } : {}),
          ...(form.priorities.length ? { budget_priorities: form.priorities } : {}),
          ...(form.must_haves.trim() ? { must_haves: form.must_haves.trim() } : {}),
          ...(form.no_thanks.trim() ? { no_thanks: form.no_thanks.trim() } : {}),
          ...(form.guests_estimate ? { guests_estimate: Number(form.guests_estimate) } : {}),
          ...(form.budget_range && form.budget_range !== 'undecided' ? { budget_range: form.budget_range } : {}),
          callback_pref: callbackPref,
        },
      })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string; id?: string; kind?: string }
      if (r.error) throw new Error(r.error)
      // Notifica email solo per i lead WP (lead_requests); i fornitori la vedono in dashboard.
      if (r.kind === 'wp' && r.id) {
        void supabase.functions.invoke('lead-notify', { body: { lead_id: r.id } }).catch(() => {})
      }
      setSent(true)
      window.parent?.postMessage({ type: 'planfully:embed-submitted' }, '*')
    } catch (e) {
      setError(e instanceof Error && e.message === 'profile_not_found'
        ? 'Professionista non trovato.'
        : 'Invio non riuscito. Riprova tra poco.')
    } finally { setSending(false) }
  }

  const ui = useMemo(() => makeStyles(primary, narrow), [primary, narrow])

  if (altSent) {
    return (
      <div ref={rootRef} style={{ ...ui.page, background: transparent ? 'transparent' : ui.page.background }}>
        <div style={ui.card}>
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>✉️</div>
            <h2 style={{ ...ui.h2, marginTop: 12 }}>Ti abbiamo scritto!</h2>
            <p style={ui.muted}>
              Grazie{form.client_name ? `, ${form.client_name.split(' ')[0]}` : ''}! {proName || 'Il professionista'} non è disponibile per quella data,
              ma ti abbiamo inviato via email <strong>due colleghi dello stesso settore</strong> liberi in quel giorno, con i loro contatti. Controlla la posta.
            </p>
          </div>
        </div>
      </div>
    )
  }
  if (sent) {
    return (
      <div ref={rootRef} style={{ ...ui.page, background: transparent ? 'transparent' : ui.page.background }}>
        <div style={ui.card}>
          <div style={{ textAlign: 'center', padding: '24px 8px' }}>
            <div style={{ fontSize: 40, lineHeight: 1 }}>✓</div>
            <h2 style={{ ...ui.h2, marginTop: 12 }}>Richiesta inviata!</h2>
            <p style={ui.muted}>
              Grazie{form.client_name ? `, ${form.client_name.split(' ')[0]}` : ''}! La data è disponibile.
              {' '}{proName || 'Il professionista'} ti <strong>ricontatterà telefonicamente</strong>
              {callbackPref !== 'indifferente' ? ` in fascia ${callbackPref}` : ' al più presto'} per fissare una chiamata conoscitiva.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ ...ui.page, background: transparent ? 'transparent' : ui.page.background }}>
      <form
        style={ui.card}
        onSubmit={(e) => { e.preventDefault(); void submit() }}
        onKeyDown={(e) => {
          // Evita l'invio accidentale premendo Invio in un campo a riga singola.
          // L'invio avviene solo col pulsante; Invio resta attivo nelle textarea.
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') e.preventDefault()
        }}
      >
        <h2 style={ui.h2}>Richiedi un preventivo{proName ? ` a ${proName}` : ''}</h2>
        <p style={ui.muted}>Raccontaci il tuo evento: ti ricontatteremo con una proposta su misura.</p>

        <div style={ui.grid2}>
          <Field label="Nome e cognome *">
            <input style={ui.input} value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} placeholder="Mario Rossi" />
          </Field>
          <Field label="Email *">
            <input style={ui.input} type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} placeholder="mario@email.it" />
          </Field>
        </div>
        <Field label="Telefono *">
          <input style={ui.input} type="tel" value={form.client_phone} onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))} placeholder="+39 ..." />
        </Field>

        <div style={ui.grid2}>
          <Field label="Tipo di evento *">
            <select style={ui.input} value={form.event_kind} onChange={(e) => setForm((f) => ({ ...f, event_kind: e.target.value, styles: [], priorities: [] }))}>
              {EVENT_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </Field>
          <Field label="Data (anche indicativa) *">
            <input style={ui.input} type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
          </Field>
        </div>
        <Field label="Quando preferisci essere ricontattato?">
          <select style={ui.input} value={callbackPref} onChange={(e) => setCallbackPref(e.target.value)}>
            <option value="indifferente">Indifferente</option>
            <option value="mattina">Mattina (9–13)</option>
            <option value="pomeriggio">Pomeriggio (14–18)</option>
            <option value="sera">Sera (18–21)</option>
          </select>
        </Field>
        <div style={ui.grid2}>
          <Field label="Invitati stimati">
            <input style={ui.input} type="number" value={form.guests_estimate} onChange={(e) => setForm((f) => ({ ...f, guests_estimate: e.target.value }))} placeholder="120" />
          </Field>
          <Field label="Zona / location ideale">
            <input style={ui.input} value={form.event_location} onChange={(e) => setForm((f) => ({ ...f, event_location: e.target.value }))} placeholder="Es. Cosenza, Tropea..." />
          </Field>
        </div>
        <Field label="Budget orientativo">
          <select style={ui.input} value={form.budget_range} onChange={(e) => setForm((f) => ({ ...f, budget_range: e.target.value }))}>
            {BUDGETS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
          </select>
        </Field>

        {!compact && (
          <>
            <Field label="Raccontaci cosa immagini">
              <textarea style={{ ...ui.input, minHeight: 64, resize: 'vertical' }} value={form.story} onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))} placeholder="L'atmosfera che sogni, un'emozione che non deve mancare..." />
            </Field>
            <Field label="Stile che ti piace (max 3)">
              <div style={ui.chips}>
                {styleOptionsFor(form.event_kind).map((s) => (
                  <button key={s} type="button" onClick={() => toggleChip('styles', s, 3)} style={form.styles.includes(s) ? ui.chipOn : ui.chip}>{s}</button>
                ))}
              </div>
            </Field>
            <Field label="Su cosa vuoi investire di più (max 3)">
              <div style={ui.chips}>
                {priorityOptionsFor(form.event_kind).map((p) => (
                  <button key={p} type="button" onClick={() => toggleChip('priorities', p, 3)} style={form.priorities.includes(p) ? ui.chipOn : ui.chip}>{p}</button>
                ))}
              </div>
            </Field>
            <div style={ui.grid2}>
              <Field label="Cosa non può mancare">
                <input style={ui.input} value={form.must_haves} onChange={(e) => setForm((f) => ({ ...f, must_haves: e.target.value }))} placeholder="Es. open bar" />
              </Field>
              <Field label="Cosa proprio non vuoi">
                <input style={ui.input} value={form.no_thanks} onChange={(e) => setForm((f) => ({ ...f, no_thanks: e.target.value }))} placeholder="Es. lancio del riso" />
              </Field>
            </div>
          </>
        )}

        {/* honeypot anti-bot */}
        <input type="text" tabIndex={-1} autoComplete="off" name="website_url" value={form.honeypot}
          onChange={(e) => setForm((f) => ({ ...f, honeypot: e.target.value }))}
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden="true" />

        {error && <p style={ui.error}>{error}</p>}

        <button type="submit" disabled={sending}
          style={{ ...ui.submit, opacity: sending ? 0.5 : 1, cursor: 'pointer' }}>
          {sending ? 'Invio…' : 'Invia richiesta'}
        </button>
        <p style={ui.legal}>
          Inviando accetti il trattamento dei dati per essere ricontattato. Powered by Planfully.
        </p>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{label}</span>
      {children}
    </label>
  )
}

function makeStyles(primary: string, narrow = false) {
  const input: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '9px 11px', fontSize: 14,
    border: '1px solid #d6dae1', borderRadius: 8, background: '#fff', color: '#0f172a', outline: 'none',
    fontFamily: 'inherit',
  }
  const chipBase: React.CSSProperties = {
    padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 999,
    border: '1px solid #d6dae1', background: '#fff', color: '#475569', cursor: 'pointer',
  }
  return {
    page: { background: '#f6f7f9', padding: 14, minHeight: '100%', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' } as React.CSSProperties,
    card: { maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #e6e8ec', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' } as React.CSSProperties,
    h2: { fontSize: 19, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' } as React.CSSProperties,
    muted: { fontSize: 13, color: '#64748b', margin: '0 0 14px' } as React.CSSProperties,
    grid2: { display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 10 } as React.CSSProperties,
    input,
    chips: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 2 } as React.CSSProperties,
    chip: chipBase,
    chipOn: { ...chipBase, background: primary, borderColor: primary, color: '#fff' } as React.CSSProperties,
    submit: { width: '100%', marginTop: 6, padding: '11px 16px', fontSize: 15, fontWeight: 600, color: '#fff', background: primary, border: 'none', borderRadius: 9, cursor: 'pointer' } as React.CSSProperties,
    legal: { fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: '10px 0 0' } as React.CSSProperties,
    error: { fontSize: 13, color: '#dc2626', margin: '4px 0 0' } as React.CSSProperties,
  }
}
