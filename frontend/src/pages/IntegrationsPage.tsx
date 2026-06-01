import { useEffect, useMemo, useState } from 'react'
import { Copy, Check, Globe, ExternalLink, Code2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'

// ============================================================================
// Integrazione sito: il professionista (WP, location, fornitore) copia il
// codice del form lead e lo incolla nel proprio sito (Wix, Squarespace,
// WordPress, Webflow, Shopify...). Due modalità:
//  • iframe semplice (universale, funziona ovunque)
//  • iframe + auto-resize (per chi può incollare anche un piccolo script)
// ============================================================================

export default function IntegrationsPage() {
  const { profile } = useAuth()
  const [slug, setSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [height, setHeight] = useState(880)
  const [copied, setCopied] = useState<string | null>(null)

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://planfully.it'
  const primary = (profile?.brand_primary_color || '#b08d57').replace('#', '')

  useEffect(() => {
    if (!profile?.id) return
    void (async () => {
      const { data } = await supabase.from('profiles').select('slug').eq('id', profile.id).maybeSingle()
      setSlug((data as { slug: string | null } | null)?.slug ?? null)
      setLoading(false)
    })()
  }, [profile?.id])

  const embedUrl = slug ? `${origin}/embed/lead/${slug}?primary=${primary}` : ''

  const iframeSnippet = useMemo(() => slug ? (
`<iframe
  src="${embedUrl}"
  title="Richiedi un preventivo"
  width="100%"
  height="${height}"
  style="border:0;max-width:600px;width:100%;"
  loading="lazy">
</iframe>`) : '', [embedUrl, height, slug])

  const autoResizeSnippet = useMemo(() => slug ? (
`<iframe
  id="planfully-lead"
  src="${embedUrl}"
  title="Richiedi un preventivo"
  width="100%"
  height="${height}"
  style="border:0;max-width:600px;width:100%;"
  loading="lazy">
</iframe>
<script>
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "planfully:embed-height") {
      var f = document.getElementById("planfully-lead");
      if (f) f.style.height = e.data.height + "px";
    }
  });
</script>`) : '', [embedUrl, height, slug])

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key); toast.success('Copiato negli appunti')
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    })
  }

  return (
    <div className="min-h-full">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Integrazione"
          title="Form richieste sul tuo sito"
          description="Incolla il form di richiesta preventivo nel tuo sito esistente. I lead arrivano dritti nella tua dashboard Planfully."
        />

        {loading ? (
          <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</Card>
        ) : !slug ? (
          <Card className="p-6 text-sm">
            Per generare il codice devi prima impostare un <strong>indirizzo pubblico (slug)</strong> del tuo profilo.
            Vai su <a className="underline" href="/settings/brand">Brand &amp; profilo</a> e scegli il tuo link pubblico.
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Anteprima live */}
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-medium" style={{ borderColor: 'rgb(var(--border))' }}>
                <Globe size={15} /> Anteprima dal vivo
                <a href={embedUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-[rgb(var(--fg-muted))] hover:underline">
                  Apri a tutto schermo <ExternalLink size={12} />
                </a>
              </div>
              <iframe src={embedUrl} title="Anteprima form" className="w-full" style={{ height: 560, border: 0 }} />
            </Card>

            {/* Altezza */}
            <Card className="p-4">
              <label className="text-sm font-medium block mb-1.5">Altezza del riquadro (px)</label>
              <div className="flex items-center gap-2 max-w-xs">
                <Input type="number" value={height} onChange={(e) => setHeight(Math.max(400, Number(e.target.value) || 880))} />
                <span className="text-xs text-[rgb(var(--fg-subtle))]">consigliato 800–950</span>
              </div>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-2">
                Con la versione “auto-resize” l’altezza si adatta da sola; con la versione semplice imposta qui un valore comodo.
              </p>
            </Card>

            {/* Snippet 1 — universale */}
            <SnippetBlock
              title="Codice da incollare (universale)"
              subtitle="Funziona ovunque: Wix, Squarespace, WordPress, Webflow, Shopify, sito custom."
              code={iframeSnippet}
              copied={copied === 'simple'}
              onCopy={() => copy(iframeSnippet, 'simple')}
            />

            {/* Snippet 2 — auto-resize */}
            <SnippetBlock
              title="Codice con auto-resize (consigliato)"
              subtitle="Se il tuo sito consente di incollare anche un piccolo <script>, l’altezza si adatta da sola."
              code={autoResizeSnippet}
              copied={copied === 'auto'}
              onCopy={() => copy(autoResizeSnippet, 'auto')}
            />

            {/* Istruzioni Wix */}
            <Card className="p-5">
              <h3 className="font-display text-lg mb-2 flex items-center gap-2"><Code2 size={18} /> Come si fa su Wix</h3>
              <ol className="text-sm space-y-1.5 list-decimal pl-5 text-[rgb(var(--fg-muted))]">
                <li>Apri l’editor del tuo sito Wix e vai alla pagina <strong>Contatti</strong>.</li>
                <li>Clicca <strong>Aggiungi</strong> (+) → <strong>Incorpora codice</strong> → <strong>Incorpora HTML</strong> (o “Incorpora un widget”).</li>
                <li>Scegli <strong>Codice</strong> e incolla il <strong>codice universale</strong> qui sopra.</li>
                <li>Ridimensiona il riquadro trascinando gli angoli e clicca <strong>Pubblica</strong>.</li>
              </ol>
              <p className="text-xs text-[rgb(var(--fg-subtle))] mt-3">
                Stessa logica su Squarespace (“Code Block”), WordPress (blocco “HTML personalizzato”), Webflow (“Embed”), Shopify (sezione “Custom Liquid/HTML”).
              </p>
            </Card>

            {/* Link diretto */}
            <Card className="p-4">
              <label className="text-sm font-medium block mb-1.5">Oppure link diretto (per email, bio Instagram, QR…)</label>
              <div className="flex items-center gap-2">
                <Input readOnly value={embedUrl} onFocus={(e) => e.currentTarget.select()} />
                <Button variant="outline" onClick={() => copy(embedUrl, 'url')}>
                  {copied === 'url' ? <Check size={15} /> : <Copy size={15} />}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function SnippetBlock({ title, subtitle, code, copied, onCopy }: {
  title: string; subtitle: string; code: string; copied: boolean; onCopy: () => void
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b flex items-start gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">{subtitle}</p>
        </div>
        <Button variant="outline" className="ml-auto shrink-0" onClick={onCopy}>
          {copied ? <><Check size={15} className="mr-1" /> Copiato</> : <><Copy size={15} className="mr-1" /> Copia</>}
        </Button>
      </div>
      <pre className="text-xs leading-relaxed overflow-x-auto p-4 bg-[rgb(var(--bg-sunken))] whitespace-pre">{code}</pre>
    </Card>
  )
}
