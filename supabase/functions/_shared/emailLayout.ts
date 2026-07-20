// Shell email condiviso — brand "filiera" (cipresso/lacca, registro Olivetti/Pineider).
// Fondo carta, simbolo ad anello, eyebrow mono, titolo e corpo sans (Jost con fallback
// web-safe: i client email non caricano Google Fonts, e il brand vieta comunque i serif),
// UN bottone. I template NON definiscono colori propri: passano solo contenuto + eventuale
// accento del pro (white-label). Il DEFAULT Planfully è cipresso (era oro).
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export function esc(s: unknown): string { return String(s ?? '').replace(/[&<>"]/g, (c) => ESC[c]!) }

const CARTA = '#F4F3EE'
const CARD = '#FBFAF6'
const INCHIOSTRO = '#181F1B'
const CIPRESSO = '#25402F'
const BORDO = '#E2DFD4'
const MUTED = '#6B6B63'
const SANS = "'Jost',Helvetica,Arial,sans-serif"
const MONO = "'IBM Plex Mono',Consolas,'Courier New',monospace"

export type EmailShellOptions = {
  accent?: string        // colore brand del professionista (default cipresso). Filetto + bottone.
  eyebrow?: string       // rubrica mono (es. "Contratto da firmare")
  title: string          // titolo sans
  subtitleHtml?: string  // sotto-titolo (HTML già sicuro dal chiamante)
  bodyHtml: string       // corpo (HTML già sicuro dal chiamante)
  cta?: { href: string; label: string }
  contactHtml?: string   // riga contatti del pro (HTML già sicuro)
}

// Default cipresso; se il pro passa un colore valido lo rispettiamo (white-label).
function safeAccent(a?: string): string {
  const v = (a ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : CIPRESSO
}

export function emailShell(o: EmailShellOptions): string {
  const accent = safeAccent(o.accent)
  return `<!doctype html><html lang="it"><body style="font-family:${SANS};background:${CARTA};margin:0;padding:32px 16px;color:${INCHIOSTRO}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" style="max-width:560px;background:${CARD};border:1px solid ${BORDO};border-collapse:collapse">
    <tr><td style="background:${accent};height:3px;line-height:3px;font-size:0">&nbsp;</td></tr>
    <tr><td style="padding:32px 36px 28px">
      <img src="https://planfully.it/brand/planfully-symbol-cipresso.png" width="34" height="34" style="display:block;border:0" alt="Planfully" />
      ${o.eyebrow ? `<p style="font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${CIPRESSO};margin:20px 0 8px">${esc(o.eyebrow)}</p>` : '<div style="height:20px;line-height:20px;font-size:0">&nbsp;</div>'}
      <h1 style="font-family:${SANS};font-weight:500;font-size:26px;line-height:1.15;margin:0 0 6px;color:${INCHIOSTRO}">${esc(o.title)}</h1>
      ${o.subtitleHtml ? `<p style="font-size:14px;color:${MUTED};margin:0 0 18px">${o.subtitleHtml}</p>` : ''}
      <div style="font-size:15px;line-height:1.7;color:${INCHIOSTRO};margin:8px 0 22px">${o.bodyHtml}</div>
      ${o.cta ? `<a href="${o.cta.href}" style="display:inline-block;background:${accent};color:${CARTA};padding:14px 32px;text-decoration:none;font-family:${SANS};font-weight:500;font-size:14px;letter-spacing:.5px">${esc(o.cta.label)}</a>` : ''}
      ${o.contactHtml ? `<p style="margin:26px 0 0;font-size:12px;color:${MUTED}">${o.contactHtml}</p>` : ''}
    </td></tr>
    <tr><td style="border-top:1px solid ${BORDO};padding:18px 36px 24px;text-align:center">
      <p style="font-size:11px;color:${MUTED};margin:0;font-family:${MONO};letter-spacing:.06em">PLANFULLY · IL GESTIONALE DELLA FILIERA WEDDING</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}
