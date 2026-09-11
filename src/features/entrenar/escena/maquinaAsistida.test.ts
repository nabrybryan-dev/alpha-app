import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { PATRON_POR_ID, patronDeCategoria } from '../../../domain/patrones/catalogo'
import { esqueletoEnFase } from '../../../domain/patrones/escena'
import { puntoDeHueso } from '../../../domain/patrones/esqueleto'
import { modeloDePalanca } from '../../../domain/biomecanica/palancas'
import { implementosDeEscena } from './implementos'
import { construirPieza } from './dibujarImplementos'
import { barraDe, RODILLERA, rodilleraBajo, techoSobre } from './maquinaAsistida'

/**
 * LA DOMINADA ASISTIDA, 2026-09-06. Bryan: «las dominadas asistidas, puedes buscar un vídeo
 * de referencia». Hasta ese día salía como una dominada a secas —barra fija con montantes— y
 * con el sujeto SENTADO en el aire, porque «Dominadas asistidas» cae en TRACCIÓN VERTICAL y
 * esa ficha es un jalón sentado.
 *
 * Lo que se clava aquí: que el nombre la separe del jalón sin quitarle el mando a la
 * categoría; que el sujeto cuelgue de la barra y se arrodille; y que la máquina tenga
 * rodillera bajo las espinillas EN TODAS LAS FASES, porque sube con él.
 */
const patron = PATRON_POR_ID.dominada_asistida
const alturaDeLaBarra = patron.alturaApoyo ?? 0

/** Alturas mínima y máxima de los vértices ESCRITOS, no de la capacidad reservada. */
function alturas(m: Malla): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < m.vertices; i++) {
    const y = m.posicion[i * 3 + 1]
    min = Math.min(min, y)
    max = Math.max(max, y)
  }
  return { min, max }
}

describe('la dominada asistida es su propia ficha', () => {
  it('el nombre la separa del jalón DENTRO de la misma categoría', () => {
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Dominadas asistidas')?.id).toBe('dominada_asistida')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Dominada asistida en máquina (neutro)')?.id).toBe('dominada_asistida')
    expect(patronDeCategoria('DOMINADA', 'Pull-up asistido')?.id).toBe('dominada_asistida')
    // La categoría sigue mandando: un jalón es un jalón; y la dominada a secas tiene desde esa
    // misma noche su propia ficha colgando (`dominada.test.ts`).
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Jalón al pecho en polea')?.id).toBe('traccion_vertical')
    expect(patronDeCategoria('TRACCIÓN VERTICAL', 'Dominadas')?.id).toBe('dominada')
    // Y por su propia categoría, como toda ficha del catálogo.
    expect(patronDeCategoria('DOMINADA ASISTIDA')?.id).toBe('dominada_asistida')
  })

  it('su mecánica es la de la dominada: manos fijas al mundo, el cuerpo gira', () => {
    const modelo = modeloDePalanca('DOMINADA ASISTIDA')
    expect(modelo?.cadena).toBe('cerrada')
    expect(modelo?.linea.origen).toBe('centro-de-masas')
  })

  it('cuelga de las manos a la altura de la barra y se arrodilla, en las tres fases', () => {
    for (const fase of [0, 0.5, 1]) {
      const esq = esqueletoEnFase(patron, fase)
      // El solver cuelga al sujeto por el punto MÁS ALTO de cada mano —los dedos, que apuntan
      // arriba—, así que es ese el que tiene que estar en la barra; la palma queda unos
      // centímetros por debajo, como en la vida.
      for (const h of ['manoD', 'manoI']) {
        const yDedos = Math.max(...[0, 0.5, 1].map((t) => puntoDeHueso(esq, h, t)[1]))
        expect(Math.abs(yDedos - alturaDeLaBarra), `fase ${fase}: ${h}`).toBeLessThan(0.02)
      }
      // Arrodillado: el tobillo queda DETRÁS de la rodilla, no debajo.
      const rodilla = puntoDeHueso(esq, 'tibiaD', 0)
      const tobillo = puntoDeHueso(esq, 'tibiaD', 1)
      expect(rodilla[2] - tobillo[2], `fase ${fase}: la espinilla no va hacia atrás`).toBeGreaterThan(0.25)
      expect(Math.abs(rodilla[1] - tobillo[1]), `fase ${fase}: la espinilla no está horizontal`).toBeLessThan(0.12)
    }
  })

  it('el cuerpo sube: la pelvis en el bloqueo está más alta que colgado', () => {
    const abajo = puntoDeHueso(esqueletoEnFase(patron, 0), 'pelvis', 0)[1]
    const arriba = puntoDeHueso(esqueletoEnFase(patron, 1), 'pelvis', 0)[1]
    expect(arriba - abajo).toBeGreaterThan(0.25)
  })
})

describe('la máquina de asistencia', () => {
  it('la escena devuelve la máquina —no una barra suelta— y sin banco, se llegue por donde se llegue', () => {
    for (const [categoria, nombre] of [
      ['TRACCIÓN VERTICAL', 'Dominadas asistidas en máquina'],
      ['DOMINADA ASISTIDA', ''],
    ]) {
      const e = implementosDeEscena(categoria, nombre)
      expect(e.piezas.map((p) => `${p.pieza}/${p.forma ?? ''}`), `${categoria} · ${nombre}`).toEqual(['maquina/asistida'])
      expect(e.supuesto).toBe(false)
    }
    // La dominada sin asistir sigue con su barra fija.
    expect(implementosDeEscena('TRACCIÓN VERTICAL', 'Dominadas').piezas[0].pieza).toBe('barra-fija')
  })

  it('la rodillera va justo bajo las espinillas y sube con el sujeto', () => {
    const abajo = esqueletoEnFase(patron, 0)
    const arriba = esqueletoEnFase(patron, 1)
    const rAbajo = rodilleraBajo(abajo)
    const rArriba = rodilleraBajo(arriba)
    expect(rArriba[1] - rAbajo[1], 'la rodillera no sube con el cuerpo').toBeGreaterThan(0.2)
    for (const [esq, r] of [
      [abajo, rAbajo],
      [arriba, rArriba],
    ] as const) {
      const yEspinilla = Math.min(
        ...['tibiaD', 'tibiaI'].flatMap((h) => [0, 0.5, 1].map((t) => puntoDeHueso(esq, h, t)[1])),
      )
      const tapa = r[1] + RODILLERA[1]
      expect(tapa, 'la rodillera atraviesa la pierna').toBeLessThan(yEspinilla)
      expect(yEspinilla - tapa, 'la rodillera no toca la pierna').toBeLessThan(0.09)
    }
  })

  it('el bastidor llega al suelo, la barra está en las manos y el techo justo encima', () => {
    const esq = esqueletoEnFase(patron, 0)
    const e = implementosDeEscena('DOMINADA ASISTIDA')
    const m = new Malla(8192)
    construirPieza(m, e.piezas[0], esq)
    expect(m.vertices).toBeGreaterThan(100)
    const { min, max } = alturas(m)
    expect(min, 'no llega al suelo').toBeLessThan(0.02)
    expect(max, 'el techo no está sobre la barra').toBeGreaterThan(alturaDeLaBarra)
    expect(max, 'el techo se va demasiado arriba').toBeLessThan(alturaDeLaBarra + 0.2)
  })

  it('la barra cruza al sujeto aunque llegue una sola mano, o dos en el mismo punto', () => {
    const [a, b] = barraDe([[0.1, 2, 0]])
    expect(b[0] - a[0]).toBeGreaterThan(0.9)
    const [c, d] = barraDe([
      [0, 2, 0],
      [0, 2, 0],
    ])
    expect(Number.isFinite(c[0]) && Number.isFinite(d[0])).toBe(true)
    // Con dos manos, vuela más allá de cada una y el techo queda justo encima.
    const barra = barraDe([
      [-0.3, 2.15, 0],
      [0.3, 2.15, 0],
    ])
    expect(barra[0][0]).toBeLessThan(-0.5)
    expect(barra[1][0]).toBeGreaterThan(0.5)
    expect(techoSobre(barra)).toBeCloseTo(2.23, 2)
  })
})
