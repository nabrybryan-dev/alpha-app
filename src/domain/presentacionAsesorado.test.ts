import { describe, expect, it } from 'vitest'
import type { CadenaCorrida } from '../data/consola/cadenaCorridas'
import type { TablaPlan } from './consolaCoach/perfilCompleto'
import { conclusionesPorMicrociclo, mapaDelPlan, textoDeAviso } from './presentacionAsesorado'
import type { Microciclo } from './types'

const TABLA: TablaPlan = {
  cabecera: ['Micro', 'Series', 'Nota'],
  filas: [
    { numero: 1, celdas: ['M1', '60', ''], actual: false },
    { numero: 2, celdas: ['M2', '64', 'sube'], actual: true },
    { numero: 3, celdas: ['M3', '68', ''], actual: false },
  ],
}

describe('mapaDelPlan', () => {
  it('sin tabla no hay mapa', () => {
    expect(mapaDelPlan(undefined, 2, 1)).toEqual([])
  })

  it('marca hechas, la actual y las que vienen', () => {
    expect(mapaDelPlan(TABLA, 2, undefined).map((c) => c.situacion)).toEqual(['hecha', 'actual', 'viene'])
  })

  it('sin microciclo en curso, «hecha» llega hasta el último cerrado', () => {
    expect(mapaDelPlan(TABLA, undefined, 2).map((c) => c.situacion)).toEqual(['hecha', 'hecha', 'viene'])
    expect(mapaDelPlan(TABLA, undefined, undefined).map((c) => c.situacion)).toEqual(['viene', 'viene', 'viene'])
  })

  it('el detalle trae las columnas de su fila y se salta las vacías', () => {
    const [m1, m2] = mapaDelPlan(TABLA, 2, undefined)
    expect(m1.detalle).toEqual([
      { titulo: 'Micro', texto: 'M1' },
      { titulo: 'Series', texto: '60' },
    ])
    expect(m2.detalle.map((d) => d.titulo)).toEqual(['Micro', 'Series', 'Nota'])
  })
})

let secuencia = 0
function corrida(parcial: Partial<CadenaCorrida> & Pick<CadenaCorrida, 'paso' | 'semanaInicio'>): CadenaCorrida {
  secuencia += 1
  return {
    id: `c-${secuencia}`,
    eventId: `e-${secuencia}`,
    runId: 'r',
    usuarioId: 'u',
    intento: 1,
    estado: 'completado',
    secuencia,
    hashArtefacto: 'h',
    versionReglas: 'v',
    fechaDato: '2026-09-01T00:00:00Z',
    fechaRecepcion: '2026-09-01T00:00:00Z',
    resumen: null,
    avisos: [],
    preguntasPendientes: [],
    creadoEn: '2026-09-01T00:00:00Z',
    ...parcial,
  }
}

function micro(numero: number, fechaInicio: string, cadenciaDias: 7 | 8 | 15 = 7): Microciclo {
  return { id: `m-${numero}`, usuarioId: 'u', numero, cadenciaDias, estado: 'cerrado', fechaInicio, sesiones: [] }
}

describe('textoDeAviso', () => {
  it('toma el texto de un string o de un objeto con campo de texto, y nada más', () => {
    expect(textoDeAviso('  hola ')).toBe('hola')
    expect(textoDeAviso({ mensaje: 'dormir poco' })).toBe('dormir poco')
    expect(textoDeAviso({ codigo: 7 })).toBeUndefined()
    expect(textoDeAviso(42)).toBeUndefined()
    expect(textoDeAviso('   ')).toBeUndefined()
  })
})

describe('conclusionesPorMicrociclo', () => {
  const micros = [micro(1, '2026-09-01'), micro(2, '2026-09-08')]

  it('sin corridas, no hay conclusiones', () => {
    expect(conclusionesPorMicrociclo([], 'u', micros)).toEqual([])
  })

  it('toma resumen y avisos del último paso COMPLETADO de la semana', () => {
    const r = conclusionesPorMicrociclo(
      [
        corrida({ paso: 2, semanaInicio: '2026-09-01', resumen: 'plan listo' }),
        corrida({ paso: 3, semanaInicio: '2026-09-01', resumen: 'carga puesta', avisos: ['sueño bajo'] }),
        corrida({ paso: 4, semanaInicio: '2026-09-01', estado: 'fallido', resumen: 'no debe salir' }),
      ],
      'u',
      micros,
    )
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ titulo: 'Semana 1', paso: 3, resumen: 'carga puesta', avisos: ['sueño bajo'] })
  })

  it('NO usa el paso ① aunque sea el único completado (su resumen es el que se deriva mal)', () => {
    const r = conclusionesPorMicrociclo(
      [corrida({ paso: 1, semanaInicio: '2026-09-01', resumen: 'pico de rampa' })],
      'u',
      micros,
    )
    expect(r).toEqual([])
  })

  it('agrupa por microciclo por fecha, ordena lo más reciente primero y solo de esa persona', () => {
    const r = conclusionesPorMicrociclo(
      [
        corrida({ paso: 4, semanaInicio: '2026-09-01', resumen: 'uno' }),
        corrida({ paso: 4, semanaInicio: '2026-09-08', resumen: 'dos' }),
        corrida({ paso: 4, semanaInicio: '2026-09-08', usuarioId: 'otra', resumen: 'ajena' }),
      ],
      'u',
      micros,
    )
    expect(r.map((c) => [c.titulo, c.resumen])).toEqual([
      ['Semana 2', 'dos'],
      ['Semana 1', 'uno'],
    ])
  })

  it('una corrida de una semana sin microciclo cargado sale con su fecha', () => {
    const r = conclusionesPorMicrociclo([corrida({ paso: 3, semanaInicio: '2026-10-12', resumen: 'lo que viene' })], 'u', micros)
    expect(r[0].titulo).toBe('Semana del 12 oct')
    expect(r[0].numero).toBeUndefined()
  })

  it('sin texto útil (resumen nulo, avisos que no son texto) el grupo no sale', () => {
    const r = conclusionesPorMicrociclo(
      [corrida({ paso: 4, semanaInicio: '2026-09-01', resumen: '  ', avisos: [{ codigo: 1 }, 5] })],
      'u',
      micros,
    )
    expect(r).toEqual([])
  })

  it('quita avisos repetidos', () => {
    const r = conclusionesPorMicrociclo(
      [corrida({ paso: 4, semanaInicio: '2026-09-01', avisos: ['a', 'a', { texto: 'a' }, 'b'] })],
      'u',
      micros,
    )
    expect(r[0].avisos).toEqual(['a', 'b'])
  })
})
