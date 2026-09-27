import { describe, expect, it } from 'vitest'
import {
  PREGUNTAS_VIDA,
  debeMostrarTarjeta,
  esIdPreguntaVida,
  lunesDeSemanaActual,
  revisarRespuestasTarjetaVida,
  semanaAMostrar,
} from './tarjetaVida'

describe('el catálogo de las siete preguntas', () => {
  it('son siete, V1..V7, cada una con su escala', () => {
    expect(PREGUNTAS_VIDA.map((p) => p.id)).toEqual(['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7'])
    for (const p of PREGUNTAS_VIDA) {
      expect(p.texto.length, p.id).toBeGreaterThan(10)
      expect(p.escala.maximo, p.id).toBeGreaterThan(p.escala.minimo)
    }
  })

  it('V7 es la pregunta de rendimiento, 1-5, con sus cinco etiquetas', () => {
    const v7 = PREGUNTAS_VIDA.find((p) => p.id === 'V7')!
    expect(v7.texto).toContain('¿cómo rendiste en tu trabajo o en tus estudios')
    expect(v7.escala).toEqual({
      minimo: 1,
      maximo: 5,
      etiquetas: {
        1: 'Mucho peor que lo normal',
        2: 'Algo peor',
        3: 'Igual que siempre',
        4: 'Algo mejor',
        5: 'Mucho mejor que lo normal',
      },
    })
  })

  it('reconoce las siete claves y ninguna otra', () => {
    for (const p of PREGUNTAS_VIDA) expect(esIdPreguntaVida(p.id)).toBe(true)
    for (const id of ['V0', 'V8', 'v1', 'sueno']) expect(esIdPreguntaVida(id), id).toBe(false)
  })

  // Las cinco de abajo fijan el texto EXACTO del diseño (DISENO-AGENTE-ESTILO-DE-VIDA.md
  // §2): una paráfrasis que suene parecida no es la misma pregunta, y en V4/V5 el motor de
  // reglas (`alarmas_de`, `agentes/estilo_vida.py`) lee valores concretos (V4 <= 2, V5 en
  // 'nada'/'trabajo') que solo tienen sentido si la pregunta es la que el diseño describe.

  it('V4 es de ÁNIMO, 0-10 (no de nivel de estrés): alarmas_de dispara con V4 <= 2', () => {
    const v4 = PREGUNTAS_VIDA.find((p) => p.id === 'V4')!
    expect(v4.texto).toBe('¿Cómo estuvo tu ánimo esta semana?')
    expect(v4.escala).toEqual({ minimo: 0, maximo: 10 })
  })

  it('V5 es una opción cerrada de 7, con "nada" y "trabajo" tal cual (no un sí/no)', () => {
    const v5 = PREGUNTAS_VIDA.find((p) => p.id === 'V5')!
    expect(v5.texto).toBe('¿Qué te quitó más tiempo o ganas de entrenar?')
    expect(v5.escala.minimo).toBe(0)
    expect(v5.escala.maximo).toBe(6)
    expect(Object.values(v5.escala.etiquetas ?? {})).toEqual(
      expect.arrayContaining(['Nada en particular', 'Trabajo']),
    )
  })

  it('V6 mide el cumplimiento de la acción de la semana, 0-7 días', () => {
    const v6 = PREGUNTAS_VIDA.find((p) => p.id === 'V6')!
    expect(v6.texto).toContain('cumpliste')
    expect(v6.escala).toEqual({ minimo: 0, maximo: 7 })
  })
})

describe('revisarRespuestasTarjetaVida', () => {
  it('una tarjeta completa y plausible pasa sin reparos', () => {
    expect(revisarRespuestasTarjetaVida({ V1: 2, V2: 5, V3: 1, V4: 4, V5: 1, V6: 5, V7: 4 })).toEqual([])
  })

  it('saltarse preguntas está bien: lo que falta, falta', () => {
    expect(revisarRespuestasTarjetaVida({})).toEqual([])
    expect(revisarRespuestasTarjetaVida({ V1: 2 })).toEqual([])
    expect(revisarRespuestasTarjetaVida({ V1: 2, V2: undefined })).toEqual([])
  })

  it('rechaza una clave que no es de las siete', () => {
    const reparos = revisarRespuestasTarjetaVida({ V1: 2, V9: 1 })
    expect(reparos).toHaveLength(1)
    expect(reparos[0].campo).toBe('V9')
  })

  it('rechaza fuera de rango, incluida la escala guiada de V7', () => {
    expect(revisarRespuestasTarjetaVida({ V7: 0 })).toHaveLength(1)
    expect(revisarRespuestasTarjetaVida({ V7: 6 })).toHaveLength(1)
    expect(revisarRespuestasTarjetaVida({ V7: 1 })).toEqual([])
    expect(revisarRespuestasTarjetaVida({ V7: 5 })).toEqual([])
  })

  it('rechaza lo que no es un entero', () => {
    expect(revisarRespuestasTarjetaVida({ V1: 2.5 })).toHaveLength(1)
    expect(revisarRespuestasTarjetaVida({ V1: '2' })).toHaveLength(1)
    expect(revisarRespuestasTarjetaVida({ V1: Number.NaN })).toHaveLength(1)
  })

  it('devuelve todos los reparos, no el primero', () => {
    const reparos = revisarRespuestasTarjetaVida({ V1: 99, V9: 1, V7: 0 })
    expect(reparos.map((r) => r.campo).sort()).toEqual(['V1', 'V7', 'V9'])
  })
})

describe('lunesDeSemanaActual', () => {
  it('un lunes se devuelve a sí mismo', () => {
    expect(lunesDeSemanaActual('2026-09-21')).toBe('2026-09-21') // lunes
  })

  it('un domingo devuelve el lunes de ESA misma semana (la que termina hoy)', () => {
    expect(lunesDeSemanaActual('2026-09-27')).toBe('2026-09-21') // domingo
  })

  it('un miércoles devuelve el lunes de esta semana', () => {
    expect(lunesDeSemanaActual('2026-09-23')).toBe('2026-09-21')
  })
})

describe('semanaAMostrar', () => {
  it('un domingo muestra la semana que termina hoy', () => {
    expect(semanaAMostrar('2026-09-27')).toBe('2026-09-21') // domingo
  })

  it('cualquier otro día muestra la semana ANTERIOR, ya cerrada', () => {
    expect(semanaAMostrar('2026-09-23')).toBe('2026-09-14') // miércoles
    expect(semanaAMostrar('2026-09-21')).toBe('2026-09-14') // lunes
  })
})

describe('debeMostrarTarjeta', () => {
  it('un domingo sin la tarjeta de esa semana: sí toca', () => {
    expect(debeMostrarTarjeta('2026-09-27', [])).toBe(true)
  })

  it('ya respondida esa semana: no vuelve a ofrecerse', () => {
    expect(debeMostrarTarjeta('2026-09-27', ['2026-09-21'])).toBe(false)
  })

  it('un jueves con la semana pasada sin responder: sigue tocando (alcance)', () => {
    expect(debeMostrarTarjeta('2026-09-24', [])).toBe(true)
  })

  it('un jueves con la semana pasada YA respondida: no toca', () => {
    expect(debeMostrarTarjeta('2026-09-24', ['2026-09-14'])).toBe(false)
  })

  it('haber respondido otras semanas no cuenta para la que toca ahora', () => {
    expect(debeMostrarTarjeta('2026-09-27', ['2026-09-07', '2026-09-14'])).toBe(true)
  })
})
