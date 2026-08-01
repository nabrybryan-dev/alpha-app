import { describe, expect, it } from 'vitest'
import {
  diasExigidos,
  evaluarRacha,
  tramoDeHambre,
  TOLERANCIA_DIAS_SIN_CONFIRMAR,
  type RegistroHambre,
} from './hambre'

/**
 * Los números salen de la decisión de la nutricionista, y las dos reglas de
 * criterio -perdón de un día, tramos que no se prestan días- están portadas de
 * `herramientas/senales/hambre.py`. Si el puerto se desvía, aquí se ve.
 */

/** Serie de días consecutivos a partir de una fecha, con los valores dados. */
const serie = (desde: string, valores: (number | null)[]): RegistroHambre[] => {
  const [a, m, d] = desde.split('-').map(Number)
  return valores.map((hambre, i) => {
    const f = new Date(a, m - 1, d + i)
    const mes = String(f.getMonth() + 1).padStart(2, '0')
    return {
      fecha: `${f.getFullYear()}-${mes}-${String(f.getDate()).padStart(2, '0')}`,
      hambre,
    }
  })
}

const repetir = (valor: number | null, veces: number) => Array<number | null>(veces).fill(valor)

describe('diasExigidos', () => {
  it('cuanto más intensa, menos días se espera', () => {
    expect(diasExigidos(2)).toBe(21)
    expect(diasExigidos(5)).toBe(10)
    expect(diasExigidos(7)).toBe(5)
    expect(diasExigidos(10)).toBe(2)
  })

  it('los bordes de cada tramo caen donde deben', () => {
    expect(diasExigidos(3)).toBe(21)
    expect(diasExigidos(4)).toBe(10)
    expect(diasExigidos(6)).toBe(10)
    expect(diasExigidos(8)).toBe(5)
    expect(diasExigidos(9)).toBe(2)
  })

  it('fuera de 1 a 10 revienta, no se acota en silencio', () => {
    expect(() => diasExigidos(0)).toThrow()
    expect(() => diasExigidos(11)).toThrow()
  })

  it('un decimal tampoco pasa: la escala es de enteros', () => {
    expect(() => diasExigidos(7.5)).toThrow()
  })
})

describe('tramoDeHambre', () => {
  it('nombra el tramo, para poder decirlo en pantalla', () => {
    expect(tramoDeHambre(2).etiqueta).toBe('leve')
    expect(tramoDeHambre(10).etiqueta).toBe('insostenible')
  })
})

describe('evaluarRacha', () => {
  it('sin registros no hay nada que evaluar, y no revienta', () => {
    expect(evaluarRacha([])).toEqual({ cumplido: false })
  })

  it('un hambre insostenible cumple en dos días', () => {
    const veredicto = evaluarRacha(serie('2026-08-01', [10, 9]))
    expect(veredicto.cumplido).toBe(true)
    expect(veredicto.tramo).toBe('insostenible')
    expect(veredicto.fechaCumplimiento).toBe('2026-08-02')
  })

  it('un día solo todavía no', () => {
    expect(evaluarRacha(serie('2026-08-01', [10])).cumplido).toBe(false)
  })

  it('un hambre leve necesita veintiún días', () => {
    expect(evaluarRacha(serie('2026-08-01', repetir(2, 20))).cumplido).toBe(false)
    expect(evaluarRacha(serie('2026-08-01', repetir(2, 21))).cumplido).toBe(true)
  })

  describe('el perdón de un día', () => {
    it('un día bueno en medio NO rompe la racha', () => {
      // Cuatro días de hambre 8, uno bien, y otros cuatro de 8 SÍ son cinco
      // días sostenidos: el día bueno no borra lo que pasó antes.
      const veredicto = evaluarRacha(serie('2026-08-01', [8, 8, 8, 8, 2, 8]))
      expect(veredicto.cumplido).toBe(true)
      expect(veredicto.tramo).toBe('intensa')
    })

    it('dos días seguidos sí la rompen', () => {
      const veredicto = evaluarRacha(serie('2026-08-01', [8, 8, 8, 8, 2, 2, 8]))
      expect(veredicto.cumplido).toBe(false)
    })

    it('la tolerancia es de un solo día, y está declarada', () => {
      expect(TOLERANCIA_DIAS_SIN_CONFIRMAR).toBe(1)
    })
  })

  describe('los tramos no se prestan días', () => {
    it('tres días intensos y tres leves NO son seis de nada', () => {
      // Son dos patrones distintos, y cada uno pide una respuesta distinta.
      expect(evaluarRacha(serie('2026-08-01', [8, 8, 8, 2, 2, 2])).cumplido).toBe(false)
    })

    it('pero cada tramo sigue contando lo suyo en paralelo', () => {
      // Cuatro intensos separados por un leve: el tramo intenso llega a cinco.
      const veredicto = evaluarRacha(serie('2026-08-01', [7, 7, 2, 7, 7, 7]))
      expect(veredicto.cumplido).toBe(true)
      expect(veredicto.tramo).toBe('intensa')
    })
  })

  describe('los días sin registrar', () => {
    it('un hueco no CONFIRMA el nivel: no suma a la racha', () => {
      // Tres días con un hueco en medio dan dos días confirmados, no tres. Si
      // el hueco contara, quien deja de registrar acumularía días de un hambre
      // que nadie midió.
      expect(evaluarRacha(serie('2026-08-01', [5, null, 5])).cumplido).toBe(false)
    })

    it('pero uno solo tampoco la BORRA: se perdona igual que un día bueno', () => {
      // Verificado contra el Python: [10, null, 10] sí cumple — son dos días
      // confirmados de hambre insostenible, y el hueco no los desanda.
      expect(evaluarRacha(serie('2026-08-01', [10, null, 10])).cumplido).toBe(true)
      expect(evaluarRacha(serie('2026-08-01', [8, 8, null, 8, 8, 8])).cumplido).toBe(true)
    })

    it('dos huecos seguidos sí la borran', () => {
      expect(evaluarRacha(serie('2026-08-01', [10, null, null, 10])).cumplido).toBe(false)
    })
  })

  describe('la serie tiene que estar completa', () => {
    it('un día que falta de la lista revienta', () => {
      // Dos días separados por una semana parecerían seguidos, y la racha
      // contaría días que nadie vivió.
      const conHueco: RegistroHambre[] = [
        { fecha: '2026-08-01', hambre: 10 },
        { fecha: '2026-08-08', hambre: 10 },
      ]
      expect(() => evaluarRacha(conHueco)).toThrow(/consecutivos/)
    })

    it('un día repetido también', () => {
      const repetido: RegistroHambre[] = [
        { fecha: '2026-08-01', hambre: 10 },
        { fecha: '2026-08-01', hambre: 10 },
      ]
      expect(() => evaluarRacha(repetido)).toThrow()
    })

    it('el cambio de mes no se le atraganta', () => {
      const veredicto = evaluarRacha(serie('2026-08-30', [10, 10, 10]))
      expect(veredicto.cumplido).toBe(true)
      expect(veredicto.fechaCumplimiento).toBe('2026-08-31')
    })
  })

  it('avisa del primer tramo que cruza su umbral, no del último', () => {
    // Es, en los hechos, el momento en que con los datos de entonces ya tocaba
    // actuar.
    const veredicto = evaluarRacha(serie('2026-08-01', [...repetir(10, 2), ...repetir(5, 10)]))
    expect(veredicto.fechaCumplimiento).toBe('2026-08-02')
  })
})
