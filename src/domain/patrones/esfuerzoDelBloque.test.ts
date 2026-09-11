import { describe, expect, it } from 'vitest'

import { PATRON_POR_ID } from './catalogo'
import { esfuerzoDeTexto, patronConEsfuerzo } from './esfuerzoDelBloque'

/**
 * QUE SE VEA CUÁNDO CORRE LENTO Y CUÁNDO FUERTE.
 *
 * Nace en rojo el 2026-09-10: hasta ese día un trote de zona 2 y un intervalo a RPE 8 se
 * animaban EXACTAMENTE IGUAL. Aquí se comprueban las dos mitades: que el esfuerzo se lea de
 * lo escrito —y solo de lo escrito—, y que mueva lo que las medidas dicen que se mueve.
 */

const CARRERA = PATRON_POR_ID['carrera_en_cinta']
const BICI = PATRON_POR_ID['bicicleta_estatica']

describe('esfuerzoDeTexto', () => {
  it('lee el RPE, y de un rango se queda con el techo', () => {
    expect(esfuerzoDeTexto('El minuto fuerte a RPE 8')).toBeCloseTo(4 / 6, 3)
    expect(esfuerzoDeTexto('rpe 7-8 durante el bloque')).toBeCloseTo(4 / 6, 3)
    expect(esfuerzoDeTexto('RPE 5-6, antes o después según energía')).toBeCloseTo(2 / 6, 3)
  })

  it('lee la zona, y la 2 es de las suaves', () => {
    const zona2 = esfuerzoDeTexto('Zona 2: debes poder hablar')!
    expect(zona2).toBeCloseTo(0.25, 3)
    expect(zona2).toBeLessThan(esfuerzoDeTexto('Z4 sostenido')!)
  })

  it('el número manda sobre la palabra', () => {
    // «Zona 2, y el último minuto fuerte» sigue siendo una zona 2: lo que define el bloque
    // es lo que el coach cuantificó, no un adjetivo suelto.
    expect(esfuerzoDeTexto('CARDIO ZONA 2 · el último minuto más fuerte')).toBeCloseTo(0.25, 3)
  })

  it('sin número, la palabra; y de dos palabras gana la MÁS FUERTE', () => {
    expect(esfuerzoDeTexto('Ritmo conversacional, zancada corta')).toBe(0.3)
    // «1 min fuerte / 1 min suave» son las dos mitades del intervalo, y el bloque es de
    // intervalos: si ganara «suave», un HIIT se vería como un paseo.
    expect(esfuerzoDeTexto('10 × 1 min fuerte / 1 min suave')).toBe(0.8)
  })

  it('y si no dice nada, NO se inventa', () => {
    expect(esfuerzoDeTexto('30 min de bici')).toBeUndefined()
    expect(esfuerzoDeTexto('')).toBeUndefined()
  })
})

describe('patronConEsfuerzo', () => {
  it('sin esfuerzo escrito devuelve la MISMA ficha, no una copia', () => {
    // No es cosmético: el visor monta su escena WebGL con la ficha por dependencia, así que
    // una copia nueva en cada render recrearía el contexto entero.
    expect(patronConEsfuerzo(CARRERA, undefined)).toBe(CARRERA)
    expect(patronConEsfuerzo(CARRERA, 0.5)).toBe(CARRERA)
  })

  it('fuerte acorta el ciclo y suave lo alarga', () => {
    expect(patronConEsfuerzo(CARRERA, 1).ciclo!.periodoSeg).toBeLessThan(CARRERA.ciclo!.periodoSeg)
    expect(patronConEsfuerzo(CARRERA, 0).ciclo!.periodoSeg).toBeGreaterThan(CARRERA.ciclo!.periodoSeg)
  })

  it('corriendo fuerte la rodilla que recoge sube más y la cadera de atrás extiende más', () => {
    const fuerte = patronConEsfuerzo(CARRERA, 1)
    // `rodillaFlexI` en el inicio es la pierna que recoge: 92° tal como está escrita.
    expect(fuerte.inicio.rodillaFlexI!).toBeGreaterThan(CARRERA.inicio.rodillaFlexI!)
    // `caderaFlexI` negativa es la pierna de atrás: más negativa = más extendida.
    expect(fuerte.inicio.caderaFlexI!).toBeLessThan(CARRERA.inicio.caderaFlexI!)
  })

  it('la pierna que APOYA no se toca: estirarla la rompería hacia atrás', () => {
    const fuerte = patronConEsfuerzo(CARRERA, 1)
    // `rodillaFlexD` en el inicio es la que llega al suelo, a 32°.
    expect(fuerte.inicio.rodillaFlexD).toBe(CARRERA.inicio.rodillaFlexD)
  })

  it('en una máquina se mueve la cadencia y NADA más', () => {
    // Pedalear fuerte es pedalear más rápido, no describir un círculo más grande: el pedal
    // no se sale de su eje. Estirar la amplitud aquí sería dibujar una máquina que no existe.
    const fuerte = patronConEsfuerzo(BICI, 1)
    expect(fuerte.ciclo!.periodoSeg).toBeLessThan(BICI.ciclo!.periodoSeg)
    expect(fuerte.inicio).toEqual(BICI.inicio)
    expect(fuerte.fin).toEqual(BICI.fin)
  })

  it('una ficha que no es cíclica se queda igual', () => {
    const sentadilla = PATRON_POR_ID['sentadilla']
    expect(patronConEsfuerzo(sentadilla, 1)).toBe(sentadilla)
  })
})
