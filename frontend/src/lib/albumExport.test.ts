import { describe, it, expect } from 'vitest'
import { hiResProxyUrl } from './albumExport'

describe('hiResProxyUrl — proxy alta risoluzione', () => {
  it('costruisce l’URL del proxy con grant, media e apikey', () => {
    const u = hiResProxyUrl('https://x.supabase.co', 'ANON', 'tok123', 'media-1')
    expect(u).toBe('https://x.supabase.co/functions/v1/album-image?t=tok123&m=media-1&apikey=ANON')
  })
  it('codifica i parametri (niente injection in query)', () => {
    const u = hiResProxyUrl('https://x.supabase.co', 'a&b', 'to k', 'm/1?z')
    expect(u).toContain('t=to%20k')
    expect(u).toContain('m=m%2F1%3Fz')
    expect(u).toContain('apikey=a%26b')
  })
})
