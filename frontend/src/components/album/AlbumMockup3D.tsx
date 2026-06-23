import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { AlbumMockup } from './AlbumMockup'
import { materialByKey, modelByKey, coverDims, COLORS, modelLayout, type Cover, type Decoro, type Layout } from './albumCatalog'
import { getDecoroNormal, makeTitleTexture } from './albumTextures'

// Mockup album in vero 3D (WebGL). Drop-in di <AlbumMockup>: stesso `cover`.
// Album realistico: due piatti imbottiti + blocco carta a vista (bordi a pagine)
// + dorso sagomato (cresta tonda). MATERIALE = texture reale (bump+roughness) + PBR.
// Fallback al mockup CSS se WebGL non disponibile.

function hexLum(hex?: string) {
  if (!hex) return 0.8
  const m = hex.replace('#', '')
  if (m.length < 6) return 0.8
  return (parseInt(m.slice(0, 2), 16) * 0.299 + parseInt(m.slice(2, 4), 16) * 0.587 + parseInt(m.slice(4, 6), 16) * 0.114) / 255
}

// texture del taglio carta: righe finissime = le pagine impilate.
// vertical=true → righe lungo l'asse U (per la faccia laterale); false → lungo V (sopra/sotto)
const _stripes: Record<string, THREE.CanvasTexture> = {}
function stripesTexture(vertical: boolean): THREE.CanvasTexture {
  const k = vertical ? 'v' : 'h'
  if (_stripes[k]) return _stripes[k]!
  const c = document.createElement('canvas')
  if (vertical) { c.width = 256; c.height = 4 } else { c.width = 4; c.height = 256 }
  const x = c.getContext('2d')!
  x.fillStyle = '#f4eede'; x.fillRect(0, 0, c.width, c.height)
  const n = vertical ? c.width : c.height
  for (let i = 0; i < n; i += 2) {
    const v = 112 + Math.floor(Math.random() * 46) // righe nette → pagine leggibili
    x.fillStyle = `rgb(${v},${v - 14},${v - 30})`
    if (vertical) x.fillRect(i, 0, 1, 4); else x.fillRect(0, i, 4, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  _stripes[k] = t
  return t
}

const _texCache = new Map<string, THREE.Texture>()
function loadMatTexture(loader: THREE.TextureLoader, name: string, repeat: number, onReady: () => void): THREE.Texture {
  const cached = _texCache.get(name)
  if (cached) return cached
  const tex = loader.load(`/textures/materials/${name}.jpg`, () => onReady())
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.NoColorSpace
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  _texCache.set(name, tex)
  return tex
}
// albedo fotografico reale (legno) da URL arbitrario — sRGB
const _albCache = new Map<string, THREE.Texture>()
function loadAlbedo(loader: THREE.TextureLoader, url: string, repeat: number, onReady: () => void): THREE.Texture {
  const cached = _albCache.get(url)
  if (cached) return cached
  const tex = loader.load(url, () => onReady())
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  _albCache.set(url, tex)
  return tex
}

class AlbumScene {
  group = new THREE.Group()
  front: THREE.Mesh | null = null   // piatto anteriore (riceve materiale + decoro)
  spine: THREE.Mesh | null = null
  back: THREE.Mesh | null = null
  title: THREE.Mesh | null = null
  photo: THREE.Group | null = null
  box: THREE.Group | null = null
  boxKey = ''
  modelKey = ''; sizeSig = ''
  d = 0.5; w = 2.3; h = 2.85; tBoard = 0.1
  decoro: Decoro = 'plate'
  layout: Layout = 'plate'
  private texLoader = new THREE.TextureLoader()
  private photoUrl: string | null = null

  build(cover: Cover) {
    const m = modelByKey(cover.model)
    this.decoro = m?.decoro ?? 'plate'
    this.layout = modelLayout(cover.model)
    const { w, h, d } = coverDims(cover)
    this.w = w; this.h = h; this.d = d
    const t = this.tBoard = Math.min(0.12, d * 0.26)
    this.group.clear()
    this.front = this.back = this.spine = this.title = null; this.photo = null; this.photoUrl = null

    // --- blocco carta (a vista: bordi a pagine impilate) ---
    const pageW = w * 0.985, pageH = h * 0.985, pageD = (d - 2 * t) * 0.99
    const nLines = Math.max(24, Math.round(pageD * 130)) // ~n. pagine sul taglio
    const cream = new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.9 })
    const vEdge = stripesTexture(true).clone(); vEdge.needsUpdate = true; vEdge.wrapS = vEdge.wrapT = THREE.RepeatWrapping; vEdge.repeat.set(nLines, 1)
    const hEdge = stripesTexture(false).clone(); hEdge.needsUpdate = true; hEdge.wrapS = hEdge.wrapT = THREE.RepeatWrapping; hEdge.repeat.set(1, nLines)
    const sideMat = new THREE.MeshStandardMaterial({ map: vEdge, roughness: 0.94 })   // taglio laterale (+x)
    const tbMat = new THREE.MeshStandardMaterial({ map: hEdge, roughness: 0.94 })     // sopra/sotto (±y)
    // ordine facce BoxGeometry: px, nx, py, ny, pz, nz
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(pageW, pageH, pageD),
      [sideMat, cream, tbMat, tbMat, cream, cream],
    )
    block.castShadow = block.receiveShadow = true
    this.group.add(block)

    // --- piatti (imbottiti, bevel) ---
    const board = (zc: number) => {
      const b = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, t, 4, Math.min(0.05, t * 0.45)),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6 }),
      )
      b.position.z = zc; b.castShadow = b.receiveShadow = true
      this.group.add(b); return b
    }
    this.front = board(d / 2 - t / 2)
    this.back = board(-(d / 2 - t / 2))

    // --- dorso sagomato (cresta tonda imbottita) ---
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(d * 0.5, d * 0.5, h, 40, 1, false),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6 }),
    )
    spine.position.set(-w / 2 + d * 0.04, 0, 0)
    spine.castShadow = spine.receiveShadow = true
    this.group.add(spine); this.spine = spine

    const L = this.layout
    if (L === 'plate') this.addPlate(this.decoro === 'ottone', 'center')
    else if (L === 'monogram') this.addMonogram(cover)
    else if (L === 'fascia') this.addFascia(false)
    else if (L === 'fascia-ornament') this.addFascia(true)
    else if (L === 'oblique') this.addOblique()
    else if (L === 'swarovski-line') { this.addSwarovskiLine(); this.addPlate(false, 'top-right') }
    else if (L === 'swarovski-cluster') this.addSwarovski()
    // photo-* / print / laser → gestiti da setPhoto e dal normalMap in setMaterial
  }

  private addPlate(brass: boolean, pos: 'center' | 'top-right' = 'center') {
    const s = this.w * (pos === 'top-right' ? 0.3 : 0.34)
    const col = brass ? 0xb9923a : 0xcfd2d6
    const x = pos === 'top-right' ? this.w * 0.22 : 0
    const y = pos === 'top-right' ? this.h * 0.32 : 0
    const ph = pos === 'top-right' ? s * 0.42 : s
    const frame = new THREE.Mesh(
      new RoundedBoxGeometry(s, ph, 0.02, 3, 0.012),
      new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: brass ? 0.35 : 0.28, clearcoat: 0.4 }),
    )
    frame.position.set(x, y, this.d / 2 + 0.011); frame.castShadow = true
    this.group.add(frame)
    if (pos === 'center') {
      const inner = new THREE.Mesh(
        new THREE.PlaneGeometry(s * 0.7, s * 0.7),
        new THREE.MeshPhysicalMaterial({ color: brass ? 0x2a2018 : 0x15171c, metalness: 0.6, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
      )
      inner.position.set(0, 0, this.d / 2 + 0.022)
      this.group.add(inner)
    }
  }

  // fascia orizzontale di materiale contrastante (Claire/Comete/Plaza)
  private addFascia(ornament: boolean) {
    const fh = this.h * 0.24
    const mat = new THREE.MeshPhysicalMaterial({ color: ornament ? 0xe9ecdc : 0x6f7f93, roughness: 0.7, clearcoat: 0.1 })
    if (ornament) { mat.normalMap = getDecoroNormal('floral'); if (mat.normalMap) mat.normalScale.set(0.5, 0.5) }
    const band = new THREE.Mesh(new RoundedBoxGeometry(this.w * 1.005, fh, this.d * 0.62, 3, 0.02), mat)
    band.position.set(0, 0, 0); band.castShadow = true
    this.group.add(band)
    if (!ornament) {
      this.addSwarovskiLine(0)
      // targhetta a destra sulla fascia
      const s = this.w * 0.26
      const plate = new THREE.Mesh(new RoundedBoxGeometry(s, fh * 0.5, 0.02, 3, 0.01),
        new THREE.MeshPhysicalMaterial({ color: 0xd2d5d9, metalness: 1, roughness: 0.3, clearcoat: 0.4 }))
      plate.position.set(this.w * 0.26, 0, this.d / 2 + 0.012)
      this.group.add(plate)
    }
  }

  // separazione obliqua bicolore + linea Swarovski (Almond) — a filo sul piatto
  private addOblique() {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(this.w * 1.12, this.h * 0.46),
      new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, roughness: 0.5, clearcoat: 0.2 }))
    panel.position.set(0, -this.h * 0.26, this.d / 2 + 0.004)
    panel.rotation.z = -0.13
    this.group.add(panel)
    const grp = new THREE.Group()
    this.crystalRow(grp, this.w * 1.02, 0.022)
    grp.position.set(0, -this.h * 0.03, this.d / 2 + 0.02); grp.rotation.z = -0.13
    this.group.add(grp)
  }

  private crystalRow(grp: THREE.Group, width: number, size: number) {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 0.7, ior: 2.2, clearcoat: 1, reflectivity: 1 })
    const n = Math.max(10, Math.round(width / (size * 2.4)))
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(size), mat)
      c.position.set(-width / 2 + (i + 0.5) * (width / n), 0, 0)
      c.rotation.set(0.6, i, 0)
      grp.add(c)
    }
  }
  // linea Swarovski orizzontale (Diez / fascia Claire)
  private addSwarovskiLine(y = this.h * 0.0) {
    const grp = new THREE.Group()
    this.crystalRow(grp, this.w * 0.86, 0.028)
    grp.position.set(0, y, this.d / 2 + 0.03)
    this.group.add(grp)
  }

  // monogramma inciso (Brand/Vega) — testo iniziali debossato
  private addMonogram(cover: Cover) {
    const initials = (cover.title || 'A B').split(/[^A-Za-zÀ-ÿ]+/).filter(Boolean).map((s) => s[0]?.toUpperCase()).slice(0, 2).join('') || 'AB'
    const tex = makeTitleTexture(initials, false)
    const sz = this.w * 0.36
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz * 0.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.85 }))
    plane.position.set(0, this.h * 0.04, this.d / 2 + 0.012)
    this.group.add(plane)
  }

  private addSwarovski() {
    const crystalMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 0.6, ior: 2.0, clearcoat: 1, reflectivity: 1 })
    const cx = 0, cy = -this.h * 0.05
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const rr = 0.06 + (i % 3) * 0.04
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), crystalMat)
      c.position.set(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, this.d / 2 + 0.03)
      c.rotation.set(a, a, 0)
      this.group.add(c)
    }
  }

  setMaterial(materialKey: string | undefined, colorHex: string | undefined, albedoUrl: string | undefined, onReady: () => void) {
    const mat = materialByKey(materialKey) ?? materialByKey('alcantara')!
    const p = mat.pbr
    const bump = loadMatTexture(this.texLoader, mat.texture, p.repeat, onReady) // texture procedurale tileable: nessuna fascia
    const albedo = (mat.albedo && albedoUrl) ? loadAlbedo(this.texLoader, albedoUrl, p.repeat, onReady) : null
    const apply = (mesh: THREE.Mesh | null) => {
      if (!mesh) return
      const cm = mesh.material as THREE.MeshPhysicalMaterial
      if (albedo) { cm.map = albedo; cm.color.set(0xffffff) }   // legno: foto reale come colore
      else { cm.map = null; cm.color.set(colorHex || mat.swatch) }
      cm.roughness = p.roughness
      cm.metalness = p.metalness
      cm.clearcoat = p.clearcoat ?? 0
      cm.clearcoatRoughness = p.clearcoatRoughness ?? 0.5
      cm.reflectivity = p.reflectivity ?? 0.5
      cm.envMapIntensity = p.metalness > 0.2 ? 1.1 : 0.65
      cm.sheen = p.sheen ?? 0
      if (p.sheen) { cm.sheen = p.sheen; cm.sheenRoughness = 0.6; cm.sheenColor.set(0xffffff) }
      cm.bumpMap = bump; cm.bumpScale = p.bumpScale * (albedo ? 1.4 : 3.4)
      if (p.metalness < 0.2 && !albedo) cm.roughnessMap = bump   // grana modula la ruvidità → riflessi vivi
      else cm.roughnessMap = null
      cm.needsUpdate = true
    }
    apply(this.front); apply(this.back); apply(this.spine)
    // decoro inciso/stampato sul piatto anteriore — solo per laser e stampa
    if (this.front) {
      const cm = this.front.material as THREE.MeshPhysicalMaterial
      const nd: Decoro | null = this.layout === 'laser' ? 'frame' : this.layout === 'print' ? 'print' : null
      cm.normalMap = nd ? getDecoroNormal(nd) : null
      if (cm.normalMap) cm.normalScale.set(0.7, 0.7)
      cm.needsUpdate = true
    }
  }

  setTitle(title?: string, colorHex?: string) {
    if (this.title) { this.group.remove(this.title); (this.title.material as THREE.Material).dispose(); this.title.geometry.dispose(); this.title = null }
    const text = (title || '').trim()
    if (!text || this.layout === 'monogram') return   // monogram usa già le iniziali
    const L = this.layout
    const onMetal = L === 'plate' || L === 'fascia' || L === 'swarovski-line'
    const light = onMetal ? false : hexLum(colorHex) > 0.6
    const tex = makeTitleTexture(text, light)
    const tw = onMetal ? this.w * 0.24 : this.w * 0.5
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, tw * 0.25),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    let x = 0, y = -this.h * 0.34
    if (L === 'plate') y = 0
    else if (L === 'fascia') { x = this.w * 0.26; y = 0 }
    else if (L === 'swarovski-line') { x = this.w * 0.22; y = this.h * 0.32 }
    else if (L === 'photo-vertical') { x = -this.w * 0.2; y = -this.h * 0.18 }
    else if (L === 'photo-panoramic') y = -this.h * 0.16
    else if (L === 'oblique') { x = this.w * 0.18; y = -this.h * 0.2 }
    plane.position.set(x, y, this.d / 2 + (onMetal ? 0.03 : 0.015))
    this.group.add(plane); this.title = plane
  }

  private photoLayout(): null | { pw: number; ph: number; cx: number; cy: number; tri?: boolean } {
    const w = this.w, h = this.h
    switch (this.layout) {
      case 'photo-vertical': return { pw: w * 0.42, ph: h * 0.58, cx: w * 0.2, cy: h * 0.06 }
      case 'photo-panoramic': return { pw: w * 0.7, ph: h * 0.26, cx: 0, cy: h * 0.05 }
      case 'photo-small': return { pw: w * 0.3, ph: h * 0.22, cx: w * 0.12, cy: -h * 0.02 }
      case 'photo-full': return { pw: w * 0.86, ph: h * 0.86, cx: 0, cy: 0 }
      case 'trilogy': return { pw: w * 0.17, ph: w * 0.17, cx: 0, cy: h * 0.04, tri: true }
      default: return null
    }
  }

  setPhoto(url: string | null | undefined, onReady: () => void) {
    const cfg = this.photoLayout()
    const want = !!cfg || !!url
    if (!want) { if (this.photo) { this.group.remove(this.photo); this.photo = null } this.photoUrl = null; return }
    const src = url || (cfg ? '/textures/demo/couple.jpg' : null)
    const sig = `${this.layout}|${src ?? ''}`
    if (this.photo && this.photoUrl === sig) return
    if (this.photo) { this.group.remove(this.photo); this.photo = null }
    this.photoUrl = sig

    const p = cfg || { pw: this.w * 0.5, ph: this.h * 0.34, cx: 0, cy: this.h * 0.06 }
    const grp = new THREE.Group()
    const z = this.d / 2 + 0.012
    const positions = p.tri ? [-this.w * 0.19, 0, this.w * 0.19] : [p.cx]
    for (const px of positions) {
      const border = new THREE.Mesh(new THREE.PlaneGeometry(p.pw * 1.07, p.ph * 1.07), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }))
      border.position.set(px, p.cy, z); grp.add(border)
      const photoMat = new THREE.MeshBasicMaterial({ color: src ? 0xffffff : 0xcdc6ba })
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(p.pw, p.ph), photoMat)
      photo.position.set(px, p.cy, z + 0.004); grp.add(photo)
      if (src) this.texLoader.load(src, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; photoMat.map = tex; photoMat.color.set(0xffffff); photoMat.needsUpdate = true; onReady() })
    }
    this.group.add(grp); this.photo = grp
  }

  // box/contenitore coordinato che spunta dietro l'album (abbinamento packaging)
  setBox(boxKey: string | undefined, onReady: () => void) {
    const k = boxKey && boxKey !== 'nessuno' ? boxKey : ''
    if (this.boxKey === k && this.box) return
    if (this.box) { this.group.remove(this.box); this.box = null }
    this.boxKey = k
    if (!k) return
    const isCase = k === 'valigetta'
    const mat = isCase
      ? new THREE.MeshPhysicalMaterial({ color: 0x33271f, roughness: 0.5, clearcoat: 0.2 })
      : new THREE.MeshStandardMaterial({ map: loadAlbedo(this.texLoader, '/textures/wood/noce.jpg', 1, onReady), roughness: 0.6 })
    const g = new THREE.Group()
    const bw = this.w * 1.05, bh = this.h * 1.05, bd = this.d * 1.3
    const cof = new THREE.Mesh(new RoundedBoxGeometry(bw, bh, bd, 4, 0.05), mat)
    cof.position.set(this.w * 0.3, this.h * 0.08, -this.d * 0.92)
    cof.castShadow = cof.receiveShadow = true
    g.add(cof)
    // coperchio/solco a metà altezza (linea del cofanetto)
    const groove = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.002, 0.012, bd * 1.002), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 }))
    groove.position.set(this.w * 0.3, this.h * 0.08, -this.d * 0.92)
    g.add(groove)
    if (isCase) { // manico valigetta
      const handle = new THREE.Mesh(new THREE.TorusGeometry(this.w * 0.12, this.w * 0.018, 10, 24, Math.PI),
        new THREE.MeshPhysicalMaterial({ color: 0x222, roughness: 0.5 }))
      handle.position.set(this.w * 0.3, this.h * 0.62, -this.d * 0.92); handle.rotation.z = Math.PI
      g.add(handle)
    }
    this.group.add(g); this.box = g
  }

  apply(cover: Cover, onReady: () => void) {
    const sig = `${cover.model}|${cover.sizeKey || ''}|${cover.format || ''}`
    if (sig !== this.sizeSig) { this.sizeSig = sig; this.modelKey = cover.model || ''; this.box = null; this.boxKey = ''; this.build(cover) }
    this.setMaterial(cover.fabric, cover.color, cover.colorKey ? COLORS[cover.colorKey]?.tex : undefined, onReady)
    this.setTitle(cover.title, cover.color)
    this.setPhoto(cover.photo_url, onReady)
    this.setBox(cover.box, onReady)
  }
}

export function AlbumMockup3D({ cover, width = 360, interactive = true }: { cover: Cover; width?: number; interactive?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<AlbumScene | null>(null)
  const renderRef = useRef<() => void>(() => {})
  const frameRef = useRef<() => void>(() => {})
  const [failed, setFailed] = useState(false)
  const H = Math.round(width * 1.05)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }) } catch { setFailed(true); return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, H, false)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const camera = new THREE.PerspectiveCamera(34, width / H, 0.1, 100)
    const album = new AlbumScene()
    sceneRef.current = album
    scene.add(album.group)

    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(3, 5.5, 4); key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1; key.shadow.camera.far = 20
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4
    key.shadow.bias = -0.0004
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-4, 2, -2); scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(-2, 3, -5); scene.add(rim)
    const graze = new THREE.DirectionalLight(0xfff4e6, 0.9); graze.position.set(5, -0.5, 1.5); scene.add(graze) // radente → rivela la trama
    scene.add(new THREE.AmbientLight(0xffffff, 0.2))

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true
    scene.add(floor)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08
    controls.enablePan = false; controls.enableZoom = false
    controls.autoRotate = true; controls.autoRotateSpeed = 0.8
    controls.enabled = interactive
    controls.addEventListener('start', () => { controls.autoRotate = false })

    const render = () => renderer.render(scene, camera)
    renderRef.current = render

    const frame = () => {
      const { w, h } = album
      floor.position.y = -h / 2 - 0.01
      const dist = Math.max(w, h) * 2.2
      camera.position.set(dist * 0.52, dist * 0.34, dist * 0.74) // più 3/4: si vede il fianco (pagine chiuse)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0); controls.update()
    }
    frameRef.current = frame

    album.apply(cover, () => render())
    frame()

    let raf = 0
    const loop = () => { controls.update(); render(); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => {
      const cw = mount.clientWidth || width, ch = mount.clientHeight || H
      renderer.setSize(cw, ch, false)
      camera.aspect = cw / ch; camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose?.()
        const mm = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose()); else mm?.dispose?.()
      })
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const album = sceneRef.current
    if (!album) return
    album.apply(cover, () => renderRef.current())
    frameRef.current()   // riposiziona camera se è cambiato il formato
    renderRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.model, cover.fabric, cover.color, cover.title, cover.photo_url, cover.format, cover.sizeKey, cover.box])

  if (failed) return <AlbumMockup cover={cover} width={width} interactive={interactive} />
  return <div ref={mountRef} style={{ width, height: H, cursor: interactive ? 'grab' : 'default', touchAction: 'none' }} className="select-none rounded-lg overflow-hidden" />
}
