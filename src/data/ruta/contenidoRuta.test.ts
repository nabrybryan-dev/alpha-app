import { describe, expect, it } from 'vitest'
import type { NivelMetodo } from '../../domain/rutaEntrenamiento'
import { ESCALA_ALFA, rutaPorDefecto } from './contenidoRuta'

const ORDEN_METODO: Record<NivelMetodo, number> = {
  principiante: 0,
  intermedio: 1,
  avanzado: 2,
}

describe('Escala Alfa', () => {
  it('numera los peldaños en orden y sin huecos', () => {
    expect(ESCALA_ALFA.map((n) => n.numero)).toEqual(
      ESCALA_ALFA.map((_, i) => String(i + 1).padStart(2, '0')),
    )
  })

  it('nunca retrocede de nivel del método', () => {
    // Los peldaños son presentación; el nivel del método es lo que manda al
    // programar. Una escalera que baje de avanzado a intermedio sería mentira.
    const orden = ESCALA_ALFA.map((n) => ORDEN_METODO[n.nivelMetodo])
    expect(orden).toEqual([...orden].sort((a, b) => a - b))
  })

  it('cubre los tres niveles del método', () => {
    expect(new Set(ESCALA_ALFA.map((n) => n.nivelMetodo))).toEqual(
      new Set(['principiante', 'intermedio', 'avanzado']),
    )
  })

  it('solo hay un nivel actual y la cima es el último', () => {
    expect(ESCALA_ALFA.filter((n) => n.estado === 'actual')).toHaveLength(1)
    const elites = ESCALA_ALFA.filter((n) => n.estado === 'elite')
    expect(elites).toHaveLength(1)
    expect(elites[0]).toBe(ESCALA_ALFA[ESCALA_ALFA.length - 1])
  })

  it('lo superado queda por debajo del nivel actual', () => {
    const actual = ESCALA_ALFA.findIndex((n) => n.estado === 'actual')
    ESCALA_ALFA.forEach((nivel, i) => {
      if (i < actual) expect(nivel.estado).toBe('superado')
      if (i > actual) expect(nivel.estado).not.toBe('superado')
    })
  })

  it('cada peldaño explica qué lo distingue', () => {
    for (const nivel of ESCALA_ALFA) {
      expect(nivel.nombre.length).toBeGreaterThan(0)
      expect(nivel.descripcion.length).toBeGreaterThan(40)
    }
  })
})

describe('rutaPorDefecto', () => {
  it('apunta al nivel actual y al siguiente de la escala', () => {
    const ruta = rutaPorDefecto('u1')
    expect(ruta.nivelActual.estado).toBe('actual')
    const actual = ESCALA_ALFA.indexOf(ruta.nivelActual)
    expect(ruta.siguienteNivel).toBe(ESCALA_ALFA[actual + 1])
  })

  it('no trae competencias del coach hasta que las cargue', () => {
    expect(rutaPorDefecto('u1').competenciasCoach).toEqual([])
  })
})
