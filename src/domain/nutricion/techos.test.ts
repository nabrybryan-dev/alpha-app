import { describe, expect, it } from 'vitest'

import type { AlimentoIndice } from './busqueda'
import type { TotalDia } from './dia'
import {
  DIAS_ENTRE_RACIONES,
  VITAMINA_A_ANIMAL,
  conVitaminaAAnimal,
  esDeOrigenAnimal,
  fuenteDelLimite,
  limiteDe,
  motivoDeLaFrecuencia,
  seManejaPorFrecuencia,
  techosPasados,
} from './techos'

const alimento = (parcial: Partial<AlimentoIndice>): AlimentoIndice =>
  ({
    id: 'x',
    nombre: 'X',
    grupo: 'otro',
    estado: 'listo',
    confianza: 'verificado',
    fuente: 'tcac',
    por100g: {},
    medidas: [],
    ...parcial,
  }) as AlimentoIndice

const dia = (porDia: Record<string, number>, parciales: string[] = []): TotalDia => ({
  porDia,
  parciales: new Set(parciales),
  margenPct: 0,
})

describe('el caroteno no dispara el aviso', () => {
  it('la ahuyama no aporta vitamina A animal por mucho ER que tenga', () => {
    const ahuyama = alimento({ id: 'ahuyama', grupo: 'vegetales', por100g: { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, vitamina_a_er: 1775 } })
    expect(esDeOrigenAnimal(ahuyama)).toBe(false)
    expect(conVitaminaAAnimal(ahuyama).por100g[VITAMINA_A_ANIMAL]).toBeUndefined()
  })

  it('un día entero de ahuyama no pasa ningún techo', () => {
    // Es el fallo que este módulo existe para evitar: sumar `vitamina_a_er` a
    // secas y comparar con 3.000 asusta a quien come verdura.
    expect(techosPasados(dia({ vitamina_a_er: 5000 }))).toEqual([])
  })

  it('el hígado sí la aporta', () => {
    const higado = alimento({
      id: 'res-higado-asado-sin-sal',
      grupo: 'proteinas',
      por100g: { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, vitamina_a_er: 9491 },
    })
    expect(conVitaminaAAnimal(higado).por100g[VITAMINA_A_ANIMAL]).toBe(9491)
  })

  it('la mantequilla cuenta aunque su grupo sea grasas', () => {
    const mantequilla = alimento({
      id: 'mantequilla',
      grupo: 'grasas',
      por100g: { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, vitamina_a_er: 1170 },
    })
    expect(esDeOrigenAnimal(mantequilla)).toBe(true)
  })

  it('en una planta no crea la clave: ahí no falta nada, es que no aplica', () => {
    const lechuga = alimento({ grupo: 'vegetales', por100g: { kcal: 15, proteina_g: 1, carbos_g: 2, grasa_g: 0 } })
    expect(conVitaminaAAnimal(lechuga).por100g[VITAMINA_A_ANIMAL]).toBeUndefined()
  })

  it('en un animal sin medir, la clave viaja como null y el día sale parcial', () => {
    // "No se midió" no es "no contiene". Sin el null explícito el total del día
    // se queda corto y nada avisa: `nutrientesAusentes` solo mira los nulls.
    const carne = alimento({
      grupo: 'proteinas',
      por100g: { kcal: 100, proteina_g: 20, carbos_g: 0, grasa_g: 3, vitamina_a_er: null },
    })
    expect(conVitaminaAAnimal(carne).por100g[VITAMINA_A_ANIMAL]).toBeNull()
  })

  it('no muta el alimento original', () => {
    const higado = alimento({ grupo: 'proteinas', por100g: { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0, vitamina_a_er: 9491 } })
    conVitaminaAAnimal(higado)
    expect(higado.por100g[VITAMINA_A_ANIMAL]).toBeUndefined()
  })
})

describe('techosPasados', () => {
  it('vacío es lo normal', () => {
    expect(techosPasados(dia({ [VITAMINA_A_ANIMAL]: 800, zinc_mg: 12 }))).toEqual([])
  })

  it('avisa del hígado con las veces que se pasó', () => {
    const [techo] = techosPasados(dia({ [VITAMINA_A_ANIMAL]: 11389 }))
    expect(techo.nutriente).toBe('vitamina_a_er')
    expect(techo.limite).toBe(3000)
    expect(techo.veces).toBeCloseTo(3.8, 1)
  })

  it('no avisa justo en el límite', () => {
    expect(techosPasados(dia({ [VITAMINA_A_ANIMAL]: 3000 }))).toEqual([])
  })

  it('el hierro es informativo y nunca avisa', () => {
    // Su límite es de suplementos, y el único que lo pasa con comida es la
    // pajarilla, que es justo la fuente que cierra el hueco de hierro.
    expect(techosPasados(dia({ hierro_mg: 54 }))).toEqual([])
  })

  it('ordena por lo más excedido', () => {
    const pasados = techosPasados(dia({ zinc_mg: 50, [VITAMINA_A_ANIMAL]: 11389 }))
    expect(pasados.map((t) => t.nutriente)).toEqual(['vitamina_a_er', 'zinc_mg'])
  })

  it('marca parcial cuando al día le falta ese dato', () => {
    const [techo] = techosPasados(dia({ [VITAMINA_A_ANIMAL]: 11389 }, [VITAMINA_A_ANIMAL]))
    expect(techo.parcial).toBe(true)
  })

  it('un nutriente sin dato no es un cero por debajo del techo', () => {
    expect(techosPasados(dia({}))).toEqual([])
  })
})

describe('el límite es el de ella, no el del adulto genérico', () => {
  // Manuela, 2026-08-09: en embarazo y lactancia, el umbral mínimo mientras no
  // haya indicación médica propia. 2.800 µg contra los 3.000 generales.
  const ENTRE_LOS_DOS = 2900

  it('sin condiciones declaradas manda el general', () => {
    expect(limiteDe('vitamina_a_er')).toBe(3000)
    expect(techosPasados(dia({ [VITAMINA_A_ANIMAL]: ENTRE_LOS_DOS }))).toEqual([])
  })

  it('en embarazo y en lactancia baja a 2.800', () => {
    expect(limiteDe('vitamina_a_er', ['embarazo'])).toBe(2800)
    expect(limiteDe('vitamina_a_er', ['lactancia'])).toBe(2800)
  })

  it('el mismo día que no avisaba, en lactancia sí avisa', () => {
    const [techo] = techosPasados(dia({ [VITAMINA_A_ANIMAL]: ENTRE_LOS_DOS }), {
      condiciones: ['lactancia'],
    })
    expect(techo.limite).toBe(2800)
    expect(techo.valor).toBe(ENTRE_LOS_DOS)
  })

  it('si declara varias, manda la más baja y no la última leída', () => {
    expect(limiteDe('vitamina_a_er', ['lactancia', 'embarazo'])).toBe(2800)
  })

  it('la condición no toca los otros nutrientes', () => {
    expect(limiteDe('zinc_mg', ['embarazo'])).toBe(40)
  })

  it('una condición que no existe no rompe ni cambia nada', () => {
    expect(limiteDe('vitamina_a_er', ['algo_que_no_esta'])).toBe(3000)
  })
})

describe('el hígado va por frecuencia y no por techo diario', () => {
  // El aviso diario salía CADA vez que alguien registraba hígado —su ración
  // pasa el techo siempre— y a la tercera nadie lo lee. Manuela lo cambió por
  // «cada dos semanas» el 2026-08-09.
  const DIA_DE_HIGADO = dia({ [VITAMINA_A_ANIMAL]: 11389 })

  it('sin la lista de lo que comió, avisa como siempre', () => {
    expect(techosPasados(DIA_DE_HIGADO)).toHaveLength(1)
  })

  it('con el hígado en el día, el aviso diario se calla', () => {
    expect(
      techosPasados(DIA_DE_HIGADO, { nombresDelDia: ['Res, hígado, asado, sin sal'] }),
    ).toEqual([])
  })

  it('también las menudencias, que llevan hígado dentro', () => {
    expect(seManejaPorFrecuencia('Pollo, menudencias, crudas', 'vitamina_a_er')).toBe(true)
  })

  it('se compara por palabra entera: «higadillo» no es hígado', () => {
    expect(seManejaPorFrecuencia('Higadillos en conserva', 'vitamina_a_er')).toBe(false)
  })

  it('callar el aviso del hígado no calla los demás nutrientes de ese día', () => {
    const pasados = techosPasados(dia({ [VITAMINA_A_ANIMAL]: 11389, zinc_mg: 50 }), {
      nombresDelDia: ['Res, hígado, asado, sin sal'],
    })
    expect(pasados.map((t) => t.nutriente)).toEqual(['zinc_mg'])
  })

  it('un día sin hígado sigue avisando de la vitamina A', () => {
    expect(
      techosPasados(DIA_DE_HIGADO, { nombresDelDia: ['Zanahoria cruda', 'Mantequilla'] }),
    ).toHaveLength(1)
  })

  it('la frecuencia dice por qué existe, para poder explicarla', () => {
    expect(DIAS_ENTRE_RACIONES).toBe(14)
    expect(motivoDeLaFrecuencia('vitamina_a_er')).toContain('retinol')
  })
})

describe('la tabla viene del Cerebro', () => {
  it('cada límite dice de dónde sale', () => {
    expect(fuenteDelLimite('vitamina_a_er')).toContain('retinol')
    expect(fuenteDelLimite('zinc_mg')).toContain('cobre')
  })

  it('los límites que solo aplican a suplementos no están', () => {
    // magnesio (laxante), niacina y folatos (forma sintética), potasio (sin
    // límite para persona sana). Si alguno aparece, se copió una tabla entera.
    for (const nutriente of ['magnesio_mg', 'niacina_mg', 'folatos_ug', 'potasio_mg']) {
      expect(fuenteDelLimite(nutriente)).toBe('')
    }
  })
})
