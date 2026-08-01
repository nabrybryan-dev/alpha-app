import { describe, expect, it } from 'vitest'
import {
  avanceDeCalibracion,
  debeVolverAPesar,
  errorPct,
  estaCalibrado,
  peoresAlimentos,
  queDebePesar,
  sesgo,
  DIAS_MINIMOS,
  PRUEBAS_MINIMAS,
  SESGO_MAXIMO,
  type Prueba,
} from './calibracion'

/**
 * Las reglas están portadas de `herramientas/registro-comidas/calibracion.py`.
 * Lo que se prueba aquí no es la aritmética: es que se mida el SESGO y no el
 * acierto, y que la ventana sea ventana.
 */

const prueba = (
  estimados: number,
  reales: number,
  fecha = '2026-08-01',
  alimentoId = 'arroz',
): Prueba => ({ alimentoId, gramosEstimados: estimados, gramosReales: reales, fecha })

/** N pruebas con el mismo error, en días consecutivos hacia atrás. */
const tanda = (n: number, estimados: number, reales: number, alimentoId = 'arroz'): Prueba[] =>
  Array.from({ length: n }, (_, i) =>
    prueba(estimados, reales, `2026-08-${String(i + 1).padStart(2, '0')}`, alimentoId),
  )

describe('errorPct', () => {
  it('positivo cuando se pasó', () => {
    expect(errorPct(110, 100)).toBe(10)
  })

  it('negativo cuando se quedó corto', () => {
    expect(errorPct(90, 100)).toBe(-10)
  })

  it('dividir por cero no da infinito: da que la pregunta no aplica', () => {
    expect(errorPct(50, 0)).toBeNull()
  })

  it('un dato corrupto revienta en vez de colarse', () => {
    // Un NaN pasa desapercibido -«NaN <= 10» es false igual que «NaN > 10»- y
    // dejaría a la persona pesando para siempre sin que nadie sepa por qué.
    expect(() => errorPct(Number.NaN, 100)).toThrow()
    expect(() => errorPct(-5, 100)).toThrow()
  })
})

describe('sesgo', () => {
  it('es la MEDIANA, no la media: un día disparatado no decide', () => {
    const pruebas = [...tanda(14, 100, 100), prueba(1000, 100, '2026-08-15')]
    expect(sesgo(pruebas)).toBe(0)
  })

  it('fallar mucho pero sin sesgo NO impide calibrar', () => {
    // Es la parte contraintuitiva: quien se pasa un día y se queda corto al
    // otro estima con ruido, no con sesgo, y en la semana eso se cancela. Lo
    // que no se cancela nunca es quedarse corto SIEMPRE.
    const dispersos = [22, -18, 15, -20, 9, -11, 25, -3, -14, 17, -8, 12, -21, 6, -5]
    const pruebas = dispersos.map((error, i) =>
      prueba(100 + error, 100, `2026-08-${String(i + 1).padStart(2, '0')}`),
    )
    expect(Math.abs(sesgo(pruebas) ?? 99)).toBeLessThanOrEqual(SESGO_MAXIMO)
    expect(estaCalibrado(pruebas, 30)).toBe(true)
  })

  it('pero un sesgo pequeño y CONSTANTE sí lo impide', () => {
    // Errar un 12 % siempre en la misma dirección es peor que errar un 22 %
    // alternando, aunque el segundo «falle más».
    expect(estaCalibrado(tanda(15, 112, 100), 30)).toBe(false)
  })

  it('un sesgo constante NO se cancela', () => {
    // 15 % corto todos los días son ~250 kcal diarias que no existen en el
    // registro, y el motor recorta el déficit creyendo que come más.
    expect(sesgo(tanda(15, 85, 100))).toBe(-15)
  })

  it('mira solo las últimas quince: lo viejo sale del cálculo', () => {
    // Sin ventana, las primeras semanas malas de quien ya aprendió no salen
    // nunca y esa persona no calibra jamás.
    const viejasMalas = tanda(20, 50, 100).map((p, i) => ({ ...p, fecha: `2026-07-${String(i + 1).padStart(2, '0')}` }))
    const recientesBuenas = tanda(15, 100, 100)
    expect(sesgo([...viejasMalas, ...recientesBuenas])).toBe(0)
  })

  it('sin pruebas no hay sesgo que dar', () => {
    expect(sesgo([])).toBeNull()
  })
})

describe('estaCalibrado', () => {
  it('con pocos días todavía no, por bueno que sea el sesgo', () => {
    expect(estaCalibrado(tanda(20, 100, 100), DIAS_MINIMOS - 1)).toBe(false)
  })

  it('con pocas pruebas tampoco', () => {
    expect(estaCalibrado(tanda(PRUEBAS_MINIMAS - 1, 100, 100), 30)).toBe(false)
  })

  it('con días, pruebas y sesgo dentro del margen, sí', () => {
    expect(estaCalibrado(tanda(PRUEBAS_MINIMAS, 100, 100), DIAS_MINIMOS)).toBe(true)
  })

  it('el margen es de ±10 %, en los dos sentidos', () => {
    expect(estaCalibrado(tanda(15, 110, 100), 30)).toBe(true)
    expect(estaCalibrado(tanda(15, 90, 100), 30)).toBe(true)
    expect(estaCalibrado(tanda(15, 111, 100), 30)).toBe(false)
    expect(estaCalibrado(tanda(15, 89, 100), 30)).toBe(false)
  })
})

describe('peoresAlimentos', () => {
  it('ordena por lo mal que se estima cada uno', () => {
    const pruebas = [
      ...tanda(3, 100, 100, 'arroz'),
      ...tanda(3, 150, 100, 'aceite'),
      ...tanda(3, 120, 100, 'pollo'),
    ]
    expect(peoresAlimentos(pruebas, 2)).toEqual(['aceite', 'pollo'])
  })

  it('el signo no importa: quedarse corto también es estimar mal', () => {
    const pruebas = [...tanda(3, 50, 100, 'aceite'), ...tanda(3, 105, 100, 'arroz')]
    expect(peoresAlimentos(pruebas, 1)).toEqual(['aceite'])
  })

  it('usa el histórico completo, no la ventana de quince', () => {
    // La dificultad de un alimento es del alimento, no de cuánto haya mejorado
    // la persona. Y con solo quince pruebas repartidas, la mediana por alimento
    // se quedaría sin muestras.
    const muchas = [...tanda(20, 200, 100, 'aceite'), ...tanda(20, 100, 100, 'arroz')]
    expect(peoresAlimentos(muchas, 1)).toEqual(['aceite'])
  })

  it('sin pruebas no hay ranking', () => {
    expect(peoresAlimentos([])).toEqual([])
  })
})

describe('queDebePesar', () => {
  it('mientras aprende, todo', () => {
    expect(queDebePesar(tanda(3, 100, 100), 5)).toBe('todo')
  })

  it('cuando calibra, nada', () => {
    expect(queDebePesar(tanda(15, 100, 100), 15)).toBe('nada')
  })

  it('pasadas cuatro semanas sin calibrar, solo sus peores', () => {
    // Castigarle con la báscula entera es como se pierde la adherencia.
    const malas = [...tanda(20, 200, 100, 'aceite'), ...tanda(20, 180, 100, 'arroz')]
    const resultado = queDebePesar(malas, 29)
    expect(resultado).not.toBe('todo')
    expect(resultado).not.toBe('nada')
    expect((resultado as { peores: string[] }).peores.length).toBeGreaterThan(0)
  })

  it('el tope de cuatro semanas se comprueba de verdad', () => {
    // Antes era un número declarado que ninguna función miraba. Un límite que
    // no se comprueba no es un límite.
    const malas = tanda(20, 200, 100)
    expect(queDebePesar(malas, 28)).toBe('todo')
    expect(queDebePesar(malas, 29)).not.toBe('todo')
  })
})

describe('avanceDeCalibracion', () => {
  it('dice cuánto falta, para poder enseñárselo', () => {
    const avance = avanceDeCalibracion(tanda(6, 100, 100), 4)
    expect(avance.pruebasQueFaltan).toBe(PRUEBAS_MINIMAS - 6)
    expect(avance.diasQueFaltan).toBe(DIAS_MINIMOS - 4)
    expect(avance.calibrado).toBe(false)
  })

  it('cuando ya está, no falta nada', () => {
    const avance = avanceDeCalibracion(tanda(15, 100, 100), 12)
    expect(avance.pruebasQueFaltan).toBe(0)
    expect(avance.diasQueFaltan).toBe(0)
    expect(avance.calibrado).toBe(true)
  })
})

describe('debeVolverAPesar', () => {
  it('si el peso no se movió ni la mitad de lo previsto, sí', () => {
    expect(debeVolverAPesar(-1.5, -0.5)).toBe(true)
  })

  it('si se movió lo esperado, no', () => {
    expect(debeVolverAPesar(-1.5, -1.4)).toBe(false)
  })

  it('bajar MÁS de lo previsto no dispara esto', () => {
    // Eso es un déficit excesivo, y lo vigila la disponibilidad energética.
    expect(debeVolverAPesar(-1, -2)).toBe(false)
  })

  it('moverse en la dirección contraria sí', () => {
    expect(debeVolverAPesar(-1.5, 0.8)).toBe(true)
  })

  it('sin previsión no hay nada que comparar', () => {
    expect(debeVolverAPesar(0, -1)).toBe(false)
  })

  it('un dato no finito revienta', () => {
    expect(() => debeVolverAPesar(Number.NaN, -1)).toThrow()
  })
})
