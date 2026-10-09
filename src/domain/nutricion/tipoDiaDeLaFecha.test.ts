import { describe, expect, it } from 'vitest'
import type { PlanNutricional } from '../types'
import { etiquetaDelTipoDeDia, tipoDiaDeLaFecha } from './tipoDiaDeLaFecha'

/** La forma real del plan que destapó el fallo: nombres con el día entero, etiquetas con sigla. */
const PLAN = {
  etiquetasDia: { ALTO: 'DÍA ALTO · L · Ma · Mi · V', BAJO: 'DÍA BAJO · J · Sá', CHEAT: 'REFEED · DOMINGO' },
  menus: [
    { tipoDia: 'ALTO', nombre: 'Día ALTO · lunes · martes · miércoles · viernes', comidas: [] },
    { tipoDia: 'BAJO', nombre: 'Día BAJO · jueves y sábado', comidas: [] },
    { tipoDia: 'CHEAT', nombre: 'REFEED · domingo (mantenimiento)', comidas: [] },
  ],
} as unknown as PlanNutricional

describe('tipoDiaDeLaFecha', () => {
  it('cada día de la semana cae en el menú que lo nombra', () => {
    // Semana del lunes 5 al domingo 11 de octubre de 2026.
    expect(
      ['05', '06', '07', '08', '09', '10', '11'].map((d) => tipoDiaDeLaFecha(PLAN, `2026-10-${d}`)),
    ).toEqual(['ALTO', 'ALTO', 'ALTO', 'BAJO', 'ALTO', 'BAJO', 'CHEAT'])
  })

  it('sin nombres de día en los menús, lee las siglas de las etiquetas', () => {
    const soloEtiquetas = {
      ...PLAN,
      menus: PLAN.menus.map((m) => ({ ...m, nombre: `Menú ${m.tipoDia}` })),
    } as PlanNutricional
    expect(tipoDiaDeLaFecha(soloEtiquetas, '2026-10-08')).toBe('BAJO') // jueves: «J»
    expect(tipoDiaDeLaFecha(soloEtiquetas, '2026-10-10')).toBe('BAJO') // sábado: «Sá»
    expect(tipoDiaDeLaFecha(soloEtiquetas, '2026-10-06')).toBe('ALTO') // martes: «Ma», no «Mi»
    expect(tipoDiaDeLaFecha(soloEtiquetas, '2026-10-11')).toBe('CHEAT') // «DOMINGO» entero
  })

  it('si el plan no dice nada de ese día, o lo dicen dos menús, se queda en ALTO como antes', () => {
    const mudo = { ...PLAN, etiquetasDia: undefined, menus: PLAN.menus.map((m) => ({ ...m, nombre: 'Menú' })) }
    expect(tipoDiaDeLaFecha(mudo as unknown as PlanNutricional, '2026-10-08')).toBe('ALTO')
    const doble = {
      ...PLAN,
      menus: [
        { tipoDia: 'BAJO', nombre: 'jueves', comidas: [] },
        { tipoDia: 'CHEAT', nombre: 'jueves libre', comidas: [] },
      ],
    }
    expect(tipoDiaDeLaFecha(doble as unknown as PlanNutricional, '2026-10-08')).toBe('ALTO')
    expect(tipoDiaDeLaFecha(undefined, '2026-10-08')).toBe('ALTO')
    expect(tipoDiaDeLaFecha(PLAN, 'no-es-fecha')).toBe('ALTO')
  })
})

describe('etiquetaDelTipoDeDia', () => {
  it('no repite «día» cuando la etiqueta ya lo trae', () => {
    expect(etiquetaDelTipoDeDia(PLAN, 'ALTO')).toBe('DÍA ALTO · L · Ma · Mi · V')
    expect(etiquetaDelTipoDeDia(PLAN, 'CHEAT')).toBe('Día REFEED · DOMINGO')
    expect(etiquetaDelTipoDeDia(undefined, 'BAJO')).toBe('Día BAJO')
  })
})
