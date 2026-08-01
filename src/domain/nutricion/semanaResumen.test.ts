import { describe, expect, it } from 'vitest'
import { resumenDeSemana } from './semanaResumen'
import type { AlimentoIndice } from './busqueda'
import type { RegistroComida } from '../types'

const ARROZ: AlimentoIndice = {
  id: 'arroz',
  nombre: 'Arroz blanco, cocido',
  grupo: 'carbohidratos',
  estado: 'cocido',
  confianza: 'verificado',
  fuente: 'tcac',
  por100g: { kcal: 130, proteina_g: 2.4, carbos_g: 28, grasa_g: 0.3 },
}

const porId = (id: string) => (id === 'arroz' ? ARROZ : undefined)

const comida = (fecha: string, gramos: number): RegistroComida => ({
  id: `c-${fecha}-${gramos}`,
  usuarioId: 'u-1',
  momentoIso: `${fecha}T13:00:00`,
  comida: 'almuerzo',
  cocinadoPorEl: true,
  aceiteG: null,
  salG: null,
  confianza: 'pesado',
  items: [{ id: `it-${gramos}`, alimentoId: 'arroz', gramos, fuePesado: true, estadoAsumido: 'cocido' }],
})

const vacia = (fecha: string): RegistroComida => ({ ...comida(fecha, 0), items: [] })

const FECHAS = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
]

const semanaCon = (porDia: RegistroComida[][]) => resumenDeSemana(porDia, FECHAS, porId, 2100)

describe('resumenDeSemana', () => {
  it('devuelve los siete días con su fecha', () => {
    const resumen = semanaCon(FECHAS.map(() => []))
    expect(resumen.dias.map((d) => d.fecha)).toEqual(FECHAS)
  })

  it('suma las calorías de cada día', () => {
    const resumen = semanaCon([[comida(FECHAS[0], 1000)], [], [], [], [], [], []])
    expect(resumen.dias[0].kcal).toBe(1300)
  })

  describe('el promedio', () => {
    it('un día en blanco NO cuenta como un día de cero calorías', () => {
      // Es la distinción que más importa de este módulo: "no cumplió" y "no
      // registró" piden decisiones opuestas.
      const resumen = semanaCon([[comida(FECHAS[0], 1000)], [], [], [], [], [], []])
      expect(resumen.promedioKcal).toBe(1300)
    })

    it('promedia solo los días con algo anotado', () => {
      const resumen = semanaCon([
        [comida(FECHAS[0], 1000)],
        [comida(FECHAS[1], 2000)],
        [],
        [],
        [],
        [],
        [],
      ])
      // (1300 + 2600) / 2, no /7.
      expect(resumen.promedioKcal).toBe(1950)
    })

    it('una comida abierta pero vacía tampoco cuenta como día registrado', () => {
      const resumen = semanaCon([[vacia(FECHAS[0])], [], [], [], [], [], []])
      expect(resumen.diasRegistrados).toBe(0)
      expect(resumen.dias[0].registrado).toBe(false)
    })

    it('sin nada registrado, el promedio es cero y no revienta', () => {
      const resumen = semanaCon(FECHAS.map(() => []))
      expect(resumen.promedioKcal).toBe(0)
      expect(resumen.diasRegistrados).toBe(0)
    })
  })

  describe('contra la pauta', () => {
    it('marca cuánto se aleja del objetivo', () => {
      const resumen = semanaCon([[comida(FECHAS[0], 1000)], [], [], [], [], [], []])
      expect(resumen.contraPauta).toBe(1300 - 2100)
    })

    it('sin ningún día registrado NO inventa un déficit de la pauta entera', () => {
      // Con el promedio en 0, restar la pauta daría −2.100: un déficit brutal
      // que nadie ha tenido, solo por no haber anotado.
      expect(semanaCon(FECHAS.map(() => [])).contraPauta).toBe(0)
    })
  })

  it('cuenta las comidas con algo dentro', () => {
    const resumen = semanaCon([
      [comida(FECHAS[0], 100), vacia(FECHAS[0])],
      [comida(FECHAS[1], 100)],
      [],
      [],
      [],
      [],
      [],
    ])
    expect(resumen.comidasRegistradas).toBe(2)
  })

  it('promedia la proteína igual que las calorías', () => {
    const resumen = semanaCon([[comida(FECHAS[0], 1000)], [], [], [], [], [], []])
    expect(resumen.promedioProteinaG).toBe(24)
  })
})
