import { describe, expect, it } from 'vitest'
import type { NivelMetodo } from '../../domain/rutaEntrenamiento'
import { PELDANO_MAXIMO } from '../../domain/nivelesAlfa'
import { ESCALA_ALFA, escalaPara, nivelDe, siguienteNivelDe } from './contenidoRuta'

const ORDEN_METODO: Record<NivelMetodo, number> = {
  principiante: 0,
  intermedio: 1,
  avanzado: 2,
}

describe('Escala Alfa', () => {
  it('tiene tantos peldaños como sabe recorrer el motor de niveles', () => {
    expect(ESCALA_ALFA).toHaveLength(PELDANO_MAXIMO)
  })

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

  it('cada peldaño explica qué lo distingue', () => {
    for (const nivel of ESCALA_ALFA) {
      expect(nivel.nombre.length).toBeGreaterThan(0)
      expect(nivel.descripcion.length).toBeGreaterThan(40)
    }
  })

  /**
   * La velocidad de barra solo existe con encoder, asi que no puede definir un
   * peldaño: si lo hiciera, la escalera se acabaria en el 04 para casi todos.
   */
  it('ningún peldaño se llama por un equipo que casi nadie tiene', () => {
    expect(ESCALA_ALFA.map((n) => n.nombre)).not.toContain('PRECISIÓN')
  })
})

describe('escalaPara', () => {
  it('marca superado lo de abajo, actual el suyo y bloqueado lo de arriba', () => {
    const escala = escalaPara(3)
    expect(escala[0].estado).toBe('superado')
    expect(escala[1].estado).toBe('superado')
    expect(escala[2].estado).toBe('actual')
    expect(escala[3].estado).toBe('bloqueado')
  })

  it('la cima se pinta como élite mientras no se llegue a ella', () => {
    expect(escalaPara(3).at(-1)?.estado).toBe('elite')
  })

  it('quien está en la cima la ve como suya, no como bloqueada', () => {
    expect(escalaPara(PELDANO_MAXIMO).at(-1)?.estado).toBe('actual')
  })

  /** Nadie arranca en el 03: ese era el bug, no el diseño. */
  it('quien empieza ve el primer peldaño como suyo', () => {
    const escala = escalaPara(1)
    expect(escala[0].estado).toBe('actual')
    expect(escala.filter((n) => n.estado === 'superado')).toHaveLength(0)
  })

  it('solo hay un peldaño actual, sea cual sea el nivel', () => {
    for (let peldano = 1; peldano <= PELDANO_MAXIMO; peldano += 1) {
      expect(escalaPara(peldano).filter((n) => n.estado === 'actual')).toHaveLength(1)
    }
  })
})

describe('nivelDe y siguienteNivelDe', () => {
  it('devuelven el peldaño y el que viene después', () => {
    expect(nivelDe(3).nombre).toBe('RENDIMIENTO')
    expect(siguienteNivelDe(3)?.nombre).toBe('AVANZADO')
  })

  it('en la cima no hay siguiente', () => {
    expect(siguienteNivelDe(PELDANO_MAXIMO)).toBeUndefined()
  })

  it('un número fuera de rango no rompe nada', () => {
    expect(nivelDe(0)).toBe(ESCALA_ALFA[0])
    expect(nivelDe(99)).toBe(ESCALA_ALFA[ESCALA_ALFA.length - 1])
  })
})
