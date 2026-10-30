import { describe, expect, it } from 'vitest'
import {
  ALTO_FILA,
  diaEnLectura,
  diasTocables,
  encajar,
  FILAS_A_CADA_LADO,
  inercia,
  inclinacionDeFila,
  limitar,
  UMBRAL_DE_ARRASTRE,
  VELOCIDAD_MINIMA,
} from './fisicaDelTambor'

/**
 * LA FÍSICA DEL TAMBOR, PROBADA.
 *
 * El tambor de la semana (maqueta 7) es una columna de siete filas que se arrastra. Lo que se
 * vigila: que no se quede entre dos días, que no salga de la semana (la semana no es un
 * círculo: después del sábado no hay otro domingo) y, sobre todo, que desde cualquier día se
 * llegue a los siete. El tambor cilíndrico que lo precedió enseñaba tres días y dejaba dos
 * debajo de la ranura sin poder tocarse.
 */

const N = 7

describe('limitar y encajar', () => {
  it('no sale de la semana, ni por arriba ni por abajo', () => {
    expect(limitar(-3, N)).toBe(0)
    expect(limitar(9.4, N)).toBe(N - 1)
    expect(limitar(2.5, N)).toBe(2.5)
  })
  it('encaja siempre en un día entero dentro de la semana', () => {
    for (const c of [0.2, 1.49, 3.5, 5.51, 6, -2, 40]) {
      const e = encajar(c, N)
      expect(Number.isInteger(e)).toBe(true)
      expect(e).toBeGreaterThanOrEqual(0)
      expect(e).toBeLessThanOrEqual(N - 1)
    }
  })
  it('el día en lectura es el entero más cercano y nunca un índice fuera de la semana', () => {
    expect(diaEnLectura(2.4, N)).toBe(2)
    expect(diaEnLectura(2.6, N)).toBe(3)
    expect(diaEnLectura(-5, N)).toBe(0)
    expect(diaEnLectura(99, N)).toBe(6)
  })
})

describe('inercia', () => {
  it('con velocidad por debajo del mínimo se para', () => {
    expect(inercia(3, VELOCIDAD_MINIMA / 2, N)).toBeNull()
  })
  it('frena en cada paso y acaba', () => {
    let c = 1
    let v = 0.8
    let pasos = 0
    for (;;) {
      const p = inercia(c, v, N)
      if (!p) break
      expect(Math.abs(p.velocidad)).toBeLessThan(Math.abs(v))
      c = p.centro
      v = p.velocidad
      expect(c).toBeLessThanOrEqual(N - 1)
      if (++pasos > 500) throw new Error('la inercia no termina')
    }
  })
  it('contra el tope de la semana la inercia se anula', () => {
    expect(inercia(N - 1, 0.9, N)).toBeNull()
    expect(inercia(0, -0.9, N)).toBeNull()
  })
})

describe('diasTocables: los siete se alcanzan', () => {
  it('con un día centrado se ven y se tocan los de al lado, a cada lado', () => {
    expect(diasTocables(3, N)).toEqual([1, 2, 3, 4, 5])
    expect(diasTocables(0, N)).toEqual([0, 1, 2])
    expect(diasTocables(6, N)).toEqual([4, 5, 6])
  })

  it('desde CUALQUIER día, tocando el tocable más lejano hacia un lado y hacia el otro se llega a los siete', () => {
    // Tocar un día lo centra. Repitiéndolo no puede quedar ningún día fuera de alcance
    // (el fallo del tambor cilíndrico).
    for (let inicio = 0; inicio < N; inicio++) {
      const vistos = new Set<number>()
      for (const extremo of ['ultimo', 'primero'] as const) {
        let c = inicio
        for (let k = 0; k < 10; k++) {
          const t = diasTocables(c, N)
          t.forEach((d) => vistos.add(d))
          c = extremo === 'ultimo' ? t[t.length - 1] : t[0]
        }
      }
      expect([...vistos].sort(), `desde el día ${inicio}`).toEqual([0, 1, 2, 3, 4, 5, 6])
    }
  })

  it('el escorzo de la última fila tocable sigue dentro del límite de la maqueta y cada fila es tocable (44 px)', () => {
    expect(Math.abs(inclinacionDeFila(FILAS_A_CADA_LADO))).toBeLessThanOrEqual(70)
    expect(ALTO_FILA).toBeGreaterThanOrEqual(44)
  })
})

describe('arrastre contra toque', () => {
  it('el umbral es corto: un dedo temblón no cuenta como arrastre, un recorrido de verdad sí', () => {
    expect(UMBRAL_DE_ARRASTRE).toBeGreaterThanOrEqual(4)
    expect(UMBRAL_DE_ARRASTRE).toBeLessThanOrEqual(10)
  })
})
