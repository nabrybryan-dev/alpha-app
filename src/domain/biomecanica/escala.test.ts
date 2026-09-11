import { describe, expect, it } from 'vitest'
import {
  fiabilidadDeEscala,
  MEDIDO_EN_EL_CORPUS,
  UMBRAL_DISPERSION_FIABLE,
  type Postura,
} from './escala'

const POSTURAS = Object.keys(MEDIDO_EN_EL_CORPUS) as Postura[]

describe('lo que la postura le hace a la escala', () => {
  /**
   * El caso que justifica todo esto. No es «sale peor»: es que el ancla no
   * existe, porque los segmentos apuntan a la cámara y no hay longitud que
   * medir. Un 541 % no es una medida mala, es ninguna medida.
   */
  it('tumbado en un banco no se puede medir con ninguna cámara', () => {
    const v = fiabilidadDeEscala('tumbado')
    expect(v.nivel).toBe('imposible')
    expect(v.porQue).toContain('541 %')
    // Y dice qué SÍ se puede hacer: una negativa a secas manda a la gente a
    // repetir la misma toma con más cuidado, que es exactamente lo que no vale.
    expect(v.porQue).toContain('de pie, de lado')
  })

  it('la única postura que se sostuvo es de pie, de lado y entero', () => {
    const fiables = POSTURAS.filter((p) => fiabilidadDeEscala(p).nivel === 'fiable')
    expect(fiables).toEqual(['de-pie-de-lado'])
  })

  it('una máquina a media altura mide, pero solo para compararse consigo mismo', () => {
    const v = fiabilidadDeEscala('apoyado-a-media-altura')
    expect(v.nivel).toBe('orientativa')
    expect(v.porQue).toContain('45 %')
  })

  /**
   * El umbral no se decide aquí: es el `0,15` que aplica `escalaPorEstatura` en
   * `coherencia.mjs`, de donde lo hereda `brazo-por-fotograma.mjs` — o sea, la
   * medida de verdad. Aquí solo está copiado para poder juzgar la tabla contra
   * él, y por eso se fija el NÚMERO y no la relación.
   *
   * Comparar el veredicto con `dispersion <= UMBRAL` no habría guardado nada:
   * las dos mitades salen de la misma constante, así que subir el umbral para
   * que «entren más vídeos» dejaba el test en verde. Lo comprobé subiéndolo a
   * 0,5: esa versión pasaba, y las que se ponían rojas eran las otras dos.
   */
  it('el umbral es el 0,15 de la herramienta, no una opinión de este módulo', () => {
    expect(UMBRAL_DISPERSION_FIABLE).toBe(0.15)
  })

  it('cada fila dice de qué vídeos salió, para poder discutirla', () => {
    for (const postura of POSTURAS) {
      expect(MEDIDO_EN_EL_CORPUS[postura].ejemplo.length, postura).toBeGreaterThan(0)
    }
  })
})
