// Shell email condiviso (restyling "Partitura" §5/§7.8). Un solo layout: header crema con simbolo,
// eyebrow mono, titolo serif, corpo sans, UN bottone (fill scuro + testo crema, radius 10), footer uniforme.
// I template NON definiscono colori propri: passano solo contenuto + eventuale accento brand del pro.
const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
export function esc(s: unknown): string { return String(s ?? '').replace(/[&<>"]/g, (c) => ESC[c]!) }

export type EmailShellOptions = {
  accent?: string        // colore brand del professionista (default oro #7E6633). Usato per filetti + bottone.
  eyebrow?: string       // rubrica mono (es. "Contratto da firmare")
  title: string          // titolo serif
  subtitleHtml?: string  // sotto-titolo (HTML già sicuro dal chiamante, es. "Da <strong>Studio</strong> · € …")
  bodyHtml: string       // corpo (HTML già sicuro dal chiamante)
  cta?: { href: string; label: string }
  contactHtml?: string   // riga contatti del pro (HTML già sicuro)
}

// Bottone/filetti scuri per contrasto AA col testo crema anche quando il brand del pro è chiaro.
function safeAccent(a?: string): string {
  const v = (a ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : '#7E6633'
}

export function emailShell(o: EmailShellOptions): string {
  const accent = safeAccent(o.accent)
  return `<!doctype html><html lang="it"><body style="font-family:Georgia,serif;background:#F8F5F0;margin:0;padding:32px 16px;color:#1A1714">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="560" style="max-width:560px;background:#FDFBF6;border-radius:14px;overflow:hidden;border-collapse:collapse">
    <tr><td style="background:${accent};height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
    <tr><td style="padding:32px 36px 28px">
      <img src="https://planfully.it/brand/planfully-symbol.png" width="36" height="36" style="display:block;border:0" alt="Planfully" />
      ${o.eyebrow ? `<p style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#A08A4B;margin:18px 0 6px">${esc(o.eyebrow)}</p>` : '<div style="height:18px;line-height:18px;font-size:0">&nbsp;</div>'}
      <h1 style="font-size:26px;line-height:1.15;margin:0 0 6px;color:#1A1714">${esc(o.title)}</h1>
      ${o.subtitleHtml ? `<p style="font-size:14px;color:#787164;margin:0 0 18px">${o.subtitleHtml}</p>` : ''}
      <div style="font-size:15px;line-height:1.7;color:#1A1714;margin:8px 0 22px">${o.bodyHtml}</div>
      ${o.cta ? `<a href="${o.cta.href}" style="display:inline-block;background:${accent};color:#FAF5EA;padding:13px 30px;border-radius:10px;text-decoration:none;font-family:Arial,sans-serif;font-weight:600;font-size:14px;letter-spacing:.5px">${esc(o.cta.label)}</a>` : ''}
      ${o.contactHtml ? `<p style="margin:26px 0 0;font-size:12px;color:#A59C8E">${o.contactHtml}</p>` : ''}
    </td></tr>
    <tr><td style="border-top:1px solid #E8E2D8;padding:18px 36px 24px;text-align:center">
      <p style="font-size:11px;color:#A59C8E;margin:0;font-family:Arial,sans-serif">Realizzato con Planfully · La piattaforma per chi orchestra matrimoni</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`
}
