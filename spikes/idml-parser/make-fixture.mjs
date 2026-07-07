// Genera un IDML sintetico minimale (NON un file SmartAlbums: solo la struttura Adobe standard)
// per collaudare il parser end-to-end senza dipendere da un sample reale. Un vero export va
// comunque testato: qui verifichiamo solo che la matematica geometria→0..1 e crop sia corretta.
import { writeFileSync } from 'node:fs'
import { zipSync, strToU8 } from 'fflate'

const IDPKG = 'http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging'

const designmap = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Document xmlns:idPkg="${IDPKG}" DOMVersion="18.0">
  <idPkg:Spread src="Spreads/Spread_u1.xml"/>
</Document>`

// Spread 600x300 pt (2 pagine 300x300 affiancate). Un rettangolo con immagine linkata + crop.
const spread = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<idPkg:Spread xmlns:idPkg="${IDPKG}" DOMVersion="18.0">
  <Spread Self="u1" PageCount="2">
    <Page Self="pL" GeometricBounds="0 0 300 300" ItemTransform="1 0 0 1 0 0"/>
    <Page Self="pR" GeometricBounds="0 0 300 300" ItemTransform="1 0 0 1 300 0"/>
    <Rectangle Self="r1" ItemTransform="1 0 0 1 30 40">
      <Properties>
        <PathGeometry>
          <GeometryPathType PathOpen="false">
            <PathPointArray>
              <PathPointType Anchor="0 0"/>
              <PathPointType Anchor="240 0"/>
              <PathPointType Anchor="240 165"/>
              <PathPointType Anchor="0 165"/>
            </PathPointArray>
          </GeometryPathType>
        </PathGeometry>
      </Properties>
      <Image Self="img1" ItemTransform="1.25 0 0 1.25 -12 0">
        <Link Self="lk1" LinkResourceURI="file:/Users/foto/Album/IMG_2041.jpg"/>
      </Image>
    </Rectangle>
    <Rectangle Self="r2" ItemTransform="0.7071 0.7071 -0.7071 0.7071 420 60">
      <Properties>
        <PathGeometry>
          <GeometryPathType PathOpen="false">
            <PathPointArray>
              <PathPointType Anchor="0 0"/>
              <PathPointType Anchor="120 0"/>
              <PathPointType Anchor="120 120"/>
              <PathPointType Anchor="0 120"/>
            </PathPointArray>
          </GeometryPathType>
        </PathGeometry>
      </Properties>
      <Image Self="img2" ItemTransform="1 0 0 1 0 0">
        <Link Self="lk2" LinkResourceURI="file:/Users/foto/Album/IMG_2088.jpg"/>
      </Image>
    </Rectangle>
    <Rectangle Self="r3" ItemTransform="1 0 0 1 500 200">
      <Properties><PathGeometry><GeometryPathType><PathPointArray>
        <PathPointType Anchor="0 0"/><PathPointType Anchor="60 0"/>
        <PathPointType Anchor="60 60"/><PathPointType Anchor="0 60"/>
      </PathPointArray></GeometryPathType></PathGeometry></Properties>
    </Rectangle>
  </Spread>
</idPkg:Spread>`

const files = {
  'mimetype': strToU8('application/vnd.adobe.indesign-idml-package'),
  'designmap.xml': strToU8(designmap),
  'Spreads/Spread_u1.xml': strToU8(spread),
}
writeFileSync('fixture.idml', zipSync(files))
console.log('scritto fixture.idml (2 frame immagine + 1 frame vuoto, spread 600x300pt)')
