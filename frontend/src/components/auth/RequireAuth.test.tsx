// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

let PROFILE: any = { role: 'COUPLE', onboarding_complete: true }
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ loading: false, session: { user: { id: 'u1' } }, profile: PROFILE }) }))
vi.mock('@/components/layout/AppShell', () => ({ AppShell: ({ children }: any) => <div>{children}</div> }))

import { RequireAuth } from './RequireAuth'

function mountAt(path: string, roles: any[]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/album/:id" element={<RequireAuth roles={roles}><div>ALBUM CONTENT</div></RequireAuth>} />
        <Route path="/video/:id" element={<RequireAuth roles={roles}><div>VIDEO CONTENT</div></RequireAuth>} />
        <Route path="/onboarding" element={<RequireAuth><div>PROFILAZIONE PRO</div></RequireAuth>} />
        <Route path="/couple" element={<div>COUPLE HOME</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const COUPLE_ROLES = ['FORNITORE', 'WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'COUPLE']

describe('RequireAuth — la coppia DEVE poter aprire album e video', () => {
  it('COUPLE su /album/:id vede l’album (non rimbalza su /couple)', () => {
    PROFILE = { role: 'COUPLE', onboarding_complete: true }
    mountAt('/album/entry-1', COUPLE_ROLES)
    expect(screen.queryByText('ALBUM CONTENT')).toBeTruthy()
    expect(screen.queryByText('COUPLE HOME')).toBeNull()
  })
  it('COUPLE su /video/:id vede la revisione video', () => {
    PROFILE = { role: 'COUPLE', onboarding_complete: true }
    mountAt('/video/entry-1', COUPLE_ROLES)
    expect(screen.queryByText('VIDEO CONTENT')).toBeTruthy()
    expect(screen.queryByText('COUPLE HOME')).toBeNull()
  })
  // SICUREZZA: un cliente non deve MAI vedere la profilazione professionisti.
  it('COUPLE su /onboarding NON vede la profilazione e rimbalza su /couple', () => {
    PROFILE = { role: 'COUPLE', onboarding_complete: false }
    mountAt('/onboarding', COUPLE_ROLES)
    expect(screen.queryByText('PROFILAZIONE PRO')).toBeNull()
    expect(screen.queryByText('COUPLE HOME')).toBeTruthy()
  })
})
