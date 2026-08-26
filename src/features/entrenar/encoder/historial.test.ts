import { describe, expect, it } from 'vitest'
import {
  cargasDeLaTendencia,
  hayTendencia,
  sinEscalaEnLaTendencia,
  tomasDeLasSeries,
  puntosDelHistorial,
  tomasDeLaTendencia,
  tramoQueSeñalar,
  tramosDelHistorial,
  type TomaDelHistorial,
} from './historial'

function toma(fecha: string, p: Partial<TomaDelHistorial> = {}): TomaDelHistorial {
  return { fecha, pvPct: 29.2, calidad: 'buena', cargaKg: 100, ...p }
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
      toma(MEDIODIA, { calidad: 'descartada', pvPct: 24.5 }),
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

describe('lo que el %PV permite y los m/s no', () => {
  it('una toma sin escala CUENTA, no se descarta', () => {
    // El %PV es un cociente entre dos velocidades de la misma serie: la escala
    // se cancela y vale igual en píxeles por segundo. Descartarla sería tirar un
    // dato bueno por una razón que no aplica.
    const tomas = [toma(MANANA, { hayEscala: false }), toma(MEDIODIA, { hayEscala: false })]
    expect(hayTendencia(tomas)).toBe(true)
    expect(tomasDeLaTendencia(tomas)).toHaveLength(2)
  })

  it('pero se cuenta cuántas son, para poder decirlo', () => {
    // Callarlo sería tan malo como descartarlas: quien mire la gráfica tiene
    // derecho a saber que parte de esos puntos salieron en px/s.
    const tomas = [toma(MANANA, { hayEscala: false }), toma(MEDIODIA), toma(TARDE)]
    expect(sinEscalaEnLaTendencia(tomas)).toBe(1)
  })

  it('las cargas de la tendencia salen ordenadas y sin repetir', () => {
    // Dos puntos a la misma altura con distinta carga NO son estancamiento: son
    // el mismo esfuerzo con más peso, que es el progreso que se busca.
    const tomas = [
      toma(MANANA, { cargaKg: 100 }),
      toma(MEDIODIA, { cargaKg: 110 }),
      toma(TARDE, { cargaKg: 100 }),
    ]
    expect(cargasDeLaTendencia(tomas)).toEqual([100, 110])
  })

  it('con una sola carga no hay nada que aclarar', () => {
    expect(cargasDeLaTendencia([toma(MANANA), toma(MEDIODIA)])).toEqual([100])
  })
})

describe('de las series registradas a los puntos', () => {
  it('una serie SIN velocidad se salta, no cuenta como pérdida cero', () => {
    // Hoy casi nadie graba. Contar las no medidas como 0 dibujaría una tendencia
    // plana inventada sobre las sesiones que nadie midió.
    const puntos = tomasDeLasSeries([
      {
        fecha: MANANA,
        series: [
          { cargaKg: 100 },
          { cargaKg: 100, velocidad: { pvPct: 29.2, hayEscala: true, calidad: 'buena' } },
        ],
      },
    ])
    expect(puntos).toHaveLength(1)
    expect(puntos[0].pvPct).toBe(29.2)
  })

  it('un veredicto desconocido NO se asume bueno', () => {
    // Se trata como dudoso: se pinta, pero fuera de la línea de tendencia. Darlo
    // por bueno metería en la tendencia algo que nadie ha validado.
    const puntos = tomasDeLasSeries([
      { fecha: MANANA, series: [{ cargaKg: 100, velocidad: { pvPct: 20, hayEscala: true, calidad: 'rarísimo' } }] },
    ])
    expect(puntos[0].calidad).toBe('dudosa')
  })

  it('arrastra la carga, la escala y la inclinación', () => {
    const puntos = tomasDeLasSeries([
      {
        fecha: MANANA,
        series: [
          { cargaKg: 110, velocidad: { pvPct: 31, hayEscala: false, calidad: 'buena', inclinacionMax: 8 } },
        ],
      },
    ])
    expect(puntos[0]).toMatchObject({ cargaKg: 110, hayEscala: false, inclinacionMax: 8 })
  })

  it('varias sesiones se aplanan en una sola serie de puntos', () => {
    const puntos = tomasDeLasSeries([
      { fecha: MANANA, series: [{ cargaKg: 100, velocidad: { pvPct: 25, hayEscala: true, calidad: 'buena' } }] },
      { fecha: MEDIODIA, series: [{ cargaKg: 100, velocidad: { pvPct: 28, hayEscala: true, calidad: 'buena' } }] },
    ])
    expect(puntos).toHaveLength(2)
    expect(hayTendencia(puntos)).toBe(true)
  })

  it('sin nada grabado, no hay puntos y no se finge una gráfica', () => {
    expect(tomasDeLasSeries([{ fecha: MANANA, series: [{ cargaKg: 100 }] }])).toEqual([])
  })
})
