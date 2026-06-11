// Cifratura token Drive a riposo (AES-256-GCM). La chiave DRIVE_TOKEN_KEY è un
// secret della Edge Function (base64 di 32 byte), MAI in DB: il database conserva
// solo iv||ciphertext (bytea). Senza chiave non si memorizza nulla in chiaro.
const KEY_B64 = Deno.env.get('DRIVE_TOKEN_KEY') ?? ''

export function hasKey(): boolean { return KEY_B64.trim().length > 0 }

async function key(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(KEY_B64), (c) => c.charCodeAt(0))
  if (raw.length !== 32) throw new Error('DRIVE_TOKEN_KEY non valida (servono 32 byte base64)')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptToken(plain: string): Promise<Uint8Array> {
  const k = await key()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(plain)))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv); out.set(ct, iv.length)
  return out
}

export async function decryptToken(buf: Uint8Array): Promise<string> {
  const k = await key()
  const iv = buf.slice(0, 12)
  const ct = buf.slice(12)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, ct)
  return new TextDecoder().decode(pt)
}
