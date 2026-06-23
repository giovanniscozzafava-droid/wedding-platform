import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { AlbumMockup } from './AlbumMockup'
import { materialByKey, coverDims, COLORS, type Cover } from './albumCatalog'
import { CoverCanvas } from './albumCoverCanvas'

// Mockup album in vero 3D (WebGL). La COPERTINA stampata è una texture composita
// (CoverCanvas): materiale tinto + decoro del modello + accessori + foto + nomi,
// ridisegnata a ogni selezione → aggiornamento LIVE. Album realistico: piatti +
// blocco carta a vista + dorso tondo. Fallback al mockup CSS se WebGL non c'è.

const _texCache = new Map<string, THREE.Texture>()
function loadTex(loader: THREE.TextureLoader, url: string, srgb: boolean, repeat: number, onReady: () => void): THREE.Texture {
  const key = `${url}|${srgb}`
  const cached = _texCache.get(key)
  if (cached) return cached
  const tex = loader.load(url, () => onReady())
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = 8
  _texCache.set(key, tex)
  return tex
}

// taglio carta: righe finissime = pagine impilate
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
    const v = 112 + Math.floor(Math.random() * 46)
    x.fillStyle = `rgb(${v},${v - 14},${v - 30})`
    if (vertical) x.fillRect(i, 0, 1, 4); else x.fillRect(0, i, 4, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  _stripes[k] = t
  return t
}

class AlbumScene {
  group = new THREE.Group()
  front: THREE.Mesh | null = null   // piatto anteriore: faccia +z = copertina stampata
  spine: THREE.Mesh | null = null
  back: THREE.Mesh | null = null
  hingeA: THREE.Mesh | null = null
  hingeB: THREE.Mesh | null = null
  box: THREE.Group | null = null
  boxKey = ''
  sizeSig = ''
  d = 0.5; w = 2.3; h = 2.85; tBoard = 0.1
  onAsset: () => void = () => {}
  private texLoader = new THREE.TextureLoader()
  private coverCanvas: CoverCanvas
  private frontTex: THREE.CanvasTexture

  constructor() {
    this.coverCanvas = new CoverCanvas(() => { this.frontTex.needsUpdate = true; this.onAsset() })
    this.frontTex = new THREE.CanvasTexture(this.coverCanvas.canvas)
    this.frontTex.colorSpace = THREE.SRGBColorSpace
    this.frontTex.anisotropy = 8
  }

  private build(cover: Cover) {
    const { w, h } = coverDims(cover)
    const d = Math.max(h * 0.085, Math.min(h * 0.112, h * 0.095 + w * 0.006))
    this.w = w; this.h = h; this.d = d
    const t = this.tBoard = Math.max(0.055, Math.min(0.085, d * 0.26))
    this.group.clear()
    this.front = this.back = this.spine = this.hingeA = this.hingeB = null

    // --- blocco carta inset: resta visibile solo come taglio sottile sui lati ---
    const gutter = w * 0.055
    const overhang = Math.min(w, h) * 0.018
    const pageW = w - gutter - overhang * 2.4
    const pageH = h - overhang * 3.4
    const pageD = Math.max(0.055, d - t * 1.65)
    const nLines = Math.max(24, Math.round(pageD * 130))
    const cream = new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.94 })
    const vEdge = stripesTexture(true).clone(); vEdge.needsUpdate = true; vEdge.wrapS = vEdge.wrapT = THREE.RepeatWrapping; vEdge.repeat.set(nLines, 1)
    const hEdge = stripesTexture(false).clone(); hEdge.needsUpdate = true; hEdge.wrapS = hEdge.wrapT = THREE.RepeatWrapping; hEdge.repeat.set(1, nLines)
    const sideMat = new THREE.MeshStandardMaterial({ map: vEdge, roughness: 0.94 })
    const tbMat = new THREE.MeshStandardMaterial({ map: hEdge, roughness: 0.94 })
    const block = new THREE.Mesh(new THREE.BoxGeometry(pageW, pageH, pageD), [sideMat, cream, tbMat, tbMat, cream, cream])
    block.position.set(gutter * 0.45, 0, -t * 0.08)
    block.castShadow = block.receiveShadow = true
    this.group.add(block)

    // --- piatto anteriore: faccia +z = copertina stampata, coste rivestite ---
    const edgeMat = () => new THREE.MeshPhysicalMaterial({ color: 0xd6c7ad, roughness: 0.62, envMapIntensity: 0.55 })
    const frontMat = new THREE.MeshPhysicalMaterial({ map: this.frontTex, roughness: 0.5, envMapIntensity: 0.76 })
    // ordine facce BoxGeometry: px, nx, py, ny, pz, nz → pz = copertina
    const front = new THREE.Mesh(new RoundedBoxGeometry(w, h, t, 5, Math.min(0.045, t * 0.42)), [edgeMat(), edgeMat(), edgeMat(), edgeMat(), frontMat, edgeMat()])
    front.position.z = d / 2 - t / 2; front.castShadow = front.receiveShadow = true
    this.group.add(front); this.front = front

    // --- piatto posteriore (imbottito) ---
    const back = new THREE.Mesh(new RoundedBoxGeometry(w, h, t, 5, Math.min(0.045, t * 0.42)), edgeMat())
    back.position.z = -(d / 2 - t / 2); back.castShadow = back.receiveShadow = true
    this.group.add(back); this.back = back

    // --- dorso: ridge slim a filo, non un tubo separato ---
    const ridgeR = Math.max(0.032, Math.min(0.052, d * 0.16))
    const spine = new THREE.Mesh(new THREE.CylinderGeometry(ridgeR, ridgeR, h * 0.985, 32, 1, false), edgeMat())
    spine.position.set(-w / 2 + ridgeR * 0.52, 0, 0)
    spine.scale.x = 0.62
    spine.castShadow = spine.receiveShadow = true
    this.group.add(spine); this.spine = spine

    const grooveMat = new THREE.MeshStandardMaterial({ color: 0x17110c, roughness: 1, transparent: true, opacity: 0.24 })
    const hingeW = Math.max(0.008, w * 0.004)
    const hingeA = new THREE.Mesh(new THREE.BoxGeometry(hingeW, h * 0.965, 0.006), grooveMat)
    hingeA.position.set(-w / 2 + gutter * 0.58, 0, d / 2 + 0.003)
    const hingeB = new THREE.Mesh(new THREE.BoxGeometry(hingeW * 0.7, h * 0.94, 0.006), grooveMat.clone())
    hingeB.position.set(-w / 2 + gutter * 0.86, 0, d / 2 + 0.004)
    this.group.add(hingeA, hingeB); this.hingeA = hingeA; this.hingeB = hingeB
  }

  private setSurface(cover: Cover, onReady: () => void) {
    const mat = materialByKey(cover.fabric) ?? materialByKey('alcantara')!
    const p = mat.pbr
    const grain = loadTex(this.texLoader, `/textures/materials/${mat.texture}.jpg`, false, p.repeat, onReady)
    const woodUrl = mat.albedo ? (cover.colorKey ? COLORS[cover.colorKey]?.tex : undefined) || '/textures/wood/noce.jpg' : undefined
    const wood = woodUrl ? loadTex(this.texLoader, woodUrl, true, p.repeat, onReady) : null

    // faccia copertina (canvas): solo finitura PBR + micro-rilievo della grana
    if (this.front) {
      const fm = (this.front.material as THREE.MeshPhysicalMaterial[])[4]!
      fm.roughness = p.roughness; fm.metalness = Math.min(0.15, p.metalness)
      fm.clearcoat = p.clearcoat ?? 0; fm.clearcoatRoughness = p.clearcoatRoughness ?? 0.5
      fm.reflectivity = p.reflectivity ?? 0.5; fm.envMapIntensity = 0.7
      fm.sheen = p.sheen ?? 0; if (p.sheen) { fm.sheenRoughness = 0.6; fm.sheenColor.set(0xffffff) }
      fm.bumpMap = grain; fm.bumpScale = p.bumpScale * 1.2
      fm.needsUpdate = true
    }
    // dorso + retro + bordi del piatto: il materiale avvolge le coste (no cornice bianca)
    const paintMat = (cm: THREE.MeshPhysicalMaterial) => {
      if (wood) { cm.map = wood; cm.color.set(0xffffff) } else { cm.map = null; cm.color.set(cover.color || mat.swatch) }
      cm.roughness = p.roughness; cm.metalness = Math.min(0.15, p.metalness)
      cm.clearcoat = p.clearcoat ?? 0; cm.clearcoatRoughness = p.clearcoatRoughness ?? 0.5
      cm.envMapIntensity = 0.65; cm.sheen = p.sheen ?? 0
      cm.bumpMap = grain; cm.bumpScale = p.bumpScale * (wood ? 1.4 : 3.0)
      cm.needsUpdate = true
    }
    const skin = (mesh: THREE.Mesh | null) => { if (mesh) paintMat(mesh.material as THREE.MeshPhysicalMaterial) }
    skin(this.spine)
    skin(this.back)
    // coste del piatto frontale (tutte le facce tranne la +z = copertina)
    if (this.front) { const fa = this.front.material as THREE.MeshPhysicalMaterial[];[0, 1, 2, 3, 5].forEach((i) => fa[i] && paintMat(fa[i]!)) }
  }

  // box/contenitore coordinato dietro l'album
  private setBox(boxKey: string | undefined, onReady: () => void) {
    const k = boxKey && boxKey !== 'nessuno' ? boxKey : ''
    if (this.boxKey === k && this.box) return
    if (this.box) { this.group.remove(this.box); this.box = null }
    this.boxKey = k
    if (!k) return
    const isCase = k === 'valigetta'
    const mat = isCase
      ? new THREE.MeshPhysicalMaterial({ color: 0x33271f, roughness: 0.5, clearcoat: 0.2 })
      : new THREE.MeshStandardMaterial({ map: loadTex(this.texLoader, '/textures/wood/noce.jpg', true, 1, onReady), roughness: 0.6 })
    const g = new THREE.Group()
    const bw = this.w * 1.05, bh = this.h * 1.05, bd = Math.max(this.d * 1.55, this.h * 0.14)
    const cof = new THREE.Mesh(new RoundedBoxGeometry(bw, bh, bd, 4, 0.05), mat)
    cof.position.set(this.w * 0.3, this.h * 0.08, -this.d * 0.92); cof.castShadow = cof.receiveShadow = true
    g.add(cof)
    const groove = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.002, 0.012, bd * 1.002), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 }))
    groove.position.set(this.w * 0.3, this.h * 0.08, -this.d * 0.92); g.add(groove)
    if (isCase) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(this.w * 0.12, this.w * 0.018, 10, 24, Math.PI),
        new THREE.MeshPhysicalMaterial({ color: 0x222222, roughness: 0.5 }))
      handle.position.set(this.w * 0.3, this.h * 0.62, -this.d * 0.92); handle.rotation.z = Math.PI; g.add(handle)
    }
    this.group.add(g); this.box = g
  }

  apply(cover: Cover, onReady: () => void) {
    this.onAsset = onReady
    const sig = `${cover.model}|${cover.sizeKey || ''}|${cover.format || ''}`
    if (sig !== this.sizeSig) { this.sizeSig = sig; this.box = null; this.boxKey = ''; this.build(cover) }
    this.coverCanvas.setAspect(this.w / this.h)
    this.coverCanvas.paint(cover)
    this.frontTex.needsUpdate = true
    this.setSurface(cover, onReady)
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
    const graze = new THREE.DirectionalLight(0xfff4e6, 0.9); graze.position.set(5, -0.5, 1.5); scene.add(graze)
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
      const dist = Math.max(w, h) * 2.05
      camera.position.set(dist * 0.18, dist * 0.22, dist * 0.92)
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
    frameRef.current()
    renderRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cover.model, cover.fabric, cover.color, cover.colorKey, cover.title, cover.subtitle, cover.monogram,
    cover.fontKey, cover.textLayout, cover.decorationKey, cover.borderKey, cover.textColor, cover.accentColor,
    cover.photo_url, cover.format, cover.sizeKey, cover.box, (cover.finishes ?? []).join(','),
  ])

  if (failed) return <AlbumMockup cover={cover} width={width} interactive={interactive} />
  return <div ref={mountRef} style={{ width, height: H, cursor: interactive ? 'grab' : 'default', touchAction: 'none' }} className="select-none rounded-lg overflow-hidden" />
}
