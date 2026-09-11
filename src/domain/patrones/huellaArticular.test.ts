import { describe, expect, it } from 'vitest'
import { esPistaDePose, huellaDePista, ventanaDeUltimaRepeticion } from './huellaArticular'
import { pistaSintetica } from './pistaSintetica'

/**
 * LA HUELLA ARTICULAR, CONTRA UNA VERDAD SINTÉTICA.
 *
 * La pista se fabrica desde ángulos conocidos (`pistaSintetica.ts`), así que lo que se
 * comprueba no es «sale un número» sino «sale EL número»: rodilla a 120° en el fondo,
 * codo a 30° todo el rato, la ventana es la última repetición y no la primera.
 * Tolerancias de 2–3°: el redondeo a centésimas de píxel y el remuestreo.
 */

const cerca = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol

describe('huellaDePista', () => {
  it('coge la ÚLTIMA repetición: dura un periodo, de pico a pico', () => {
    const h = huellaDePista(pistaSintetica({ repeticiones: 3, periodoSeg: 2 }))!
    expect(h).toBeDefined()
    expect(cerca(h.duracionSeg, 2, 0.1)).toBe(true)
    expect(h.fase).toHaveLength(24)
    // Empieza arriba, pasa por abajo y termina arriba.
    expect(h.fase[0]).toBeGreaterThan(0.9)
    expect(Math.min(...h.fase)).toBeLessThan(0.05)
    expect(h.fase[23]).toBeGreaterThan(0.9)
  })

  it('lee los ángulos que se pusieron: rodilla 0→120, cadera 0→90, tronco 0→30', () => {
    const h = huellaDePista(pistaSintetica({ rodillaMax: 120 }))!
    const a = h.articular!
    expect(cerca(Math.max(...a.rodillaFlex), 120, 3)).toBe(true)
    expect(cerca(Math.min(...a.rodillaFlex), 0, 3)).toBe(true)
    expect(cerca(Math.max(...a.caderaFlex), 90, 3)).toBe(true)
    // El tronco se reparte 40/60 entre lumbar y tórax: la suma es la inclinación.
    const tronco = a.lumbarFlex.map((v, i) => v + a.toraxFlex[i])
    expect(cerca(Math.max(...tronco), 30, 3)).toBe(true)
    expect(cerca(a.lumbarFlex[12] / a.toraxFlex[12], 0.4 / 0.6, 0.01)).toBe(true)
  })

  it('un canal que no se mueve sale plano: hombro 20 y codo 30 en todas las muestras', () => {
    const h = huellaDePista(pistaSintetica({ hombro: 20, codo: 30 }))!
    for (const v of h.articular!.hombroFlex) expect(cerca(v, 20, 2)).toBe(true)
    for (const v of h.articular!.codoFlex) expect(cerca(v, 30, 2)).toBe(true)
  })

  it('aguanta fotogramas sin persona: interpola por encima del hueco', () => {
    const h = huellaDePista(pistaSintetica({ sinPersonaCada: 4 }))!
    expect(h).toBeDefined()
    expect(h.articular!.rodillaFlex.every((v) => Number.isFinite(v))).toBe(true)
    expect(cerca(Math.max(...h.articular!.rodillaFlex), 120, 4)).toBe(true)
  })

  it('con una sola repetición se toma la pista entera', () => {
    const h = huellaDePista(pistaSintetica({ repeticiones: 1, periodoSeg: 2 }))!
    expect(h).toBeDefined()
    expect(cerca(h.duracionSeg, 2, 0.1)).toBe(true)
  })

  it('sin nadie en el cuadro no hay huella, y no una huella vacía', () => {
    const vacia = pistaSintetica({ repeticiones: 1 })
    vacia.fotogramas = vacia.fotogramas.map((f) => ({ ...f, puntos: null }))
    expect(huellaDePista(vacia)).toBeUndefined()
    expect(huellaDePista({ ancho: 1, alto: 1, fotogramas: [] })).toBeUndefined()
  })

  it('con las piernas tapadas no hay pose que enseñar', () => {
    const p = pistaSintetica()
    for (const f of p.fotogramas) {
      if (!f.puntos) continue
      for (const l of ['d', 'i']) {
        f.puntos[`rodilla_${l}`] = [f.puntos[`rodilla_${l}`][0], f.puntos[`rodilla_${l}`][1], 0.1]
      }
    }
    expect(huellaDePista(p)).toBeUndefined()
  })
})

describe('ventanaDeUltimaRepeticion', () => {
  it('de pico a pico, con histéresis: el ruido pequeño no fabrica repeticiones', () => {
    const t: number[] = []
    const s: number[] = []
    for (let k = 0; k <= 120; k++) {
      const tt = k / 30
      t.push(tt)
      // Dos repeticiones de 2 s y un temblor del 5 % que no debe contar.
      s.push(Math.cos(Math.PI * tt) + 0.05 * Math.sin(40 * tt))
    }
    const [a, b] = ventanaDeUltimaRepeticion(t, s)!
    expect(Math.abs(a - 2)).toBeLessThan(0.15)
    expect(Math.abs(b - 4)).toBeLessThan(0.15)
  })

  it('sin recorrido no hay ventana', () => {
    expect(ventanaDeUltimaRepeticion([0, 1, 2], [3, 3, 3])).toBeUndefined()
    expect(ventanaDeUltimaRepeticion([0], [1])).toBeUndefined()
  })
})

describe('esPistaDePose', () => {
  it('reconoce la salida de articulaciones.py y rechaza lo demás', () => {
    expect(esPistaDePose(pistaSintetica())).toBe(true)
    expect(esPistaDePose({ ejeObjetivo: 'rodilla', porFotograma: [] })).toBe(false)
    expect(esPistaDePose({ ancho: 1, alto: 1, fotogramas: [{ t: 'x', puntos: null }] })).toBe(false)
    expect(esPistaDePose(null)).toBe(false)
  })
})
