import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Upload, Sparkles, Check, X, Send, Copy, Wand2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'
import {
  loadCatalog, createSession, uploadSelfie, generateProposal, setProposalStatus, sendSession,
  composePrompt, catsFor, CAT_LABEL, KIND_UI, kindForSubrole,
  type LookKind, type LookStyle, type LookSession, type LookProposal,
} from '@/lib/provaLook'

export default function ProvaLookPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'ADMIN'
  const fixedKind = kindForSubrole(profile?.subrole)
  const [kind, setKind] = useState<LookKind>(fixedKind ?? 'makeup')
  useEffect(() => { if (fixedKind) setKind(fixedKind) }, [fixedKind])
  const available = !!fixedKind || isAdmin
  const ui = KIND_UI[kind]
  const [backView, setBackView] = useState(true) // capelli: genera anche la vista da dietro

  const [catalog, setCatalog] = useState<LookStyle[]>([])
  const [session, setSession] = useState<LookSession | null>(null)
  const [clientName, setClientName] = useState('')
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selected, setSelected] = useState<Record<string, string>>({}) // category → style.id (single per categoria)
  const [freeText, setFreeText] = useState('')
  const [title, setTitle] = useState('')
  const [proposals, setProposals] = useState<LookProposal[]>([])
  const [busy, setBusy] = useState(false)
  const [balance, setBalance] = useState<number | null>(null)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const cats = catsFor(kind)
  const byCat = useMemo(() => {
    const m: Record<string, LookStyle[]> = {}
    for (const s of catalog) { (m[s.category] ??= []).push(s) }
    return m
  }, [catalog])

  useEffect(() => { loadCatalog(kind).then(setCatalog).catch(() => {}); setSelected({}) }, [kind])
  useEffect(() => { (async () => { const { data: me } = await supabase.auth.getUser(); const uid = me.user?.id; if (!uid) return; const { data } = await (supabase.from as any)('fb_ai_wallet').select('balance_eur').eq('location_id', uid).maybeSingle(); setBalance(data?.balance_eur ?? 0) })() }, [])

  const selFragments = useMemo(() => Object.values(selected).map((id) => catalog.find((s) => s.id === id)?.prompt_fragment).filter(Boolean) as string[], [selected, catalog])
  const selLabels = useMemo(() => Object.values(selected).map((id) => catalog.find((s) => s.id === id)?.label).filter(Boolean) as string[], [selected, catalog])

  async function startSession() {
    try { const s = await createSession(kind, clientName.trim()); setSession(s); setProposals([]); setShareToken(null); setSelfieUrl(null) }
    catch (e) { toast.error((e as Error).message === 'forbidden' ? 'Strumento non disponibile per il tuo profilo' : 'Errore: ' + (e as Error).message) }
  }

  async function onFile(file: File) {
    if (!session) return
    if (!file.type.startsWith('image/')) { toast.error('Serve una foto'); return }
    setUploading(true)
    try { const url = await uploadSelfie(session, file); setSelfieUrl(url) }
    catch (e) { toast.error('Caricamento non riuscito: ' + (e as Error).message) } finally { setUploading(false) }
  }

  function pick(cat: string, id: string) { setSelected((s) => ({ ...s, [cat]: s[cat] === id ? '' : id })) }

  async function runOne(t: string, prompt: string, view: 'front' | 'back') {
    const res = await generateProposal(session!.id, prompt, t, selected, view)
    if (res.error || !res.ok) {
      const m = res.error === 'no_credit' ? 'Credito AI esaurito: ricarica il wallet.' : res.error === 'no_ai_key' ? 'Motore AI non ancora configurato (chiave DashScope).' : res.error === 'no_selfie' ? 'Carica prima la foto.' : `Generazione non riuscita (${res.error ?? '?'})`
      toast.error(m); return false
    }
    if (res.proposal) setProposals((p) => [res.proposal as LookProposal, ...p])
    if (typeof res.balance === 'number') setBalance(res.balance)
    return true
  }
  async function generate() {
    if (!session || !selfieUrl) { toast.error(`Carica prima la ${ui.photoLabel}`); return }
    const prompt = composePrompt(selFragments, freeText)
    if (!prompt) { toast.error('Scegli almeno un elemento'); return }
    setBusy(true)
    const base = title.trim() || selLabels.slice(0, 3).join(' · ') || ui.short
    try {
      // per i capelli: fronte + (se attivo) vista da dietro
      const ok = await runOne(kind === 'hair' && backView ? `${base} · fronte` : base, prompt, 'front')
      if (ok && kind === 'hair' && backView) await runOne(`${base} · dietro`, prompt, 'back')
    } catch (e) { toast.error('Errore: ' + (e as Error).message) } finally { setBusy(false) }
  }

  async function curate(id: string, status: 'KEPT' | 'DISCARDED') {
    setProposals((p) => p.map((x) => (x.id === id ? { ...x, status } : x)))
    await setProposalStatus(id, status)
  }
  async function send() {
    if (!session) return
    const r = await sendSession(session.id)
    if (r.error) { toast.error(r.error === 'no_kept' ? 'Tieni almeno una proposta prima di inviare' : r.error); return }
    setShareToken(r.token ?? session.share_token)
    toast.success(`Inviate ${r.kept} proposte`)
  }
  const shareUrl = shareToken ? `${window.location.origin}/prova/${shareToken}` : null

  if (!available) return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-center">
      <ImageIcon size={40} className="mx-auto text-[rgb(var(--fg-subtle))]" />
      <h2 className="font-display text-2xl mt-4">Prova look</h2>
      <p className="text-[rgb(var(--fg-muted))] mt-2">Strumento disponibile per <strong>parrucchieri</strong>, <strong>make-up artist</strong>, <strong>fioristi / allestitori</strong> e <strong>pirotecnici</strong>. Imposta il tuo mestiere nel profilo per attivarlo.</p>
    </div>
  )

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow={`${ui.short} · Beta`} title={ui.title}
          description={`Carica la ${ui.photoLabel}, componi la proposta, l'AI la genera mantenendo tutto il resto intatto. Rivedi, tieni le migliori e inviale al cliente con un link.`} />

        <div className="flex items-center justify-between gap-3 flex-wrap mt-2 mb-6">
          {isAdmin && !fixedKind && (
            <div className="inline-flex rounded-lg border border-[rgb(var(--border))] p-0.5 flex-wrap">
              {(['makeup', 'hair', 'flowers', 'pyro'] as LookKind[]).map((k) => (
                <button key={k} onClick={() => { setKind(k); setSession(null) }} className={`px-3 h-8 rounded-md text-sm ${kind === k ? 'bg-[rgb(var(--gold-500))] text-white' : 'text-[rgb(var(--fg-muted))]'}`}>{KIND_UI[k].short}</button>
              ))}
            </div>
          )}
          {balance != null && <span className="font-mono text-xs text-[rgb(var(--fg-muted))]">Wallet AI: € {balance.toFixed(2)}</span>}
        </div>

        {!session ? (
          <div className="rounded-xl border border-[rgb(var(--border))] p-6 max-w-lg">
            <h3 className="font-display text-lg mb-3">Nuova prova</h3>
            <label className="text-sm text-[rgb(var(--fg-muted))]">Nome cliente (facoltativo)</label>
            <div className="flex gap-2 mt-1.5">
              <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="es. Giulia" />
              <Button onClick={startSession}><Sparkles size={16} /> Inizia</Button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[300px_1fr] gap-8">
            {/* colonna sinistra: foto + compositore */}
            <div className="space-y-5">
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onFile(f) }} />
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))] grid place-items-center">
                  {selfieUrl ? <img src={selfieUrl} alt="" className="w-full h-full object-cover" /> : <span className="text-[rgb(var(--fg-subtle))] text-sm capitalize">{ui.photoLabel}</span>}
                </div>
                <Button variant="outline" size="sm" className="w-full mt-2" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {selfieUrl ? 'Cambia foto' : `Carica ${ui.photoLabel}`}</Button>
                {kind === 'hair' && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-[rgb(var(--fg-muted))] cursor-pointer">
                    <input type="checkbox" checked={backView} onChange={(e) => setBackView(e.target.checked)} /> Genera anche la vista da dietro
                  </label>
                )}
              </div>

              <div className="space-y-4">
                {cats.map((c) => (byCat[c]?.length ? (
                  <div key={c}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--fg-muted))] mb-1.5">{CAT_LABEL[c] ?? c}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {byCat[c]!.map((s) => (
                        <button key={s.id} onClick={() => pick(c, s.id)} className={`text-xs px-2.5 py-1 rounded-full border ${selected[c] === s.id ? 'bg-[rgb(var(--gold-500))] text-white border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border-strong))] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'}`}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                ) : null))}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[rgb(var(--fg-muted))] mb-1.5">Aggiungi a parole</p>
                  <Input value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder={ui.freePlaceholder} />
                </div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome del look (facoltativo)" />
                <Button className="w-full" disabled={busy || !selfieUrl} onClick={generate}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} Genera proposta</Button>
              </div>
            </div>

            {/* colonna destra: proposte */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl">Proposte ({proposals.length})</h3>
                <Button variant="gold" size="sm" disabled={!proposals.some((p) => p.status === 'KEPT')} onClick={send}><Send size={14} /> Invia alla cliente</Button>
              </div>

              {shareUrl && (
                <div className="rounded-lg border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] p-3 mb-4 flex items-center gap-2">
                  <input readOnly value={shareUrl} className="flex-1 bg-transparent text-sm font-mono text-[rgb(var(--gold-700))] outline-none" />
                  <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(shareUrl); toast.success('Link copiato') }}><Copy size={14} /> Copia</Button>
                </div>
              )}

              {proposals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[rgb(var(--border))] p-10 text-center text-[rgb(var(--fg-muted))]">Componi un look e premi <strong>Genera</strong>. Le proposte compaiono qui: tieni le migliori e inviale.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {proposals.map((p) => (
                    <figure key={p.id} className={`relative rounded-lg overflow-hidden border ${p.status === 'KEPT' ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-500))]' : p.status === 'DISCARDED' ? 'border-[rgb(var(--border))] opacity-45' : 'border-[rgb(var(--border))]'}`}>
                      <img src={p.image_url ?? ''} alt={p.title ?? ''} className="w-full h-auto object-cover bg-[rgb(var(--bg-sunken))]" />
                      <figcaption className="p-2">
                        <p className="text-xs truncate text-[rgb(var(--fg-muted))]">{p.title}</p>
                        <div className="flex gap-1 mt-1.5">
                          <button onClick={() => curate(p.id, 'KEPT')} title="Tieni" className={`flex-1 grid place-items-center h-8 rounded-md ${p.status === 'KEPT' ? 'bg-[rgb(var(--gold-500))] text-white' : 'border border-[rgb(var(--border-strong))] text-[rgb(var(--fg-muted))]'}`}><Check size={15} /></button>
                          <button onClick={() => curate(p.id, 'DISCARDED')} title="Scarta" className="flex-1 grid place-items-center h-8 rounded-md border border-[rgb(var(--border-strong))] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--rose-600))]"><X size={15} /></button>
                        </div>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
