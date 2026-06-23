import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

// Visore 3D del mockup: carica il GLB generato da Higgsfield (image_to_3d) a partire
// dal mockup 2D fotorealistico. Album ruotabile, proporzioni reali.
export function AlbumGlb3D({ url, width = 400 }: { url: string; width?: number }) {
  const mountRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, width, false)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.display = 'block'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100)
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(2.5, 4, 4); scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(-3, 2, 2); scene.add(fill)
    scene.add(new THREE.AmbientLight(0xffffff, 0.4))

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.dampingFactor = 0.08
    controls.enablePan = false; controls.enableZoom = false
    controls.autoRotate = true; controls.autoRotateSpeed = 0.9
    controls.addEventListener('start', () => { controls.autoRotate = false })

    let raf = 0
    new GLTFLoader().load(url, (g) => {
      const obj = g.scene
      const box = new THREE.Box3().setFromObject(obj)
      const c = box.getCenter(new THREE.Vector3())
      const s = box.getSize(new THREE.Vector3())
      obj.position.sub(c)
      scene.add(obj)
      const m = Math.max(s.x, s.y, s.z)
      camera.position.set(m * 0.95, m * 0.5, m * 1.95)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0); controls.update()
    })

    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width, h = mount.clientHeight || width
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
    })
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); pmrem.dispose(); renderer.dispose()
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
      scene.traverse((o) => {
        const me = o as THREE.Mesh
        me.geometry?.dispose?.()
        const mm = me.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mm)) mm.forEach((x) => x.dispose()); else mm?.dispose?.()
      })
    }
  }, [url])

  return <div ref={mountRef} style={{ width, height: width, cursor: 'grab', touchAction: 'none' }} className="select-none rounded-lg overflow-hidden" />
}
