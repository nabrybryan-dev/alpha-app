import { describe, expect, it } from 'vitest'
import {
  hayTendencia,
  puntosDelHistorial,
  tomasDeLaTendencia,
  tramoQueSeñalar,
  tramosDelHistorial,
  type TomaDelHistorial,
} from './historial'

function toma(fecha: string, p: Partial<TomaDelHistorial> = {}): TomaDelHistorial {
  return { fecha, vPrimera: 0.72, calidad: 'buena', cargaKg: 100, ...p }
}

/* Las horas son locales a propósito: `comparablesPorHora` decide por la franja
 * del día, y una fecha en UTC diría otra franja según dónde corra el test. */
const MANANA = '2026-08-10T08:30:00'
const MEDIODIA = '2026-08-17T12:30:00'
const TARDE = '2026-08-24T18:30:00'

describe('qué punto se pinta', () => {
  it('una descartada no aparece en ningún sitio', () => {
    // Su número es falso, y un punto falso en una serie temporal no se distingue
    // de uno real por la forma. Atenuarlo no basta: sigue dibujando la línea.
    const puntos = puntosDelHistorial([
      toma(MANANA),
      toma(MEDIODIA, { calidad: 'descartada', vPrimera: 0.94 }),
    ])
    expect(puntos).toHaveLength(1)
    expect(puntos.every((p) => p.calidad !== 'descartada')).toBe(true)
  })

  it('una dudosa sí se pinta, porque su número existe', () => {
    const puntos = puntosDelHistorial([toma(MANANA), toma(MEDIODIA, { calidad: 'dudosa' })])
    expect(puntos).toHaveLength(2)
  })

  it('pero NO cuenta para la línea de tendencia', () => {
    // Contamina la tendencia sin avisar: la línea es lo que la gente lee, y una
    // toma con la escala en duda la mueve igual que una buena.
    const tomas = [toma(MANANA), toma(MEDIODIA, { calidad: 'dudosa' }), toma(TARDE)]
    expect(puntosDelHistorial(tomas)).toHaveLength(3)
    expect(tomasDeLaTendencia(tomas)).toHaveLength(2)
  })

  it('los puntos salen ordenados por fecha aunque lleguen revueltos', () => {
    const puntos = puntosDelHistorial([toma(TARDE), toma(MANANA), toma(MEDIODIA)])
    expect(puntos.map((p) => p.fecha)).toEqual([MANANA, MEDIODIA, TARDE])
  })
})

describe('los tramos se comparan contra el ANTERIOR, no dos sueltas', () => {
  it('con tres puntos hay dos comparaciones', () => {
    // Un solo aviso para toda la gráfica diría que ninguna pareja se compara, y
    // eso casi nunca es verdad.
    expect(tramosDelHistorial([toma(MANANA), toma(MEDIODIA), toma(TARDE)])).toHaveLength(2)
  })

  it('mañana contra tarde rompe la comparación', () => {
    const tramos = tramosDelHistorial([toma(MANANA), toma(TARDE)])
    expect(tramos[0].aviso.comparables).toBe(false)
  })

  it('y el cambio de carga se marca aparte, porque es otra cosa', () => {
    // La velocidad baja al subir el peso: una serie que mezcla 100 y 110 kg
    // dibuja una caída que se lee como pérdida de forma siendo lo contrario.
    const tramos = tramosDelHistorial([toma(MANANA), toma(MEDIODIA, { cargaKg: 110 })])
    expect(tramos[0].cargaCambio).toBe(true)
  })
})

describe('cuál se señala', () => {
  it('el más reciente que no se sostiene, no el peor', () => {
    // El historial se mira para decidir qué hacer ahora, y la comparación que
    // importa es contra la última toma.
    const tramo = tramoQueSeñalar([
      toma('2026-08-03T08:00:00'),
      toma('2026-08-10T18:00:00'), // rompe, pero es viejo
      toma('2026-08-17T18:00:00'),
      toma('2026-08-24T08:00:00'), // rompe, y es el último
    ])
    expect(tramo?.hasta.fecha).toBe('2026-08-24T08:00:00')
  })

  it('un tramo que rompe del todo gana a uno que solo avisa', () => {
    const tramo = tramoQueSeñalar([
      toma(MANANA),
      toma('2026-08-17T18:00:00'), // mañana vs tarde: rompe
      toma('2026-08-24T20:00:00'), // tarde vs tarde: como mucho avisa
    ])
    expect(tramo?.aviso.comparables).toBe(false)
  })

  it('y si todo se compara, no se señala nada', () => {
    // Sin aviso no se pinta nada: ni marco vacío ni placeholder.
    const tramo = tramoQueSeñalar([
      toma('2026-08-10T08:00:00'),
      toma('2026-08-17T08:30:00'),
    ])
    expect(tramo).toBeUndefined()
  })
})

describe('con una sola toma no hay tendencia', () => {
  it('una buena no basta', () => {
    expect(hayTendencia([toma(MANANA)])).toBe(false)
  })

  it('ni una buena y una dudosa', () => {
    expect(hayTendencia([toma(MANANA), toma(MEDIODIA, { calidad: 'dudosa' })])).toBe(false)
  })

  it('dos buenas sí', () => {
    expect(hayTendencia([toma(MANANA), toma(MEDIODIA)])).toBe(true)
  })
})
