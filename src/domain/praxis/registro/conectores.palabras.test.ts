// @vitest-environment node
/**
 * Palabras nuevas de los conectores (propuesta del 7-nov, CAMBIO-PROPUESTO-PALABRAS-20261107.md). Una prueba por fila,
 * más las trampas de matiz. ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function salida(frase: string, p?: CampoCheckin) {
  const r = conectarMensaje(frase, { preguntaAnterior: p })
  if (r.tipo === 'riesgo') return 'riesgo'
  const s: Record<string, unknown> = {}
  for (const x of r.propuestas) s[x.campo] = x.valor
  for (const d of r.dudosas) s[d.campo] = [...new Set(d.candidatos.map((c) => c.valor))]
  return s
}

describe('una fila de la lista, una prueba', () => {
  it.each([
    ['estrés a tope', { estres: 'MUCHO' }],
    ['me levanté cansado', { cansancio: ['REGULAR', 'MUCHO'] }],
    ['estoy muy cansada', { cansancio: 'MUCHO' }],
    ['me levanté con energía', { cansancio: 'POCO' }],
    ['anoche me desvelé', { calidadSueno: 'MALA' }],
    ['no dormí casi nada', { calidadSueno: 'MALA' }],
    ['dormí poquito', { calidadSueno: ['REGULAR', 'MALA'] }],
    ['el entreno buenísimo', { rendimiento: 'BUENA' }],
    ['el entreno re bien', { rendimiento: 'BUENA' }],
    ['el entreno lo sentí pesado', { rendimiento: 'MALA' }],
  ] as const)('«%s»', (frase, esperado) => {
    expect(salida(frase)).toEqual(esperado)
  })
})

describe('«no tanto» depende del área', () => {
  it('la comida no tanto = regular o mala; el estrés no tanto = poco o regular', () => {
    expect(salida('la comida no tanto')).toEqual({ alimentacion: ['REGULAR', 'MALA'] })
    expect(salida('el estrés no tanto')).toEqual({ estres: ['POCO', 'REGULAR'] })
    expect(salida('no tanto', 'motivacion')).toEqual({ motivacion: ['REGULAR', 'POCO'] })
  })
})

describe('trampas', () => {
  it('«me destruyó» no se mapea', () => {
    expect(salida('el entreno de pierna me destruyó')).toEqual({})
  })

  it('«sin energía» sigue siendo MUCHO cansancio (la tabla manda), no se confunde con «con energía»', () => {
    expect(salida('amanecí sin energía')).toEqual({ cansancio: 'MUCHO' })
  })

  it('«cansadísima» sigue MUCHO por la tabla, no entre dos', () => {
    expect(salida('estoy cansadísima')).toEqual({ cansancio: 'MUCHO' })
  })

  it('«buenísimo» suelto tras el entreno lo toma por el trozo de antes', () => {
    expect(salida('el entreno de pierna me destruyó, buenísimo')).toEqual({ rendimiento: 'BUENA' })
  })

  it('las palabras nuevas no se usan sin área: «a tope» suelto no da nada', () => {
    expect(salida('a tope')).toEqual({})
  })
})

/**
 * Sonda del 8-nov: 37 frases nuevas por toda la cadena. Destapó que las palabras nuevas IGNORABAN la negación
 * («no me desvelé» salía sueño MALO, «no me levanté con energía» salía POCO cansancio) y que «un poco / re / súper
 * cansada» salían igual que «cansada» a secas.
 */
describe('negación: lo negado no se lee como lo afirmado', () => {
  it.each([
    ['no me desvelé', {}],
    ['no me levanté con energía', {}],
    ['no dormí poco, dormí 8 horas', { horasSueno: 8 }],
    ['no estoy a tope de estrés', {}],
  ] as const)('«%s»', (frase, esperado) => {
    expect(salida(frase)).toEqual(esperado)
  })

  it('«no estoy cansada» = poco o regular; «nada cansado» = poco', () => {
    expect(salida('no estoy cansada')).toEqual({ cansancio: ['POCO', 'REGULAR'] })
    expect(salida('no me siento cansado')).toEqual({ cansancio: ['POCO', 'REGULAR'] })
    expect(salida('ya no estoy tan cansada')).toEqual({ cansancio: ['POCO', 'REGULAR'] })
    expect(salida('nada cansado hoy')).toEqual({ cansancio: 'POCO' })
  })
})

describe('cuánto cansancio dice el intensificador', () => {
  it('«un poco cansada» = poco o regular', () => {
    expect(salida('un poco cansada')).toEqual({ cansancio: ['POCO', 'REGULAR'] })
  })
  it.each(['re cansado', 'súper cansada', 'bien cansada'])('«%s» = mucho', (frase) => {
    expect(salida(frase)).toEqual({ cansancio: 'MUCHO' })
  })
})

describe('«buenísimo» vale en toda área de calidad, no solo en el entreno', () => {
  it('sueño, comida y respuesta corta', () => {
    expect(salida('el sueño buenísimo')).toEqual({ calidadSueno: 'BUENA' })
    expect(salida('la comida buenísima')).toEqual({ alimentacion: 'BUENA' })
    expect(salida('buenísimo', 'calidadSueno')).toEqual({ calidadSueno: 'BUENA' })
  })
})

describe('«comí no tanto» es cantidad, no calidad de la comida', () => {
  it('no se anota alimentación', () => {
    expect(salida('comí no tanto')).toEqual({})
  })
})
