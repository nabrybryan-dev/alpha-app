import { describe, expect, it } from 'vitest'
import {
  edadA,
  factorActividad,
  katchMcArdle,
  objetivoInsuficiente,
  redondearExcel,
  repartirMacros,
  tdee,
  tmbCombinada,
  tmb,
} from './energia'

/**
 * Las cifras esperadas salen de correr
 * `herramientas/inventario-nutricion/parametros.py` sobre los mismos datos: lo
 * que calcule la app y lo que calcule el coach en su Excel tienen que dar lo
 * mismo, o cada uno defendería su número con el asesorado en medio.
 */

describe('redondearExcel', () => {
  it('la mitad va hacia arriba', () => {
    expect(redondearExcel(1352.5)).toBe(1353)
  })

  it('también en negativos, alejándose del cero', () => {
    // Aquí es donde Math.round de JavaScript se separa: daría -1352.
    expect(redondearExcel(-1352.5)).toBe(-1353)
  })

  it('no toca lo que ya es entero', () => {
    expect(redondearExcel(1352)).toBe(1352)
  })
})

describe('tmb', () => {
  it('coincide con el Python en una mujer', () => {
    expect(tmb(56, 170, 22, 'M')).toBe(1352)
  })

  it('coincide en un hombre', () => {
    expect(tmb(80, 178, 30, 'H')).toBe(1768)
  })

  it('el ajuste de género son 166 kcal de diferencia', () => {
    // +5 en hombres, -161 en mujeres. Si alguien lo tocara, esto lo caza.
    const h = tmb(70, 175, 30, 'H') ?? 0
    const m = tmb(70, 175, 30, 'M') ?? 0
    expect(h - m).toBe(166)
  })

  it('sin un dato no hay TMB: de ella cuelga todo lo demás', () => {
    expect(tmb(null, 170, 22, 'M')).toBeNull()
    expect(tmb(56, 170, 22, null)).toBeNull()
  })
})

describe('factorActividad', () => {
  it('sedentario sin entrenar', () => {
    expect(factorActividad(4000, 0)).toBe(1.2)
  })

  it('los escalones de la tabla real', () => {
    expect(factorActividad(8000, 1)).toBe(1.38)
    expect(factorActividad(11000, 3)).toBe(1.55)
    expect(factorActividad(15000, 6)).toBe(1.73)
    expect(factorActividad(21000, 10)).toBe(1.9)
  })

  it('hacen falta LOS DOS criterios para subir de escalón', () => {
    // Entrenar seis días caminando 3.000 pasos no gasta como entrenar seis
    // caminando 15.000: el NEAT es la mayor parte de esa diferencia.
    expect(factorActividad(3000, 6)).toBe(1.2)
    expect(factorActividad(15000, 0)).toBe(1.2)
  })

  it('sin pasos no hay factor: es el dato que más mueve el resultado', () => {
    expect(factorActividad(null, 5)).toBeNull()
  })
})

describe('tdee', () => {
  it('es la TMB por el factor', () => {
    expect(tdee(1352, 1.38)).toBe(1866)
    expect(tdee(1352, 1.55)).toBe(2096)
  })

  it('230 kcal separan dos escalones de pasos en la misma persona', () => {
    // La razón por la que los pasos se preguntan y no se suponen.
    expect((tdee(1352, 1.55) ?? 0) - (tdee(1352, 1.38) ?? 0)).toBe(230)
  })

  it('sin factor no hay gasto', () => {
    expect(tdee(1352, null)).toBeNull()
  })
})

describe('repartirMacros', () => {
  it('fija la proteína en 1,6 g/kg', () => {
    expect(repartirMacros(2100, 70)?.proteinaG).toBe(112)
  })

  it('la sube a 1,9 cuando se pide', () => {
    expect(repartirMacros(2100, 70, { proteinaAlta: true })?.proteinaG).toBe(133)
  })

  it('nunca baja la grasa del piso hormonal', () => {
    // Aunque se pida menos: 0,8 g/kg es un suelo, no una sugerencia.
    expect(repartirMacros(2100, 70, { grasaGKg: 0.2 })?.grasaG).toBe(56)
  })

  it('el carbohidrato es el resto', () => {
    const macros = repartirMacros(2100, 70)
    if (!macros) throw new Error('debería repartir')
    const suma = macros.proteinaG * 4 + macros.carbosG * 4 + macros.grasaG * 9
    expect(Math.abs(suma - 2100)).toBeLessThanOrEqual(4)
  })

  it('con pocas calorías el carbo cae a cero, pero proteína y grasa aguantan', () => {
    // No se recorta ninguno de los dos para dejarle sitio al carbo: si el
    // objetivo no alcanza, el que sobra es el objetivo.
    const macros = repartirMacros(900, 70)
    expect(macros?.carbosG).toBe(0)
    expect(macros?.proteinaG).toBe(112)
    expect(macros?.grasaG).toBe(70)
  })

  it('un objetivo imposible se marca en vez de disimularse', () => {
    // 112 g de proteína + 70 g de grasa ya son 1.078 kcal: no caben en 900.
    const macros = repartirMacros(900, 70)
    if (!macros) throw new Error('debería repartir')
    expect(objetivoInsuficiente(macros)).toBe(true)
  })

  it('el redondeo de los gramos NO cuenta como objetivo imposible', () => {
    // Un reparto normal se pasa un par de kcal del objetivo al redondear al
    // gramo entero. Eso es aritmética, no un plan que no se sostiene.
    const macros = repartirMacros(2100, 70)
    if (!macros) throw new Error('debería repartir')
    const suma = macros.proteinaG * 4 + macros.carbosG * 4 + macros.grasaG * 9
    expect(suma).toBeGreaterThan(macros.kcal)
    expect(objetivoInsuficiente(macros)).toBe(false)
  })

  it('un objetivo normal no salta la alarma', () => {
    const macros = repartirMacros(2100, 70)
    if (!macros) throw new Error('debería repartir')
    expect(objetivoInsuficiente(macros)).toBe(false)
  })

  it('sin peso o sin calorías no reparte nada', () => {
    expect(repartirMacros(0, 70)).toBeNull()
    expect(repartirMacros(2100, 0)).toBeNull()
  })
})

describe('edadA', () => {
  it('cuenta años cumplidos', () => {
    expect(edadA('2004-05-06', '2026-07-31')).toBe(22)
  })

  it('el día antes del cumpleaños todavía no cuenta', () => {
    expect(edadA('2004-08-01', '2026-07-31')).toBe(21)
  })

  it('el mismo día del cumpleaños sí', () => {
    expect(edadA('2004-07-31', '2026-07-31')).toBe(22)
  })

  it('una fecha imposible no da una edad', () => {
    expect(edadA('2040-01-01', '2026-07-31')).toBeNull()
  })
})

describe('katchMcArdle', () => {
  it('370 + 21,6 x masa libre de grasa, como la fuente', () => {
    // 370 + 21,6 x 42,22 = 1.281,95
    expect(katchMcArdle(42.22)).toBe(1282)
  })

  // Es toda la diferencia con Mifflin: esta fórmula no sabe de peso, altura ni
  // edad, solo de cuánto músculo hay que mantener.
  it('la misma masa magra da la misma cifra, pese al resto', () => {
    expect(katchMcArdle(50)).toBe(katchMcArdle(50))
  })

  describe('cuando el dato no da', () => {
    it('sin masa magra devuelve null: sin % de grasa no hay fórmula', () => {
      expect(katchMcArdle(null)).toBeNull()
    })

    it('una masa magra de cero o negativa no es una persona', () => {
      expect(katchMcArdle(0)).toBeNull()
      expect(katchMcArdle(-10)).toBeNull()
    })
  })
})

describe('tmbCombinada', () => {
  /**
   * El caso conocido del repo: mujer, 56 kg, 170 cm, 22 años, 42,22 kg de masa
   * magra. Mifflin sola daba 1.352; Katch da 1.282; el promedio, 1.317.
   */
  it('promedia las dos fórmulas cuando se conoce la masa magra', () => {
    expect(tmbCombinada(56, 170, 22, 'M', 42.22)).toBe(1317)
  })

  it('queda entre las dos, nunca fuera', () => {
    const mifflin = tmb(56, 170, 22, 'M') as number
    const katch = katchMcArdle(42.22) as number
    const combinada = tmbCombinada(56, 170, 22, 'M', 42.22) as number
    expect(combinada).toBeGreaterThanOrEqual(Math.min(mifflin, katch))
    expect(combinada).toBeLessThanOrEqual(Math.max(mifflin, katch))
  })

  /**
   * Sin % de grasa NO se promedia con cero: eso hundiría la TMB a la mitad y
   * pautaría un déficit brutal a quien solo dejó una medida sin tomar.
   */
  it('sin masa magra cae a Mifflin sola, no a un promedio con cero', () => {
    expect(tmbCombinada(56, 170, 22, 'M', null)).toBe(tmb(56, 170, 22, 'M'))
    expect(tmbCombinada(56, 170, 22, 'M', null)).toBe(1352)
  })

  it('si no hay ni Mifflin, no hay nada que promediar', () => {
    expect(tmbCombinada(null, 170, 22, 'M', 42.22)).toBeNull()
    expect(tmbCombinada(56, 170, 22, null, 42.22)).toBeNull()
  })
})
