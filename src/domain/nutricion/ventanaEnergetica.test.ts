import { describe, expect, it } from 'vitest'
import {
  DIAS_MINIMOS,
  DIAS_VENTANA,
  ventanaEnergetica,
  type DiaRegistrado,
} from './ventanaEnergetica'

const dia = (fecha: string, kcal: number, margenPct = 25): DiaRegistrado => ({
  fecha,
  total: { porDia: { kcal }, parciales: new Set(), margenPct },
})

/** Días consecutivos hacia atrás desde el 2026-08-02, todos con las mismas kcal. */
const seguidos = (cuantos: number, kcal = 1900): DiaRegistrado[] =>
  Array.from({ length: cuantos }, (_, i) => dia(`2026-08-${String(2 - i).padStart(2, '0')}`, kcal))

const HOY = '2026-08-03'

describe('ventanaEnergetica', () => {
  it('promedia lo registrado en los días anteriores', () => {
    const v = ventanaEnergetica([dia('2026-08-02', 2000), dia('2026-08-01', 1800), dia('2026-07-31', 1900)], HOY)
    expect(v?.ingestaKcal).toBe(1900)
    expect(v?.dias).toBe(3)
  })

  /**
   * A las ocho de la mañana solo hay un desayuno anotado. Con una masa magra de
   * 45 kg eso da 7,7 kcal/kg contra un umbral de 30: todo el mundo abriría la
   * app con una alerta de que come poco, y saldría de ella a media tarde.
   */
  it('HOY no cuenta, por muy poco que lleve anotado', () => {
    const v = ventanaEnergetica([...seguidos(3), dia(HOY, 350)], HOY)
    expect(v?.dias).toBe(3)
    expect(v?.ingestaKcal).toBe(1900)
  })

  it('un día futuro tampoco: un dato adelantado no es un dato', () => {
    const v = ventanaEnergetica([...seguidos(3), dia('2026-08-10', 500)], HOY)
    expect(v?.dias).toBe(3)
  })

  describe('cuando no hay bastante', () => {
    it('con menos de los días mínimos devuelve null, no una media floja', () => {
      // `null` es "todavía no se puede decir". Quien lo reciba tiene que callar,
      // no dar el día por bueno.
      expect(ventanaEnergetica(seguidos(DIAS_MINIMOS - 1), HOY)).toBeNull()
    })

    it('justo en el mínimo ya habla', () => {
      expect(ventanaEnergetica(seguidos(DIAS_MINIMOS), HOY)?.dias).toBe(DIAS_MINIMOS)
    })

    it('sin ningún registro, null', () => {
      expect(ventanaEnergetica([], HOY)).toBeNull()
    })

    it('un día abierto sin nada dentro no cuenta como día registrado', () => {
      // La fila existe porque tocó la comida, pero no anotó nada. Contarlo como
      // un día de 0 kcal hundiría la media e inventaría un ayuno.
      const v = ventanaEnergetica([...seguidos(3), dia('2026-07-30', 0)], HOY)
      expect(v?.dias).toBe(3)
    })
  })

  describe('la ventana', () => {
    it('mira como mucho los últimos días, no el historial entero', () => {
      const v = ventanaEnergetica(seguidos(20), HOY)
      expect(v?.dias).toBe(DIAS_VENTANA)
    })

    it('coge los más recientes, no los primeros de la lista', () => {
      // Llegan desordenados a propósito: los repos no garantizan orden.
      const viejos = Array.from({ length: 7 }, (_, i) =>
        dia(`2026-07-${String(10 + i).padStart(2, '0')}`, 1000),
      )
      const nuevos = seguidos(7, 2000)
      const v = ventanaEnergetica([...viejos, ...nuevos], HOY)
      expect(v?.ingestaKcal).toBe(2000)
    })
  })

  describe('el margen', () => {
    it('se queda con el peor de los días usados', () => {
      // Una media que incluye un día anotado a ojo no es más fiable que ese día.
      const v = ventanaEnergetica(
        [dia('2026-08-02', 1900, 5), dia('2026-08-01', 1900, 25), dia('2026-07-31', 1900, 15)],
        HOY,
      )
      expect(v?.margenPct).toBe(25)
    })

    it('si pesó todos los días, el margen es el de la báscula', () => {
      const v = ventanaEnergetica(seguidos(4).map((d) => ({ ...d, total: { ...d.total, margenPct: 5 } })), HOY)
      expect(v?.margenPct).toBe(5)
    })
  })

  it('no cuenta un día dos veces aunque venga repetido', () => {
    // Sin dedupe, la fecha repetida entraría dos veces y arrastraría la media
    // hacia su valor. Con 3 días de 1.900 y un 08-02 repetido de 900, la media
    // sin dedupe sería 1.650 y con dedupe sigue siendo 1.900.
    const v = ventanaEnergetica([...seguidos(3), dia('2026-08-02', 900)], HOY)
    expect(v?.dias).toBe(3)
    expect(v?.ingestaKcal).toBe(1900)
  })
})
