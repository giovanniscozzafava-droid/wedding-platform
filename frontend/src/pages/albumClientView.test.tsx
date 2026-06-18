// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const MEDIA = [
  { id: 'm1', drive_file_id: 'guest:a', thumbnail_link: 'http://x/1.jpg', media_type: 'PHOTO', guest_tag_name: null, album_choice: 'KEPT', album_moment: 'CERIMONIA' },
  { id: 'm2', drive_file_id: 'guest:b', thumbnail_link: 'http://x/2.jpg', media_type: 'PHOTO', guest_tag_name: null, album_choice: 'KEPT', album_moment: 'CERIMONIA' },
]

// la fixture corrente (mutata per ogni variante)
let LAYOUT: any = null

const DATA = (): Record<string, any> => ({
  album_projects: { data: { format_key: 'PORT_30x40', status: 'CLIENT_REVIEW', layout: LAYOUT } },
  gallery_media: { data: MEDIA },
  calendar_entries: { data: { title: 'Zoe & Test' } },
  album_revision_requests: { data: [] },
})
function builder(table: string) {
  const result = DATA()[table] ?? { data: null }
  const b: any = {}
  for (const m of ['select', 'eq', 'order', 'insert', 'update']) b[m] = () => b
  b.maybeSingle = () => Promise.resolve(result)
  b.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej)
  return b
}
vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: null }) } }))
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ profile: { role: 'COUPLE', id: 'u1' } }) }))
vi.mock('react-router-dom', () => ({ useParams: () => ({ entryId: 'entry-1' }), Link: ({ children }: any) => <a>{children}</a> }))

import AlbumDesignerPage from './AlbumDesignerPage'

const el = (id: string, mediaId: string, x: number, cell: any = { z: 1, fx: 0.5, fy: 0.5 }) => ({ id, mediaId, x, y: 0.05, w: 0.4, h: 0.9, rot: 0, cell })
const tavFree = (els: any[]) => ({ id: 'p0', moment: 'CERIMONIA', template: 'full', mediaIds: [], cells: [], mode: 'free', tavolaFree: true, bg: '#fff', elements: els })
const emptyRight = { id: 'p1', moment: 'CERIMONIA', template: 'full', mediaIds: [], cells: [], mode: 'template', tavolaFree: false, elements: [] }

async function mountOk(name: string) {
  const { unmount } = render(<AlbumDesignerPage />)
  await waitFor(() => {
    const crashed = screen.queryByText(/Qualcosa è andato storto/i)
    const opened = screen.queryByText(/Il tuo album/i) || screen.queryByText(/non è ancora pronto/i)
    expect(crashed, `${name}: BOUNDARY SCATTATA`).toBeNull()
    expect(opened, `${name}: non ancora caricato`).toBeTruthy()
  }, { timeout: 3000 })
  unmount()
}

describe('vista cliente coppia — battery dati malformati', () => {
  it('A) tavolaFree + cell valide', async () => { LAYOUT = { bleed: false, pages: [tavFree([el('e1', 'm1', 0.05), el('e2', 'm2', 0.5)]), emptyRight] }; await mountOk('A') })
  it('B) element cell:null', async () => { LAYOUT = { pages: [tavFree([el('e1', 'm1', 0.05, null), el('e2', 'm2', 0.5)]), emptyRight] }; await mountOk('B') })
  it('C) tavolaFree elements:undefined', async () => { const p = tavFree([]); delete (p as any).elements; LAYOUT = { pages: [p, emptyRight] }; await mountOk('C') })
  it('D) spread template con mediaIds:undefined (MiniPage→framesForPage)', async () => {
    const p0: any = { id: 'p0', moment: 'CERIMONIA', template: 'full', mode: 'template', tavolaFree: false }; delete p0.mediaIds
    LAYOUT = { pages: [p0, emptyRight] }; await mountOk('D')
  })
  it('E) element mediaId mancante in media', async () => { LAYOUT = { pages: [tavFree([el('e1', 'GHOST', 0.05)]), emptyRight] }; await mountOk('E') })
  it('F) spreadImage non-tavolaFree con cell:null', async () => {
    const p0: any = { id: 'p0', moment: 'CERIMONIA', template: 'full', mediaIds: [], cells: [], mode: 'template', tavolaFree: false, spreadImage: { mediaId: 'm1', cell: null, cellRight: null } }
    LAYOUT = { pages: [p0, emptyRight] }; await mountOk('F')
  })
})
