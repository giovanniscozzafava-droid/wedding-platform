import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { AlbumMockup } from './AlbumMockup'
import { materialByKey, modelByKey, type Cover, type Format, type Decoro } from './albumCatalog'
import { getDecoroNormal, makeTitleTexture } from './albumTextures'

// Mockup album in vero 3D (WebGL). Drop-in di <AlbumMockup>: stesso `cover`.
// MATERIALE = texture reale (bumpMap) + PBR + colore. MODELLO = forma + decoro.
// Fallback al mockup CSS se WebGL non disponibile.

function dims(format: Format) {
  if (format === 'portrait') return { w: 2.3, h: 2.85, d: 0.5 }
  if (format === 'landscape') return { w: 2.95, h: 2.25, d: 0.5 }
  return { w: 2.75, h: 2.75, d: 0.5 }
}
function hexLum(hex?: string) {
  if (!hex) return 0.8
  const m = hex.replace('#', '')
  if (m.length < 6) return 0.8
  return (parseInt(m.slice(0, 2), 16) * 0.299 + parseInt(m.slice(2, 4), 16) * 0.587 + parseInt(m.slice(4, 6), 16) * 0.114) / 255
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

class AlbumScene {
  group = new THREE.Group()
  cover: THREE.Mesh | null = null
  title: THREE.Mesh | null = null
  photo: THREE.Group | null = null
  modelKey = ''
  d = 0.5; w = 2.75; h = 2.75
  decoro: Decoro = 'plate'
  private texLoader = new THREE.TextureLoader()
  private photoUrl: string | null = null

  setModel(modelKey: string) {
    if (modelKey === this.modelKey) return
    this.modelKey = modelKey
    const m = modelByKey(modelKey)
    this.decoro = m?.decoro ?? 'plate'
    const { w, h, d } = dims(m?.format ?? 'portrait')
    this.w = w; this.h = h; this.d = d
    this.group.clear()
    this.cover = this.title = null; this.photo = null; this.photoUrl = null

    const pages = new THREE.Mesh(
      new RoundedBoxGeometry(w * 0.965, h * 0.965, d * 0.74, 3, 0.015),
      new THREE.MeshStandardMaterial({ color: 0xefe7d6, roughness: 0.85 }),
    )
    pages.castShadow = pages.receiveShadow = true
    this.group.add(pages)

    const cover = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 5, 0.05),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6 }),
    )
    cover.castShadow = cover.receiveShadow = true
    this.group.add(cover); this.cover = cover

    const groove = new THREE.Mesh(
      new RoundedBoxGeometry(0.03, h * 0.9, d * 0.78, 2, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }),
    )
    groove.position.set(-w / 2 + 0.06, 0, 0)
    this.group.add(groove)

    if (this.decoro === 'plate' || this.decoro === 'ottone') this.addPlate(this.decoro === 'ottone')
    if (this.decoro === 'strap') this.addStrap()
    if (this.decoro === 'swarovski') this.addSwarovski()
  }

  private addPlate(brass: boolean) {
    const s = this.w * 0.34
    const col = brass ? 0xb9923a : 0xcfd2d6
    const frame = new THREE.Mesh(
      new RoundedBoxGeometry(s, s, 0.02, 3, 0.012),
      new THREE.MeshPhysicalMaterial({ color: col, metalness: 1, roughness: brass ? 0.35 : 0.28, clearcoat: 0.4 }),
    )
    frame.position.set(0, 0, this.d / 2 + 0.011); frame.castShadow = true
    this.group.add(frame)
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(s * 0.7, s * 0.7),
      new THREE.MeshPhysicalMaterial({ color: brass ? 0x2a2018 : 0x15171c, metalness: 0.6, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    )
    inner.position.set(0, 0, this.d / 2 + 0.022)
    this.group.add(inner)
  }

  private addStrap() {
    const strap = new THREE.Mesh(
      new RoundedBoxGeometry(this.w * 0.13, this.h * 1.02, 0.04, 2, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.7 }),
    )
    strap.position.set(this.w * 0.3, 0, this.d / 2 + 0.02); strap.castShadow = true
    this.group.add(strap)
    const buckle = new THREE.Mesh(
      new THREE.TorusGeometry(this.w * 0.05, this.w * 0.012, 12, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xb98b3a, metalness: 1, roughness: 0.3 }),
    )
    buckle.position.set(this.w * 0.3, 0, this.d / 2 + 0.05)
    this.group.add(buckle)
  }

  private addSwarovski() {
    // piccolo cluster di cristalli al centro-basso
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

  setMaterial(materialKey: string | undefined, colorHex: string | undefined, onReady: () => void) {
    if (!this.cover) return
    const mat = materialByKey(materialKey) ?? materialByKey('alcantara')!
    const p = mat.pbr
    const cm = this.cover.material as THREE.MeshPhysicalMaterial
    cm.color.set(colorHex || mat.swatch)
    cm.roughness = p.roughness
    cm.metalness = p.metalness
    cm.clearcoat = p.clearcoat ?? 0
    cm.clearcoatRoughness = p.clearcoatRoughness ?? 0.5
    cm.reflectivity = p.reflectivity ?? 0.5
    cm.sheen = p.sheen ?? 0
    if (p.sheen) cm.sheenColor.set(0xffffff)
    // texture reale del materiale come bump
    const bump = loadMatTexture(this.texLoader, mat.texture, p.repeat, onReady)
    cm.bumpMap = bump; cm.bumpScale = p.bumpScale
    // ornamento del modello (decoro inciso/stampato)
    cm.normalMap = getDecoroNormal(this.decoro)
    if (cm.normalMap) cm.normalScale.set(0.7, 0.7)
    cm.needsUpdate = true
  }

  setTitle(title?: string, colorHex?: string) {
    if (this.title) { this.group.remove(this.title); (this.title.material as THREE.Material).dispose(); this.title.geometry.dispose(); this.title = null }
    const text = (title || '').trim()
    if (!text) return
    const onMetal = this.decoro === 'plate' || this.decoro === 'ottone'
    const light = onMetal ? false : hexLum(colorHex) > 0.6
    const tex = makeTitleTexture(text, light)
    const tw = onMetal ? this.w * 0.26 : this.w * (this.decoro === 'photo' ? 0.5 : 0.6)
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, tw * 0.25),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    let y = -this.h * 0.34
    if (onMetal) y = 0
    else if (this.decoro === 'frame') y = 0
    else if (this.decoro === 'photo') y = -this.h * 0.3
    plane.position.set(0, y, this.d / 2 + (onMetal ? 0.03 : 0.02))
    this.group.add(plane); this.title = plane
  }

  setPhoto(url: string | null | undefined, onReady: () => void) {
    const want = this.decoro === 'photo' || !!url
    if (!want) { if (this.photo) { this.group.remove(this.photo); this.photo = null } this.photoUrl = null; return }
    if (this.photo && this.photoUrl === (url ?? null)) return
    if (this.photo) { this.group.remove(this.photo); this.photo = null }
    this.photoUrl = url ?? null

    const big = this.decoro === 'photo'
    const pw = this.w * (big ? 0.62 : 0.5), ph = this.h * (big ? 0.42 : 0.34)
    const cy = big ? this.h * 0.12 : this.h * 0.06
    const grp = new THREE.Group()
    const border = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.06, ph * 1.06), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }))
    border.position.set(0, cy, this.d / 2 + 0.018); grp.add(border)
    const photoMat = new THREE.MeshBasicMaterial({ color: url ? 0xffffff : 0xcdc6ba })
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat)
    photo.position.set(0, cy, this.d / 2 + 0.02); grp.add(photo)
    this.group.add(grp); this.photo = grp
    if (url) this.texLoader.load(url, (tex) => { tex.colorSpace = THREE.SRGBColorSpace; photoMat.map = tex; photoMat.color.set(0xffffff); photoMat.needsUpdate = true; onReady() })
  }

  apply(cover: Cover, onReady: () => void) {
    this.setModel(cover.model || 'rimboccato')
    this.setMaterial(cover.fabric, cover.color, onReady)
    this.setTitle(cover.title, cover.color)
    this.setPhoto(cover.photo_url, onReady)
  }
}

export function AlbumMockup3D({ cover, width = 360, interactive = true }: { cover: Cover; width?: number; interactive?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<AlbumScene | null>(null)
  const renderRef = useRef<() => void>(() => {})
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
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const camera = new THREE.PerspectiveCamera(35, width / H, 0.1, 100)
    const album = new AlbumScene()
    sceneRef.current = album
    scene.add(album.group)

    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(3, 5.5, 4); key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.near = 1; key.shadow.camera.far = 20
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4
    key.shadow.bias = -0.0004
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-4, 2, -2); scene.add(fill)
    scene.add(new THREE.AmbientLight(0xffffff, 0.28))

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.18 }))
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
      const dist = Math.max(w, h) * 2.15
      camera.position.set(dist * 0.32, dist * 0.26, dist * 0.9)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0); controls.update()
    }

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
    renderRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.model, cover.fabric, cover.color, cover.title, cover.photo_url])

  if (failed) return <AlbumMockup cover={cover} width={width} interactive={interactive} />
  return <div ref={mountRef} style={{ width, height: H, cursor: interactive ? 'grab' : 'default', touchAction: 'none' }} className="select-none rounded-lg overflow-hidden" />
}
