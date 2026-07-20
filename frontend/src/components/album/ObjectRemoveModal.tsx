import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, X, Eraser, Trash2, Wand2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

// "Cancella oggetto (AI)": apri la foto grande, PENNELLA sopra ciò che vuoi togliere (o descrivilo a
// parole) e l'AI (Qwen-Image-Edit) ricostruisce lo sfondo. Qwen ridisegna l'intera foto, perciò NON uso
// il suo risultato tale e quale: ricompongo l'ORIGINALE a piena risoluzione e ci incollo SOLO la zona
// pennellata presa dal risultato AI, con tono riallineato all'originale e guardia bianco/nero → niente
// shift di colore, niente B&N che diventa colore, niente calo di risoluzione sul resto della foto.
// Il canvas usa l'immagine CORS-safe (stessa dell'export) → niente taint.

const MAXDIM = 2048 // lato lungo mandato a Qwen (più risoluzione = ritaglio più nitido; il resto resta full-res)

export function ObjectRemoveModal({ src, onClose, onResult }: { src: string; onClose: () => void; onResult: (file: File) => void }) {
  const dispRef = useRef<HTMLCanvasElement>(null)          // canvas visibile (immagine + pennellate rosse)
  const imgRef = useRef<HTMLImageElement | null>(null)     // immagine caricata
  const paintRef = useRef<HTMLCanvasElement | null>(null)  // maschera full-res (bianco dove pennello)
  const drawing = useRef(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [brush, setBrush] = useState(38)                   // raggio pennello in px display
  const [hasPaint, setHasPaint] = useState(false)
  const [text, setText] = useState('')
  const dims = useRef<{ w: number; h: number; dw: number; dh: number; scale: number }>({ w: 0, h: 0, dw: 0, dh: 0, scale: 1 })

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      const long = Math.max(img.naturalWidth, img.naturalHeight)
      const scale = long > MAXDIM ? MAXDIM / long : 1
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale)
      // dimensione DISPLAY: entra in un riquadro comodo
      const maxDW = Math.min(window.innerWidth * 0.9, 760), maxDH = window.innerHeight * 0.62
      const dscale = Math.min(maxDW / w, maxDH / h, 1)
      const dw = Math.round(w * dscale), dh = Math.round(h * dscale)
      dims.current = { w, h, dw, dh, scale: w / dw }
      const paint = document.createElement('canvas'); paint.width = w; paint.height = h
      paintRef.current = paint
      const c = dispRef.current; if (c) { c.width = dw; c.height = dh; render() }
      setReady(true)
    }
    img.onerror = () => toast.error('Non riesco a caricare la foto per l\'editing (formato/permessi).')
    img.src = src
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src])

  // ridisegna il canvas visibile: immagine + overlay rosso delle pennellate
  function render() {
    const c = dispRef.current, img = imgRef.current, paint = paintRef.current; if (!c || !img || !paint) return
    const { dw, dh } = dims.current
    const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, dw, dh)
    ctx.drawImage(img, 0, 0, dw, dh)
    ctx.save(); ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'source-over'
    // colora di rosso dove è dipinta la maschera
    const tmp = document.createElement('canvas'); tmp.width = dw; tmp.height = dh
    const tctx = tmp.getContext('2d')!
    tctx.drawImage(paint, 0, 0, dw, dh)
    tctx.globalCompositeOperation = 'source-in'; tctx.fillStyle = '#ff2d55'; tctx.fillRect(0, 0, dw, dh)
    ctx.drawImage(tmp, 0, 0); ctx.restore()
  }

  function paintAt(clientX: number, clientY: number) {
    const c = dispRef.current, paint = paintRef.current; if (!c || !paint) return
    const r = c.getBoundingClientRect()
    const dx = clientX - r.left, dy = clientY - r.top
    const s = dims.current.scale
    const pctx = paint.getContext('2d')!
    pctx.fillStyle = '#fff'
    pctx.beginPath(); pctx.arc(dx * s, dy * s, brush * s, 0, Math.PI * 2); pctx.fill()
    setHasPaint(true); render()
  }

  function clearPaint() {
    const paint = paintRef.current; if (!paint) return
    paint.getContext('2d')!.clearRect(0, 0, paint.width, paint.height)
    setHasPaint(false); render()
  }

  async function run() {
    const img = imgRef.current, paint = paintRef.current; if (!img || !paint) return
    if (!hasPaint && !text.trim()) { toast.message('Pennella sull\'oggetto da togliere, oppure scrivi cosa cancellare.'); return }
    setBusy(true)
    try {
      const { w, h } = dims.current
      // FLUX Fill: immagine ad aspetto naturale + maschera BIANCO (dove pennello) su NERO = area da rigenerare.
      const ic = document.createElement('canvas'); ic.width = w; ic.height = h
      ic.getContext('2d')!.drawImage(img, 0, 0, w, h)
      const image = ic.toDataURL('image/jpeg', 0.92)
      let mask: string | undefined
      let marked: string | undefined
      if (hasPaint) {
        const mc = document.createElement('canvas'); mc.width = w; mc.height = h
        const m = mc.getContext('2d')!
        m.fillStyle = '#000'; m.fillRect(0, 0, w, h)
        m.drawImage(paint, 0, 0) // paint = cerchi bianchi opachi dove ho pennellato → bianco su nero
        mask = mc.toDataURL('image/png')
        // marked = foto originale con l'area dipinta tinta di MAGENTA TRASLUCIDO (Qwen vede l'oggetto sotto
        // e sa cosa togliere). Alpha ~0.6: abbastanza per marcare, non tanto da nascondere il contorno.
        const kc = document.createElement('canvas'); kc.width = w; kc.height = h
        const k = kc.getContext('2d')!
        k.drawImage(img, 0, 0, w, h)
        const mg = document.createElement('canvas'); mg.width = w; mg.height = h
        const g = mg.getContext('2d')!
        g.drawImage(paint, 0, 0)
        g.globalCompositeOperation = 'source-in'; g.fillStyle = '#FF00FF'; g.fillRect(0, 0, w, h)
        k.globalAlpha = 0.6; k.drawImage(mg, 0, 0); k.globalAlpha = 1
        marked = kc.toDataURL('image/jpeg', 0.92)
      }
      const prompt = text.trim()
        ? text.trim()
        : 'clean natural background that seamlessly continues the surrounding scene, object removed, photorealistic, consistent lighting and colors'
      const { data, error } = await supabase.functions.invoke('image-inpaint', { body: { image, mask, marked, prompt } })
      let err = (data as { error?: string } | null)?.error; let detail = (data as { detail?: string } | null)?.detail
      if (error) { try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === 'function') { const b = await ctx.json(); err = b?.error ?? err; detail = b?.detail ?? detail } } catch { /* */ } }
      if (error || err) {
        toast.error(
          err === 'org_not_verified' ? 'Organizzazione OpenAI non abilitata alla generazione immagini.'
          : err === 'no_engine' ? 'Manca il token del motore AI immagini sul server (REPLICATE_API_TOKEN).'
          : err === 'replicate_failed' || err === 'replicate_error' ? `Il motore ha rifiutato${detail ? `: ${detail}` : ''}`.slice(0, 200)
          : `Non riuscito${detail ? `: ${detail}` : (err ? `: ${err}` : '')}`.slice(0, 200),
          { duration: 9000 })
        return
      }
      const outUrl = (data as { image?: string }).image
      if (!outUrl) { toast.error('Nessuna immagine restituita'); return }
      // Il motore restituisce l'INTERA immagine, spesso a risoluzione/colore diversi (può perdere il B&N,
      // cambiare tono, ridurre i dpi). Per non alterare tutta la foto RICOMPONGO: originale a piena
      // risoluzione + SOLO la regione mascherata dal risultato AI (bordo sfumato). Se non c'è maschera
      // (edit a parole) uso il risultato così com'è.
      const resImg = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('out_img')); i.src = outUrl })
      let outFile: File
      if (hasPaint && paint) {
        const W = img.naturalWidth, H = img.naturalHeight
        // originale full-res + patch (risultato AI scalato) + maschera SFUMATA (bordo morbido)
        const oc = document.createElement('canvas'); oc.width = W; oc.height = H
        const octx = oc.getContext('2d')!; octx.drawImage(img, 0, 0, W, H)
        const pc = document.createElement('canvas'); pc.width = W; pc.height = H
        pc.getContext('2d')!.drawImage(resImg, 0, 0, W, H)
        const fmc = document.createElement('canvas'); fmc.width = W; fmc.height = H
        const fm = fmc.getContext('2d')!
        // Maschera DILATATA + sfumata: la sfocatura allarga l'alpha oltre la pennellata → aggancia l'ombra
        // a contatto e fa continuare lo sfondo al bordo (niente "toppa" netta). Ampiezza legata al pennello.
        const d2f = W / (dims.current.dw || W)
        const feather = Math.min(64, Math.max(8, Math.round(brush * 0.6 * d2f)))
        fm.filter = `blur(${feather}px)`; fm.drawImage(paint, 0, 0, W, H); fm.filter = 'none'
        const O = octx.getImageData(0, 0, W, H)
        const P = pc.getContext('2d')!.getImageData(0, 0, W, H)
        const A = fm.getImageData(0, 0, W, H)
        const od = O.data, pd = P.data, ad = A.data
        // (1) l'originale è in bianco/nero? croma medio su un campione rado
        let chroma = 0, ns = 0
        for (let i = 0; i < od.length; i += 4 * 97) { const r0 = od[i]!, g0 = od[i + 1]!, b0 = od[i + 2]!; chroma += Math.max(r0, g0, b0) - Math.min(r0, g0, b0); ns++ }
        const grayscale = ns > 0 && (chroma / ns) < 8
        // (2) delta tono globale originale↔AI (Qwen shifta esposizione/colore su tutta la foto)
        let oR = 0, oG = 0, oB = 0, pR = 0, pG = 0, pB = 0, nn = 0
        for (let i = 0; i < od.length; i += 4 * 31) { oR += od[i]!; oG += od[i + 1]!; oB += od[i + 2]!; pR += pd[i]!; pG += pd[i + 1]!; pB += pd[i + 2]!; nn++ }
        const dR = (oR - pR) / nn, dG = (oG - pG) / nn, dB = (oB - pB) / nn
        const cl = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v
        // (3) fondo SOLO dove ho pennellato: tono corretto + eventuale B&N + GRANA di luminanza (la toppa
        //     di Qwen è troppo liscia rispetto alla foto → senza grana sembra plastica/"troppo netta").
        const GRAIN = 11 // ampiezza ± della grana (rumore correlato su R,G,B = grana di luminanza)
        for (let i = 0; i < od.length; i += 4) {
          const a = ad[i + 3]! / 255
          if (a === 0) continue
          let pr = cl(pd[i]! + dR), pg = cl(pd[i + 1]! + dG), pb = cl(pd[i + 2]! + dB)
          if (grayscale) { const y = 0.299 * pr + 0.587 * pg + 0.114 * pb; pr = pg = pb = y }
          const nz = (Math.random() - 0.5) * GRAIN
          pr = cl(pr + nz); pg = cl(pg + nz); pb = cl(pb + nz)
          od[i] = od[i]! * (1 - a) + pr * a
          od[i + 1] = od[i + 1]! * (1 - a) + pg * a
          od[i + 2] = od[i + 2]! * (1 - a) + pb * a
        }
        octx.putImageData(O, 0, 0)
        const b = await new Promise<Blob>((r) => oc.toBlob((x) => r(x!), 'image/jpeg', 0.95))
        outFile = new File([b], `ai-edit-${Date.now()}.jpg`, { type: 'image/jpeg' })
      } else {
        const blob = await (await fetch(outUrl)).blob()
        outFile = new File([blob], `ai-edit-${Date.now()}.png`, { type: 'image/png' })
      }
      onResult(outFile)
    } catch (e) {
      toast.error(`Non riuscito: ${String((e as Error)?.message ?? e).slice(0, 140)}`)
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-[min(96vw,820px)] flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] p-4">
          <div>
            <p className="font-display text-lg">Cancella oggetto</p>
            <p className="mt-0.5 text-sm text-[rgb(var(--fg-muted))]">Pennella ciò che vuoi togliere <b>e la sua ombra</b> (rosso) — o scrivilo a parole. L'AI ricostruisce lo sfondo.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-auto p-4">
          <div className="relative touch-none select-none rounded-lg bg-black/5" style={{ width: dims.current.dw || 'auto' }}>
            <canvas ref={dispRef}
              onPointerDown={(e) => { if (busy) return; drawing.current = true; (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId); paintAt(e.clientX, e.clientY) }}
              onPointerMove={(e) => { if (busy || !drawing.current) return; paintAt(e.clientX, e.clientY) }}
              onPointerUp={() => { drawing.current = false }}
              onPointerLeave={() => { drawing.current = false }}
              className="max-w-full cursor-crosshair rounded-lg" />
            {!ready && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="animate-spin text-[rgb(var(--gold-600))]" /></div>}
          </div>

          <div className="flex w-full max-w-[760px] flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-[rgb(var(--fg-muted))]"><Eraser size={14} /> Pennello
              <input type="range" min={10} max={90} value={brush} onChange={(e) => setBrush(Number(e.target.value))} className="w-28 accent-[rgb(var(--gold-500))]" />
            </label>
            <Button variant="outline" size="sm" disabled={!hasPaint || busy} onClick={clearPaint}><Trash2 size={14} /> Pulisci pennellate</Button>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="…oppure scrivi cosa togliere (es. il bidone a destra)"
              className="min-w-[180px] flex-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-1.5 text-sm" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--border))] p-3">
          <p className="text-[11px] text-[rgb(var(--fg-subtle))]">La foto verrà sostituita nella tavola con la versione modificata (reversibile con ⌘Z).</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Annulla</Button>
            <Button variant="gold" size="sm" onClick={() => void run()} disabled={busy || !ready}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Cancella con l'AI</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
