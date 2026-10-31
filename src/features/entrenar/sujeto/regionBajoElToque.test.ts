import { describe, expect, it } from 'vitest'
import { M4, type Vec3 } from '../../../domain/patrones/algebra'
import { Malla } from '../../../domain/patrones/malla'
import { REGIONES } from './regiones'
import {
  esUnToque,
  ojoDeLaCamara,
  rayoDeLaPantalla,
  regionBajoElDedo,
  regionBajoElRayo,
  UMBRAL_DE_TOQUE_PX,
  type CamaraParaElToque,
  type ParteDelCuerpo,
} from './regionBajoElToque'

/**
 * TOCAR UN MÚSCULO SOBRE EL CUERPO 3D (Bryan, 30-oct).
 *
 * El visor es un rasterizador WebGL propio sin selección: el toque se resuelve aparte, con la
 * MISMA cámara con la que se dibuja, lanzando un rayo contra los triángulos de los músculos
 * del atlas, solo al tocar. Lo que se vigila: que el rayo pase por donde el motor pinta (ida
 * y vuelta con la proyección real), que gane el músculo más cercano al ojo, que de espaldas
 * toque la espalda, y que un toque corto se distinga de un arrastre.
 */

const A = REGIONES[0].id
const B = REGIONES[1].id

const CAMARA: CamaraParaElToque = { azimut: 0, elevacion: 0, distancia: 3, centro: [0, 1, 0], campo: 0.6 }
const RECT = { left: 10, top: 20, width: 390, height: 800 }

/** Un cuadrado de lado `l` centrado en `(x, y)` a profundidad `z`, mirando a +z. */
function cuadrado(x: number, y: number, z: number, l = 0.4): Malla {
  const m = new Malla(8)
  const v = (dx: number, dy: number) => m.vertice([x + dx, y + dy, z], [0, 0, 1], [1, 1, 1], 0)
  v(-l / 2, -l / 2)
  v(l / 2, -l / 2)
  v(l / 2, l / 2)
  v(-l / 2, l / 2)
  m.cuadro(0, 1, 2, 3)
  return m
}

/** Los píxeles en que el motor dibuja un punto del mundo con esta cámara (como `cuadroDelCuerpo`). */
function pixelDe(p: Vec3, cam: CamaraParaElToque, rect = RECT): { x: number; y: number } {
  const vista = M4.mirarDesde(ojoDeLaCamara(cam), [...cam.centro] as Vec3, [0, 1, 0])
  const proy = M4.perspectiva(cam.campo, rect.width / rect.height, 0.05, 40)
  const v = M4.transformarPunto(vista, p)
  const w = -v[2]
  return {
    x: rect.left + (((proy[0] * v[0]) / w) * 0.5 + 0.5) * rect.width,
    y: rect.top + (0.5 - ((proy[5] * v[1]) / w) * 0.5) * rect.height,
  }
}

describe('rayoDeLaPantalla', () => {
  it('el centro del lienzo mira al centro de la cámara', () => {
    const c = pixelDe(CAMARA.centro as unknown as Vec3, CAMARA)
    const r = rayoDeLaPantalla(CAMARA, RECT, c.x, c.y)
    const ojo = ojoDeLaCamara(CAMARA)
    expect(r.origen).toEqual(ojo)
    const haciaElCentro = [CAMARA.centro[0] - ojo[0], CAMARA.centro[1] - ojo[1], CAMARA.centro[2] - ojo[2]]
    const n = Math.hypot(...haciaElCentro)
    for (let i = 0; i < 3; i++) expect(r.dir[i]).toBeCloseTo(haciaElCentro[i] / n, 6)
  })

  it('ida y vuelta con la proyección real: el rayo de un píxel pasa por el punto que allí se pinta', () => {
    const camaras: CamaraParaElToque[] = [
      CAMARA,
      { azimut: 180, elevacion: 0, distancia: 3, centro: [0, 1, 0], campo: 0.6 },
      { azimut: 28, elevacion: 6, distancia: 3.4, centro: [0.1, 0.9, 0], campo: 0.45 },
      { azimut: -70, elevacion: -20, distancia: 2.2, centro: [0, 1.1, 0.05], campo: 0.8 },
    ]
    const puntos: Vec3[] = [[0.2, 1.3, 0.1], [-0.3, 0.6, -0.1], [0, 1, 0], [0.05, 1.7, 0.2]]
    for (const cam of camaras) {
      for (const p of puntos) {
        const px = pixelDe(p, cam)
        const r = rayoDeLaPantalla(cam, RECT, px.x, px.y)
        // Distancia del punto al rayo.
        const o = r.origen
        const t = (p[0] - o[0]) * r.dir[0] + (p[1] - o[1]) * r.dir[1] + (p[2] - o[2]) * r.dir[2]
        const cerca: Vec3 = [o[0] + r.dir[0] * t, o[1] + r.dir[1] * t, o[2] + r.dir[2] * t]
        expect(Math.hypot(cerca[0] - p[0], cerca[1] - p[1], cerca[2] - p[2]), JSON.stringify([cam.azimut, p])).toBeLessThan(1e-4)
      }
    }
  })
})

describe('regionBajoElRayo', () => {
  it('gana el músculo más cercano al ojo, no el primero de la lista', () => {
    const lejos: ParteDelCuerpo = { malla: cuadrado(0, 1, -0.2), region: A }
    const cerca: ParteDelCuerpo = { malla: cuadrado(0, 1, 0.2), region: B }
    const px = pixelDe([0.06, 1.03, 0.2], CAMARA)
    const r = rayoDeLaPantalla(CAMARA, RECT, px.x, px.y)
    expect(regionBajoElRayo(r, [lejos, cerca])).toBe(B)
    expect(regionBajoElRayo(r, [cerca, lejos])).toBe(B)
  })

  it('fuera del cuerpo no hay región', () => {
    const px = pixelDe([1.5, 1, 0.2], CAMARA)
    const r = rayoDeLaPantalla(CAMARA, RECT, px.x, px.y)
    expect(regionBajoElRayo(r, [{ malla: cuadrado(0, 1, 0.2), region: A }])).toBeNull()
  })

  it('un músculo sin región o que la tabla no conoce no inventa nada', () => {
    const px = pixelDe([0.06, 1.03, 0.2], CAMARA)
    const r = rayoDeLaPantalla(CAMARA, RECT, px.x, px.y)
    expect(regionBajoElRayo(r, [{ malla: cuadrado(0, 1, 0.2), region: 'sin-region' }])).toBeNull()
    expect(regionBajoElRayo(r, [{ malla: cuadrado(0, 1, 0.2), region: undefined }])).toBeNull()
  })

  it('no elige lo que queda DETRÁS del ojo', () => {
    const px = pixelDe([0, 1, 0], CAMARA)
    const r = rayoDeLaPantalla(CAMARA, RECT, px.x, px.y)
    expect(regionBajoElRayo(r, [{ malla: cuadrado(0, 1, 5), region: A }])).toBeNull()
  })
})

describe('regionBajoElDedo: de frente y de espalda', () => {
  const pecho: ParteDelCuerpo = { malla: cuadrado(0, 1.2, 0.12), region: A }
  const espalda: ParteDelCuerpo = { malla: cuadrado(0, 1.2, -0.12), region: B }

  it('de frente se toca el pecho y de espalda («Dar la vuelta», 180°) la espalda, en el mismo píxel', () => {
    const frente = CAMARA
    const atras: CamaraParaElToque = { ...CAMARA, azimut: 180 }
    const p1 = pixelDe([0.06, 1.23, 0], frente)
    const p2 = pixelDe([0.06, 1.23, 0], atras)
    expect(regionBajoElDedo(frente, RECT, p1.x, p1.y, [pecho, espalda])).toBe(A)
    expect(regionBajoElDedo(atras, RECT, p2.x, p2.y, [pecho, espalda])).toBe(B)
  })

  it('devuelve siempre una región de las que cuenta seriesPorRegion, o nada', () => {
    const ids = new Set(REGIONES.map((r) => r.id))
    const p = pixelDe([0.06, 1.23, 0], CAMARA)
    const r = regionBajoElDedo(CAMARA, RECT, p.x, p.y, [pecho, espalda])
    expect(r === null || ids.has(r)).toBe(true)
  })
})

describe('esUnToque: toque corto elige, arrastre sigue girando', () => {
  it('poco recorrido y poco tiempo es un toque', () => {
    expect(esUnToque(0, 0, 80)).toBe(true)
    expect(esUnToque(3, -4, 200)).toBe(true)
  })
  it('un recorrido mayor que el umbral es un arrastre', () => {
    expect(esUnToque(UMBRAL_DE_TOQUE_PX + 1, 0, 80)).toBe(false)
    expect(esUnToque(0, -(UMBRAL_DE_TOQUE_PX + 1), 80)).toBe(false)
    expect(esUnToque(8, 8, 80)).toBe(false) // en diagonal también cuenta (11,3 px)
  })
  it('un dedo largo rato quieto es una pulsación larga (hundir), no un toque', () => {
    expect(esUnToque(0, 0, 700)).toBe(false)
  })
  it('el umbral está justo en el límite', () => {
    expect(esUnToque(UMBRAL_DE_TOQUE_PX, 0, 80)).toBe(true)
  })
})
