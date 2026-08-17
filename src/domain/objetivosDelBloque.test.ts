import { describe, expect, it } from 'vitest'
import { objetivosDelBloque } from './objetivosDelBloque'

describe('objetivosDelBloque', () => {
  it('separa titular, entrada y secciones etiquetadas', () => {
    const r = objetivosDelBloque(
      'BLOQUE 1 · GANANCIA DE MASA MAGRA — 16 microciclos, de agosto a diciembre. ' +
        'LA BÁSCULA NO ES LA MÉTRICA DE ESTE BLOQUE. || ' +
        'PASOS: piso 8.000 (innegociable) · objetivo 10.000 · techo 12.000. || ' +
        'AGUA: de 4 vasos a 7 este mes.',
    )
    expect(r.titular).toBe('BLOQUE 1 · GANANCIA DE MASA MAGRA')
    expect(r.entrada).toContain('16 microciclos')
    expect(r.secciones).toEqual([
      { etiqueta: 'PASOS', texto: 'piso 8.000 (innegociable) · objetivo 10.000 · techo 12.000.' },
      { etiqueta: 'AGUA', texto: 'de 4 vasos a 7 este mes.' },
    ])
  })

  it('un párrafo suelto sigue siendo un solo bloque: no se inventan secciones', () => {
    const texto =
      'Déficit calórico (pérdida de grasa). Hernia discal y molestia de hombro: ' +
      'técnica intachable, axiales nunca suben en déficit.'
    const r = objetivosDelBloque(texto)
    expect(r.titular).toBeUndefined()
    expect(r.entrada).toBe(texto)
    expect(r.secciones).toEqual([])
  })

  it('un segmento sin etiqueta se conserva como texto, no se descarta', () => {
    const r = objetivosDelBloque('Algo primero || y esto no lleva etiqueta ninguna')
    expect(r.secciones).toEqual([{ texto: 'y esto no lleva etiqueta ninguna' }])
  })

  it('no confunde una frase normal con una etiqueta', () => {
    // Minúsculas, o demasiado larga para ser etiqueta: es texto.
    const r = objetivosDelBloque('X || pasos: esto va en minúscula y no es etiqueta')
    expect(r.secciones[0].etiqueta).toBeUndefined()
  })

  it('aguanta vacío y espacios', () => {
    expect(objetivosDelBloque(undefined)).toEqual({ secciones: [] })
    expect(objetivosDelBloque('   ')).toEqual({ secciones: [] })
    expect(objetivosDelBloque('A ||  || B').secciones).toHaveLength(1)
  })

  it('el caso real de un alta nueva se parte en sus 8 piezas', () => {
    const real =
      'BLOQUE 1 · GANANCIA — 16 microciclos. || PASOS: piso 8.000. || SUEÑO: de 6 h a 7-8 h. || ' +
      'TU SEMANA: entrenas DOMINGO. || RODILLA: escalón 0. || AGUA: de 4 a 7 vasos. || ' +
      'CREATINA: 5 g/día. || M1 ES UN MICROCICLO DE CALIBRACIÓN: no lleva kilos.'
    const r = objetivosDelBloque(real)
    expect(r.titular).toBe('BLOQUE 1 · GANANCIA')
    expect(r.secciones.map((s) => s.etiqueta)).toEqual([
      'PASOS',
      'SUEÑO',
      'TU SEMANA',
      'RODILLA',
      'AGUA',
      'CREATINA',
      'M1 ES UN MICROCICLO DE CALIBRACIÓN',
    ])
  })
})
