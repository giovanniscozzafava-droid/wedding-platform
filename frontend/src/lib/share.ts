// ============================================================================
// Condivisione su WhatsApp. Due modalità:
//  • shareWhatsAppLink(text, url): apre WhatsApp con un messaggio + link (per i
//    PDF che hanno un URL pubblico: contratti, accettazioni, ecc.)
//  • shareFile(file, text): usa la Web Share API per allegare il PDF (mobile →
//    sceglie WhatsApp); fallback al messaggio testuale.
// ============================================================================

export function shareWhatsAppLink(text: string, url?: string) {
  const msg = url ? `${text}\n${url}` : text
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
}

export async function shareFileOrWhatsApp(file: File, text: string, fallbackUrl?: string): Promise<boolean> {
  try {
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text })
      return true
    }
  } catch { /* utente ha annullato o non supportato */ }
  // Fallback: WhatsApp con messaggio (eventuale link)
  shareWhatsAppLink(text, fallbackUrl)
  return false
}
