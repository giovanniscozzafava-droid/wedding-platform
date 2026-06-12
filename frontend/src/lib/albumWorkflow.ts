// Workflow dell'album fra i 3 attori: NOI (admin), CLIENTE (coppia, che vede e
// interviene sulla bozza), IMPAGINATORE (fotografo, che rifinisce e consegna).
// Logica pura → testabile dai 3 punti di vista.
export type AlbumRole = 'couple' | 'photographer' | 'admin'
export type AlbumStatus = 'DRAFT' | 'COUPLE_REVIEW' | 'PHOTOGRAPHER_EDIT' | 'FINAL'

export function albumRoleOf(profileRole?: string | null): AlbumRole {
  if (profileRole === 'COUPLE') return 'couple'
  if (profileRole === 'ADMIN') return 'admin'
  return 'photographer'
}

// Tutti e tre possono modificare la bozza; la proprietà (chi tocca cosa) è
// garantita lato DB da album_can_edit (owner galleria | coppia | admin).
export function canEditAlbum(_role: AlbumRole): boolean { return true }

// Azione di consegna/avanzamento stato in base al ruolo.
export function primaryAction(role: AlbumRole, _status: AlbumStatus): { label: string; next: AlbumStatus } {
  if (role === 'couple') return { label: 'Invia al fotografo', next: 'PHOTOGRAPHER_EDIT' }
  return { label: 'Segna come finale', next: 'FINAL' }
}

export const STATUS_LABEL: Record<AlbumStatus, string> = {
  DRAFT: 'Bozza',
  COUPLE_REVIEW: 'In revisione coppia',
  PHOTOGRAPHER_EDIT: 'Da rifinire (fotografo)',
  FINAL: 'Finale',
}
export function statusLabel(s: string): string {
  return (STATUS_LABEL as Record<string, string>)[s] ?? s
}
