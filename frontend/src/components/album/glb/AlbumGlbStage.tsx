// L'ALBUM VERO IN 3D: geometria generata in Blender (blender/album_gen.py → /models/album/<layout>--<formato>.glb)
// e materiali PBR applicati a runtime dalle scelte del catalogo: tessuto/legno con grana reale
// (albedo · normal · roughness), tinta del colore scelto, foto nella lastra, nomi e logo come
// decalcomania in rilievo, ottone e cristalli con riflessi d'ambiente. Luce da studio, ACES.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { modelLayout, paletteFor, sizeByKey, type Cover } from '@/components/album/albumCatalog'
import { PBR, type PbrSet } from '@/components/album/glb/pbr.generated'
import { drawDecal, decorFor, decorImages, plateAlphaCanvas, PLATE_MARGIN, onDecalImagesReady, type DecalInk } from '@/components/album/glb/decal'
import { corsImageUrl } from '@/components/album/glb/imageUrl'

export type GlbCover = Cover & { logoKey?: string; ink?: DecalInk; eventDate?: string | null; backFabric?: string; backColorKey?: string; backColor?: string }

export type GlbView = 'front' | 'three-quarter' | 'spine' | 'top'
export type AlbumGlbStageHandle = { setView: (v: GlbView) => void; snapshot: () => string | null }

// L'album è APPOGGIATO (copertina verso l'alto, come sulle tavole del catalogo): le viste guardano dall'alto.
const VIEW: Record<GlbView, { az: number; el: number; dist: number }> = {
  front: { az: 0.0, el: 0.30, dist: 1.0 },
  'three-quarter': { az: 0.2, el: 0.24, dist: 1.05 },
  spine: { az: -0.44, el: 0.16, dist: 1.05 },
  top: { az: 0.0, el: 0.47, dist: 0.98 },
}

const texLoader = new THREE.TextureLoader()
const texCache = new Map<string, THREE.Texture>()
function tex(url: string, srgb: boolean, repeat: number): THREE.Texture {
  const k = `${url}|${srgb}|${repeat}`
  let t = texCache.get(k)
  if (!t) {
    t = texLoader.load(url)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 8
    texCache.set(k, t)
  }
  return t
}

/** Il materiale three.js della superficie di copertina per un materiale del catalogo e un colore. */
function surfaceMaterial(fabric: string | undefined, hex: string | undefined, isWood: boolean, essenceTex?: string): THREE.MeshPhysicalMaterial {
  const set: PbrSet | undefined = PBR[fabric ?? ''] ?? PBR['alcantara']
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 })
  if (set) {
    const rep = set.repeat
    if (set.color) m.map = tex(set.color, true, rep)
    if (isWood && essenceTex) m.map = tex(essenceTex, true, 1)      // foto dell'essenza (noce, rovere…)
    if (set.normal) { m.normalMap = tex(set.normal, false, rep); m.normalScale.set(set.normalScale ?? 1, set.normalScale ?? 1) }
    if (set.rough) m.roughnessMap = tex(set.rough, false, rep)
    m.roughness = set.roughness ?? 0.85
    m.metalness = set.metalness ?? 0
    if (set.sheen) { m.sheen = set.sheen; m.sheenRoughness = 0.6 }
    if (set.clearcoat) { m.clearcoat = set.clearcoat; m.clearcoatRoughness = set.clearcoatRoughness ?? 0.25 }
  }
  // tinta: sul legno l'albedo è la foto dell'essenza (non si tinge); sui tessuti il colore moltiplica la grana
  if (!isWood && hex) m.color.set(hex)
  if (isWood && set?.tint === false && hex) m.color.set(hex)
  m.envMapIntensity = set?.envMapIntensity ?? 0.9
  return m
}

export const AlbumGlbStage = forwardRef<AlbumGlbStageHandle, {
  cover: GlbCover; view?: GlbView; width?: number; interactive?: boolean
  /** Sostituisce il layout derivato dal modello (per prove). */
  layout?: string
}>(function AlbumGlbStage({ cover, view = 'three-quarter', width = 620, interactive = true, layout }, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: OrbitControls; album: THREE.Group | null; size: number } | null>(null)
  const setViewRef = useRef<(v: GlbView, animate?: boolean) => void>(() => {})
  const [failed, setFailed] = useState(false)
  const coverRef = useRef(cover); coverRef.current = cover     // sempre l'ultima composizione (anche nei callback asincroni)
  useImperativeHandle(ref, () => ({
    setView: (v) => setViewRef.current(v, true),
    snapshot: () => { const s = sceneRef.current; if (!s) return null; s.renderer.render(s.scene, s.camera); return s.renderer.domElement.toDataURL('image/png') },
  }), [])

  // ---- scena (una volta) ----
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    let renderer: THREE.WebGLRenderer
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }) } catch { setFailed(true); return }
    const H = Math.round(width * 0.75)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, H, false)
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block'
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.VSMShadowMap
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    const camera = new THREE.PerspectiveCamera(30, width / H, 0.01, 20)

    // studio: chiave calda, riempimento freddo, controluce; ombra morbida sul piano
    const key = new THREE.DirectionalLight(0xfff3e4, 2.6); key.position.set(0.5, 1.1, 0.9); key.castShadow = true
    key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.blurSamples = 12
    const cam = key.shadow.camera as THREE.OrthographicCamera; cam.left = cam.bottom = -0.5; cam.right = cam.top = 0.5; cam.near = 0.1; cam.far = 5
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xe6eefc, 0.7); fill.position.set(-1.2, 0.6, 0.4); scene.add(fill)
    const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(-0.3, 0.9, -1.2); scene.add(rim)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.22 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.enableZoom = false
    controls.minPolarAngle = Math.PI * 0.12; controls.maxPolarAngle = Math.PI * 0.55; controls.enabled = interactive

    let tween: { from: THREE.Vector3; to: THREE.Vector3; t0: number } | null = null
    const camPos = (v: GlbView) => {
      const s = sceneRef.current?.size ?? 0.3
      const a = VIEW[v]; const d = s * 2.6 * a.dist
      const az = a.az * Math.PI, el = a.el * Math.PI
      return new THREE.Vector3(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d)
    }
    setViewRef.current = (v, animate) => {
      const to = camPos(v)
      if (animate) tween = { from: camera.position.clone(), to, t0: performance.now() }
      else { camera.position.copy(to); controls.target.set(0, 0, 0); controls.update() }
    }
    sceneRef.current = { scene, camera, renderer, controls, album: null, size: 0.3 }
    setViewRef.current(view, false)

    let raf = 0
    const loop = () => {
      if (tween) {
        const t = Math.min(1, (performance.now() - tween.t0) / 650); const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        camera.position.lerpVectors(tween.from, tween.to, e); camera.lookAt(0, 0, 0)
        if (t >= 1) tween = null
      }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width, h = mount.clientHeight || H
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(mount)
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      sceneRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setViewRef.current(view, true) }, [view])

  // ---- geometria: il GLB del layout × formato ----
  const lay = layout ?? modelLayout(cover.model)
  const fmt = cover.format ?? 'square'
  const glbUrl = `/models/album/${lay}--${fmt}.glb`
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    let cancelled = false
    new GLTFLoader().load(glbUrl, (g) => {
      if (cancelled || !sceneRef.current) return
      const st = sceneRef.current
      if (st.album) { st.scene.remove(st.album) }
      const obj = g.scene
      obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
      // appoggia l'album sul piano (y = 0) e centralo; la misura reale scala la geometria di base
      const sz = sizeByKey(cover.sizeKey)
      const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3())
      const scale = sz ? Math.max(sz.w, sz.h) / 100 / Math.max(size.x, size.y) : 1
      obj.scale.setScalar(scale)
      const box2 = new THREE.Box3().setFromObject(obj); const c = box2.getCenter(new THREE.Vector3())
      obj.position.set(-c.x, -box2.min.y, -c.z)
      st.scene.add(obj); st.album = obj
      st.size = Math.max(size.x, size.y) * scale
      applyMaterials(obj, coverRef.current)
      setViewRef.current(view, false)
    }, undefined, () => setFailed(true))
    return () => { cancelled = true }
  }, [glbUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- materiali: ad ogni scelta ----
  useEffect(() => { const s = sceneRef.current; if (s?.album) applyMaterials(s.album, cover) },
    [cover.fabric, cover.color, cover.colorKey, cover.model, cover.title, cover.photo_url, cover.finishes?.join(','), cover.box, cover.logoKey, cover.ink, cover.eventDate, cover.backFabric, cover.backColorKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // le immagini del decal (logo del catalogo) arrivano dopo: ridisegno
  useEffect(() => { onDecalImagesReady(() => { const s = sceneRef.current; if (s?.album) applyMaterials(s.album, coverRef.current) }) }, [])

  if (failed) return <div className="grid place-items-center h-full text-sm text-[rgb(var(--fg-subtle))] p-6 text-center">Anteprima 3D non disponibile su questo dispositivo.</div>
  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: Math.round(width * 0.75), cursor: interactive ? 'grab' : 'default', touchAction: 'none' }} className="select-none" />
})

/** Applica i materiali del catalogo alle mesh nominate del GLB. */
function applyMaterials(root: THREE.Object3D, cover: GlbCover) {
  const isWood = cover.fabric === 'wood'
  const col = cover.fabric ? paletteFor(cover.fabric).find((c) => c.key === cover.colorKey) : undefined
  const hex = cover.color ?? col?.hex
  const coverMat = surfaceMaterial(cover.fabric, hex, isWood, isWood ? col?.tex : undefined)
  // retro e dorso: se la coppia ha scelto un altro materiale/colore, le mesh CoverBack e Spine lo indossano
  const bIsWood = cover.backFabric === 'wood'
  const bcol = cover.backFabric ? paletteFor(cover.backFabric).find((c) => c.key === cover.backColorKey) : undefined
  const backMat = cover.backFabric ? surfaceMaterial(cover.backFabric, cover.backColor ?? bcol?.hex, bIsWood, bIsWood ? bcol?.tex : undefined) : coverMat
  const bandMat = surfaceMaterial('alcantara', '#efe9dc', false)
  const brass = (cover.finishes ?? []).includes('targhetta') || true
  const plateMat = new THREE.MeshPhysicalMaterial({ color: brass ? 0xd9b46a : 0xd8d8d8, metalness: 1, roughness: 0.22, envMapIntensity: 1.4, clearcoat: 0.3 })
  const crystalMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 0.55, ior: 1.9, thickness: 0.002, envMapIntensity: 2.2, clearcoat: 1 })
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.92 })
  const photoMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 })
  const photoSrc = corsImageUrl(cover.photo_url, 1200)
  if (photoSrc) {
    // la foto passa dal proxy CORS quando serve (Drive): altrimenti WebGL la rifiuta e il piatto resta nero
    const t = texLoader.load(photoSrc, undefined, undefined, () => { photoMat.map = null; photoMat.color.set(0xe9e4dc); photoMat.needsUpdate = true })
    t.colorSpace = THREE.SRGBColorSpace; t.flipY = false
    photoMat.map = t
  } else { photoMat.color.set(0xe9e4dc) }
  const decalMat = new THREE.MeshPhysicalMaterial({ transparent: true, roughness: 0.6, metalness: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const decalTex = drawDecal(cover); if (decalTex) { decalMat.map = decalTex; decalMat.opacity = 1 } else decalMat.opacity = 0

  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    // il ruolo della mesh viene dal nome del materiale del GLB; lo memorizzo, perché dopo la prima
    // sostituzione il materiale è nostro e il nome originale non c'è più
    if (!m.userData.role) m.userData.role = String((m.material as THREE.Material)?.name ?? '').replace(/\.\d+$/, '')
    const base = m.userData.role as string
    if (base === 'Cover') m.material = (m.name === 'CoverBack' || m.name === 'Spine') ? backMat : coverMat
    else if (base === 'Band') m.material = bandMat
    else if (base === 'Plate') m.material = plateMat
    else if (base === 'Crystal') m.material = crystalMat
    else if (base === 'Pages') m.material = pagesMat
    else if (base === 'Photo') { m.material = photoMat }
    else if (base === 'Decal') { m.material = decalMat; m.castShadow = false }
  })
  // I CRISTALLI DEL DECORO: i Swarovski del modello (centri ritagliati dal catalogo) come piccole gemme 3D
  // sul piatto, in coordinate della copertina (x → larghezza, y → dall'alto della copertina verso chi guarda).
  const oldC = root.getObjectByName('DecorCrystals'); if (oldC) root.remove(oldC)
  const decor = decorFor(cover.model)
  const decal = root.getObjectByName('Decal') as THREE.Mesh | undefined
  const front = (root.getObjectByName('CoverFront') as THREE.Mesh | undefined) ?? decal
  // LA PIASTRA INTAGLIATA (Betulla/Dream, layout «laser»): la mesh Band diventa Cristalwhite lucida coi fori veri
  // del catalogo (alphaMap), e il piano dei nomi sale sopra la piastra
  const band = root.getObjectByName('Band') as THREE.Mesh | undefined
  if (decor?.kind === 'plate' && band) {
    const holes = decorImages(decor).print
    if (holes) {
      const a = new THREE.CanvasTexture(plateAlphaCanvas(holes)); a.flipY = false
      // la piastra copre la copertina meno il bordo: le UV 0..1 della piastra ↔ [margine, 1−margine] della copertina
      a.offset.set(PLATE_MARGIN, PLATE_MARGIN); a.repeat.set(1 - 2 * PLATE_MARGIN, 1 - 2 * PLATE_MARGIN); a.wrapS = a.wrapT = THREE.ClampToEdgeWrapping
      band.material = new THREE.MeshPhysicalMaterial({ color: 0xf7f5f0, roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.15, transparent: true, alphaMap: a, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 1.1 })
    }
    if (decal) {
      const bt = new THREE.Box3().setFromObject(band).max.y, dt = new THREE.Box3().setFromObject(decal).max.y
      if (dt <= bt) decal.position.y += (bt - dt + 0.0004) / (root.scale.y || 1)
    }
  }
  if (decor?.stonesXY.length && front) {
    const bb = new THREE.Box3().setFromObject(front)
    const g = new THREE.Group(); g.name = 'DecorCrystals'
    const wUnits = bb.max.x - bb.min.x, hUnits = bb.max.z - bb.min.z
    for (const [fx, fy, fr] of decor.stonesXY) {
      const r = Math.max(0.0012, fr * wUnits)
      const gem = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), crystalMat)   // calotta (chaton)
      gem.scale.set(1, 0.65, 1); gem.castShadow = true
      gem.position.copy(root.worldToLocal(new THREE.Vector3(bb.min.x + fx * wUnits, bb.max.y + r * 0.05, bb.min.z + fy * hUnits)))
      g.add(gem)
    }
    root.add(g)
  }
}
