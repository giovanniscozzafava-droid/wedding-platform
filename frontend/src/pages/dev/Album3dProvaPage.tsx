// PAGINA DI PROVA del 3D dell'album (solo fotografi/admin): mostra un modello in un formato scelto
// dalla querystring, senza passare dal configuratore. Serve per verificare decori, materiali e
// formati (30×40, 40×30…) che nel configuratore sono bloccati dall'impaginato.
//   /dev/album-3d?model=darling&fmt=portrait&size=portrait:30x40&mat=sequoia&col=sequoia:cielo&names=Anna%20e%20Luca
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlbumGlbStage, type GlbCover } from '@/components/album/glb/AlbumGlbStage'
import { MODELS, paletteFor, type Format } from '@/components/album/albumCatalog'
import { familyOf, familyDefaults, familyLogo } from '@/components/album/catalog/coverOptions'

export default function Album3dProvaPage() {
  const [sp] = useSearchParams()
  const fam = (sp.get('model') ?? 'brand').toLowerCase()
  const fmt = (sp.get('fmt') ?? 'square') as Format
  const size = sp.get('size') ?? (fmt === 'portrait' ? 'portrait:30x40' : fmt === 'landscape' ? 'landscape:40x30' : 'square:30x30')
  const model = MODELS.find((m) => familyOf(m.label) === fam)
  const d = familyDefaults(model?.label)
  const mat = sp.get('mat') ?? d?.material
  const col = sp.get('col') ?? d?.color
  const hex = mat ? paletteFor(mat).find((c) => c.key === col)?.hex : undefined
  const cover = useMemo<GlbCover>(() => ({
    model: model?.key, fabric: mat, colorKey: col, color: hex, format: fmt, sizeKey: size,
    backFabric: d?.backMaterial, backColorKey: d?.backColor, backColor: d?.backMaterial ? paletteFor(d.backMaterial).find((c) => c.key === d.backColor)?.hex : undefined,
    title: sp.get('names') ?? '', dateText: sp.get('date') ?? '',
    logoKey: sp.get('logo') ?? (familyLogo(model?.label)?.startsWith('cod.') ? familyLogo(model?.label) : undefined),
    box: sp.get('box') ?? undefined, ink: 'ink',
  }), [model?.key, mat, col, hex, fmt, size, sp, d?.backMaterial, d?.backColor])
  return (
    <div className="mx-auto max-w-4xl p-4 space-y-3">
      <p className="text-sm text-[rgb(var(--fg-muted))]">Prova 3D · {model?.label ?? fam} · {fmt} {size} · {mat} {col}</p>
      <div className="rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]" style={{ aspectRatio: '4 / 3' }}>
        <AlbumGlbStage cover={cover} view={(sp.get('view') as 'front' | 'three-quarter' | 'spine' | 'top') ?? 'three-quarter'} width={900} />
      </div>
    </div>
  )
}
