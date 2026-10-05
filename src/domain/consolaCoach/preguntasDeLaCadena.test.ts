import { describe, expect, it } from 'vitest'
import type { RespuestaCoach } from '../../data/consola/respuestasCoach'
import { preguntaDeLaCadena, repartirBandeja, textoDeRespuesta } from './preguntasDeLaCadena'

const ID = 'cp-0123456789abcdef'
const ctx = { usuarioId: 'u-1', paso: 2 as const }

function cruda(extra: Record<string, unknown> = {}) {
  return {
    fuente: 'cadena', id: ID, texto: '¿Con qué volumen vuelve tras la descarga?', paso: 2,
    persona: 'Ana', usuario_id: 'u-1', corrida: 'ana-M5', fecha: '2026-10-01T10:00:00Z', opciones: null,
    ...extra,
  }
}

function respuesta(extra: Partial<RespuestaCoach> = {}): RespuestaCoach {
  return {
    idPregunta: ID, usuarioId: 'u-1', paso: 2, texto: 'x', respuesta: 'B', respondidoPor: 'c-1',
    quien: 'Bryan', respondidoEn: '2026-10-03T10:00:00Z', ...extra,
  }
}

describe('preguntaDeLaCadena', () => {
  it('lee la pregunta que sube el importador', () => {
    expect(preguntaDeLaCadena(cruda(), ctx)).toEqual({
      id: ID, texto: '¿Con qué volumen vuelve tras la descarga?', opciones: null, paso: 2, usuarioId: 'u-1',
      fecha: '2026-10-01T10:00:00Z',
    })
  })

  it('sin opciones declaradas es respuesta libre (null); nunca inventa A/B/C', () => {
    expect(preguntaDeLaCadena(cruda({ opciones: [] }), ctx)?.opciones).toBeNull()
    expect(preguntaDeLaCadena(cruda({ opciones: ['A · sola'] }), ctx)?.opciones).toBeNull()
  })

  it('con opciones declaradas las trae tal cual', () => {
    expect(preguntaDeLaCadena(cruda({ opciones: ['A · 45', 'B · 25', 'C · otro'] }), ctx)?.opciones).toEqual([
      'A · 45', 'B · 25', 'C · otro',
    ])
  })

  it.each([
    ['el D8 del asesorado', { fuente: 'D8', detalle: '{}' }],
    ['una pregunta con cuestionario', { cuestionario_id: 'q-1', texto: 'x' }],
    ['una pregunta de otra fuente aunque traiga id y texto', cruda({ fuente: 'D8' })],
    ['un id que no es de la cadena', cruda({ id: 'otro' })],
    ['sin texto', cruda({ texto: '  ' })],
    ['un string suelto', '¿algo?'],
    ['null', null],
  ])('no toma %s por una pregunta de la cadena', (_nombre, valor) => {
    expect(preguntaDeLaCadena(valor, ctx)).toBeNull()
  })
})

describe('repartirBandeja', () => {
  const item = (pregunta: unknown, usuarioId = 'u-1', paso: 1 | 2 | 3 | 4 = 2) => ({ usuarioId, paso, pregunta })

  it('las de la cadena van a pendientes y el resto queda para el flujo de siempre', () => {
    const d8 = item({ fuente: 'D8', detalle: '{}' })
    const r = repartirBandeja([item(cruda()), d8], [])
    expect(r.pendientes.map((p) => p.id)).toEqual([ID])
    expect(r.otras).toEqual([d8])
  })

  it('una pregunta ya respondida sale de pendientes', () => {
    const r = repartirBandeja([item(cruda())], [respuesta()])
    expect(r.pendientes).toEqual([])
    expect(r.otras).toEqual([])
  })

  it('el mismo id en dos eventos sale una sola vez', () => {
    const r = repartirBandeja([item(cruda()), item(cruda(), 'u-1', 3)], [])
    expect(r.pendientes).toHaveLength(1)
  })

  it('otra pregunta con otro id no se da por respondida', () => {
    const r = repartirBandeja([item(cruda({ id: 'cp-ffffffffffffffff' }))], [respuesta()])
    expect(r.pendientes).toHaveLength(1)
  })

  it('la más reciente primero', () => {
    const r = repartirBandeja(
      [item(cruda({ fecha: '2026-09-01T00:00:00Z' })), item(cruda({ id: 'cp-aaaaaaaaaaaaaaaa', fecha: '2026-10-02T00:00:00Z' }))],
      [],
    )
    expect(r.pendientes.map((p) => p.id)).toEqual(['cp-aaaaaaaaaaaaaaaa', ID])
  })
})

describe('textoDeRespuesta', () => {
  it('la opción sola, tal cual', () => expect(textoDeRespuesta('B · 25', '')).toBe('B · 25'))
  it('lo escrito solo, recortado', () => expect(textoDeRespuesta(null, '  mantener ')).toBe('mantener'))
  it('opción más matiz', () => expect(textoDeRespuesta('C · otro', 'dos días')).toBe('C · otro — dos días'))
  it('nada es vacío (no se guarda)', () => expect(textoDeRespuesta(null, '   ')).toBe(''))
})
