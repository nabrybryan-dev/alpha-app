import { describe, expect, it } from 'vitest'

import type { ItemMarcable } from '../../../../domain/types'
import { estacionesDelCardio, intensidadEscrita } from './estacionesDelCardio'

/**
 * Nace en rojo el 2026-09-10: hasta entonces un día de cardio con sujeto no tenía ninguna
 * estación, así que el salón enseñaba a alguien corriendo y **ni un número**. Los bloques
 * de este archivo son los del METABÓLICO A del seed, tal cual.
 */

const bloque = (titulo: string, indicaciones: string, duracionMin?: number): ItemMarcable => ({
  id: titulo,
  titulo,
  indicaciones,
  duracionMin,
})

const METABOLICO = [
  bloque('Calentamiento: 5 min trote suave', 'Ritmo conversacional, zancada corta.', 5),
  bloque(
    '10 × 1 min fuerte / 1 min suave',
    'El minuto fuerte a RPE 8: palabras sueltas, no frases. El suave es trote, no caminata.',
    20,
  ),
  bloque('Enfriamiento: 5 min caminata', 'Baja pulsaciones caminando, respira por la nariz.', 5),
]

describe('estacionesDelCardio', () => {
  it('sin bloques no planta ningún poste', () => {
    expect(estacionesDelCardio(undefined)).toEqual([])
    expect(estacionesDelCardio([])).toEqual([])
  })

  it('suma los minutos de todos los bloques, no los del primero', () => {
    const minutos = estacionesDelCardio(METABOLICO).find((e) => e.clave === 'minutos')
    expect(minutos?.cifra).toBe('30')
  })

  it('cuenta los tramos, y los nombra en singular cuando es uno solo', () => {
    expect(estacionesDelCardio(METABOLICO).find((e) => e.clave === 'tramos')?.cifra).toBe('3')
    const uno = estacionesDelCardio([bloque('40 min bici zona 2', 'Continuo.', 40)])
    expect(uno.find((e) => e.clave === 'tramos')?.pie).toBe('bloque continuo')
  })

  it('saca el RPE de las indicaciones, partido en rótulo y cifra', () => {
    const i = estacionesDelCardio(METABOLICO).find((e) => e.clave === 'intensidad')
    // «RPE 8» entero a 52 px no cabe en un cartel de 132: el rótulo va arriba, pequeño.
    expect(i?.rotulo).toBe('RPE')
    expect(i?.cifra).toBe('8')
  })

  it('lee la zona igual de bien que el RPE', () => {
    expect(intensidadEscrita('40 min bici ZONA 2')).toEqual({ rotulo: 'Zona', cifra: '2' })
    expect(intensidadEscrita('30 min en Z3 sostenido')).toEqual({ rotulo: 'Zona', cifra: '3' })
    expect(intensidadEscrita('rpe 7-8 durante el bloque')).toEqual({ rotulo: 'RPE', cifra: '7-8' })
  })

  it('NO inventa la intensidad cuando no está escrita', () => {
    const sinNada = estacionesDelCardio([bloque('20 min caminata', 'Suave.', 20)])
    expect(sinNada.map((e) => e.clave)).toEqual(['minutos', 'tramos'])
  })

  it('sin minutos escritos sigue diciendo los tramos, que es lo que sí sabe', () => {
    const sinMinutos = estacionesDelCardio([bloque('Caminata al aire libre', 'Suave.')])
    expect(sinMinutos.map((e) => e.clave)).toEqual(['tramos'])
  })

  it('cada estación cae en un ángulo distinto, o dos carteles se pisarían', () => {
    const angulos = estacionesDelCardio(METABOLICO).map((e) => e.angulo)
    expect(new Set(angulos).size).toBe(angulos.length)
  })
})
