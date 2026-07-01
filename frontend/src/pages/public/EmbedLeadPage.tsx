import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getQuestionsForSubrole, subroleLabel } from '@/lib/supplierQuestions'
import type { Question } from '@/lib/eventQuestions'

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
  type Pro = { business_name?: string | null; full_name?: string | null; subrole?: string | null; tagline?: string | null; city?: string | null; bio?: string | null; brand_logo_url?: string | null; cover_image_url?: string | null; brand_primary_color?: string | null }
  const [pro, setPro] = useState<Pro | null>(null)
  const [brandKit, setBrandKit] = useState<{ primary?: string | null; secondary?: string | null; photos?: string[] } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [callbackPref, setCallbackPref] = useState('indifferente')
  const [altSent, setAltSent] = useState(false)
  const [subrole, setSubrole] = useState<string | null>(null)          // categoria del professionista
  const [catAnswers, setCatAnswers] = useState<Record<string, unknown>>({}) // risposte alle domande di categoria
  // GIOCO "scegli il tuo stile": TORNEO a coppie ("questo o questo?") dagli asset taggati
  // del fornitore. Si restringe round dopo round fino a poche scelte finali (lo stile vero).
  type Card = { id: string; path: string | null; image_url?: string | null; caption?: string | null; tags: string[] }
  const [round, setRound] = useState<Card[]>([])      // coda del round corrente
  const [winners, setWinners] = useState<Card[]>([])  // vincitori di questo round
  const [pairIdx, setPairIdx] = useState(0)           // indice coppia (a 2 a 2)
  const [finalists, setFinalists] = useState<Card[] | null>(null)
  const [hasGame, setHasGame] = useState(false)
  const [liked, setLiked] = useState<{ id: string; url: string; tags: string[] }[]>([])
  const [tagScore, setTagScore] = useState<Record<string, number>>({}) // matching: punteggio tag (pesato per round)
  const [roundNum, setRoundNum] = useState(1)
  const cardUrl = (c: { path: string | null; image_url?: string | null }) => c.image_url || (c.path ? supabase.storage.from('supplier-assets').getPublicUrl(c.path).data.publicUrl : '')
  const FINALISTS = 3
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
          const p = data as Pro | null
          if (!error && p) { setProName(p.business_name || p.full_name || ''); setSubrole(p.subrole ?? null); setPro(p); return }
        } catch { /* prova il prossimo */ }
      }
    })()
  }, [slug])

  // Brand kit (colori + FOTO del catalogo) per il mini-sito che incornicia il form.
  useEffect(() => {
    if (!slug) return
    void (async () => {
      try {
        const { data } = await (supabase as unknown as AnyRpc).rpc('public_brand_kit', { p_slug: slug })
        const d = data as { brand_primary_color?: string | null; brand_secondary_color?: string | null; photos?: string[] } | null
        if (d) setBrandKit({ primary: d.brand_primary_color, secondary: d.brand_secondary_color, photos: Array.isArray(d.photos) ? d.photos : [] })
      } catch { /* facoltativo */ }
    })()
  }, [slug])

  // Card del gioco "scegli il tuo stile" (asset taggati del fornitore), filtrate per tipo evento.
  // Avviamo un TORNEO: mescola, prendi fino a 16, poi duelli a coppie.
  useEffect(() => {
    if (!slug) return
    void (async () => {
      try {
        const { data } = await (supabase as unknown as AnyRpc).rpc('get_supplier_assets', { p_slug: slug, p_event_kind: form.event_kind, p_limit: 30 })
        const arr = (Array.isArray(data) ? data : []) as Card[]
        const pool = [...arr].sort(() => Math.random() - 0.5).slice(0, 16)
        setRound(pool); setWinners([]); setPairIdx(0); setFinalists(null); setLiked([]); setHasGame(pool.length >= 2)
        setTagScore({}); setRoundNum(1)
      } catch { setHasGame(false) }
    })()
  }, [slug, form.event_kind])

  // Fine round / fine torneo
  function endOfRound(w: Card[]) {
    if (w.length <= FINALISTS) {
      setFinalists(w)
      setLiked(w.map((c) => ({ id: c.id, url: cardUrl(c), tags: c.tags ?? [] })))
    } else {
      setRound([...w].sort(() => Math.random() - 0.5)); setWinners([]); setPairIdx(0); setRoundNum((r) => r + 1)
    }
  }
  function choose(card: Card) {
    // MATCHING: la foto scelta dà punti ai suoi tag, pesati per round (i round profondi pesano di più)
    setTagScore((s) => { const m = { ...s }; for (const t of card.tags ?? []) m[t] = (m[t] || 0) + roundNum; return m })
    const w = [...winners, card]
    const next = pairIdx + 2
    if (next >= round.length) endOfRound(w)
    else { setWinners(w); setPairIdx(next) }
  }
  // Profilo di stile ordinato dal matching (tag → punteggio)
  const styleProfile = Object.entries(tagScore).sort((a, b) => b[1] - a[1])
  const rankedTags = styleProfile.map(([t]) => t).slice(0, 8)
  // bye automatico: numero dispari → l'ultima card avanza da sola
  useEffect(() => {
    if (finalists || round.length === 0) return
    if (pairIdx < round.length && pairIdx + 1 >= round.length) {
      const w = [...winners, round[pairIdx]!]
      if (pairIdx + 2 >= round.length) endOfRound(w)
      else { setWinners(w); setPairIdx(pairIdx + 2) }
    }
  }, [round, pairIdx, winners, finalists]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleChip(key: 'styles' | 'priorities', val: string, max: number) {
    setForm((f) => {
      const cur = f[key]
      if (cur.includes(val)) return { ...f, [key]: cur.filter((x) => x !== val) }
      if (cur.length >= max) return f
      return { ...f, [key]: [...cur, val] }
    })
  }

  // Risposte alle domande di categoria (specifiche del subrole del professionista)
  function setCat(key: string, val: unknown) { setCatAnswers((a) => ({ ...a, [key]: val })) }
  function toggleCatMulti(key: string, val: string) {
    setCatAnswers((a) => { const cur = Array.isArray(a[key]) ? (a[key] as string[]) : []; return { ...a, [key]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] } })
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
          ...catAnswers, // risposte alle domande specifiche di categoria (fiorista, fotografo, ...)
          ...(liked.length ? { liked_style_cards: liked } : {}),
          ...(rankedTags.length ? { liked_tags: rankedTags, style_profile: styleProfile.slice(0, 8).map(([tag, score]) => ({ tag, score })) } : {}),
          callback_pref: callbackPref,
        },
      })
      if (error) throw error
      const r = data as { ok?: boolean; error?: string; id?: string; kind?: string }
      if (r.error) throw new Error(r.error)
      // Notifica in-app: trigger DB. Email al WP: invoke dal browser (anon key del bundle, no GUC).
      if (r.kind === 'wp' && r.id) void supabase.functions.invoke('lead-notify', { body: { lead_id: r.id } }).catch(() => {})
      setSent(true)
      window.parent?.postMessage({ type: 'planfully:embed-submitted' }, '*')
    } catch (e) {
      setError(e instanceof Error && e.message === 'profile_not_found'
        ? 'Professionista non trovato.'
        : 'Invio non riuscito. Riprova tra poco.')
    } finally { setSending(false) }
  }

  // MINI-SITO: quando il link è aperto da solo (NON dentro un iframe), avvolgiamo il
  // form in una cornice brandizzata coi COLORI DEL BRAND e le FOTO DEL CATALOGO.
  // Dentro un iframe o con ?embed=1 / ?bg=transparent resta il form nudo, come prima.
  const embedded = typeof window !== 'undefined' && window.self !== window.top
  const siteMode = !embedded && !transparent && sp.get('embed') !== '1'
  const toHex = (c?: string | null) => { const h = (c || '').replace('#', ''); return /^[0-9a-fA-F]{6}$/.test(h) ? `#${h}` : null }
  const brandPrimary = toHex(brandKit?.primary) || toHex(pro?.brand_primary_color)
  const brandSecondary = toHex(brandKit?.secondary)
  // In modalità sito uso il colore del brand come accento del form (bottoni, chip, hero).
  const accent = siteMode && brandPrimary ? brandPrimary : primary
  const ui = useMemo(() => makeStyles(accent, narrow), [accent, narrow])
  const heroColor = brandPrimary || accent
  const heroColor2 = brandSecondary || heroColor
  // SOLO le foto del catalogo del fornitore
  const heroAssets = siteMode ? (brandKit?.photos ?? []).filter(Boolean).slice(0, 4) : []
  const hero = siteMode ? (
    <div style={{ maxWidth: 560, margin: '0 auto 14px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 24px rgba(15,23,42,.10)' }}>
      <div style={{ position: 'relative', minHeight: 130, display: 'flex', alignItems: 'flex-end', padding: 16,
        background: pro?.cover_image_url ? `center/cover no-repeat url("${pro.cover_image_url}")` : `linear-gradient(135deg, ${heroColor}, ${heroColor2})` }}>
        {pro?.cover_image_url && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,.05))' }} />}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          {pro?.brand_logo_url
            ? <img src={pro.brand_logo_url} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', background: '#fff', border: '2px solid #fff' }} />
            : <div style={{ width: 56, height: 56, borderRadius: 12, background: '#fff', color: heroColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26 }}>{(proName || 'P').slice(0, 1).toUpperCase()}</div>}
          <div style={{ color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.35)' }}>
            <div style={{ fontSize: 19, fontWeight: 800, lineHeight: 1.1 }}>{proName || 'Professionista'}</div>
            <div style={{ fontSize: 12.5, opacity: 0.95, marginTop: 1 }}>{[pro?.subrole && subroleLabel(pro.subrole), pro?.city].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      </div>
      {(pro?.tagline || pro?.bio) && <div style={{ background: '#fff', padding: '10px 16px', fontSize: 13, color: '#475569', lineHeight: 1.45 }}>{pro?.tagline || pro?.bio}</div>}
      {heroAssets.length >= 2 && (
        <div style={{ display: 'flex', gap: 4, background: '#fff', padding: '0 8px 10px' }}>
          {heroAssets.map((u, i) => <div key={i} style={{ flex: 1, aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#f4f1ea' }}><img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>)}
        </div>
      )}
    </div>
  ) : null
  const footer = siteMode ? (
    <div style={{ maxWidth: 560, margin: '14px auto 0', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
      {pro?.city ? `${pro.city} · ` : ''}Powered by Planfully
    </div>
  ) : null

  if (altSent) {
    return (
      <div ref={rootRef} style={{ ...ui.page, background: transparent ? 'transparent' : ui.page.background }}>
        {hero}
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
        {footer}
      </div>
    )
  }
  if (sent) {
    return (
      <div ref={rootRef} style={{ ...ui.page, background: transparent ? 'transparent' : ui.page.background }}>
        {hero}
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
        {footer}
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ ...ui.page, background: transparent ? 'transparent' : ui.page.background }}>
      {hero}
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
        <Field label="Quando preferisci che ti ricontattiamo?">
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

        {/* GIOCO "SCEGLI IL TUO STILE": TORNEO a coppie ("questo o questo?"). Si restringe
            round dopo round fino a poche scelte finali → lo stile vero del cliente, al pro. */}
        {!compact && hasGame && (() => {
          const A = round[pairIdx], B = round[pairIdx + 1]
          const DuelCard = ({ c }: { c: Card }) => (
            <button type="button" onClick={() => choose(c)} style={{ flex: 1, minWidth: 0, padding: 0, border: '2px solid transparent', borderRadius: 14, overflow: 'hidden', background: '#fff', cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,.12)' }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = primary)} onMouseOut={(e) => (e.currentTarget.style.borderColor = 'transparent')}>
              {/* foto INTERA (contain): il cliente la vede tutta, niente crop */}
              <div style={{ aspectRatio: '3 / 4', background: '#f4f1ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={cardUrl(c)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
              </div>
              {(c.caption || (c.tags ?? []).length > 0) && (
                <div style={{ padding: '6px 8px 8px', textAlign: 'left' }}>
                  {c.caption && <div style={{ fontSize: 12, fontWeight: 600, color: '#3a3a3a' }}>{c.caption}</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                    {(c.tags ?? []).slice(0, 3).map((t) => <span key={t} style={{ fontSize: 9, background: 'rgba(0,0,0,.06)', color: '#555', borderRadius: 99, padding: '1px 6px' }}>{t}</span>)}
                  </div>
                </div>
              )}
            </button>
          )
          return (
            <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.08)' }}>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Scegli il tuo stile ✨</p>
              {finalists ? (
                <div style={{ textAlign: 'center', padding: '6px 0' }}>
                  <p style={{ fontSize: 14 }}>{finalists.length > 0 ? `Ecco il tuo stile: ${finalists.length} preferiti.` : 'Saltato — nessun problema.'}</p>
                  {finalists.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                    {finalists.map((l) => <div key={l.id} style={{ width: 72, height: 90, borderRadius: 8, border: `2px solid ${primary}`, background: '#f4f1ea', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}><img src={cardUrl(l)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>)}
                  </div>}
                  {rankedTags.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>Il tuo stile, in ordine:</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center' }}>
                        {rankedTags.slice(0, 6).map((t, i) => <span key={t} style={{ fontSize: 11, borderRadius: 99, padding: '2px 9px', background: i === 0 ? primary : 'rgba(0,0,0,.06)', color: i === 0 ? '#fff' : '#555', fontWeight: i === 0 ? 600 : 400 }}>{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              ) : A && B ? (<>
                <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Tra le due, quale preferisci? Andiamo avanti finché restano i tuoi preferiti.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <DuelCard c={A} />
                  <span style={{ fontSize: 11, opacity: 0.5, fontWeight: 600 }}>oppure</span>
                  <DuelCard c={B} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <p style={{ fontSize: 11, opacity: 0.5 }}>{round.length} in gara · restano {Math.max(FINALISTS, Math.ceil((winners.length + round.length - pairIdx) / 2))}</p>
                  <button type="button" onClick={() => { setFinalists([]); setLiked([]) }} style={{ fontSize: 11, color: primary, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>salta</button>
                </div>
              </>) : null}
            </div>
          )
        })()}

        {/* DOMANDE SPECIFICHE DI CATEGORIA (dal subrole del professionista): le risposte
            arrivano automaticamente a chi crea il preventivo. */}
        {!compact && subrole && (() => {
          const catSections = getQuestionsForSubrole(subrole).slice(0, 2).filter((s) => (s.questions?.length ?? 0) > 0)
          if (!catSections.length) return null
          return (
            <>
              <div style={{ marginTop: 6, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.08)' }}>
                <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>Qualche dettaglio per {proName || subroleLabel(subrole)}</p>
                <p style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Aiuta {proName ? 'il professionista' : 'chi ti seguirà'} a capire subito i tuoi gusti (facoltativo).</p>
              </div>
              {catSections.flatMap((sec) => sec.questions).map((q: Question) => {
                const v = catAnswers[q.key]
                return (
                  <Field key={q.key} label={q.label}>
                    {q.type === 'textarea' ? (
                      <textarea style={{ ...ui.input, minHeight: 56, resize: 'vertical' }} value={(v as string) ?? ''} onChange={(e) => setCat(q.key, e.target.value)} placeholder={q.placeholder} />
                    ) : q.type === 'select' ? (
                      <select style={ui.input} value={(v as string) ?? ''} onChange={(e) => setCat(q.key, e.target.value)}>
                        <option value="">Seleziona…</option>
                        {(q.options ?? []).map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                      </select>
                    ) : q.type === 'multiselect' ? (
                      <div style={ui.chips}>
                        {(q.options ?? []).map((o) => {
                          const on = Array.isArray(v) && (v as string[]).includes(o)
                          return <button key={o} type="button" onClick={() => toggleCatMulti(q.key, o)} style={on ? ui.chipOn : ui.chip}>{o.replace(/_/g, ' ')}</button>
                        })}
                      </div>
                    ) : q.type === 'tags' ? (
                      <input style={ui.input} value={Array.isArray(v) ? (v as string[]).join(', ') : ((v as string) ?? '')} onChange={(e) => setCat(q.key, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} placeholder={q.placeholder} />
                    ) : q.type === 'number' ? (
                      <input style={ui.input} type="number" value={(v as number | string) ?? ''} onChange={(e) => setCat(q.key, e.target.value ? Number(e.target.value) : null)} placeholder={q.placeholder} />
                    ) : q.type === 'date' ? (
                      <input style={ui.input} type="date" value={(v as string) ?? ''} onChange={(e) => setCat(q.key, e.target.value)} />
                    ) : (
                      <input style={ui.input} value={(v as string) ?? ''} onChange={(e) => setCat(q.key, e.target.value)} placeholder={q.placeholder} />
                    )}
                  </Field>
                )
              })}
            </>
          )
        })()}

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
          Inviando accetti il trattamento dei dati per essere ricontattato/a. Powered by Planfully.
        </p>
      </form>
      {footer}
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
  // Colore testo leggibile sul brand: se il brand è chiaro, testo scuro (altrimenti il bottone
  // bianco-su-bianco sparisce). + bordo/ombra così resta visibile anche con brand quasi bianco.
  const L = (() => { const m = primary.replace('#', ''); if (m.length < 6) return 0.5; const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255; return 0.299 * r + 0.587 * g + 0.114 * b })()
  const onPrimary = L > 0.6 ? '#1a1a1a' : '#fff'
  const primaryBorder = `1px solid ${L > 0.85 ? 'rgba(0,0,0,.2)' : primary}`
  return {
    page: { background: '#f6f7f9', padding: 14, minHeight: '100%', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' } as React.CSSProperties,
    card: { maxWidth: 560, margin: '0 auto', background: '#fff', border: '1px solid #e6e8ec', borderRadius: 14, padding: 20, boxShadow: '0 1px 3px rgba(15,23,42,0.06)' } as React.CSSProperties,
    h2: { fontSize: 19, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' } as React.CSSProperties,
    muted: { fontSize: 13, color: '#64748b', margin: '0 0 14px' } as React.CSSProperties,
    grid2: { display: 'grid', gridTemplateColumns: narrow ? '1fr' : '1fr 1fr', gap: 10 } as React.CSSProperties,
    input,
    chips: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 2 } as React.CSSProperties,
    chip: chipBase,
    chipOn: { ...chipBase, background: primary, border: primaryBorder, color: onPrimary } as React.CSSProperties,
    submit: { width: '100%', marginTop: 6, padding: '11px 16px', fontSize: 15, fontWeight: 700, color: onPrimary, background: primary, border: primaryBorder, borderRadius: 9, cursor: 'pointer', boxShadow: '0 2px 10px rgba(15,23,42,.18)' } as React.CSSProperties,
    legal: { fontSize: 11, color: '#94a3b8', textAlign: 'center', margin: '10px 0 0' } as React.CSSProperties,
    error: { fontSize: 13, color: '#dc2626', margin: '4px 0 0' } as React.CSSProperties,
  }
}
