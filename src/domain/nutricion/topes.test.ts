import { describe, expect, it } from 'vitest'
import {
  TOPE_COMIDA_KCAL,
  TOPE_DIA_KCAL,
  TOPE_KCAL_100G,
  TOPE_REGISTRO_KCAL,
  revisarDia,
  revisarItem,
} from './topes'

// El tope del registro va en CALORÍAS, no en gramos, y estos tests fijan por
// qué: un tope en gramos marcaría 1,5 L de agua y 1.500 g de sandía, que son
// consumos normales, y eso enseña a ignorar las alertas.

describe('energía imposible', () => {
  it('muy por encima del tope bloquea', () => {
    const avisos = revisarItem({ kcal: 1200.0 }, 10)
    expect(avisos.some((a) => a.bloquea)).toBe(true)
  })

  it('el aceite normal no bloquea', () => {
    // 884 kcal/100 g es real y tiene que pasar.
    const avisos = revisarItem({ kcal: 884.0 }, 14)
    expect(avisos.some((a) => a.bloquea)).toBe(false)
  })

  it('el alimento más calórico del catálogo real no bloquea', () => {
    // La comprobación que de verdad importa. El tope se fijó mirando el
    // catálogo real de 1.195 alimentos (herramientas/base-alimentos/, fuera
    // de este repo: app/ es un repositorio aparte, así que aquí se usa el
    // valor ya documentado en topes.py en vez de leer ese archivo). El peor
    // caso real es el omega 3 en cápsula (aceite de pescado): 902 kcal/100 g.
    // Con el tope viejo (900, estricto) esto bloqueaba un alimento
    // verificado de la USDA.
    const kcalMaxima = 902.0
    const avisos = revisarItem({ kcal: kcalMaxima }, 10)
    expect(avisos.some((a) => a.bloquea)).toBe(false)
  })
})

describe('tope del registro', () => {
  it('el cero de más en el arroz avisa', () => {
    // 1.500 g de arroz cocido son 1.950 kcal: el caso que motiva el tope.
    const avisos = revisarItem({ kcal: 130.0 }, 1500)
    expect(avisos.length).toBeGreaterThan(0)
    expect(avisos.some((a) => a.bloquea)).toBe(false)
  })

  it('UN LITRO Y MEDIO DE AGUA NO AVISA', () => {
    // El caso que rompía el tope en gramos. Es un termo normal.
    expect(revisarItem({ kcal: 0.0 }, 1500)).toEqual([])
  })

  it('MIL QUINIENTOS GRAMOS DE SANDÍA NO AVISAN', () => {
    // 450 kcal. Un domingo en familia, no un error.
    expect(revisarItem({ kcal: 30.0 }, 1500)).toEqual([])
  })

  it('doscientos gramos de aceite avisan', () => {
    // 1.768 kcal en un solo registro: nadie se come eso.
    expect(revisarItem({ kcal: 884.0 }, 200)).not.toEqual([])
  })

  it('medio kilo de carne no avisa', () => {
    // ~1.000 kcal. Mucho, pero real.
    expect(revisarItem({ kcal: 200.0 }, 500)).toEqual([])
  })
})

describe('topes del día', () => {
  it('una comida pasada de 2500 avisa', () => {
    const avisos = revisarDia([3000.0], 3000.0)
    expect(avisos.some((a) => a.mensaje.includes('comida'))).toBe(true)
  })

  it('un día pasado de 6000 avisa', () => {
    const avisos = revisarDia([2000.0, 2000.0, 2000.0, 2000.0], 8000.0)
    expect(avisos.some((a) => a.mensaje.includes('día'))).toBe(true)
  })

  it('el aviso del día comunica que es mucho', () => {
    // Antes decía solo "el día suma X kcal": un número, sin decir que hay
    // que prestarle atención. Lo lee un asesorado, no un programador, y los
    // otros tres avisos sí comunican preocupación ("es imposible",
    // "¿Seguro?", "es mucho"). Este tiene que hacer lo mismo.
    const avisos = revisarDia([600.0], 6001.0)
    const avisoDia = avisos.find((a) => a.mensaje.includes('día'))!
    expect(avisoDia.mensaje).toContain('mucho')
  })

  it('un día normal no avisa', () => {
    expect(revisarDia([600.0, 800.0, 700.0], 2100.0)).toEqual([])
  })

  it('ningún tope del día bloquea', () => {
    // Registrar nunca se bloquea (R2). Solo la energía imposible lo hace,
    // porque ahí el dato es seguro que está mal.
    const avisos = revisarDia([9000.0], 9000.0)
    expect(avisos.some((a) => a.bloquea)).toBe(false)
  })
})

describe('valores', () => {
  it('los cuatro topes son los aprobados', () => {
    expect(TOPE_KCAL_100G).toBe(950.0)
    expect(TOPE_REGISTRO_KCAL).toBe(1500.0)
    expect(TOPE_COMIDA_KCAL).toBe(2500.0)
    expect(TOPE_DIA_KCAL).toBe(6000.0)
  })
})

describe('fronteras de los topes', () => {
  // El bloque de "valores" solo fija el NÚMERO de cada tope. Estas pruebas
  // fijan que ese número de verdad se usa en la comparación -y que la
  // frontera es estricta (>), no inclusiva (>=)-: justo en el tope no avisa,
  // un poco más allá sí.

  it('novecientas cincuenta kcal exactas no bloquean', () => {
    expect(revisarItem({ kcal: 950.0 }, 10)).toEqual([])
  })

  it('novecientas cincuenta y una kcal bloquean', () => {
    const avisos = revisarItem({ kcal: 951.0 }, 10)
    expect(avisos.some((a) => a.bloquea)).toBe(true)
  })

  it('mil quinientas kcal exactas en el registro no avisan', () => {
    // 150 kcal/100 g x 1000 g = 1500 kcal clavado.
    expect(revisarItem({ kcal: 150.0 }, 1000)).toEqual([])
  })

  it('una kcal más en el registro avisa', () => {
    const avisos = revisarItem({ kcal: 150.0 }, 1001)
    expect(avisos.length).toBeGreaterThan(0)
    expect(avisos.some((a) => a.bloquea)).toBe(false)
  })

  it('dos mil quinientas kcal exactas en una comida no avisan', () => {
    expect(revisarDia([2500.0], 2500.0)).toEqual([])
  })

  it('una kcal más en la comida avisa', () => {
    const avisos = revisarDia([2501.0], 2501.0)
    expect(avisos.some((a) => a.mensaje.includes('comida'))).toBe(true)
  })

  it('seis mil kcal exactas en el día no avisan', () => {
    expect(revisarDia([600.0], 6000.0)).toEqual([])
  })

  it('una kcal más en el día avisa', () => {
    const avisos = revisarDia([600.0], 6001.0)
    expect(avisos.some((a) => a.mensaje.includes('día'))).toBe(true)
  })
})

describe('ramas sin probar', () => {
  // Ramas que el plan original ejercita como mucho una vez, así que un
  // cambio ahí puede colarse sin que ningún test se queje.

  it('cada comida pasada de tope suma su propio aviso', () => {
    // Si el bucle se cambiara por "avisa una vez y para", este caso no lo
    // notaría el resto de tests.
    const avisos = revisarDia([3000.0, 2600.0], 5600.0)
    const avisosDeComida = avisos.filter((a) => a.mensaje.includes('comida'))
    expect(avisosDeComida.length).toBe(2)
  })

  it('kcal_dia no se recalcula sumando las comidas', () => {
    // Las comidas suman 200 kcal -ningún aviso por comida-, pero kcalDia
    // llega aparte en 6500. Si la función ignorara el parámetro y sumara la
    // lista por su cuenta, este aviso no saldría nunca.
    const avisos = revisarDia([100.0, 100.0], 6500.0)
    expect(avisos.some((a) => a.mensaje.includes('día'))).toBe(true)
  })

  it('el aviso que bloquea no corta el del registro', () => {
    // revisarItem no vuelve después de marcar bloquea=true: si alguien le
    // mete un return ahí, este caso pierde el segundo aviso.
    const avisos = revisarItem({ kcal: 1200.0 }, 200)
    expect(avisos.length).toBe(2)
    expect(avisos.some((a) => a.bloquea)).toBe(true)
    expect(avisos.some((a) => !a.bloquea)).toBe(true)
  })
})

describe('entradas inválidas', () => {
  // Todo revienta, incluido por100g=null: a propósito distinto de
  // porcion.ts, donde el mismo caso revienta solo, por un TypeError natural,
  // porque ese módulo no promete otra cosa. Aquí sí se promete reventar de
  // punta a punta (ver docstring del módulo), así que null se valida
  // explícito en vez de dejarlo chocar contra el acceso a la propiedad.

  it('por100g null revienta', () => {
    expect(() => revisarItem(null, 1500)).toThrow()
  })

  it('por100g sin kcal revienta', () => {
    expect(() => revisarItem({}, 1500)).toThrow()
  })

  it('gramos negativos revienta', () => {
    expect(() => revisarItem({ kcal: 130.0 }, -1500)).toThrow()
  })

  it('gramos no finitos revientan', () => {
    // NaN e Infinity pasan "gramos < 0" sin problema (la comparación da
    // false para los dos). El caso de NaN es el más peligroso: NaN contra
    // cualquier tope también da false, así que sin esta validación el
    // chequeo se apagaría solo frente al dato más corrupto posible.
    expect(() => revisarItem({ kcal: 130.0 }, NaN)).toThrow()
    expect(() => revisarItem({ kcal: 130.0 }, Infinity)).toThrow()
  })

  it('kcal_100g no finito revienta', () => {
    // La mitad de "kcal100g > TOPE_KCAL_100G" que no se estaba validando:
    // NaN contra el tope también da false, así que sin esto el chequeo se
    // apaga solo frente al dato más corrupto posible (el propio kcal, no
    // los gramos).
    expect(() => revisarItem({ kcal: NaN }, 100)).toThrow()
    expect(() => revisarItem({ kcal: Infinity }, 100)).toThrow()
  })

  it('kcal_100g negativo revienta', () => {
    expect(() => revisarItem({ kcal: -500.0 }, 100)).toThrow()
    expect(() => revisarItem({ kcal: -999999.0 }, 100)).toThrow()
  })
})

describe('entradas inválidas en revisarDia', () => {
  // El docstring del módulo promete que las entradas inválidas revientan
  // como principio DEL MÓDULO, no solo de revisarItem. Antes revisarDia no
  // validaba nada: revisarDia([NaN], NaN) devolvía [] en silencio, y
  // revisarDia([Infinity], Infinity) solo se cazaba de pura casualidad
  // -porque Infinity supera cualquier tope, no porque hubiera validación-.

  it('kcal_por_comida no finito revienta', () => {
    expect(() => revisarDia([NaN], 100.0)).toThrow()
    expect(() => revisarDia([Infinity], 100.0)).toThrow()
  })

  it('kcal_por_comida negativo revienta', () => {
    expect(() => revisarDia([-100.0], 100.0)).toThrow()
  })

  it('kcal_dia no finito revienta', () => {
    expect(() => revisarDia([600.0], NaN)).toThrow()
    expect(() => revisarDia([600.0], Infinity)).toThrow()
  })

  it('kcal_dia negativo revienta', () => {
    expect(() => revisarDia([600.0], -100.0)).toThrow()
  })
})
