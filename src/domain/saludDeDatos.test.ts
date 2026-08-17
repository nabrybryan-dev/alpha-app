import { describe, expect, it } from 'vitest'
import {
  familiasEnRiesgo,
  saludDeDatos,
  UMBRAL_ATRASO_DIAS,
  VENTANA_DIAS,
  type FamiliaDeDatos,
} from './saludDeDatos'

const HOY = '2026-08-02'

function familia(id: string, fechas: string[]): FamiliaDeDatos {
  return { id, nombre: id, fechas }
}

describe('saludDeDatos', () => {
  it('marca al día lo que registró hoy', () => {
    const { familias } = saludDeDatos([familia('comidas', [HOY])], HOY)
    expect(familias[0].estado).toBe('al-dia')
    expect(familias[0].diasSinRegistrar).toBe(0)
    expect(familias[0].ultimo).toBe(HOY)
  })

  it('marca sin-datos lo que nunca llegó', () => {
    // El caso real: registro de comidas a cero mientras todo lo demás subía.
    const { familias } = saludDeDatos([familia('comidas', [])], HOY)
    expect(familias[0].estado).toBe('sin-datos')
    expect(familias[0].recientes).toBe(0)
    expect(familias[0].ultimo).toBeUndefined()
    expect(familias[0].diasSinRegistrar).toBeUndefined()
  })

  it('el umbral de atraso corta donde dice la constante', () => {
    const justo = saludDeDatos([familia('c', ['2026-07-30'])], HOY) // 3 días
    const pasado = saludDeDatos([familia('c', ['2026-07-29'])], HOY) // 4 días
    expect(UMBRAL_ATRASO_DIAS).toBe(3)
    expect(justo.familias[0].estado).toBe('al-dia')
    expect(pasado.familias[0].estado).toBe('atrasado')
    expect(pasado.familias[0].diasSinRegistrar).toBe(4)
  })

  it('cuenta solo los registros de la ventana', () => {
    const dentro = ['2026-08-02', '2026-08-01', '2026-07-28']
    const fuera = ['2026-07-20', '2026-07-01']
    const { familias } = saludDeDatos([familia('c', [...dentro, ...fuera])], HOY)
    expect(VENTANA_DIAS).toBe(7)
    expect(familias[0].recientes).toBe(3)
  })

  it('el último es el más reciente aunque las fechas vengan desordenadas', () => {
    const { familias } = saludDeDatos([familia('c', ['2026-07-10', HOY, '2026-07-25'])], HOY)
    expect(familias[0].ultimo).toBe(HOY)
  })

  it('un reloj adelantado no da días negativos ni oculta un atraso', () => {
    const { familias } = saludDeDatos([familia('c', ['2026-08-05'])], HOY)
    expect(familias[0].diasSinRegistrar).toBe(0)
    expect(familias[0].estado).toBe('al-dia')
  })

  it('un equipo recién creado no se pinta en rojo entero', () => {
    // Todo vacío el primer día no es una avería. Un panel que grita desde el
    // arranque enseña a ignorarlo, que es justo lo que hay que evitar.
    const salud = saludDeDatos([familia('a', []), familia('b', [])], HOY)
    expect(salud.sinEstrenar).toBe(true)
    expect(familiasEnRiesgo(salud)).toEqual([])
  })

  it('en cuanto UNA familia tiene datos, las vacías sí cuentan', () => {
    // Este es el caso que se vivió: check-ins y mensajes llegando, comidas a
    // cero. Ahí el cero significa algo.
    const salud = saludDeDatos([familia('checkins', [HOY]), familia('comidas', [])], HOY)
    expect(salud.sinEstrenar).toBe(false)
    expect(familiasEnRiesgo(salud).map((f) => f.id)).toEqual(['comidas'])
  })

  it('sin familias no inventa un equipo sin estrenar', () => {
    const salud = saludDeDatos([], HOY)
    expect(salud.sinEstrenar).toBe(false)
    expect(familiasEnRiesgo(salud)).toEqual([])
  })
})

describe('familiasEnRiesgo', () => {
  it('junta lo atrasado y lo que nunca llegó, y deja fuera lo sano', () => {
    const salud = saludDeDatos(
      [
        familia('al-dia', [HOY]),
        familia('atrasada', ['2026-07-20']),
        familia('vacia', []),
      ],
      HOY,
    )
    expect(familiasEnRiesgo(salud).map((f) => f.id)).toEqual(['atrasada', 'vacia'])
  })
})
