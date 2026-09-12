import { describe, expect, it } from 'vitest'
import { armarSemana, inicioSemanaDe } from './rutaEntrenamiento'
import type { Microciclo, Sesion } from './types'

/**
 * R-18 de la auditoría (`cerebro-alpha-agentes/auditoria/frente-5/R-18-la-bateria-roja.md`).
 *
 * ROJO A PROPÓSITO CONTRA EL CÓDIGO ANTERIOR a este commit.
 *
 * EL CASO REAL: un microciclo que arranca en SÁBADO y trae una sesión
 * «(DOMINGO)» —el día siguiente, dentro del mismo bloque de 7 días— perdía esa
 * sesión en la víspera. No aparecía tarde ni pronto: no aparecía.
 *
 * LA CAUSA: `inicioSemanaDe` decidía DOMINGO con solo «hay alguna sesión de
 * domingo», sin mirar si esa sesión abre el bloque o es su segundo día. Con
 * la semana tipo DOMINGO, `armarSemana` anclaba la víspera a la semana
 * natural domingo-sábado que contiene el arranque —la semana ANTERIOR al
 * propio bloque—, y el domingo de verdad (el día siguiente al sábado) caía
 * fuera de toda rejilla.
 *
 * MEDIDO CONTRA LA BASE REAL EL 2026-09-12: cero microciclos con esta forma
 * hoy (ni activos ni futuros). Era un defecto latente, no uno que ya hubiera
 * mordido a alguien — el próximo plan que arrancara martes-a-sábado con una
 * sesión de domingo lo habría pisado.
 */

function sesion(id: string, nombre: string, orden: number, dia: string): Sesion {
  return { id, nombre, orden, ejercicios: [], dia } as unknown as Sesion
}

function microSabadoConDomingo(): Microciclo {
  return {
    id: 'm-banco-sin-registro-ninguno',
    usuarioId: 'u-1',
    numero: 1,
    cadenciaDias: 7,
    estado: 'activo',
    fechaInicio: '2026-09-05', // SÁBADO
    sesiones: [
      sesion('s1', 'FULL A · SÁBADO', 1, 'SÁBADO'),
      sesion('s2', 'FULL A · DOMINGO', 2, 'DOMINGO'),
    ],
  }
}

describe('R-18 · un microciclo que arranca en sábado y sigue en domingo', () => {
  it('`inicioSemanaDe` NO es DOMINGO: la primera sesión del bloque es SÁBADO, no la que trae domingo', () => {
    // Antes del arreglo esto daba 'DOMINGO', mirando solo si «hay alguna» sesión
    // de domingo, sin importar en qué posición del bloque cae.
    expect(inicioSemanaDe(microSabadoConDomingo())).toBe('LUNES')
  })

  it('en la víspera, la sesión del domingo se ve el día siguiente al sábado de arranque', () => {
    const dias = armarSemana(microSabadoConDomingo(), '2026-09-04')

    const domingoDelBloque = dias.find((d) => d.fechaIso === '2026-09-06')
    expect(domingoDelBloque?.sesionId).toBe('s2')
  })

  it('y esa sesión no aparece una semana antes del arranque', () => {
    const dias = armarSemana(microSabadoConDomingo(), '2026-09-04')

    const domingoDeSieteDiasAntes = dias.find((d) => d.fechaIso === '2026-08-30')
    expect(domingoDeSieteDiasAntes?.sesionId).not.toBe('s2')
  })

  it('y el sábado de arranque sigue viéndose, como antes', () => {
    const dias = armarSemana(microSabadoConDomingo(), '2026-09-04')

    expect(dias.find((d) => d.fechaIso === '2026-09-05')?.sesionId).toBe('s1')
  })
})
