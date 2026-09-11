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
import { buildBox, isBoxKind } from '@/components/album/glb/boxScene'
import { MATERIAL_SWATCH, MATERIAL_RELIEF } from '@/components/album/glb/materialSwatch.generated'
import { swatchUrl } from '@/components/album/catalog/swatches.generated'
import { logoToInk, inkRgb } from '@/components/album/glb/layoutSpec'
import { LAYOUT_SPEC, cropRect, frameOf, type PhotoCrop, type PhotoFrame, type LogoPlace, type TextPlace, type Rect } from '@/components/album/glb/layoutSpec'

export type GlbCover = Cover & { logoKey?: string; ink?: DecalInk; eventDate?: string | null; backFabric?: string; backColorKey?: string; backColor?: string; boxFabric?: string; boxColorKey?: string; boxColor?: string; boxHinge?: string; boxLogoKey?: string; photoCrops?: Record<number, PhotoCrop>; photoFrames?: Record<number, PhotoFrame>; logoPlace?: LogoPlace; dateText?: string | null; textPlace?: TextPlace }

export type GlbView = 'front' | 'three-quarter' | 'spine' | 'top'
export type AlbumGlbStageHandle = { setView: (v: GlbView) => void; snapshot: () => string | null }

// L'album è APPOGGIATO (copertina verso l'alto, come sulle tavole del catalogo): le viste guardano dall'alto.
const VIEW: Record<GlbView, { az: number; el: number; dist: number }> = {
  front: { az: 0.0, el: 0.30, dist: 1.0 },
  'three-quarter': { az: 0.2, el: 0.24, dist: 1.05 },
  spine: { az: -0.44, el: 0.16, dist: 1.05 },
  top: { az: 0.0, el: 0.47, dist: 0.98 },
}

// QUANTE VOLTE si ripete il campione sulla copertina: il ritaglio del catalogo inquadra circa 4–6 cm
// di materiale, quindi su un piatto da 30 cm la grana deve ripetersi 5–7 volte per avere la scala giusta.
const SWATCH_REPEAT: Record<string, number> = {
  alcantara: 4, sequoia: 4, acero: 4, pelle: 3.5, 'velu-arte': 4, 'soft-touch': 4, suade: 4,
  safir: 3.5, crazy: 3, juta: 4, metal: 3.5, skill: 3.5, wood: 2, cristalwhite: 2.5, cristalplex: 2.5,
}

// immagini del catalogo (loghi) per la box: cache, e al primo caricamento si ridisegna
const imgCache = new Map<string, HTMLImageElement | null>()
let onImgReady: (() => void) | null = null
function cachedImage(url?: string | null): HTMLImageElement | null {
  if (!url) return null
  if (imgCache.has(url)) return imgCache.get(url) ?? null
  const el = new Image(); el.crossOrigin = 'anonymous'; imgCache.set(url, null)
  el.onload = () => { imgCache.set(url, el); onImgReady?.() }
  el.src = url
  return null
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

/** Il materiale three.js della superficie di copertina per un materiale del catalogo e un colore.
 *  L'ALBEDO viene dal CAMPIONE VERO del catalogo quando c'è (grana e tinta fotografate sulle tavole
 *  115–127, rese ripetibili da gen-material-textures.py): niente più texture di libreria tinta a
 *  mano, che è ciò che dava l'aria da videogioco. Rilievo e lucentezza restano dal set PBR. */
function surfaceMaterial(fabric: string | undefined, hex: string | undefined, isWood: boolean, essenceTex?: string, colorKey?: string): THREE.MeshPhysicalMaterial {
  const set: PbrSet | undefined = PBR[fabric ?? ''] ?? PBR['alcantara']
  const vero = colorKey ? MATERIAL_SWATCH[colorKey] : undefined
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0 })
  if (set) {
    const rep = set.repeat
    if (set.color) m.map = tex(set.color, true, rep)
    if (isWood && essenceTex) {
      // L'ESSENZA VERA (ritagliata dalla tavola del catalogo): la piastrella si ripete ~2 volte sul
      // piatto, col suo rilievo; niente clearcoat da mobile laccato: la pelle di legno è satinata
      m.map = tex(essenceTex, true, 2)
      m.normalMap = tex('/textures/wood/_normal.jpg', false, 2); m.normalScale.set(0.45, 0.45)
      m.roughnessMap = tex('/textures/wood/_rough.jpg', false, 2)
      m.roughness = 0.62; m.clearcoat = 0.08; m.clearcoatRoughness = 0.5
    }
    // il campione del catalogo vince su tutto: è la superficie vera di quella tinta, col SUO rilievo
    // (ricavato dalla grana del campione, non dalla libreria)
    if (vero) {
      const rep = SWATCH_REPEAT[fabric ?? ''] ?? 5
      m.map = tex(vero.tex, true, rep)
      const rel = MATERIAL_RELIEF[fabric ?? '']
      if (rel) {
        m.normalMap = tex(rel.normal, false, rep); m.normalScale.set(set.normalScale ?? 1, set.normalScale ?? 1)
        m.roughnessMap = tex(rel.rough, false, rep)
      }
    }
    if (set.normal) { m.normalMap = tex(set.normal, false, rep); m.normalScale.set(set.normalScale ?? 1, set.normalScale ?? 1) }
    if (set.rough) m.roughnessMap = tex(set.rough, false, rep)
    m.roughness = set.roughness ?? 0.85
    m.metalness = set.metalness ?? 0
    if (set.sheen) { m.sheen = set.sheen; m.sheenRoughness = 0.6 }
    if (set.clearcoat) { m.clearcoat = set.clearcoat; m.clearcoatRoughness = set.clearcoatRoughness ?? 0.25 }
  }
  // tinta: col campione vero la grana PORTA GIÀ il colore (niente moltiplicazione, o si scurirebbe);
  // sul legno l'albedo è la foto dell'essenza; altrimenti il colore moltiplica la grana di libreria
  if (vero || (isWood && essenceTex)) m.color.set(0xffffff)   // la fotografia porta già il colore
  else if (!isWood && hex) m.color.set(hex)
  else if (isWood && set?.tint === false && hex) m.color.set(hex)
  m.envMapIntensity = isWood && essenceTex ? 0.55 : (set?.envMapIntensity ?? 0.9)
  return m
}

export const AlbumGlbStage = forwardRef<AlbumGlbStageHandle, {
  cover: GlbCover; view?: GlbView; width?: number; interactive?: boolean
  /** Sostituisce il layout derivato dal modello (per prove). */
  layout?: string
}>(function AlbumGlbStage({ cover, view = 'three-quarter', width = 620, interactive = true, layout }, ref) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: OrbitControls; album: THREE.Group | null; size: number; baseSize?: THREE.Vector3 } | null>(null)
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
    // modalità LEGGERA (?lite, o dispositivi con pochi core / senza GPU vera): niente ombre, un pixel per pixel
    const lite = (() => { try { return new URLSearchParams(window.location.search).has('lite') || (navigator.hardwareConcurrency ?? 8) <= 2 } catch { return false } })()
    renderer.setPixelRatio(lite ? 1 : Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, H, false)
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block'
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = !lite; renderer.shadowMap.type = THREE.VSMShadowMap
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
    // LA BOX SI APRE E SI CHIUDE AL TOCCO: un click sulla box (non un trascinamento) porta il
    // coperchio dalla posa aperta a quella chiusa, e viceversa, con una molla morbida
    let lidTarget = 1   // 1 = aperta, 0 = chiusa
    let lidNow = 1
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2()
    let downAt: { x: number; y: number; t: number } | null = null
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() } }
    const onUp = (e: PointerEvent) => {
      if (!downAt) return
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || performance.now() - downAt.t > 400
      downAt = null
      if (moved) return
      const boxScene = scene.getObjectByName('BoxScene'); if (!boxScene) return
      const r = renderer.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      if (ray.intersectObject(boxScene, true).length) lidTarget = lidTarget === 1 ? 0 : 1
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
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
      // il coperchio: interpolazione morbida tra aperto e chiuso
      {
        // si applica sempre: se la box viene ricostruita (cambio materiale) il coperchio riparte
        // dalla posa in cui l'aveva lasciata il cliente
        if (Math.abs(lidNow - lidTarget) > 0.001) lidNow += (lidTarget - lidNow) * 0.12
        const lid = scene.getObjectByName('BoxLid')
        const o = lid?.userData.open as { rz: number; ry?: number; x: number; y: number; z: number } | undefined
        const c = lid?.userData.closed as { rz: number; ry?: number; x: number; y: number; z: number } | undefined
        if (lid && o && c) {
          const k = lidNow
          lid.rotation.z = c.rz + (o.rz - c.rz) * k
          lid.rotation.y = (c.ry ?? 0) + ((o.ry ?? 0) - (c.ry ?? 0)) * k
          lid.position.set(c.x + (o.x - c.x) * k, c.y + (o.y - c.y) * k, c.z + (o.z - c.z) * k)
        }
      }
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
      renderer.domElement.removeEventListener('pointerdown', onDown); renderer.domElement.removeEventListener('pointerup', onUp)
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
      // appoggia l'album sul piano (y = 0) e centralo; la MISURA REALE dell'impaginato scala la geometria di base
      // per asse: larghezza (x) e altezza (z, verso chi guarda) ognuna sulla sua, così un 40×30, un 30×40 o un
      // 28×21 su misura hanno le proporzioni esatte, non quelle del GLB di riferimento
      st.baseSize = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3())
      st.scene.add(obj); st.album = obj
      fitToSize(st, obj, coverRef.current.sizeKey)
      applyMaterials(obj, coverRef.current)
      applyBox(st, coverRef.current)
      setViewRef.current(view, false)
    }, undefined, () => setFailed(true))
    return () => { cancelled = true }
  }, [glbUrl]) // eslint-disable-line react-hooks/exhaustive-deps
  // la misura cambia (arriva l'impaginato, o la coppia sceglie un'altra misura dello stesso formato): si riscala l'album
  useEffect(() => { const s = sceneRef.current; if (s?.album) { fitToSize(s, s.album, cover.sizeKey); applyBox(s, cover); setViewRef.current(view, false) } }, [cover.sizeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // il box contenitore (quale, e di che rivestimento) si ricostruisce attorno all'album
  useEffect(() => { const s = sceneRef.current; if (s?.album) { applyBox(s, cover); setViewRef.current(view, false) } }, [cover.box, cover.boxHinge, cover.boxLogoKey, cover.boxFabric, cover.boxColorKey, cover.boxColor, cover.fabric, cover.colorKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- materiali: ad ogni scelta ----
  useEffect(() => { const s = sceneRef.current; if (s?.album) applyMaterials(s.album, cover) },
    [cover.fabric, cover.color, cover.colorKey, cover.model, cover.title, cover.photo_url, cover.photo_urls?.join('|'), cover.finishes?.join(','), cover.box, cover.logoKey, cover.ink, cover.eventDate, cover.backFabric, cover.backColorKey, JSON.stringify(cover.photoCrops ?? null), JSON.stringify(cover.photoFrames ?? null), JSON.stringify(cover.logoPlace ?? null), cover.dateText, JSON.stringify(cover.textPlace ?? null)]) // eslint-disable-line react-hooks/exhaustive-deps
  // le immagini del decal (logo del catalogo) arrivano dopo: ridisegno
  useEffect(() => { onDecalImagesReady(() => { const s = sceneRef.current; if (s?.album) applyMaterials(s.album, coverRef.current) }) }, [])
  useEffect(() => { onImgReady = () => { const s = sceneRef.current; if (s?.album) { applyBox(s, coverRef.current); setViewRef.current(view, false) } }; return () => { onImgReady = null } }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className="grid place-items-center h-full text-sm text-[rgb(var(--fg-subtle))] p-6 text-center">Anteprima 3D non disponibile su questo dispositivo.</div>
  return <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: Math.round(width * 0.75), cursor: interactive ? 'grab' : 'default', touchAction: 'none' }} className="select-none" />
})

/** Scala l'album alla MISURA REALE per asse (larghezza x, altezza z verso chi guarda), lo appoggia sul piano e lo centra:
 *  un 40×30, un 30×40 o un 28×21 su misura hanno le proporzioni esatte, non quelle del GLB di riferimento. */
function fitToSize(st: { album: THREE.Group | null; size: number; baseSize?: THREE.Vector3 }, obj: THREE.Object3D, sizeKey?: string) {
  const base = st.baseSize; if (!base) return
  const sz = sizeByKey(sizeKey)
  const sx = sz ? sz.w / 100 / base.x : 1, szz = sz ? sz.h / 100 / base.z : 1
  obj.scale.set(sx, Math.max(sx, szz), szz)
  const box = new THREE.Box3().setFromObject(obj); const c = box.getCenter(new THREE.Vector3())
  obj.position.set(-c.x, -box.min.y, -c.z)
  st.size = Math.max(base.x * sx, base.z * szz)
}

/** IL BOX attorno all'album: costruito sulle misure vere dell'album, col rivestimento scelto (di default come la
 *  copertina); l'album si alza sul fondo del vano e l'inquadratura si allarga al box. */
function applyBox(st: { scene: THREE.Scene; album: THREE.Group | null; size: number; baseSize?: THREE.Vector3 }, cover: GlbCover) {
  const old = st.scene.getObjectByName('BoxScene'); if (old) st.scene.remove(old)
  const album = st.album; if (!album || !st.baseSize) return
  // l'album torna appoggiato a terra (fitToSize lo mette a y = 0), poi eventualmente sale sul fondo del box
  const bb0 = new THREE.Box3().setFromObject(album)
  album.position.y -= bb0.min.y
  if (!isBoxKind(cover.box)) { st.size = Math.max(st.baseSize.x * album.scale.x, st.baseSize.z * album.scale.z); return }
  const bb = new THREE.Box3().setFromObject(album); const sz = bb.getSize(new THREE.Vector3())
  const fabric = cover.boxFabric ?? cover.fabric
  const isWood = fabric === 'wood'
  const col = fabric ? paletteFor(fabric).find((c) => c.key === (cover.boxFabric ? cover.boxColorKey : cover.colorKey)) : undefined
  const hex = cover.boxFabric ? (cover.boxColor ?? col?.hex) : (cover.color ?? col?.hex)
  const outer = surfaceMaterial(fabric, hex, isWood, isWood ? col?.tex : undefined, cover.boxFabric ? cover.boxColorKey : cover.colorKey)
  const inner = surfaceMaterial('alcantara', '#efe9dc', false)
  // plexiglass: trasparenza semplice (niente `transmission`: costringe three.js a un passaggio di rendering in più
  // per fotogramma e sui dispositivi senza GPU vera blocca tutto)
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xf4f8fb, metalness: 0, roughness: 0.05, transparent: true, opacity: 0.32, envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false })
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9b46a, metalness: 1, roughness: 0.25, envMapIntensity: 1.3 })
  const albumMat = surfaceMaterial(cover.fabric, cover.color ?? undefined, cover.fabric === 'wood', undefined, cover.colorKey)
  // il logo sul coperchio (copertine con la foto a tutta pagina): il ritaglio del catalogo tinto
  // nell'inchiostro, come sulla copertina, ma appoggiato sulla box
  let lidLogo: THREE.Texture | undefined
  if (cover.boxLogoKey) {
    const im = cachedImage(swatchUrl(cover.boxLogoKey))
    if (im) { const c = logoToInk(im, 1024, Math.round(1024 * im.naturalHeight / im.naturalWidth), inkRgb('ink')); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; lidLogo = t }
  }
  const b = buildBox(cover.box, sz.x, sz.z, sz.y, { outer, inner, glass, brass, album: albumMat }, cover.boxHinge !== 'sfilabile', lidLogo)
  st.scene.add(b.group)
  album.position.y += b.albumLift
  st.size = b.footprint
}

/** «Photo», «Photo1», «Photo2»… → indice della finestra (da sinistra) */
const photoOrder = (name: string) => { const n = name.match(/(\d+)$/); return n ? Number(n[1]) - 1 : 0 }

/** IL RIQUADRO DELLE FOTO dove lo vuole la coppia. La finestra del modello (mesh «Photo», «Photo1»…)
 *  viene spostata, ridimensionata e inclinata sul piatto. Le coordinate si leggono dal piatto vero
 *  (mesh «CoverFront»): X = larghezza, Z = altezza dall'alto, Y = spessore (la normale della copertina).
 *  La trasformazione di partenza si tiene da parte, così ogni cambio riparte dal modello. */
function applyPhotoFrames(root: THREE.Object3D, meshes: THREE.Mesh[], windows: Rect[], coverMat: THREE.Material, frames?: Record<number, PhotoFrame>) {
  // le toppe della volta prima: via
  for (const old of root.children.filter((c) => c.name.startsWith('PhotoPatch'))) root.remove(old)
  if (!meshes.length) return
  const front = root.getObjectByName('CoverFront') ?? root.getObjectByName('Cover')
  if (!front) return
  root.updateWorldMatrix(true, true)
  const cb = new THREE.Box3().setFromObject(front)
  const cw = cb.max.x - cb.min.x, ch = cb.max.z - cb.min.z
  if (!(cw > 0 && ch > 0)) return
  const box = new THREE.Box3(), size = new THREE.Vector3(), center = new THREE.Vector3()
  for (const m of meshes) {
    const i = photoOrder(m.name)
    const win = windows[i] ?? windows[0]; if (!win) continue
    // la posa originale del modello: la ripristino a ogni applicazione
    const o = (m.userData.pose ??= { p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.clone() }) as { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }
    m.position.copy(o.p); m.quaternion.copy(o.q); m.scale.copy(o.s)
    const f = frames?.[i]
    if (!f) continue
    m.updateWorldMatrix(true, false)
    box.setFromObject(m); box.getSize(size); box.getCenter(center)
    if (!(size.x > 0 && size.z > 0)) continue
    // 1) misura: quanto deve crescere/stringere rispetto alla finestra del modello
    m.scale.set(o.s.x * (f.w / win.w), o.s.y, o.s.z * (f.h / win.h))
    // 2) inclinazione attorno alla normale del piatto
    if (f.rot) m.rotateY(THREE.MathUtils.degToRad(f.rot))
    // 3) posizione: il centro del riquadro sul piatto (x da sinistra, y dall'alto)
    m.updateWorldMatrix(true, false)
    const after = new THREE.Box3().setFromObject(m).getCenter(new THREE.Vector3())
    const target = new THREE.Vector3(cb.min.x + f.x * cw, center.y, cb.min.z + f.y * ch)
    const delta = target.sub(after)
    const parentScale = new THREE.Vector3(); (m.parent ?? root).getWorldScale(parentScale)
    m.position.add(new THREE.Vector3(delta.x / (parentScale.x || 1), delta.y / (parentScale.y || 1), delta.z / (parentScale.z || 1)))
    // 4) fuori dall'incasso del modello la foto sparirebbe dietro il piatto: la si posa SOPRA la
    //    copertina, come fa l'artigiano applicando la stampa
    m.updateWorldMatrix(true, false)
    const nb = new THREE.Box3().setFromObject(m)
    const lift = cb.max.y + (cb.max.y - cb.min.y) * 0.02 - nb.max.y
    if (lift > 0) m.position.y += lift / (parentScale.y || 1)
    // 5) l'incasso rimasto vuoto (la finestra del modello) si chiude con una toppa del materiale
    //    della copertina, altrimenti nel 3D resterebbe un buco dove la foto non c'è più
    if (Math.abs(f.x - win.x) > 0.002 || Math.abs(f.y - win.y) > 0.002) {
      const patch = new THREE.Mesh(new THREE.PlaneGeometry(win.w * cw, win.h * ch), coverMat)
      patch.name = `PhotoPatch${i}`
      patch.rotation.x = -Math.PI / 2
      patch.position.copy(root.worldToLocal(new THREE.Vector3(cb.min.x + win.x * cw, cb.max.y + (cb.max.y - cb.min.y) * 0.004, cb.min.z + win.y * ch)))
      patch.receiveShadow = true
      root.add(patch)
    }
  }
}

/** Applica i materiali del catalogo alle mesh nominate del GLB. */
function applyMaterials(root: THREE.Object3D, cover: GlbCover) {
  const isWood = cover.fabric === 'wood'
  const col = cover.fabric ? paletteFor(cover.fabric).find((c) => c.key === cover.colorKey) : undefined
  const hex = cover.color ?? col?.hex
  const coverMat = surfaceMaterial(cover.fabric, hex, isWood, isWood ? col?.tex : undefined, cover.colorKey)
  // retro e dorso: se la coppia ha scelto un altro materiale/colore, le mesh CoverBack e Spine lo indossano
  const bIsWood = cover.backFabric === 'wood'
  const bcol = cover.backFabric ? paletteFor(cover.backFabric).find((c) => c.key === cover.backColorKey) : undefined
  const backMat = cover.backFabric ? surfaceMaterial(cover.backFabric, cover.backColor ?? bcol?.hex, bIsWood, bIsWood ? bcol?.tex : undefined, cover.backColorKey) : coverMat
  const bandMat = surfaceMaterial('alcantara', '#efe9dc', false)
  const brass = (cover.finishes ?? []).includes('targhetta') || true
  const plateMat = new THREE.MeshPhysicalMaterial({ color: brass ? 0xd9b46a : 0xd8d8d8, metalness: 1, roughness: 0.22, envMapIntensity: 1.4, clearcoat: 0.3 })
  const crystalMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 0.55, ior: 1.9, thickness: 0.002, envMapIntensity: 2.2, clearcoat: 1 })
  const pagesMat = new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.92 })
  // UNA FOTO PER FINESTRA: i modelli a più finestre (Julies/Trilogy: Photo1, Photo2, Photo3 da sinistra) prendono
  // le foto scelte in ordine; a una finestra sola vale photo_url. La foto passa dal proxy CORS quando serve
  // (Drive): altrimenti WebGL la rifiuta e il piatto resta nero
  const urls = (cover.photo_urls?.length ? cover.photo_urls : [cover.photo_url ?? '']).filter(Boolean)
  const windows = LAYOUT_SPEC[modelLayout(cover.model)].photos
  const photoMatFor = (i: number) => {
    const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.34, clearcoat: 0.35, clearcoatRoughness: 0.22, envMapIntensity: 0.75 })
    const src = corsImageUrl(urls[i] ?? urls[0], 1200)
    if (src) {
      const t = texLoader.load(src, (tex) => {
        // la foto riempie la finestra «a copertura» col ritaglio scelto dalla coppia (stessa geometria di editor e PSD)
        const im = tex.image as { width?: number; height?: number } | undefined
        const win = frameOf(windows, i, cover.photoFrames)
        if (im?.width && im?.height && win) {
          const r = cropRect(im.width, im.height, win.w, win.h, cover.photoCrops?.[i])
          tex.offset.set(r.sx / im.width, r.sy / im.height); tex.repeat.set(r.sw / im.width, r.sh / im.height)
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true
        }
      }, undefined, () => { m.map = null; m.color.set(0xe9e4dc); m.needsUpdate = true })
      t.colorSpace = THREE.SRGBColorSpace; t.flipY = false
      m.map = t
    } else { m.color.set(0xe9e4dc) }
    return m
  }
  const decalMat = new THREE.MeshPhysicalMaterial({ transparent: true, roughness: 0.6, metalness: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const decalTex = drawDecal(cover); if (decalTex) { decalMat.map = decalTex; decalMat.opacity = 1 } else decalMat.opacity = 0

  const photoMeshes: THREE.Mesh[] = []
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
    else if (base === 'Photo') { m.material = photoMatFor(photoOrder(m.name)); photoMeshes.push(m) }
    else if (base === 'Decal') { m.material = decalMat; m.castShadow = false }
  })
  // IL RIQUADRO DELLA FOTO dove l'ha voluto la coppia: la finestra del modello viene spostata,
  // ridimensionata e inclinata sul piatto (l'artigiano poi la monta a mano seguendo la tavola).
  // Le coordinate si ricavano dal piatto vero (CoverFront): x = larghezza, z = altezza dall'alto.
  applyPhotoFrames(root, photoMeshes, windows, coverMat, cover.photoFrames)

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
