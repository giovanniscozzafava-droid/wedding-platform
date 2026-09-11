// IL BOX CONTENITORE IN 3D, costruito al volo attorno all'album (misure vere): si deve capire QUALE box è
// e di che materiale/colore. Le box del catalogo si aprono SEMPRE DI LATO (cerniera sul fianco),
// mai dall'alto. Wood Clak = cofanetto con coperchio a cerniera aperto; Wood Duo = due vani
// (album + album genitori); Wood Case = custodia col coperchio trasparente chiuso; Twin Box = due vani
// (album + chiavetta USB); Valigetta = coperchio aperto, spigoli tondi e maniglia.
import * as THREE from 'three'

export type BoxKind = 'wood-clak' | 'wood-duo' | 'wood-case' | 'twin-box' | 'valigetta'
export const isBoxKind = (k?: string | null): k is BoxKind => !!k && ['wood-clak', 'wood-duo', 'wood-case', 'twin-box', 'valigetta'].includes(k)

export type BoxMats = { outer: THREE.Material; inner: THREE.Material; glass: THREE.Material; brass: THREE.Material; album: THREE.Material }
export type BoxBuild = { group: THREE.Group; albumLift: number; footprint: number }

const box = (w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true
  return mesh
}

/** Costruisce il box attorno a un album di larghezza w, profondità h (verso chi guarda) e spessore t (metri).
 *  L'album va appoggiato sul fondo del vano principale, centrato in (0, albumLift, 0). */
/** Il logo stampato sul coperchio: un piano sottile appoggiato sulla faccia esterna, con la texture
 *  del logo (canvas trasparente). `w`/`d` sono le misure del coperchio. */
function logoSulCoperchio(tex: THREE.Texture, w: number, d: number, lidT: number): THREE.Mesh {
  const lw = Math.min(w, d) * 0.42
  const img = tex.image as { width?: number; height?: number } | undefined
  const ratio = img?.width && img?.height ? img.height / img.width : 0.4
  const m = new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const p = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw * ratio), m)
  p.rotation.x = -Math.PI / 2
  p.position.set(0, lidT + 0.0006, 0)
  return p
}

export function buildBox(kind: BoxKind, w: number, h: number, t: number, M: BoxMats, hinged = true, lidLogo?: THREE.Texture): BoxBuild {
  const g = new THREE.Group(); g.name = 'BoxScene'
  const wall = 0.012, floor = 0.008, gap = 0.006, lidT = 0.012
  const clear = t + 0.012                                   // altezza interna del vano
  const second = kind === 'wood-duo' ? Math.max(0.12, w * 0.45) : kind === 'twin-box' ? 0.06 : 0   // secondo vano (a destra)
  const innerW = w + 2 * gap + (second ? second + wall : 0), innerD = h + 2 * gap
  const W = innerW + 2 * wall, D = innerD + 2 * wall, H = floor + clear
  // il vano principale è centrato sull'album: il box si sposta a destra della metà del secondo vano
  const ox = second ? (second + wall) / 2 : 0
  // fondo e pareti
  g.add(box(W, floor, D, M.outer, ox, floor / 2, 0))
  g.add(box(innerW, 0.001, innerD, M.inner, ox, floor + 0.0005, 0))            // fodera del fondo
  g.add(box(W, clear, wall, M.outer, ox, floor + clear / 2, -D / 2 + wall / 2))   // parete dietro
  g.add(box(W, clear, wall, M.outer, ox, floor + clear / 2, D / 2 - wall / 2))    // parete davanti
  g.add(box(wall, clear, D, M.outer, ox - W / 2 + wall / 2, floor + clear / 2, 0))   // sinistra
  g.add(box(wall, clear, D, M.outer, ox + W / 2 - wall / 2, floor + clear / 2, 0))   // destra
  if (second) {
    // divisorio e contenuto del secondo vano: l'album genitori (Wood Duo) o la chiavetta USB (Twin Box)
    const divX = w / 2 + gap + wall / 2
    g.add(box(wall, clear, innerD, M.outer, divX, floor + clear / 2, 0))
    if (kind === 'wood-duo') {
      const mw = second - 2 * gap, mh = Math.min(h - 2 * gap, mw * (h / w))
      g.add(box(mw, t * 0.7, mh, M.album, divX + wall / 2 + gap + mw / 2, floor + t * 0.35, 0))
    } else {
      g.add(box(0.012, 0.005, 0.05, M.brass, divX + wall / 2 + second / 2, floor + 0.0025, 0))
    }
  }
  // coperchio
  if (kind === 'wood-case') {
    // custodia: coperchio trasparente chiuso (si vede l'album dentro), cornice sottile
    const lid = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * wall, 0.004, D - 2 * wall), M.glass)
    lid.position.set(ox, H + 0.002, 0); g.add(lid)
    g.add(box(W, 0.006, wall, M.outer, ox, H + 0.003, -D / 2 + wall / 2)); g.add(box(W, 0.006, wall, M.outer, ox, H + 0.003, D / 2 - wall / 2))
    g.add(box(wall, 0.006, D, M.outer, ox - W / 2 + wall / 2, H + 0.003, 0)); g.add(box(wall, 0.006, D, M.outer, ox + W / 2 - wall / 2, H + 0.003, 0))
  } else {
    if (hinged) {
      // COPERCHIO A CERNIERA SUL FIANCO, aperto (~105°): le box del catalogo si aprono di lato, come
      // un libro, non sollevando il coperchio dall'alto. La fodera interna resta a vista.
      const hinge = new THREE.Group(); hinge.position.set(ox - W / 2, H, 0)
      const lid = box(W, lidT, D, M.outer, W / 2, lidT / 2, 0)
      const lining = box(W - 2 * wall, 0.001, D - 2 * wall, M.inner, W / 2, -0.0005, 0)
      hinge.add(lid); hinge.add(lining)
      if (lidLogo) { const l = logoSulCoperchio(lidLogo, W, D, lidT); l.position.x = W / 2; hinge.add(l) }
      hinge.rotation.z = Math.PI * (105 / 180)
      hinge.name = 'BoxLid'
      // la posa aperta e quella chiusa: il 3D le interpola quando il cliente tocca la box
      hinge.userData.open = { rz: Math.PI * (105 / 180), x: hinge.position.x, y: hinge.position.y, z: hinge.position.z }
      hinge.userData.closed = { rz: 0, x: hinge.position.x, y: hinge.position.y, z: hinge.position.z }
      g.add(hinge)
      for (const hz of [-D * 0.3, D * 0.3]) g.add(box(0.006, 0.006, 0.03, M.brass, ox - W / 2, H, hz))   // cerniere sul fianco
    } else {
      // SENZA CERNIERE: il coperchio è un tappo che si solleva. Si mostra sfilato di lato, appoggiato
      // e appena inclinato, come quando lo si toglie per prendere l'album.
      const tappo = new THREE.Group()
      tappo.add(box(W, lidT, D, M.outer, 0, lidT / 2, 0))
      if (lidLogo) tappo.add(logoSulCoperchio(lidLogo, W, D, lidT))
      tappo.add(box(W - 2 * wall, 0.001, D - 2 * wall, M.inner, 0, -0.0005, 0))
      // il bordo del tappo, che scende sulle pareti della base
      const bordo = wall * 0.9, hb = H * 0.34
      for (const [bw, bd, bx, bz] of [[W, bordo, 0, -D / 2 + bordo / 2], [W, bordo, 0, D / 2 - bordo / 2],
        [bordo, D, -W / 2 + bordo / 2, 0], [bordo, D, W / 2 - bordo / 2, 0]] as [number, number, number, number][]) {
        tappo.add(box(bw, hb, bd, M.outer, bx, -hb / 2, bz))
      }
      tappo.position.set(ox - W * 1.02, hb * 0.5, D * 0.06)
      tappo.rotation.set(0, 0.10, 0)
      tappo.name = 'BoxLid'
      tappo.userData.open = { rz: 0, ry: 0.10, x: ox - W * 1.02, y: hb * 0.5, z: D * 0.06 }
      tappo.userData.closed = { rz: 0, ry: 0, x: ox, y: H, z: 0 }   // calzato sulla base
      g.add(tappo)
    }
    if (kind === 'valigetta') {
      // maniglia sul fronte
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 10, 24, Math.PI), M.brass)
      handle.position.set(ox + W / 2 + 0.006, H * 0.55, 0); handle.rotation.set(0, Math.PI / 2, 0); g.add(handle)
      // chiusure
      for (const hz of [-D * 0.32, D * 0.32]) g.add(box(0.004, 0.012, 0.018, M.brass, ox + W / 2 + 0.002, H * 0.6, hz))
    }
  }
  // il coperchio si apre (o si sfila) di lato: l'ingombro cresce in larghezza, non in profondità
  return { group: g, albumLift: floor + 0.001, footprint: Math.max(W + (kind === 'wood-case' ? 0 : W * (hinged ? 0.55 : 1.15)), D) }
}
