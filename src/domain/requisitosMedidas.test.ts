import { describe, expect, it } from 'vitest'
import {
  DIAS_VIGENCIA,
  PERIMETROS_BASE,
  evaluarRequisitoMedidas,
} from './requisitosMedidas'
import type { MedidaCorporal, Perfil } from './types'

const HOY = '2026-08-11'

const medida = (over: Partial<MedidaCorporal> = {}): MedidaCorporal => ({
  fecha: '2026-08-01',
  pesoKg: 70,
  alturaCm: 170,
  perimetros: { Cintura: 80 },
  ...over,
})

const perfil = (over: Partial<Perfil> = {}): Perfil => ({
  usuarioId: 'u1',
  objetivos: '',
  edad: 30,
  diasEntrenamiento: 4,
  tiempoSesionMin: 90,
  somatotipo: '',
  volumenSemanal: {},
  medidas: [medida()],
  ...over,
})

describe('evaluarRequisitoMedidas', () => {
  it('cumple con peso, altura y los perímetros base recientes', () => {
    const r = evaluarRequisitoMedidas(perfil(), HOY)
    expect(r.cumple).toBe(true)
    expect(r.faltan).toEqual([])
    expect(r.vencida).toBe(false)
  })

  it('sin perfil cargado NO bloquea: no se castiga a quien aún no ha sincronizado', () => {
    const r = evaluarRequisitoMedidas(undefined, HOY)
    expect(r.cumple).toBe(true)
    expect(r.indeterminado).toBe(true)
  })

  it('sin ninguna medida, pide todo y bloquea', () => {
    const r = evaluarRequisitoMedidas(perfil({ medidas: [] }), HOY)
    expect(r.cumple).toBe(false)
    expect(r.faltan).toContain('Peso')
    expect(r.faltan).toContain('Altura')
    expect(r.faltan).toContain('Cintura')
  })

  it('falta el peso', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ pesoKg: 0 })] }),
      HOY,
    )
    expect(r.cumple).toBe(false)
    expect(r.faltan).toEqual(['Peso'])
  })

  it('falta la altura', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ alturaCm: 0 })] }),
      HOY,
    )
    expect(r.cumple).toBe(false)
    expect(r.faltan).toEqual(['Altura'])
  })

  it('falta un perímetro base', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ perimetros: {} })] }),
      HOY,
    )
    expect(r.cumple).toBe(false)
    expect(r.faltan).toEqual([...PERIMETROS_BASE])
  })

  it('un perímetro en 0 cuenta como ausente, no como medido', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ perimetros: { Cintura: 0 } })] }),
      HOY,
    )
    expect(r.cumple).toBe(false)
    expect(r.faltan).toEqual(['Cintura'])
  })

  it('una medida más vieja que la vigencia bloquea y se marca vencida', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ fecha: '2026-01-01' })] }),
      HOY,
    )
    expect(r.cumple).toBe(false)
    expect(r.vencida).toBe(true)
    expect(r.diasDesdeUltima).toBe(222)
  })

  it('justo en el límite de vigencia todavía cumple', () => {
    const limite = new Date(Date.parse(`${HOY}T00:00:00Z`) - DIAS_VIGENCIA * 86400000)
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ fecha: limite.toISOString().slice(0, 10) })] }),
      HOY,
    )
    expect(r.cumple).toBe(true)
    expect(r.diasDesdeUltima).toBe(DIAS_VIGENCIA)
  })

  it('lee SIEMPRE la medida más reciente, no la última del array', () => {
    const r = evaluarRequisitoMedidas(
      perfil({
        medidas: [
          medida({ fecha: '2026-08-05' }),
          medida({ fecha: '2026-01-01', perimetros: {} }),
        ],
      }),
      HOY,
    )
    expect(r.cumple).toBe(true)
  })

  it('el coach puede exigir perímetros extra por objetivo (p. ej. glúteo)', () => {
    const r = evaluarRequisitoMedidas(perfil(), HOY, ['Glúteo'])
    expect(r.cumple).toBe(false)
    expect(r.faltan).toEqual(['Glúteo'])
  })

  it('los perímetros extra se comparan sin distinguir mayúsculas ni tildes', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ perimetros: { Cintura: 80, GLUTEO: 100 } })] }),
      HOY,
      ['Glúteo'],
    )
    expect(r.cumple).toBe(true)
  })

  it('no duplica un extra que ya está en la base', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ perimetros: {} })] }),
      HOY,
      ['Cintura'],
    )
    expect(r.faltan).toEqual(['Cintura'])
  })

  // Los perímetros de la base NO están normalizados. Bloquear a alguien que se
  // midió hace una semana porque escribió «Cintura natural» y no «Cintura» es
  // peor que no bloquear a nadie: es la puerta castigando a quien sí cumplió.
  describe('cubre por familia, no por nombre exacto', () => {
    const conPerimetros = (perimetros: Record<string, number>, extra: string[] = []) =>
      evaluarRequisitoMedidas(perfil({ medidas: [medida({ perimetros })] }), HOY, extra)

    it('«Cintura natural» cubre el requisito de Cintura', () => {
      expect(conPerimetros({ 'Cintura natural': 103 }).cumple).toBe(true)
    })

    it('«Cintura ombligo» también', () => {
      expect(conPerimetros({ 'Cintura ombligo': 109 }).cumple).toBe(true)
    })

    it('«Cintura media» también', () => {
      expect(conPerimetros({ 'Cintura media': 90.2 }).cumple).toBe(true)
    })

    it('«Glúteos» en plural cubre Glúteo', () => {
      expect(conPerimetros({ Cintura: 80, Glúteos: 108 }, ['Glúteo']).cumple).toBe(true)
    })

    it('«Muslo derecho» y «Muslo D» cubren Muslo', () => {
      expect(conPerimetros({ Cintura: 80, 'Muslo derecho': 63 }, ['Muslo']).cumple).toBe(true)
      expect(conPerimetros({ Cintura: 80, 'Muslo D': 63 }, ['Muslo']).cumple).toBe(true)
    })

    it('«Pierna derecha» cubre Muslo: es la misma medida con otro nombre', () => {
      expect(conPerimetros({ Cintura: 80, 'Pierna derecha': 62.6 }, ['Muslo']).cumple).toBe(true)
    })

    it('«Abdomen bajo» cubre Abdomen', () => {
      expect(conPerimetros({ Cintura: 80, 'Abdomen bajo': 93.5 }, ['Abdomen']).cumple).toBe(true)
    })

    it('pero NO cuela una familia distinta: Cadera no es Cintura', () => {
      expect(conPerimetros({ Cadera: 106 }).cumple).toBe(false)
    })

    it('ni un prefijo pegado sin separar: «Cinturon» no es una cintura', () => {
      expect(conPerimetros({ Cinturon: 90 }).cumple).toBe(false)
    })
  })

  it('una fecha ilegible se trata como ausente, no como válida', () => {
    const r = evaluarRequisitoMedidas(
      perfil({ medidas: [medida({ fecha: 'no-es-fecha' })] }),
      HOY,
    )
    expect(r.cumple).toBe(false)
    expect(r.vencida).toBe(true)
  })
})
