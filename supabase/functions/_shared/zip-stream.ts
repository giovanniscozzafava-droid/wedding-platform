// ZIP SCRITTO A FLUSSO, senza compressione (metodo STORE).
//
// Perché: JSZip teneva in memoria TUTTI i file e poi ne costruiva una seconda copia compressa.
// Su una galleria vera (1.300 foto: ~370 KB l'una in formato web) si arrivava a centinaia di MB
// e il worker della edge veniva ucciso — la coppia vedeva solo «Download .zip non riuscito».
// Qui i byte escono man mano: in memoria resta un file per volta. I JPEG non si comprimono,
// quindi STORE non costa nulla in dimensione e risparmia anche la CPU del deflate.
//
// Formato: local file header + dati per ogni voce, poi il central directory e l'EOCD.
// Le dimensioni e il CRC si conoscono prima di scrivere (il file è già in memoria), quindi
// non servono i data descriptor.

const TAB = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0 }
  return t
})()
export function crc32(buf: Uint8Array): number {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = TAB[(c ^ buf[i]!) & 0xFF]! ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
const u8 = (...n: number[]) => Uint8Array.from(n)
const u16 = (v: number) => u8(v & 255, (v >>> 8) & 255)
const u32 = (v: number) => u8(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255)
const cat = (...parts: Uint8Array[]) => {
  const n = parts.reduce((s, p) => s + p.length, 0)
  const o = new Uint8Array(n); let i = 0
  for (const p of parts) { o.set(p, i); i += p.length }
  return o
}

export class ZipWriter {
  private offset = 0
  private entries: { nb: Uint8Array; crc: number; size: number; offset: number }[] = []
  /** I byte da mandare per questo file (intestazione + contenuto). */
  file(name: string, bytes: Uint8Array): Uint8Array {
    const nb = new TextEncoder().encode(name)
    const crc = crc32(bytes)
    const local = cat(u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(bytes.length), u32(bytes.length), u16(nb.length), u16(0), nb)
    this.entries.push({ nb, crc, size: bytes.length, offset: this.offset })
    this.offset += local.length + bytes.length
    return cat(local, bytes)
  }
  /** La coda dell'archivio: indice dei file e chiusura. */
  end(): Uint8Array {
    const central = this.entries.map((e) => cat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(e.crc), u32(e.size), u32(e.size),
      u16(e.nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset), e.nb,
    ))
    const dir = cat(...central)
    const eocd = cat(u32(0x06054b50), u16(0), u16(0), u16(this.entries.length), u16(this.entries.length), u32(dir.length), u32(this.offset), u16(0))
    return cat(dir, eocd)
  }
  get count() { return this.entries.length }
}
