import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { materialByKey, coverDims, type Cover } from './albumCatalog'

// Sfoglio album in 3D: la copertina (tessuto reale) si apre e si girano le
// facciate con le FOTO vere. Tecnica "una sola pagina che gira" + ricicla le
// texture → resta fluido anche con molte foto su telefono.
// Faccia: { fabric:true } (copertina) | { photo:url } | { blank:true }

type Face = { fabric?: boolean; photo?: string | null; blank?: boolean }
type Leaf = { front: Face; back: Face }

function buildLeaves(photos: string[]): Leaf[] {
  const ph = photos.filter(Boolean)
  const leaves: Leaf[] = []
  leaves.push({ front: { fabric: true }, back: ph[0] ? { photo: ph[0] } : { blank: true } })
  const rest = ph.slice(1)
  for (let i = 0; i < rest.length; i += 2) {
    leaves.push({ front: { photo: rest[i]! }, back: rest[i + 1] ? { photo: rest[i + 1]! } : { fabric: true } })
  }
  if (leaves.length === 1) leaves.push({ front: { blank: true }, back: { fabric: true } })
  // assicura che l'ultima facciata posteriore sia copertina
  const last = leaves[leaves.length - 1]!
  if (!last.back.fabric) leaves.push({ front: { blank: true }, back: { fabric: true } })
  return leaves
}

const _photoCache = new Map<string, THREE.Texture>()

export function AlbumFlipbook({ cover, photos, onClose }: { cover: Cover; photos: string[]; onClose: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<{ next: () => void; prev: () => void; canNext: () => boolean; canPrev: () => boolean } | null>(null)
  const [spread, setSpread] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const W = mount.clientWidth, H = mount.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H, false)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    // dimensioni pagina dal formato
    const dim = coverDims(cover)
    const pw = dim.w, ph = dim.h           // mezza apertura = una pagina
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100)
    const dist = Math.max(pw * 2.2, ph) * 1.85
    camera.position.set(0, dist * 0.18, dist)
    camera.lookAt(0, 0, 0)
    const render = () => renderer.render(scene, camera)

    const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(2, 5, 6); key.castShadow = true
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.near = 1; key.shadow.camera.far = 30
    key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-5, 3, 2); scene.add(fill)
    scene.add(new THREE.AmbientLight(0xffffff, 0.35))

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: 0.16 }))
    floor.rotation.x = -Math.PI / 2; floor.position.y = -ph / 2 - 0.05; floor.receiveShadow = true; scene.add(floor)

    // --- materiali ---
    const matInfo = materialByKey(cover.fabric) ?? materialByKey('alcantara')!
    const texLoader = new THREE.TextureLoader()
    const fabricBump = texLoader.load(`/textures/materials/${matInfo.texture}.jpg`, () => render())
    fabricBump.wrapS = fabricBump.wrapT = THREE.RepeatWrapping; fabricBump.colorSpace = THREE.NoColorSpace; fabricBump.repeat.set(matInfo.pbr.repeat, matInfo.pbr.repeat)
    const fabricMat = () => {
      const m = new THREE.MeshPhysicalMaterial({ color: cover.color || matInfo.swatch, roughness: matInfo.pbr.roughness, metalness: matInfo.pbr.metalness, clearcoat: matInfo.pbr.clearcoat ?? 0 })
      m.bumpMap = fabricBump; m.bumpScale = matInfo.pbr.bumpScale * 3.0; m.envMapIntensity = matInfo.pbr.metalness > 0.2 ? 1.1 : 0.65
      if (matInfo.pbr.sheen) { m.sheen = matInfo.pbr.sheen; m.sheenColor.set(0xffffff) }
      return m
    }
    const paperMat = (tex?: THREE.Texture | null) =>
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, map: tex ?? null })
    const blankMat = () => new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.85 })

    const loadPhoto = (url: string, cb: (t: THREE.Texture) => void) => {
      const c = _photoCache.get(url); if (c) { cb(c); return }
      texLoader.load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; _photoCache.set(url, t); cb(t) })
    }
    const faceMaterial = (f: Face): THREE.Material => {
      if (f.fabric) return fabricMat()
      if (f.blank) return blankMat()
      const m = paperMat(null)
      if (f.photo) loadPhoto(f.photo, (t) => { m.map = t; m.color.set(0xffffff); m.needsUpdate = true; render() })
      return m
    }

    const leaves = buildLeaves(photos)
    const N = leaves.length
    setTotal(N)

    // blocchi pagina (spessore) sotto le pagine statiche
    const blockMat = new THREE.MeshStandardMaterial({ color: 0xf1eadd, roughness: 0.9 })
    const mkBlock = (sign: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.18), blockMat)
      b.position.set(sign * pw / 2, 0, -0.11); b.castShadow = b.receiveShadow = true; return b
    }
    const leftBlock = mkBlock(-1), rightBlock = mkBlock(1)
    scene.add(leftBlock, rightBlock)

    // pagine statiche (sinistra/destra dello spread corrente)
    const plane = () => new THREE.PlaneGeometry(pw, ph)
    const leftPage = new THREE.Mesh(plane(), blankMat()); leftPage.position.set(-pw / 2, 0, 0.001); scene.add(leftPage)
    const rightPage = new THREE.Mesh(plane(), blankMat()); rightPage.position.set(pw / 2, 0, 0.001); scene.add(rightPage)

    // foglio che gira: gruppo con perno sulla costa (x=0), due facce back-to-back
    const flip = new THREE.Group(); scene.add(flip); flip.visible = false
    const frontFace = new THREE.Mesh(plane(), blankMat()); frontFace.position.set(pw / 2, 0, 0.004)
    const backFace = new THREE.Mesh(plane(), blankMat()); backFace.position.set(pw / 2, 0, -0.004); backFace.rotation.y = Math.PI
    flip.add(frontFace, backFace)

    let turned = 0          // quante facciate girate (0 = chiuso, copertina a destra)
    let animating = false

    const setPage = (mesh: THREE.Mesh, f: Face) => { mesh.material = faceMaterial(f) }
    const refreshStatic = () => {
      // destra = fronte del foglio corrente (se esiste); sinistra = retro del foglio precedente
      const right = leaves[turned]
      const leftPrev = leaves[turned - 1]
      rightPage.visible = !!right
      if (right) setPage(rightPage, right.front)
      leftPage.visible = !!leftPrev
      if (leftPrev) setPage(leftPage, leftPrev.back)
      leftBlock.visible = turned > 0
      rightBlock.visible = turned < N
      render()
    }
    refreshStatic()

    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

    const animate = (dir: 1 | -1, done: () => void) => {
      if (animating) return
      const leaf = dir === 1 ? leaves[turned] : leaves[turned - 1]
      if (!leaf) return
      animating = true
      // prepara il foglio in rotazione
      setPage(frontFace, leaf.front); setPage(backFace, leaf.back)
      flip.visible = true
      if (dir === 1) { rightPage.visible = false } else { leftPage.visible = false }
      const from = dir === 1 ? 0 : -Math.PI
      const to = dir === 1 ? -Math.PI : 0
      const t0 = performance.now(); const D = 620
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / D)
        flip.rotation.y = from + (to - from) * easeInOut(t)
        // leggero sollevamento al centro (curvatura finta)
        flip.position.z = Math.sin(easeInOut(t) * Math.PI) * 0.12
        render()
        if (t < 1) requestAnimationFrame(step)
        else { flip.visible = false; flip.rotation.y = 0; flip.position.z = 0; animating = false; done() }
      }
      requestAnimationFrame(step)
    }

    const next = () => { if (animating || turned >= N) return; animate(1, () => { turned++; refreshStatic(); setSpread(turned) }) }
    const prev = () => { if (animating || turned <= 0) return; animate(-1, () => { turned--; refreshStatic(); setSpread(turned) }) }
    apiRef.current = { next, prev, canNext: () => turned < N, canPrev: () => turned > 0 }

    // click sulla metà destra = avanti, sinistra = indietro
    const onClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect()
      if (e.clientX - r.left > r.width / 2) next(); else prev()
    }
    renderer.domElement.addEventListener('click', onClick)

    let raf = 0
    const idle = () => { render(); raf = requestAnimationFrame(idle) }
    raf = requestAnimationFrame(idle)

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth, h = mount.clientHeight
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); render()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener('click', onClick)
      pmrem.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      scene.traverse((o) => {
        const m = o as THREE.Mesh; m.geometry?.dispose?.()
        const mm = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose()); else mm?.dispose?.()
      })
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.fabric, cover.color, cover.sizeKey, cover.format, photos.join('|')])

  return (
    <div className="fixed inset-0 z-50 bg-[rgb(15,12,10)]/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 text-white/90">
        <span className="text-sm">Sfoglia l'album · {spread}/{Math.max(0, total)}</span>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10"><X size={20} /></button>
      </div>
      <div ref={mountRef} className="flex-1 min-h-0" />
      <div className="flex items-center justify-center gap-6 py-4">
        <button onClick={() => apiRef.current?.prev()} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30" disabled={spread <= 0}><ChevronLeft size={22} /></button>
        <span className="text-white/60 text-xs">tocca i lati o usa le frecce</span>
        <button onClick={() => apiRef.current?.next()} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30" disabled={spread >= total}><ChevronRight size={22} /></button>
      </div>
    </div>
  )
}
