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
  return {
    cargadas,
    motor: { cargarTextura: (nombre: string) => void cargadas.push(nombre) },
  }
}

describe('cargarTexturas', () => {
  it('pide cada imagen por su ruta y la entrega al motor con su nombre', () => {
    const { creadas, crear } = fabrica()
    const { motor, cargadas } = motorDeMentira()
    let avisos = 0
    cargarTexturas(motor, () => avisos++, crear)
    expect(creadas.map((i) => i.src)).toEqual(Object.values(TEXTURAS_DEL_SALON))
    creadas[0].onload?.()
    expect(cargadas).toEqual([Object.keys(TEXTURAS_DEL_SALON)[0]])
    expect(avisos).toBe(1)
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
    expect(TEXTURAS_DEL_SALON['suelo-goma']).toBe('/texturas/suelo-goma.jpg')
  })
})
