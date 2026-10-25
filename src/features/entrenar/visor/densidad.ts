/**
 * LA DENSIDAD DE PIXELES QUE SE ADAPTA, portada de `ajustarDensidad` de la landing.
 *
 * Lo que frena en un portatil o en un telefono son los PIXELES, no los triangulos (medido en
 * Iris Xe: 28-40 fps a 1440x900 y 53-60 a 960x600, con cualquiera de los dos juegos de
 * piezas). Si el promedio de un segundo baja de 50 fps se reduce la densidad un 15 %, hasta
 * 0,6; si sobra (mas de 58 fps tres medidas seguidas) se recupera un 10 %.
 *
 * **Nunca sube del tope de 2** (`TOPE_DE_PIXELES`, el mismo de `Motor.ajustarTamano`): en un
 * iPhone con devicePixelRatio 3 renderizar a 3 es 2,25 veces los pixeles de 2 sin que se
 * note a la vista.
 *
 * Solo mide cuando se esta pintando de continuo: si entre dos cuadros pasan mas de 250 ms
 * (el cuerpo esta quieto, se pinta a demanda) se reinicia la ventana, para no confundir un
 * rato quieto con un telefono lento.
 */
export const TOPE_DE_PIXELES = 2
export const DENSIDAD_MINIMA = 0.6
const FPS_BAJO = 50
const FPS_ALTO = 58
const HUECO_QUIETO_MS = 250

export class AjusteDeDensidad {
  private readonly maxima: number
  densidad: number
  private desde = 0
  private cuadros = 0
  private ultimo = 0
  private holgura = 0

  constructor(dprDelDispositivo: number) {
    this.maxima = Math.min(dprDelDispositivo || 1, TOPE_DE_PIXELES)
    this.densidad = this.maxima
  }

  /** Avisa de un cuadro pintado. Devuelve la densidad nueva si hay que cambiarla. */
  alPintar(ahora: number): number | undefined {
    if (!this.desde || ahora - this.ultimo > HUECO_QUIETO_MS) {
      this.desde = ahora
      this.cuadros = 0
      this.ultimo = ahora
      return undefined
    }
    this.ultimo = ahora
    this.cuadros++
    const lapso = ahora - this.desde
    if (lapso < 1000) return undefined
    const fps = (this.cuadros * 1000) / lapso
    this.cuadros = 0
    this.desde = ahora
    let nueva = this.densidad
    if (fps < FPS_BAJO && this.densidad > DENSIDAD_MINIMA) {
      nueva = Math.max(DENSIDAD_MINIMA, this.densidad * 0.85)
      this.holgura = 0
    } else if (fps > FPS_ALTO && this.densidad < this.maxima && ++this.holgura >= 3) {
      nueva = Math.min(this.maxima, this.densidad * 1.1)
      this.holgura = 0
    }
    if (nueva === this.densidad) return undefined
    this.densidad = nueva
    return nueva
  }
}

/** Celular: menos de 760 px de ancho, el mismo corte que la landing. */
export function esCelular(
  matchMedia: ((q: string) => MediaQueryList) | undefined = typeof window !== 'undefined' ? window.matchMedia?.bind(window) : undefined,
): boolean {
  if (!matchMedia) return false
  try {
    return matchMedia('(max-width: 759px)').matches
  } catch {
    return false
  }
}

/** El pixel ratio real: el del aparato con tope de 2, y el ajuste solo puede bajarlo. */
export function pixelRatioEfectivo(dprDelDispositivo: number, densidad: number | null): number {
  const tope = Math.min(dprDelDispositivo || 1, TOPE_DE_PIXELES)
  if (densidad === null) return tope
  return Math.min(tope, Math.max(DENSIDAD_MINIMA, densidad))
}
