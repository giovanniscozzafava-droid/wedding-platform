// imagetracerjs non ha tipi ufficiali: dichiarazione minima per l'uso (vettorizzazione raster→SVG).
declare module 'imagetracerjs' {
  const ImageTracer: {
    imagedataToSVG(imgd: ImageData, options?: Record<string, unknown>): string
    imageToSVG(url: string, cb: (svg: string) => void, options?: Record<string, unknown>): void
  }
  export default ImageTracer
}
