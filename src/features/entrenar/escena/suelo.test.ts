import { describe, expect, it } from 'vitest'
import { Malla } from '../../../domain/patrones/malla'
import { construirSuelo, METROS_POR_REPETICION, TEXTURA_DEL_SUELO } from './suelo'

/**
 * EL SUELO DE LA SALA, probado sin WebGL.
 *
 * Hasta el 2026-09-05 la sala no tenía suelo: pared, marcadores, estación y mobiliario,
 * y bajo los pies el color de fondo. Esto es un disco a ras de suelo con coordenadas de
 * textura EN METROS, y es la primera malla del salón que lleva una imagen encima.
 *
 * La prueba que más vale es la del enrollado. Con `CULL_FACE` la tarjeta tira en
 * silencio cualquier cara que mire hacia abajo, y un suelo del revés se construye bien,
 * se sube bien y no aparece: cero píxeles, ningún error. Aquí se recalcula la normal de
 * cada triángulo a partir de sus tres vértices y se exige que mire hacia ARRIBA.
 */

function normalDelTriangulo(m: Malla, k: number): [number, number, number] {
  const p = m.posicion
  const [a, b, c] = [m.indice[k], m.indice[k + 1], m.indice[k + 2]]
  const u = [p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]]
  const v = [p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]]
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
}

describe('construirSuelo', () => {
  it('es un disco a ras de suelo, del radio de la sala, con su textura', () => {
    const m = new Malla(256)
    construirSuelo(m, 7, 48)
    expect(m.vertices).toBe(1 + 48 + 1)
    expect(m.textura).toBe(TEXTURA_DEL_SUELO)
    for (let i = 1; i < m.posicion.length; i += 3) expect(m.posicion[i]).toBe(0)
    let radioMaximo = 0
    for (let i = 0; i < m.posicion.length; i += 3) {
      radioMaximo = Math.max(radioMaximo, Math.hypot(m.posicion[i], m.posicion[i + 2]))
    }
    expect(radioMaximo).toBeCloseTo(7, 6)
  })

  it('todas las caras miran hacia arriba: ninguna se la traga el descarte de traseras', () => {
    const m = new Malla(256)
    construirSuelo(m, 7, 48)
    expect(m.indice.length).toBe(48 * 3)
    for (let k = 0; k < m.indice.length; k += 3) {
      expect(normalDelTriangulo(m, k)[1]).toBeGreaterThan(0)
    }
    for (let i = 0; i < m.normal.length; i += 3) {
      expect(Array.from(m.normal.subarray(i, i + 3))).toEqual([0, 1, 0])
    }
  })

  it('las coordenadas de textura van en metros: la imagen se repite cada tres', () => {
    const m = new Malla(256)
    construirSuelo(m, 6, 4)
    // El centro está en el origen: uv (0, 0). El primer vértice del borde está en +X.
    expect(Array.from(m.uv.subarray(0, 2))).toEqual([0, 0])
    expect(m.uv[2]).toBeCloseTo(6 / METROS_POR_REPETICION, 6)
    expect(m.uv[3]).toBeCloseTo(0, 6)
  })

  it('no tiñe la imagen: el color de los vértices es blanco', () => {
    const m = new Malla(256)
    construirSuelo(m, 7, 8)
    for (let i = 0; i < m.color.length; i++) expect(m.color[i]).toBe(1)
  })
})
