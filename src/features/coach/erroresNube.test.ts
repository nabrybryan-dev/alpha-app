/**
 * Cómo se agrupan los errores del navegador en el panel del coach.
 *
 * Lo que Bryan necesitaba ver el 10-sep era UNA línea: «este mensaje, a tantas personas, tantas
 * veces, la última hace un rato». 37 filas sueltas no se leen; una fila con «2 personas · 37
 * veces» sí. Por eso el orden va primero por PERSONAS: un fallo que le pasa a mucha gente es una
 * avería de la app, y uno que le pasa a una sola persona muchas veces suele ser su teléfono.
 */
import { describe, expect, it } from 'vitest'
import { agruparErrores, type FilaErrorLeida } from './erroresNube'

const fila = (usuario: string, creado: string, mensaje: string): FilaErrorLeida => ({
  usuario_id: usuario,
  creado_en: creado,
  mensaje,
})

describe('agruparErrores', () => {
  it('junta el mismo mensaje: cuántas veces, cuántas personas y cuándo fue la última', () => {
    const grupos = agruparErrores([
      fila('u1', '2026-09-10T08:00:00Z', '[42883] operator does not exist'),
      fila('u2', '2026-09-11T09:30:00Z', '[42883] operator does not exist'),
      fila('u1', '2026-09-10T20:00:00Z', '[42883] operator does not exist'),
    ])

    expect(grupos).toEqual([
      {
        mensaje: '[42883] operator does not exist',
        veces: 3,
        personas: 2,
        ultimoVisto: '2026-09-11T09:30:00Z',
      },
    ])
  })

  it('no junta mensajes distintos', () => {
    const grupos = agruparErrores([
      fila('u1', '2026-09-10T08:00:00Z', 'Failed to fetch'),
      fila('u1', '2026-09-10T08:01:00Z', 'Loading chunk 12 failed'),
    ])
    expect(grupos).toHaveLength(2)
  })

  it('sin filas no hay grupos', () => {
    expect(agruparErrores([])).toEqual([])
  })

  it('ordena primero lo que le pasa a más personas, y a igualdad lo más reciente', () => {
    const grupos = agruparErrores([
      fila('u1', '2026-09-12T10:00:00Z', 'solo mío, muchas veces'),
      fila('u1', '2026-09-12T10:01:00Z', 'solo mío, muchas veces'),
      fila('u1', '2026-09-12T10:02:00Z', 'solo mío, muchas veces'),
      fila('u1', '2026-09-10T08:00:00Z', 'de todos'),
      fila('u2', '2026-09-10T08:00:00Z', 'de todos'),
      fila('u3', '2026-09-11T08:00:00Z', 'otro de uno, más reciente'),
      fila('u3', '2026-09-13T08:00:00Z', 'otro de uno, más reciente'),
    ])
    expect(grupos.map((g) => g.mensaje)).toEqual([
      'de todos',
      'otro de uno, más reciente',
      'solo mío, muchas veces',
    ])
  })
})
