import { describe, expect, it } from 'vitest'
import type { Composicion } from './porcion'
import { MARGENES, rangoKcal, totalDelDia, type Confianza, type Item } from './dia'

// El asesorado ve el número; el motor ve el margen. Con un ±25 % no se debe
// tomar una decisión fina de déficit, y para eso el margen tiene que llegar
// arriba.

const ARROZ: Composicion = { kcal: 130.0, proteina_g: 2.7, vitamina_d_ug: null }
const POLLO: Composicion = { kcal: 165.0, proteina_g: 31.0, vitamina_d_ug: 0.2 }

/** Construye un Item con el mismo orden posicional que el `Item(...)` de Python. */
function item(por100g: Composicion, gramos: number, confianza: Confianza): Item {
  return { por100g, gramos, confianza }
}

describe('suma', () => {
  it('suma las calorías de los ítems', () => {
    const total = totalDelDia([item(ARROZ, 200, 'pesado'), item(POLLO, 100, 'pesado')])
    expect(total.porDia.kcal).toBeCloseTo(425.0, 1)
  })

  it('un día vacío no revienta', () => {
    expect(totalDelDia([]).porDia).toEqual({})
  })
})

describe('nulos parciales', () => {
  it('un nutriente sin medir en UN alimento marca el total como parcial', () => {
    // El arroz no trae vitamina D. El total de vitamina D del día es
    // incompleto, y decirlo es la diferencia entre un dato y una mentira.
    const total = totalDelDia([item(ARROZ, 200, 'pesado'), item(POLLO, 100, 'pesado')])
    expect(total.parciales.has('vitamina_d_ug')).toBe(true)
  })

  it('lo que todos traen no es parcial', () => {
    const total = totalDelDia([item(ARROZ, 200, 'pesado'), item(POLLO, 100, 'pesado')])
    expect(total.parciales.has('kcal')).toBe(false)
  })

  it('un parcial igual se suma con lo que hay', () => {
    // Se informa de que falta, pero no se tira lo que sí se sabe.
    const total = totalDelDia([item(ARROZ, 200, 'pesado'), item(POLLO, 100, 'pesado')])
    expect(total.porDia.vitamina_d_ug).toBeCloseTo(0.2, 2)
  })
})

describe('margen', () => {
  it('todo pesado da el margen más estrecho', () => {
    const total = totalDelDia([item(ARROZ, 200, 'pesado')])
    expect(total.margenPct).toBeCloseTo(MARGENES.pesado * 100, 1)
  })

  it('todo estimado sin calibrar da el más ancho', () => {
    const total = totalDelDia([item(ARROZ, 200, 'estimado')])
    expect(total.margenPct).toBeCloseTo(MARGENES.estimado * 100, 1)
  })

  it('el margen se pondera por las calorías que aporta cada ítem', () => {
    // Un ítem estimado que aporta poco no debe ensuciar un día bien pesado.
    const total = totalDelDia([item(POLLO, 500, 'pesado'), item(ARROZ, 10, 'estimado')])
    expect(total.margenPct).toBeLessThan(7.0)
  })

  it('lo que no cocinó él es lo más incierto', () => {
    expect(MARGENES.ajeno).toBeGreaterThan(MARGENES.estimado)
  })

  it('el rango encierra al total', () => {
    const total = totalDelDia([item(ARROZ, 200, 'estimado')])
    const [bajo, alto] = rangoKcal(total)
    expect(bajo).toBeLessThan(total.porDia.kcal)
    expect(alto).toBeGreaterThan(total.porDia.kcal)
  })
})

describe('valores aprobados', () => {
  it('los cuatro márgenes son los del spec', () => {
    expect(MARGENES.pesado).toBe(0.05)
    expect(MARGENES.estimado_calibrado).toBe(0.15)
    expect(MARGENES.estimado).toBe(0.25)
    expect(MARGENES.ajeno).toBe(0.3)
  })
})

describe('confianza inválida', () => {
  // Mismo patrón que unidades.opciones(): antes, un fallback en silencio
  // convertía cualquier valor no reconocido -una coletilla de más, un
  // "pesados" con esa "s"- en un margen de ±25 % en vez de reventar. El
  // fallo va hacia el lado prudente (el margen se ENSANCHA, nunca se
  // estrecha), así que nunca da un resultado escandaloso: solo desconfía de
  // datos buenos. Un asesorado que pesa todo con rigor recibiría en
  // silencio el trato de uno que estima a ojo.

  it('una confianza desconocida revienta en vez de caer a "estimado"', () => {
    expect(() => totalDelDia([item(ARROZ, 200, 'pesados' as Confianza)])).toThrow()
  })

  it('una confianza null también revienta', () => {
    expect(() => totalDelDia([item(ARROZ, 200, null as unknown as Confianza)])).toThrow()
  })
})

describe('rango_kcal: valores exactos', () => {
  // "el rango encierra al total" solo prueba una desigualdad. Confirmado
  // mutando a mano el divisor de rangoKcal (/100 por /10): la holgura queda
  // diez veces más ancha y esa desigualdad sigue en verde igual. Hacen falta
  // los valores exactos para proteger el divisor.

  it('la holgura es el margen_pct exacto, no solo un rango ancho', () => {
    const total = totalDelDia([item(ARROZ, 200, 'estimado')])
    expect(total.porDia.kcal).toBe(260.0)
    expect(total.margenPct).toBe(25.0)
    expect(rangoKcal(total)).toEqual([195.0, 325.0])
  })
})

describe('día solo agua', () => {
  // Ningún otro test usa un ítem con kcal 0.0: ARROZ y POLLO siempre aportan
  // kcal positiva, así que kcalTotal nunca llega a cero y la rama de
  // promedio plano nunca se ejecuta sin este bloque. Un día de solo agua es
  // real -1,5 L de agua son 0 kcal- y no es un caso raro.

  const AGUA: Composicion = { kcal: 0.0, sodio_mg: 2.0 }

  it('un solo ítem sin kcal no revienta', () => {
    const total = totalDelDia([item(AGUA, 1500, 'pesado')])
    expect(total.porDia.kcal).toBe(0.0)
    expect(total.margenPct).toBe(MARGENES.pesado * 100)
  })

  it('varios ítems sin kcal promedian plano por ítem, no por kcal', () => {
    // Sin kcal que pesar, se cae al promedio simple de las confianzas:
    // (pesado + ajeno) / 2 = (0.05 + 0.30) / 2 = 0.175 = 17.5 %.
    const total = totalDelDia([item(AGUA, 1000, 'pesado'), item(AGUA, 500, 'ajeno')])
    expect(total.porDia.kcal).toBe(0.0)
    expect(total.margenPct).toBeCloseTo(17.5, 1)
  })

  it('una confianza inválida en un día sin kcal también revienta', () => {
    // La rama del promedio plano usa margenDe() igual que la ponderada:
    // tiene que validar también, no solo la rama de kcal positiva.
    expect(() => totalDelDia([item(AGUA, 500, 'pesados' as Confianza)])).toThrow()
  })
})

describe('parciales entre varios ítems', () => {
  it('dos ítems con huecos DISTINTOS se unen los dos', () => {
    // El caso de arriba tiene el hueco en un solo lado (ARROZ); POLLO nunca
    // aporta ninguno. Mutar la unión de conjuntos por una asignación simple
    // habría pasado ese caso si el ítem sin huecos fuera el último de la
    // lista. Aquí cada ítem aporta un hueco DIFERENTE y hace falta la unión
    // real de los dos para pasar.
    const huevo: Composicion = { kcal: 155.0, proteina_g: 13.0, hierro_mg: null }
    const total = totalDelDia([item(ARROZ, 100, 'pesado'), item(huevo, 50, 'pesado')])
    expect(total.parciales).toEqual(new Set(['vitamina_d_ug', 'hierro_mg']))
  })

  it('el orden de los ítems no cambia los parciales', () => {
    const total = totalDelDia([item(POLLO, 100, 'pesado'), item(ARROZ, 200, 'pesado')])
    expect(total.parciales.has('vitamina_d_ug')).toBe(true)
  })
})

describe('día vacío completo', () => {
  // "un día vacío no revienta" solo mira porDia. Un día sin ítems no tiene
  // nada de qué desconfiar, así que margenPct=0 y parciales vacío son el
  // valor por defecto -pero nada lo fijaba hasta ahora.

  it('margen_pct y parciales también quedan vacíos', () => {
    const total = totalDelDia([])
    expect(total.margenPct).toBe(0.0)
    expect(total.parciales).toEqual(new Set())
  })
})

describe('por100g vacío', () => {
  it('un ítem sin ningún nutriente no revienta y no aporta nada', () => {
    // Un alimento sin ninguna clave medida es un dato anómalo, pero no tiene
    // por qué reventar: simplemente no tiene nada que sumar ni ningún hueco
    // que declarar (nutrientesAusentes también necesita una clave para
    // poder decir que esa clave falta).
    const total = totalDelDia([item({}, 200, 'pesado')])
    expect(total.porDia).toEqual({})
    expect(total.parciales).toEqual(new Set())
    expect(total.margenPct).toBe(MARGENES.pesado * 100)
  })

  it('mezclado con un ítem normal no lo ensucia', () => {
    const total = totalDelDia([item(ARROZ, 200, 'pesado'), item({}, 50, 'pesado')])
    expect(total.porDia.kcal).toBe(260.0)
  })
})

describe('validación heredada de porcion', () => {
  // dia.ts no vuelve a comprobar que `gramos` sea finito y no negativo:
  // escalar() ya lo hace, y es la primera línea del cuerpo del bucle en
  // totalDelDia(). Confirmado aquí en vez de solo asumido: si algún día
  // alguien "optimiza" totalDelDia() reemplazando la llamada a escalar()
  // por una cuenta propia, estos dos tests son los que se rompen.

  it('gramos NaN revienta, no un error silencioso', () => {
    expect(() => totalDelDia([item(ARROZ, NaN, 'pesado')])).toThrow()
  })

  it('gramos negativos revientan', () => {
    expect(() => totalDelDia([item(ARROZ, -5, 'pesado')])).toThrow()
  })
})
