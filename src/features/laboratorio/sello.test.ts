import { describe, expect, it } from 'vitest'
import {
  CONDICIONES_HOY,
  LABORATORIO_VISIBLE,
  datoValido,
  filtraPorRol,
  interruptorEfectivo,
  labPrescribe,
  puedeEncender,
  type DatoLaboratorio,
} from './sello'

const P: Array<DatoLaboratorio | null> = [
  { sello: 'evidencia', fuente: 'F1', texto: 'a' },
  { sello: 'simulado', fuente: 'F2', texto: 'b' },
  { sello: 'estimado', fuente: 'F3', texto: 'c' },
  { sello: 'no_afirmable', fuente: 'F4', texto: 'd' },
  { sello: 'evidencia', fuente: '', texto: 'sin fuente' },
  { sello: 'evidencia', fuente: '   ', texto: 'fuente en blanco' },
  { sello: 'inventado', fuente: 'F5', texto: 'sello raro' },
  { sello: 'toString', fuente: 'F6', texto: 'sello heredado' },
  { texto: 'sin nada' },
  null,
]
const FIRMADAS = { hojaFirmada: true, revisionLegal: true }

describe('sello del laboratorio', () => {
  it('apagado por defecto y sin condiciones hoy', () => {
    expect(LABORATORIO_VISIBLE).toBe(false)
    expect(CONDICIONES_HOY).toEqual({ hojaFirmada: false, revisionLegal: false })
    expect(interruptorEfectivo(true, CONDICIONES_HOY)).toBe(false)
  })
  it('solo enciende con hoja firmada Y revisión legal', () => {
    expect(puedeEncender({ hojaFirmada: true, revisionLegal: false })).toBe(false)
    expect(puedeEncender({ hojaFirmada: false, revisionLegal: true })).toBe(false)
    expect(interruptorEfectivo(true, FIRMADAS)).toBe(true)
    expect(interruptorEfectivo(false, FIRMADAS)).toBe(false)
  })
  it('sin sello válido o sin fuente no se dibuja', () => {
    expect(P.filter(datoValido)).toHaveLength(4)
    expect(filtraPorRol(P, 'equipo', false).map((d) => d.sello)).toEqual([
      'evidencia',
      'simulado',
      'estimado',
      'no_afirmable',
    ])
  })
  it('apagado: el asesorado no ve nada', () => {
    expect(filtraPorRol(P, 'asesorado', false)).toHaveLength(0)
  })
  it('encendido: el asesorado solo ve evidencia', () => {
    expect(filtraPorRol(P, 'asesorado', true).map((d) => d.sello)).toEqual(['evidencia'])
  })
  it('labPrescribe es falso apagado; encendido, solo evidencia', () => {
    expect(labPrescribe(P[0], false)).toBe(false)
    expect(labPrescribe(P[0], true)).toBe(true)
    expect(labPrescribe(P[1], true)).toBe(false)
    expect(labPrescribe(P[4], true)).toBe(false)
  })
  it('tolera datos nulos o ausentes', () => {
    expect(filtraPorRol(null, 'equipo', true)).toEqual([])
    expect(filtraPorRol(undefined, 'asesorado', true)).toEqual([])
  })
})
