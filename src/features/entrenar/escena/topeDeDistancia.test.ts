import { describe, expect, it } from 'vitest'
import { Orbita } from '../visor/motor'
import { topeDeDistanciaEnSala } from './sala'

/**
 * LA CÁMARA NO SE SALE DE LA SALA.
 *
 * Con la sala cilíndrica de 7 m, alejarse los 6,5 m del pellizco siempre caía dentro. La
 * sala de Blender es rectangular y **el muro corto está a 5,5**: al alejarse hacia el
 * fondo, la cámara salía de la habitación y se veían las paredes desde fuera,
 * atravesándose. Bryan, navegando el 2026-09-05: «se cruzan paredes que no se debían
 * cruzar».
 *
 * La prueba barre la vuelta entera y exige que el ojo quede DENTRO en todos los ángulos,
 * que es donde el fallo aparecía y una comprobación en un solo ángulo no lo vería.
 */

const SALA = { medioAncho: 8, medioFondo: 5.5, alto: 3.8 }
const CENTRO: [number, number, number] = [0, 1.2, 0]

describe('topeDeDistanciaEnSala', () => {
  const tope = topeDeDistanciaEnSala(SALA)

  it('mirando al muro largo cabe más que al corto', () => {
    // Azimut 90°: el ojo se va en +X, hacia el muro largo (8 m).
    expect(tope(CENTRO, 90, 0)).toBeCloseTo(8 - 0.35, 6)
    // Azimut 0°: el ojo se va en +Z, hacia el muro corto (5,5 m).
    expect(tope(CENTRO, 0, 0)).toBeCloseTo(5.5 - 0.35, 6)
  })

  it('subiendo la cámara manda el TECHO, no la pared', () => {
    // Escrito primero al revés —«al subir cabe más, porque lo que acerca a la pared es la
    // distancia horizontal»— y la prueba lo desmintió: es verdad para el muro y falso para
    // la sala, porque antes de llegar al muro la cámara choca con el techo. A 45° el tope
    // es (3,45 − 1,2) / sen 45 = 3,18 m, y no los 5,15 del muro corto.
    const alto = 3.8 - 0.35
    const porElTecho = (grados: number) => (alto - CENTRO[1]) / Math.sin((grados * Math.PI) / 180)
    expect(tope(CENTRO, 0, 45)).toBeCloseTo(porElTecho(45), 6)
    expect(tope(CENTRO, 0, 80)).toBeCloseTo(porElTecho(80), 6)
    expect(tope(CENTRO, 0, 45)).toBeLessThan(tope(CENTRO, 0, 0))
  })

  it('mirando hacia abajo no hay suelo que acote: lo limita la elevación, no la sala', () => {
    // Por debajo del horizonte el ojo baja hacia el suelo, pero el suelo no es una pared:
    // si acotara, la cámara se quedaría clavada a 30 cm del sujeto en cuanto se mira desde
    // abajo. Lo que impide meterse bajo tierra es el tope de elevación de la órbita.
    expect(tope(CENTRO, 90, -45)).toBeCloseTo((8 - 0.35) / Math.cos((45 * Math.PI) / 180), 6)
  })

  it('el centro desplazado mueve el tope: el encuadre mira al centro del cuerpo', () => {
    const pegadoAlMuro: [number, number, number] = [0, 1.2, 4]
    expect(tope(pegadoAlMuro, 0, 0)).toBeCloseTo(5.5 - 0.35 - 4, 6)
  })
})

describe('la órbita con el tope puesto', () => {
  const nueva = () => {
    const o = new Orbita(document.createElement('div'), () => {})
    o.centro = [...CENTRO]
    o.elevacion = 10
    o.distancia = 6.5
    o.topeDeDistancia = topeDeDistanciaEnSala(SALA)
    return o
  }

  it('en toda la vuelta, y a toda elevación, el ojo queda dentro de la sala', () => {
    const o = nueva()
    for (let az = 0; az < 360; az += 5) {
      for (const el of [-40, -10, 0, 10, 45, 78]) {
        o.azimut = az
        o.elevacion = el
        const [x, y, z] = o.ojo()
        expect(Math.abs(x), `azimut ${az}, elevación ${el}`).toBeLessThanOrEqual(8)
        expect(Math.abs(z), `azimut ${az}, elevación ${el}`).toBeLessThanOrEqual(5.5)
        expect(y, `azimut ${az}, elevación ${el}`).toBeLessThanOrEqual(3.8)
      }
    }
  })

  it('SIN tope se sale: es el fallo que esto arregla', () => {
    const o = nueva()
    o.topeDeDistancia = null
    o.azimut = 0
    o.elevacion = 10
    expect(Math.abs(o.ojo()[2])).toBeGreaterThan(5.5)
  })

  it('no toca `distancia`: el dedo conserva lo que pidió y se respeta al girar a donde cabe', () => {
    const o = nueva()
    o.azimut = 0
    const cerca = o.distanciaEfectiva()
    o.azimut = 90
    const lejos = o.distanciaEfectiva()
    expect(o.distancia).toBe(6.5)
    expect(lejos).toBeGreaterThan(cerca)
    expect(lejos).toBeCloseTo(6.5, 6)
  })

  it('nunca acerca la cámara más allá del mínimo del pellizco', () => {
    const o = nueva()
    // Un centro absurdo, fuera de la sala: el tope saldría diminuto o negativo.
    o.centro = [7.9, 1.2, 5.4]
    o.azimut = 45
    expect(o.distanciaEfectiva()).toBeGreaterThanOrEqual(1.1)
  })
})
