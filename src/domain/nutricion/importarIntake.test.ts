import { describe, expect, it } from 'vitest'
import { importarIntake, type IntakeCrudo } from './importarIntake'
import { camposAPreguntar } from './encuesta'
import { calcularPerfil, senalesDeLaEncuesta } from './perfilCalculado'

/**
 * Perfil INVENTADO con la forma exacta del JSON que exporta el panel. Ningún
 * dato de ninguna persona real entra en los tests.
 */
const INTAKE: IntakeCrudo = {
  person: { id: 'per-1', name: 'Persona De Prueba' },
  client_intake: {
    status: 'completed',
    answers: {
      genero: 'Femenino',
      fecha_nacimiento: '2004-05-06',
      peso_actual_kg: 56,
      altura_cm: 170,
      medida_cuello_cm: 32,
      medida_cintura_natural_cm: 68,
      medida_cintura_ombligo_cm: 74,
      medida_cadera_cm: 99,
      dias_por_semana: 5,
      cocina_o_compra: 'Cocino la mayoría de mis comidas',
      solo_mujeres_ciclo: 'Regular',
      alergias_restricciones: 'No.',
      tca_historia: 'No',
    },
  },
}

const con = (cambios: Record<string, unknown>): IntakeCrudo => ({
  ...INTAKE,
  client_intake: {
    ...INTAKE.client_intake,
    answers: { ...INTAKE.client_intake?.answers, ...cambios },
  },
})

describe('importarIntake', () => {
  it('saca todo lo que las fórmulas necesitan', () => {
    const { respuestas } = importarIntake(INTAKE)
    expect(respuestas).toMatchObject({
      genero: 'M',
      fechaNacimiento: '2004-05-06',
      pesoKg: 56,
      alturaCm: 170,
      cuelloCm: 32,
      caderaCm: 99,
      diasEntreno: 5,
    })
  })

  it('con lo importado, las cifras ya salen', () => {
    const { respuestas } = importarIntake(INTAKE)
    const perfil = calcularPerfil({ ...respuestas, pasosDiarios: 9000 }, '2026-08-01')
    expect(perfil.grasaPct).toBe(24.6)
    expect(perfil.tdee).toBe(1866)
  })

  it('quedan DOS preguntas: las únicas que el intake no hace', () => {
    // Es el objetivo del importador: no volver a preguntar lo que ya contestó.
    // Los pasos y la báscula no están en la encuesta de captación.
    const { respuestas } = importarIntake(INTAKE)
    expect(camposAPreguntar(respuestas).filter((c) => c.obligatorio).map((c) => c.clave)).toEqual([
      'pasosDiarios',
      'tieneBascula',
    ])
  })

  it('y se declaran como pendientes en vez de suponerse', () => {
    // Suponer los pasos o la báscula falsearía una cifra que después se lee
    // como medida: 230 kcal la primera, el margen entero del registro la otra.
    expect(importarIntake(INTAKE).faltan).toEqual(['pasosDiarios', 'tieneBascula'])
  })

  describe('qué cintura se usa', () => {
    it('en mujeres, la natural: es la que pide la fórmula', () => {
      expect(importarIntake(INTAKE).respuestas.cinturaCm).toBe(68)
    })

    it('en hombres, la del ombligo', () => {
      const hombre = importarIntake(con({ genero: 'Masculino' }))
      expect(hombre.respuestas.cinturaCm).toBe(74)
    })

    it('si falta la que toca, se usa la otra antes que quedarse sin ninguna', () => {
      const sinNatural = importarIntake(con({ medida_cintura_natural_cm: null }))
      expect(sinNatural.respuestas.cinturaCm).toBe(74)
    })
  })

  it('a un hombre no se le importa la cadera: su fórmula no la usa', () => {
    const hombre = importarIntake(con({ genero: 'Masculino' }))
    expect(hombre.respuestas.caderaCm).toBeUndefined()
    expect(hombre.faltan).not.toContain('perímetro de la cadera')
  })

  describe('las alergias', () => {
    it('NO se interpretan: el texto viaja entero', () => {
      const texto =
        'No soy alérgica a nada. Pero me caen mal las harinas y creo que un poco los lácteos, aunque sí tomo yogurt griego.'
      const resultado = importarIntake(con({ alergias_restricciones: texto }))

      expect(resultado.alergiasEnTexto).toBe(texto)
      // Marcadas como "otra": la app no las vuelve a preguntar y la
      // nutricionista ve que hay un texto suyo esperando traducción.
      expect(resultado.respuestas.alergias).toEqual(['otra'])
    })

    it('una negación clara sí se entiende', () => {
      expect(importarIntake(INTAKE).respuestas.alergias).toEqual(['ninguna'])
      expect(importarIntake(INTAKE).alergiasEnTexto).toBeNull()
    })

    it('"ninguna" y un guion también son negaciones', () => {
      for (const valor of ['Ninguna', '-', 'no', 'Nada.']) {
        expect(importarIntake(con({ alergias_restricciones: valor })).alergiasEnTexto).toBeNull()
      }
    })

    it('la app no las vuelve a preguntar en ningún caso', () => {
      const conTexto = importarIntake(con({ alergias_restricciones: 'evito el gluten' }))
      expect(camposAPreguntar(conTexto.respuestas).map((c) => c.clave)).not.toContain('alergias')
    })
  })

  describe('las señales para la nutricionista', () => {
    it('el antecedente de conducta alimentaria se traslada', () => {
      const resultado = importarIntake(con({ tca_historia: 'Sí' }))
      expect(resultado.senales[0]).toMatch(/conducta alimentaria/i)
      expect(senalesDeLaEncuesta(resultado.respuestas).antecedenteTca).toBe(true)
    })

    it('el ciclo irregular también', () => {
      const resultado = importarIntake(con({ solo_mujeres_ciclo: 'Irregular' }))
      expect(resultado.senales).toContain('ciclo menstrual irregular o ausente')
    })

    it('las dos a la vez se listan las dos', () => {
      const resultado = importarIntake(
        con({ tca_historia: 'Sí', solo_mujeres_ciclo: 'Irregular' }),
      )
      expect(resultado.senales).toHaveLength(2)
    })

    it('sin señales, no se inventa ninguna', () => {
      expect(importarIntake(INTAKE).senales).toEqual([])
    })
  })

  describe('cuando el JSON viene incompleto', () => {
    it('no revienta', () => {
      expect(() => importarIntake({})).not.toThrow()
    })

    it('dice todo lo que falta, para poder pedirlo', () => {
      const { faltan } = importarIntake({})
      expect(faltan).toContain('peso')
      expect(faltan).toContain('sexo')
    })

    it('un cero o un negativo en una medida no cuenta como medida', () => {
      const roto = importarIntake(con({ peso_actual_kg: 0, medida_cuello_cm: -3 }))
      expect(roto.respuestas.pesoKg).toBeUndefined()
      expect(roto.faltan).toContain('peso')
    })

    it('un género que no se reconoce no se adivina', () => {
      // Aplicar la fórmula equivocada daría un porcentaje creíble pero falso.
      const raro = importarIntake(con({ genero: 'Prefiero no decir' }))
      expect(raro.respuestas.genero).toBeUndefined()
      expect(raro.faltan).toContain('sexo')
    })
  })

  it('trae el id de la persona, para poder asociarla', () => {
    expect(importarIntake(INTAKE).personaId).toBe('per-1')
  })
})
