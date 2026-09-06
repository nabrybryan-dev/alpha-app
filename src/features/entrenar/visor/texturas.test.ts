import { describe, expect, it } from 'vitest'
import { cargarTexturas, TEXTURAS_DEL_SALON } from './texturas'

/**
 * LA CARGA DE LAS IMÁGENES, sin red y sin WebGL.
 *
 * jsdom no descarga imágenes, así que se le pasa una fábrica de imágenes de mentira que
 * dispara `onload` cuando la prueba quiere. Lo que se comprueba es el contrato: cada
 * textura llega al motor CON SU NOMBRE, se avisa para volver a pintar, y si el visor se
 * desmonta antes de que llegue la imagen no se toca un motor que ya no existe.
 */

type ImagenDeMentira = { src: string; onload: (() => void) | null; onerror: (() => void) | null }

function fabrica() {
  const creadas: ImagenDeMentira[] = []
  const crear = () => {
    const img: ImagenDeMentira = { src: '', onload: null, onerror: null }
    creadas.push(img)
    return img as unknown as HTMLImageElement
  }
  return { creadas, crear }
}

function motorDeMentira() {
  const cargadas: string[] = []
  const planas: string[] = []
  return {
    cargadas,
    planas,
    motor: {
      cargarTextura: (nombre: string) => void cargadas.push(nombre),
      cargarTexturaPlana: (nombre: string) => void planas.push(nombre),
    },
  }
}

describe('cargarTexturas', () => {
  it('pide cada imagen por su ruta y la entrega al motor con su nombre', () => {
    const { creadas, crear } = fabrica()
    const { motor, cargadas } = motorDeMentira()
    let avisos = 0
    cargarTexturas(motor, () => avisos++, crear)
    expect(creadas.map((i) => i.src)).toEqual(Object.values(TEXTURAS_DEL_SALON).map((t) => t.ruta))
    creadas[0].onload?.()
    expect(cargadas).toEqual([Object.keys(TEXTURAS_DEL_SALON)[0]])
    expect(avisos).toBe(1)
  })

  it('EL COLOR MEDIO VA PRIMERO Y SIN ESPERAR A NADIE', () => {
    // Es el fallo que Bryan vio en su iPhone el 2026-09-05: la sala llegó antes que las
    // imágenes y se dibujó BLANCA. El horneado lleva albedo 1 —el color oscuro del suelo
    // vive en la imagen—, así que sin imagen queda la luz desnuda. Con la plana puesta de
    // entrada, lo que falta es el detalle, no el color.
    const { crear } = fabrica()
    const { motor, planas, cargadas } = motorDeMentira()
    cargarTexturas(motor, () => {}, crear)
    expect(planas).toEqual(Object.keys(TEXTURAS_DEL_SALON))
    expect(cargadas).toEqual([])
  })

  it('cada textura declara un color medio creíble: ni blanco ni negro', () => {
    for (const [nombre, t] of Object.entries(TEXTURAS_DEL_SALON)) {
      expect(t.medio, nombre).toHaveLength(3)
      for (const c of t.medio) {
        expect(c, nombre).toBeGreaterThan(8)
        expect(c, nombre).toBeLessThan(200)
      }
    }
  })

  it('cancelada, una imagen que llega tarde no toca el motor ni avisa', () => {
    const { creadas, crear } = fabrica()
    const { motor, cargadas } = motorDeMentira()
    let avisos = 0
    const cancelar = cargarTexturas(motor, () => avisos++, crear)
    cancelar()
    creadas[0].onload?.()
    expect(cargadas).toEqual([])
    expect(avisos).toBe(0)
  })

  it('el suelo de goma está en la lista', () => {
    expect(TEXTURAS_DEL_SALON['suelo-goma'].ruta).toBe('/texturas/suelo-goma.jpg')
  })
})
