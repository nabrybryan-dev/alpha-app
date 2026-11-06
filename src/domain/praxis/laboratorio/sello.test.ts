import { describe, expect, it } from 'vitest'
import {
  LABORATORIO_HOJA_FIRMADA,
  LABORATORIO_REVISION_LEGAL,
  LABORATORIO_VISIBLE,
  SELLOS,
  TEXTO_DEL_SELLO,
  filtrarDibujables,
  laboratorioPuedeEncenderse,
  puedeDibujarse,
  puedeEntrarAPrescripcion,
  tieneSelloYFuente,
} from './sello'

const FUENTE = 'Estudio de ejemplo (sin dato real)'
const dato = (sello: string | null | undefined, fuente: string | null | undefined = FUENTE) => ({ sello, fuente })

describe('el interruptor del laboratorio', () => {
  it('nace apagado, con las dos condiciones en falso', () => {
    expect(LABORATORIO_HOJA_FIRMADA).toBe(false)
    expect(LABORATORIO_REVISION_LEGAL).toBe(false)
    expect(LABORATORIO_VISIBLE).toBe(false)
  })

  it('solo puede encenderse con hoja firmada Y revisión legal', () => {
    expect(laboratorioPuedeEncenderse(false, false)).toBe(false)
    expect(laboratorioPuedeEncenderse(true, false)).toBe(false)
    expect(laboratorioPuedeEncenderse(false, true)).toBe(false)
    expect(laboratorioPuedeEncenderse(true, true)).toBe(true)
  })
})

describe('sin sello y sin fuente no se dibuja', () => {
  it('un sello desconocido o ausente no se dibuja, ni para el equipo', () => {
    expect(puedeDibujarse(dato('inventado'), 'coach')).toBe(false)
    expect(puedeDibujarse(dato(undefined), 'coach')).toBe(false)
    expect(puedeDibujarse(dato(null), 'coach')).toBe(false)
    expect(puedeDibujarse(dato(''), 'coach')).toBe(false)
  })

  it('sin fuente, vacía o solo con espacios, no se dibuja, ni para el equipo', () => {
    for (const sello of SELLOS) {
      expect(puedeDibujarse({ sello }, 'coach')).toBe(false)
      expect(puedeDibujarse(dato(sello, null), 'coach')).toBe(false)
      expect(puedeDibujarse(dato(sello, ''), 'coach')).toBe(false)
      expect(puedeDibujarse(dato(sello, '   '), 'nutricionista')).toBe(false)
    }
  })

  it('un dato nulo no se dibuja', () => {
    expect(puedeDibujarse(null, 'coach')).toBe(false)
    expect(puedeDibujarse(undefined, 'coach')).toBe(false)
    expect(tieneSelloYFuente(null)).toBe(false)
  })

  it('tampoco se dibuja para un asesorado con el laboratorio encendido si le falta la fuente', () => {
    expect(puedeDibujarse(dato('evidencia', ''), 'asesorado', { laboratorioVisible: true })).toBe(false)
  })
})

describe('qué ve el equipo', () => {
  it('con el laboratorio apagado, ve los cuatro sellos válidos', () => {
    for (const sello of SELLOS) {
      expect(puedeDibujarse(dato(sello), 'coach', { laboratorioVisible: false })).toBe(true)
      expect(puedeDibujarse(dato(sello), 'nutricionista', { laboratorioVisible: false })).toBe(true)
    }
  })

  it('la cuenta personal con el puesto de coach cuenta como equipo', () => {
    expect(puedeDibujarse(dato('simulado'), 'asesorado', { ocupaElPuesto: true })).toBe(true)
    expect(puedeDibujarse(dato(null), 'asesorado', { ocupaElPuesto: true })).toBe(false)
  })
})

describe('qué ve el asesorado', () => {
  it('con el interruptor apagado no ve evidencia publicada (decisión de Bryan, 4-nov)', () => {
    expect(puedeDibujarse(dato('evidencia'), 'asesorado', { laboratorioVisible: false })).toBe(false)
  })

  it('por omisión (interruptor del código) no ve nada del laboratorio', () => {
    for (const sello of SELLOS) expect(puedeDibujarse(dato(sello), 'asesorado')).toBe(false)
  })

  it('con el interruptor encendido ve solo la evidencia publicada', () => {
    const o = { laboratorioVisible: true }
    expect(puedeDibujarse(dato('evidencia'), 'asesorado', o)).toBe(true)
    expect(puedeDibujarse(dato('simulado'), 'asesorado', o)).toBe(false)
    expect(puedeDibujarse(dato('estimado'), 'asesorado', o)).toBe(false)
    expect(puedeDibujarse(dato('no_afirmable'), 'asesorado', o)).toBe(false)
  })
})

describe('filtrarDibujables', () => {
  const lista = [dato('evidencia'), dato('simulado'), dato('estimado', ''), dato('raro'), dato('no_afirmable')]

  it('al equipo le deja solo lo válido', () => {
    expect(filtrarDibujables(lista, 'coach')).toEqual([lista[0], lista[1], lista[4]])
  })

  it('al asesorado con el laboratorio apagado no le deja nada', () => {
    expect(filtrarDibujables(lista, 'asesorado')).toEqual([])
  })

  it('al asesorado con el laboratorio encendido le deja solo la evidencia', () => {
    expect(filtrarDibujables(lista, 'asesorado', { laboratorioVisible: true })).toEqual([lista[0]])
  })

  it('tolera una lista ausente', () => {
    expect(filtrarDibujables(null, 'coach')).toEqual([])
    expect(filtrarDibujables(undefined, 'asesorado')).toEqual([])
  })
})

describe('nada del laboratorio entra a una prescripción apagado', () => {
  it('apagado, ni la evidencia publicada', () => {
    expect(puedeEntrarAPrescripcion(dato('evidencia'))).toBe(false)
    expect(puedeEntrarAPrescripcion(dato('evidencia'), false)).toBe(false)
  })

  it('encendido, solo la evidencia con fuente', () => {
    expect(puedeEntrarAPrescripcion(dato('evidencia'), true)).toBe(true)
    expect(puedeEntrarAPrescripcion(dato('evidencia', ''), true)).toBe(false)
    expect(puedeEntrarAPrescripcion(dato('simulado'), true)).toBe(false)
    expect(puedeEntrarAPrescripcion(dato('estimado'), true)).toBe(false)
    expect(puedeEntrarAPrescripcion(dato('no_afirmable'), true)).toBe(false)
  })
})

describe('los textos de los sellos', () => {
  it('hay un texto en español para cada sello y el de evidencia aclara que no es una medida propia', () => {
    for (const sello of SELLOS) expect(TEXTO_DEL_SELLO[sello].length).toBeGreaterThan(0)
    expect(TEXTO_DEL_SELLO.evidencia).toMatch(/no es tu medida/i)
  })
})
