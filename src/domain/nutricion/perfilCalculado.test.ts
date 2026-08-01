import { describe, expect, it } from 'vitest'
import { calcularPerfil, senalesDeLaEncuesta } from './perfilCalculado'
import type { Respuestas } from './encuesta'

const HOY = '2026-08-01'

/** Perfil inventado, con la forma de uno real. */
const COMPLETO: Respuestas = {
  genero: 'M',
  fechaNacimiento: '2004-05-06',
  pesoKg: 56,
  alturaCm: 170,
  cuelloCm: 32,
  cinturaCm: 68,
  caderaCm: 99,
  pasosDiarios: 9000,
  diasEntreno: 5,
}

describe('calcularPerfil', () => {
  it('calcula las cifras que el Python da para las mismas medidas', () => {
    const perfil = calcularPerfil(COMPLETO, HOY)
    expect(perfil.grasaPct).toBe(24.6)
    expect(perfil.masaMagraKg).toBe(42.22)
    expect(perfil.imc).toBe(19.4)
    expect(perfil.tmb).toBe(1352)
    expect(perfil.factorActividad).toBe(1.38)
    expect(perfil.tdee).toBe(1866)
  })

  it('en mujeres sube la proteína a 1,9 g/kg', () => {
    // Es donde más masa magra hay que proteger, y el criterio que ya usa el
    // Cerebro.
    expect(calcularPerfil(COMPLETO, HOY).macros?.proteinaG).toBe(106)
  })

  it('en hombres la deja en 1,6', () => {
    const hombre = { ...COMPLETO, genero: 'H', caderaCm: undefined }
    expect(calcularPerfil(hombre, HOY).macros?.proteinaG).toBe(90)
  })

  describe('cuando faltan datos', () => {
    it('no inventa ninguna cifra', () => {
      const perfil = calcularPerfil({ genero: 'M', pesoKg: 56 }, HOY)
      expect(perfil.grasaPct).toBeNull()
      expect(perfil.tmb).toBeNull()
      expect(perfil.macros).toBeNull()
    })

    it('dice qué faltó, en vez de dejar huecos sin explicar', () => {
      const perfil = calcularPerfil({ genero: 'M', pesoKg: 56 }, HOY)
      expect(perfil.incompleto).toContain('composición corporal')
      expect(perfil.incompleto).toContain('metabolismo basal')
    })

    it('lo que sí se puede calcular, se calcula', () => {
      // Sin perímetros no hay grasa, pero el gasto diario sale igual.
      const sinPerimetros = { ...COMPLETO, cuelloCm: undefined }
      const perfil = calcularPerfil(sinPerimetros, HOY)
      expect(perfil.grasaPct).toBeNull()
      expect(perfil.tdee).toBe(1866)
    })

    it('con todo respondido no falta nada', () => {
      expect(calcularPerfil(COMPLETO, HOY).incompleto).toEqual([])
    })
  })

  describe('la disponibilidad energética', () => {
    it('no se calcula sin saber lo que comió', () => {
      // Es la única cifra que necesita el registro, no la encuesta.
      expect(calcularPerfil(COMPLETO, HOY).energia).toBeNull()
    })

    it('con la ingesta del día sí, y con su veredicto', () => {
      const perfil = calcularPerfil(COMPLETO, HOY, {
        ingestaKcal: 1800,
        gastoEjercicioKcal: 400,
      })
      expect(perfil.energia?.disponibilidad).toBe(33.2)
      expect(perfil.energia?.estado).toBe('bien')
    })

    it('marca problema por debajo del umbral de mujeres', () => {
      const perfil = calcularPerfil(COMPLETO, HOY, {
        ingestaKcal: 1400,
        gastoEjercicioKcal: 400,
      })
      expect(perfil.energia?.estado).toBe('problema')
    })
  })

  it('el género mal escrito NO produce cifras: rechaza en vez de castear', () => {
    // Aplicaría la fórmula equivocada y daría un porcentaje creíble pero falso.
    const perfil = calcularPerfil({ ...COMPLETO, genero: 'Femenino' }, HOY)
    expect(perfil.grasaPct).toBeNull()
    expect(perfil.tmb).toBeNull()
  })
})

describe('senalesDeLaEncuesta', () => {
  it('un ciclo irregular pide que alguien lo mire', () => {
    expect(senalesDeLaEncuesta({ cicloMenstrual: 'irregular' }).cicloAlterado).toBe(true)
  })

  it('un ciclo ausente también', () => {
    expect(senalesDeLaEncuesta({ cicloMenstrual: 'ausente' }).cicloAlterado).toBe(true)
  })

  it('uno regular no', () => {
    expect(senalesDeLaEncuesta({ cicloMenstrual: 'regular' }).cicloAlterado).toBe(false)
  })

  it('la anticoncepción hormonal tampoco: explica el ciclo, no lo alerta', () => {
    expect(
      senalesDeLaEncuesta({ cicloMenstrual: 'anticoncepcion_hormonal' }).cicloAlterado,
    ).toBe(false)
  })

  it('a quien no se le preguntó, ninguna señal', () => {
    expect(senalesDeLaEncuesta({ genero: 'H' }).cicloAlterado).toBe(false)
  })
})
