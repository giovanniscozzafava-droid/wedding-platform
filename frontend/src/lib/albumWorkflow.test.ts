import { describe, it, expect } from 'vitest'
import { albumRoleOf, canEditAlbum, primaryAction, statusLabel } from './albumWorkflow'

// I 3 punti di vista richiesti: NOI, CLIENTE, IMPAGINATORE.
describe('POV NOI (admin)', () => {
  it('riconosce admin, può modificare, consegna come finale', () => {
    const role = albumRoleOf('ADMIN')
    expect(role).toBe('admin')
    expect(canEditAlbum(role)).toBe(true)
    expect(primaryAction(role, 'DRAFT').next).toBe('FINAL')
  })
})

describe('POV CLIENTE (coppia) — vede e interviene sulla bozza', () => {
  it('riconosce la coppia, può intervenire, invia al fotografo', () => {
    const role = albumRoleOf('COUPLE')
    expect(role).toBe('couple')
    expect(canEditAlbum(role)).toBe(true)
    const action = primaryAction(role, 'DRAFT')
    expect(action.label).toBe('Invia al fotografo')
    expect(action.next).toBe('PHOTOGRAPHER_EDIT')
  })
})

describe('POV IMPAGINATORE (fotografo) — rifinisce e corregge', () => {
  it('il fornitore è impaginatore, può modificare, consegna finale', () => {
    const role = albumRoleOf('FORNITORE')
    expect(role).toBe('photographer')
    expect(canEditAlbum(role)).toBe(true)
    expect(primaryAction(role, 'PHOTOGRAPHER_EDIT').next).toBe('FINAL')
  })
  it('anche location/WP impaginano come professionisti', () => {
    expect(albumRoleOf('LOCATION')).toBe('photographer')
    expect(albumRoleOf('WEDDING_PLANNER')).toBe('photographer')
  })
})

describe('etichette stato', () => {
  it('mappa gli stati in italiano', () => {
    expect(statusLabel('DRAFT')).toBe('Bozza')
    expect(statusLabel('FINAL')).toBe('Finale')
    expect(statusLabel('PHOTOGRAPHER_EDIT')).toBe('Da rifinire (fotografo)')
    expect(statusLabel('SCONOSCIUTO')).toBe('SCONOSCIUTO')
  })
})
