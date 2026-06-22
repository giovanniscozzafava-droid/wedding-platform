import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { AlbumMockup } from './AlbumMockup'
import { fabricByKey, modelByKey, type Cover, type Format, type Decoro } from './albumCatalog'
import { getCoverMaps, makeTitleTexture, type BakedDecoro } from './albumTextures'

// Mockup album in vero 3D (WebGL/three.js). Drop-in di <AlbumMockup>: stesso `cover`.
// Layer indipendenti: modello = forma + decoro · tessuto = materiale PBR · colore = tinta.
// Fallback automatico al mockup CSS se il contesto WebGL non è disponibile.

function dims(format: Format) {
  if (format === 'portrait') return { w: 2.3, h: 2.85, d: 0.5 }
  if (format === 'landscape') return { w: 2.95, h: 2.25, d: 0.5 }
  return { w: 2.75, h: 2.75, d: 0.5 }
}
function hexLum(hex?: string) {
  if (!hex) return 0.8
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

class AlbumScene {
  group = new THREE.Group()
  cover: THREE.Mesh | null = null
  title: THREE.Mesh | null = null
  photo: THREE.Mesh | null = null
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
    const { w, h, d } = dims(m?.format ?? 'square')
    this.w = w; this.h = h; this.d = d

    // pulizia
    this.group.clear()
    this.cover = this.title = this.photo = null
    this.photoUrl = null

    const pages = new THREE.Mesh(
      new RoundedBoxGeometry(w * 0.965, h * 0.965, d * 0.74, 3, 0.015),
      new THREE.MeshStandardMaterial({ color: 0xefe7d6, roughness: 0.85, metalness: 0 }),
    )
    pages.castShadow = pages.receiveShadow = true
    this.group.add(pages)

    const cover = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 5, 0.05),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0 }),
    )
    cover.castShadow = cover.receiveShadow = true
    this.group.add(cover)
    this.cover = cover

    const groove = new THREE.Mesh(
      new RoundedBoxGeometry(0.03, h * 0.9, d * 0.78, 2, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }),
    )
    groove.position.set(-w / 2 + 0.06, 0, 0)
    this.group.add(groove)

    if (this.decoro === 'plate') this.addPlate()
    if (this.decoro === 'strap') this.addStrap()
  }

  private addPlate() {
    const s = this.w * 0.34
    const frame = new THREE.Mesh(
      new RoundedBoxGeometry(s, s, 0.02, 3, 0.012),
      new THREE.MeshPhysicalMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.28, clearcoat: 0.4 }),
    )
    frame.position.set(0, 0, this.d / 2 + 0.011)
    frame.castShadow = true
    this.group.add(frame)
    const inner = new THREE.Mesh(
      new THREE.PlaneGeometry(s * 0.7, s * 0.7),
      new THREE.MeshPhysicalMaterial({ color: 0x15171c, metalness: 0.6, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
    )
    inner.position.set(0, 0, this.d / 2 + 0.022)
    this.group.add(inner)
  }

  private addStrap() {
    const strap = new THREE.Mesh(
      new RoundedBoxGeometry(this.w * 0.13, this.h * 1.02, 0.04, 2, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 0.7 }),
    )
    strap.position.set(this.w * 0.3, 0, this.d / 2 + 0.02)
    strap.castShadow = true
    this.group.add(strap)
    const buckle = new THREE.Mesh(
      new THREE.TorusGeometry(this.w * 0.05, this.w * 0.012, 12, 24),
      new THREE.MeshPhysicalMaterial({ color: 0xb98b3a, metalness: 1, roughness: 0.3 }),
    )
    buckle.position.set(this.w * 0.3, 0, this.d / 2 + 0.05)
    this.group.add(buckle)
  }

  setMaterial(fabricKey?: string, colorHex?: string) {
    if (!this.cover) return
    const fab = fabricByKey(fabricKey) ?? fabricByKey('pelle')!
    const baked: BakedDecoro = this.decoro === 'floral' ? 'floral' : this.decoro === 'frame' ? 'frame' : 'none'
    const maps = getCoverMaps(fab.grain, baked)
    const p = fab.pbr
    const mat = this.cover.material as THREE.MeshPhysicalMaterial
    mat.color.set(colorHex || fab.swatch)
    mat.roughness = p.roughness
    mat.metalness = p.metalness
    mat.clearcoat = p.clearcoat ?? 0
    mat.clearcoatRoughness = p.clearcoatRoughness ?? 0.5
    mat.reflectivity = p.reflectivity ?? 0.5
    mat.normalMap = maps.normalMap
    mat.normalScale.set(p.normalScale, p.normalScale)
    maps.normalMap.repeat.set(p.repeat, p.repeat)
    mat.roughnessMap = maps.roughnessMap
    if (maps.roughnessMap) maps.roughnessMap.repeat.set(p.repeat, p.repeat)
    mat.needsUpdate = true
  }

  setTitle(title?: string, colorHex?: string) {
    if (this.title) { this.group.remove(this.title); (this.title.material as THREE.Material).dispose(); this.title.geometry.dispose(); this.title = null }
    const text = (title || '').trim()
    if (!text) return
    const light = hexLum(colorHex) > 0.6 || this.decoro === 'plate'
    const tex = makeTitleTexture(text, this.decoro === 'plate' ? false : light)
    const onPlate = this.decoro === 'plate'
    const tw = onPlate ? this.w * 0.26 : this.w * (this.decoro === 'photo' ? 0.5 : 0.6)
    const th = tw * 0.25
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(tw, th),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    let y = -this.h * 0.34, z = this.d / 2 + 0.02
    if (onPlate) { y = 0; z = this.d / 2 + 0.03 }
    else if (this.decoro === 'frame') y = 0
    else if (this.decoro === 'photo') y = -this.h * 0.30
    plane.position.set(0, y, z)
    this.group.add(plane)
    this.title = plane
  }

  setPhoto(url: string | null | undefined, onRender: () => void) {
    const want = this.decoro === 'photo' || !!url
    if (!want) {
      if (this.photo) { this.group.remove(this.photo); this.photo = null }
      this.photoUrl = null
      return
    }
    if (this.photo && this.photoUrl === (url ?? null)) return
    if (this.photo) { this.group.remove(this.photo); this.photo = null }
    this.photoUrl = url ?? null

    const isPhotoModel = this.decoro === 'photo'
    const pw = this.w * (isPhotoModel ? 0.62 : 0.5)
    const ph = this.h * (isPhotoModel ? 0.42 : 0.34)
    const cy = isPhotoModel ? this.h * 0.12 : this.h * 0.06
    const grp = new THREE.Group()
    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(pw * 1.06, ph * 1.06),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    )
    border.position.set(0, cy, this.d / 2 + 0.018)
    grp.add(border)
    const photoMat = new THREE.MeshBasicMaterial({ color: url ? 0xffffff : 0xcdc6ba })
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat)
    photo.position.set(0, cy, this.d / 2 + 0.02)
    grp.add(photo)
    this.group.add(grp)
    this.photo = grp as unknown as THREE.Mesh

    if (url) {
      this.texLoader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        photoMat.map = tex; photoMat.color.set(0xffffff); photoMat.needsUpdate = true
        onRender()
      })
    }
  }

  apply(cover: Cover, onRender: () => void) {
    this.setModel(cover.model || 'quadra')
    this.setMaterial(cover.fabric, cover.color)
    this.setTitle(cover.title, cover.color)
    this.setPhoto(cover.photo_url, onRender)
  }
}

export function AlbumMockup3D({ cover, width = 320, interactive = true }: { cover: Cover; width?: number; interactive?: boolean }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<AlbumScene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const renderRef = useRef<() => void>(() => {})
  const [failed, setFailed] = useState(false)
  const H = Math.round(width * 1.05)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setFailed(true); return
    }
    rendererRef.current = renderer
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
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08
    controls.enablePan = false; controls.enableZoom = false
    controls.autoRotate = true; controls.autoRotateSpeed = 0.8
    controls.enabled = interactive
    controls.addEventListener('start', () => { controls.autoRotate = false })

    const render = () => renderer.render(scene, camera)
    renderRef.current = render

    // frame camera + floor sul modello iniziale
    const frame = () => {
      const { w, h } = album
      floor.position.y = -h / 2 - 0.01
      const dist = Math.max(w, h) * 2.15
      camera.position.set(dist * 0.32, dist * 0.26, dist * 0.9)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0)
      controls.update()
    }

    // primo apply + framing
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
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      pmrem.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        mesh.geometry?.dispose?.()
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose?.()
      })
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // aggiorna su cambio cover (senza ricreare la scena)
  useEffect(() => {
    const album = sceneRef.current
    if (!album) return
    album.apply(cover, () => renderRef.current())
    renderRef.current()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.model, cover.fabric, cover.color, cover.title, cover.photo_url])

  if (failed) return <AlbumMockup cover={cover} width={width} interactive={interactive} />

  return (
    <div
      ref={mountRef}
      style={{ width, height: H, cursor: interactive ? 'grab' : 'default', touchAction: 'none' }}
      className="select-none rounded-lg overflow-hidden"
    />
  )
}
