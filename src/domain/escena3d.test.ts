import { describe, expect, it } from 'vitest'
import {
  ALTO_TOPE,
  FOV_3D,
  FOV_PLANO,
  LIMITES_CAMARA,
  SEPARACION,
  SIN_AJUSTE,
  acotarAjuste,
  alturaDeVistaPlana,
  amortiguar,
  caminoDelPlan,
  centroDeVentana,
  disposicionDeBarras,
  distanciaParaAltura,
  elegirRespaldo,
  pasoDeMuelle,
  poseConAjuste,
  poseDelCamino,
  poseEnNodo,
  poseEnfocada,
  poseGeneral,
  poseVistaPlana,
  posicionDeCamara,
  puntosDeLaCinta,
  semanaVecina,
  semanasVisibles,
} from './escena3d'
import type { PautadoVsHechoMicrociclo, SituacionPautado } from './pautadoVsHecho'

function fila(
  numero: number,
  s: [number, number],
  v: [number, number],
  situacion: SituacionPautado = 'con-datos',
  extra: Partial<PautadoVsHechoMicrociclo> = {},
): PautadoVsHechoMicrociclo {
  const pct = (h: number, p: number) => (p > 0 ? Math.round((h / p) * 100) : undefined)
  return {
    id: `m-${numero}`,
    numero,
    fechaInicio: '2026-09-01',
    estado: 'cerrado',
    situacion,
    series: { pautado: s[0], hecho: s[1], cumplimientoPct: pct(s[1], s[0]) },
    volumen: { pautado: v[0], hecho: v[1], cumplimientoPct: pct(v[1], v[0]) },
    ejerciciosSinCarga: 0,
    ...extra,
  }
}

const FILAS = [
  fila(1, [60, 30], [12000, 6000]),
  fila(2, [64, 0], [13000, 0], 'sin-registros'),
  fila(3, [80, 100], [13500, 15250], 'con-datos', { estado: 'activo' }),
]

describe('disposicionDeBarras', () => {
  it('las alturas salen del cero: el tope del eje llega a ALTO_TOPE y la mitad mide la mitad', () => {
    const d = disposicionDeBarras(FILAS, 'series')
    // El máximo es 100 y el eje redondea a 100: la barra más alta toca el tope.
    expect(d.tope).toBe(100)
    expect(d.barras[2].altoHecho).toBeCloseTo(ALTO_TOPE, 6)
    expect(d.barras[2].altoPauta).toBeCloseTo(ALTO_TOPE * 0.8, 6)
    expect(d.barras[0].altoHecho).toBeCloseTo(ALTO_TOPE * 0.3, 6)
    // Proporcional: el doble de valor, el doble de altura (no hay eje recortado).
    expect(d.barras[0].altoPauta / d.barras[0].altoHecho).toBeCloseTo(2, 6)
  })

  it('la marca 0 está en el suelo y las marcas suben hasta el tope', () => {
    const d = disposicionDeBarras(FILAS, 'series')
    expect(d.marcas[0]).toEqual({ valor: 0, y: 0 })
    expect(d.marcas.at(-1)?.y).toBeCloseTo(ALTO_TOPE, 6)
  })

  it('una semana sin registros no tiene barra (altura 0 y un motivo), no una barra en cero', () => {
    const d = disposicionDeBarras(FILAS, 'series')
    expect(d.barras[1].motivo).toBe('sin registros')
    expect(d.barras[1].altoHecho).toBe(0)
    expect(d.barras[1].altoPauta).toBe(0)
    expect(d.barras[1].pct).toBeUndefined()
  })

  it('la semana sin registros no cuenta para el tope del eje', () => {
    const solo = [fila(1, [10, 8], [100, 80]), fila(2, [900, 0], [9000, 0], 'sin-registros')]
    expect(disposicionDeBarras(solo, 'series').tope).toBeLessThan(20)
  })

  it('las semanas quedan centradas en el origen, a una unidad una de otra', () => {
    const d = disposicionDeBarras(FILAS, 'series')
    expect(d.barras.map((b) => b.x)).toEqual([-SEPARACION, 0, SEPARACION])
  })

  it('series y volumen son escalas distintas: cada magnitud usa su propio tope', () => {
    const s = disposicionDeBarras(FILAS, 'series')
    const v = disposicionDeBarras(FILAS, 'volumen')
    expect(s.tope).toBe(100)
    expect(v.tope).toBe(20000)
    // 15.250 sobre 20.000, no sobre 100.
    expect(v.barras[2].altoHecho).toBeCloseTo((15250 / 20000) * ALTO_TOPE, 6)
  })

  it('marca la semana en curso (la del anillo) y trae el cumplimiento sin tope', () => {
    const d = disposicionDeBarras(FILAS, 'series')
    expect(d.barras.map((b) => b.actual)).toEqual([false, false, true])
    expect(d.barras[2].pct).toBe(125)
  })

  it('sin kilos pautados, el volumen de esa semana no dibuja barra', () => {
    const sinKilos = [fila(1, [10, 10], [0, 0], 'con-datos'), fila(2, [10, 9], [100, 90])]
    const d = disposicionDeBarras(sinKilos, 'volumen')
    expect(d.barras[0].motivo).toBe('sin kilos pautados')
    expect(d.barras[1].motivo).toBeUndefined()
  })

  it('sin filas no revienta', () => {
    const d = disposicionDeBarras([], 'series')
    expect(d.barras).toEqual([])
    expect(d.marcas.length).toBeGreaterThan(0)
  })
})

describe('puntosDeLaCinta', () => {
  it('pasa por la tapa de «lo hecho» de cada semana con barras, de izquierda a derecha', () => {
    const d = disposicionDeBarras(FILAS, 'series')
    const p = puntosDeLaCinta(d.barras)
    expect(p).toHaveLength(2)
    expect(p[0]).toEqual({ x: -1, y: d.barras[0].altoHecho, z: 0 })
    expect(p[1]).toEqual({ x: 1, y: d.barras[2].altoHecho, z: 0 })
    expect(p[0].x).toBeLessThan(p[1].x)
  })

  it('salta las semanas sin registros en vez de hundirse a cero', () => {
    const p = puntosDeLaCinta(disposicionDeBarras(FILAS, 'series').barras)
    expect(p.every((q) => q.y > 0)).toBe(true)
  })
})

describe('semanaVecina', () => {
  const ids = ['a', 'b', 'c']
  it('va a la anterior y a la siguiente', () => {
    expect(semanaVecina(ids, 'b', -1)).toBe('a')
    expect(semanaVecina(ids, 'b', 1)).toBe('c')
  })
  it('en el extremo se queda donde está (no da la vuelta)', () => {
    expect(semanaVecina(ids, 'a', -1)).toBe('a')
    expect(semanaVecina(ids, 'c', 1)).toBe('c')
  })
  it('sin semana elegida empieza por un extremo, y sin semanas no hay nada', () => {
    expect(semanaVecina(ids, undefined, 1)).toBe('a')
    expect(semanaVecina(ids, undefined, -1)).toBe('c')
    expect(semanaVecina([], 'a', 1)).toBeUndefined()
  })
})

describe('caminoDelPlan', () => {
  it('24 semanas son cuatro filas de 6 y 32 son cuatro filas de 8', () => {
    for (const [n, filas] of [
      [24, 4],
      [32, 4],
    ] as const) {
      const { nodos } = caminoDelPlan(n)
      expect(nodos).toHaveLength(n)
      expect(new Set(nodos.map((p) => p.z)).size).toBe(filas)
    }
  })

  it('serpentea: la primera fila va de izquierda a derecha y la segunda de derecha a izquierda', () => {
    const { nodos } = caminoDelPlan(24)
    expect(nodos[0].x).toBeLessThan(nodos[5].x)
    expect(nodos[6].x).toBeGreaterThan(nodos[11].x)
    // Y el giro está donde debe: el nodo 6 queda justo detrás del 5, no al otro lado.
    expect(nodos[6].x).toBeCloseTo(nodos[5].x, 9)
    expect(nodos[12].x).toBeCloseTo(nodos[0].x, 9)
  })

  it('la primera fila está al frente (z mayor) y la pista se aleja', () => {
    const { nodos } = caminoDelPlan(24)
    expect(nodos[0].z).toBeGreaterThan(nodos[6].z)
    expect(nodos[6].z).toBeGreaterThan(nodos[12].z)
  })

  it('está centrado en el origen y ningún par de nodos cae en el mismo sitio', () => {
    const { nodos } = caminoDelPlan(32)
    const mediaX = nodos.reduce((s, n) => s + n.x, 0) / nodos.length
    const mediaZ = nodos.reduce((s, n) => s + n.z, 0) / nodos.length
    expect(mediaX).toBeCloseTo(0, 9)
    expect(mediaZ).toBeCloseTo(0, 9)
    expect(new Set(nodos.map((n) => `${n.x.toFixed(3)},${n.z.toFixed(3)}`)).size).toBe(32)
  })

  it('con pocas semanas hace una sola fila; con ninguna, nada', () => {
    expect(caminoDelPlan(5).nodos).toHaveLength(5)
    expect(new Set(caminoDelPlan(5).nodos.map((n) => n.z)).size).toBe(1)
    expect(caminoDelPlan(0).nodos).toEqual([])
    expect(caminoDelPlan(-3).nodos).toEqual([])
  })
})

describe('la cámara', () => {
  const base = poseGeneral({ xs: [-1, 0, 1], xElegida: 0, aspecto: 1 })

  it('el ajuste de la persona nunca pasa de ±70° de giro', () => {
    const p = poseConAjuste(base, { azimut: 500, polar: 0, zoom: 1 })
    expect(p.azimut).toBe(LIMITES_CAMARA.azimutMax)
    expect(poseConAjuste(base, { azimut: -500, polar: 0, zoom: 1 }).azimut).toBe(-LIMITES_CAMARA.azimutMax)
  })

  it('no se puede ver por debajo del suelo: el ángulo polar se queda por debajo de 90°', () => {
    const p = poseConAjuste(base, { azimut: 0, polar: 200, zoom: 1 })
    expect(p.polar).toBe(LIMITES_CAMARA.polarMax)
    expect(p.polar).toBeLessThan(90)
    expect(posicionDeCamara(p).y).toBeGreaterThan(p.objetivo.y)
    expect(poseConAjuste(base, { azimut: 0, polar: -200, zoom: 1 }).polar).toBe(LIMITES_CAMARA.polarMin)
  })

  it('el zoom del pellizco está acotado', () => {
    expect(poseConAjuste(base, { azimut: 0, polar: 0, zoom: 99 }).distancia).toBeCloseTo(base.distancia * LIMITES_CAMARA.zoomMax, 9)
    expect(poseConAjuste(base, { azimut: 0, polar: 0, zoom: 0.01 }).distancia).toBeCloseTo(base.distancia * LIMITES_CAMARA.zoomMin, 9)
  })

  it('acotarAjuste no deja acumular un giro que no se vería', () => {
    const a = acotarAjuste({ azimut: 400, polar: -400, zoom: 10 }, base)
    expect(base.azimut + a.azimut).toBe(LIMITES_CAMARA.azimutMax)
    expect(base.polar + a.polar).toBe(LIMITES_CAMARA.polarMin)
    expect(a.zoom).toBe(LIMITES_CAMARA.zoomMax)
    expect(acotarAjuste(SIN_AJUSTE, base)).toEqual(SIN_AJUSTE)
  })

  it('la posición de la cámara está a la distancia pedida del objetivo y de frente con azimut 0', () => {
    const pose = { azimut: 0, polar: 90, distancia: 10, objetivo: { x: 2, y: 1, z: 0 }, fov: FOV_3D }
    const c = posicionDeCamara(pose)
    expect(c.x).toBeCloseTo(2, 9)
    expect(c.y).toBeCloseTo(1, 9)
    expect(c.z).toBeCloseTo(10, 9)
    const girada = posicionDeCamara({ ...pose, azimut: 90 })
    expect(girada.x).toBeCloseTo(12, 9)
    expect(girada.z).toBeCloseTo(0, 9)
  })

  it('al tocar una semana la cámara se acerca a ella y mira a su altura', () => {
    const general = poseGeneral({ xs: [-5, -4, -3, 3, 4, 5], xElegida: 3, aspecto: 1 })
    const cerca = poseEnfocada({ x: 3, altoMax: 2 })
    expect(cerca.objetivo.x).toBe(3)
    expect(cerca.distancia).toBeLessThan(general.distancia)
    expect(cerca.objetivo.y).toBeGreaterThan(0)
  })

  it('la barra más alta cabe entera cuando se acerca', () => {
    const p = poseEnfocada({ x: 0, altoMax: ALTO_TOPE })
    const altoVisible = 2 * p.distancia * Math.tan((FOV_3D * Math.PI) / 360)
    expect(altoVisible).toBeGreaterThan(ALTO_TOPE + 1)
  })

  it('con muchas semanas la ventana sigue a la elegida sin salirse de los datos', () => {
    const xs = Array.from({ length: 24 }, (_, i) => i - 11.5)
    const visibles = semanasVisibles(1, 24)
    expect(visibles).toBeLessThan(24)
    expect(centroDeVentana(xs, xs[0], visibles)).toBeGreaterThan(xs[0])
    expect(centroDeVentana(xs, xs[23], visibles)).toBeLessThan(xs[23])
    expect(centroDeVentana(xs, 0.5, visibles)).toBe(0.5)
    // Si caben todas, se centra en el medio de los datos.
    expect(centroDeVentana(xs.slice(0, 4), 0, 7)).toBeCloseTo(-10, 9)
    expect(centroDeVentana([], 0, 5)).toBe(0)
  })

  it('en pantalla estrecha caben menos semanas que en ancha, y nunca más que las que hay', () => {
    expect(semanasVisibles(0.8, 30)).toBeLessThan(semanasVisibles(1.6, 30))
    expect(semanasVisibles(1.6, 3)).toBe(3)
    expect(semanasVisibles(0.8, 0)).toBe(1)
  })

  it('la vista plana es de frente, a ras, con el campo de visión casi cerrado y la altura entera a la vista', () => {
    const p = poseVistaPlana({ xs: [-1, 0, 1], xElegida: 0, aspecto: 1.4 })
    expect(p.azimut).toBe(0)
    expect(p.polar).toBe(90)
    expect(p.fov).toBe(FOV_PLANO)
    expect(p.fov).toBeLessThan(FOV_3D / 4)
    // El mismo mundo visible que la cámara ortográfica va a cubrir.
    const alto = 2 * p.distancia * Math.tan((p.fov * Math.PI) / 360)
    expect(alto).toBeCloseTo(alturaDeVistaPlana(3, 1.4), 6)
    expect(alto).toBeGreaterThan(ALTO_TOPE)
  })

  it('el camino se ve entero y el nodo tocado se acerca', () => {
    const { ancho, fondo, nodos } = caminoDelPlan(24)
    const todo = poseDelCamino({ ancho, fondo, aspecto: 1 })
    const nodo = poseEnNodo(nodos[10])
    expect(nodo.objetivo.x).toBe(nodos[10].x)
    expect(nodo.objetivo.z).toBe(nodos[10].z)
    expect(nodo.distancia).toBeLessThan(todo.distancia)
    expect(todo.polar).toBeLessThan(LIMITES_CAMARA.polarMax)
  })

  it('distanciaParaAltura es la inversa de la altura que ve la cámara', () => {
    const d = distanciaParaAltura(6, 34)
    expect(2 * d * Math.tan((34 * Math.PI) / 360)).toBeCloseTo(6, 9)
  })
})

describe('amortiguar y pasoDeMuelle', () => {
  it('el amortiguador se acerca a la meta sin pasarse y no depende de cuántos fotogramas haya', () => {
    const unPaso = amortiguar(0, 10, 5, 0.2)
    let enDos = 0
    enDos = amortiguar(enDos, 10, 5, 0.1)
    enDos = amortiguar(enDos, 10, 5, 0.1)
    expect(unPaso).toBeGreaterThan(0)
    expect(unPaso).toBeLessThan(10)
    expect(enDos).toBeCloseTo(unPaso, 9)
    expect(amortiguar(3, 10, 5, 0)).toBe(3)
  })

  it('el muelle crece desde cero, se pasa un poco (rebote) y se asienta en la meta', () => {
    let e = { x: 0, v: 0 }
    let maximo = 0
    for (let i = 0; i < 300; i++) {
      e = pasoDeMuelle(e, 1, 1 / 60)
      maximo = Math.max(maximo, e.x)
    }
    expect(maximo).toBeGreaterThan(1.01)
    expect(maximo).toBeLessThan(1.3)
    expect(e.x).toBeCloseTo(1, 3)
    expect(Math.abs(e.v)).toBeLessThan(0.01)
  })

  it('un tirón largo de fotograma no dispara el muelle', () => {
    const e = pasoDeMuelle({ x: 0, v: 0 }, 1, 5)
    expect(Number.isFinite(e.x)).toBe(true)
    expect(e.x).toBeLessThan(1.5)
  })
})

describe('elegirRespaldo', () => {
  const ok = { webgl: true, movimientoReducido: false, fallo: false }
  it('con WebGL, sin pedir menos movimiento y sin fallos previos, va la escena 3D', () => {
    expect(elegirRespaldo(ok)).toBe('3d')
  })
  it('sin WebGL va el SVG', () => {
    expect(elegirRespaldo({ ...ok, webgl: false })).toBe('svg')
  })
  it('con movimiento reducido va el SVG aunque haya WebGL', () => {
    expect(elegirRespaldo({ ...ok, movimientoReducido: true })).toBe('svg')
  })
  it('si WebGL ya falló en la sesión, va el SVG', () => {
    expect(elegirRespaldo({ ...ok, fallo: true })).toBe('svg')
  })
})
