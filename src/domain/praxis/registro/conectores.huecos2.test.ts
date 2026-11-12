// @vitest-environment node
/**
 * Segunda ronda de los seis huecos: lo que destapó la sonda adversaria del 8-nov (frases que buscaban romper las reglas).
 * Cada caso nació de una falla real. ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
 */
import { describe, expect, it } from 'vitest'
import { conectarMensaje } from './conectores.ts'
import type { CampoCheckin } from './mensajeLargo.ts'

function ver(frase: string, p?: CampoCheckin) {
  const r = conectarMensaje(frase, { preguntaAnterior: p })
  if (r.tipo === 'riesgo') throw new Error('riesgo')
  const campos: Record<string, unknown> = {}
  for (const x of r.propuestas) campos[x.campo] = x.valor
  for (const d of r.dudosas) campos[d.campo] = [...new Set(d.candidatos.map((c) => c.valor))]
  return { campos, notas: r.anotaciones }
}

describe('«descansé» con más formas', () => {
  it.each([['descansé súper bien', 'BUENA'], ['descansé de maravilla', 'BUENA'], ['descansé muy bien', 'BUENA'], ['descansé mal', 'MALA'], ['descansé fatal', 'MALA']])(
    '«%s» = %s', (f, v) => expect(ver(f, 'calidadSueno').campos).toEqual({ calidadSueno: v }))
  it('negativas: «no descansé mal» no es MALA', () => {
    expect(ver('no descansé mal', 'calidadSueno').campos).not.toEqual({ calidadSueno: 'MALA' })
  })
})

describe('«molida»: solo la zona del cuerpo la manda al cuaderno', () => {
  it('«molida de tanto trabajar» y «por el trabajo» SON cansancio (no hay zona)', () => {
    expect(ver('estoy molida de tanto trabajar', 'cansancio')).toEqual({ campos: { cansancio: 'MUCHO' }, notas: [] })
    expect(ver('molida por el trabajo', 'cansancio')).toEqual({ campos: { cansancio: 'MUCHO' }, notas: [] })
  })
  it('la zona puede ir antes: «las piernas molidas»', () => {
    const r = ver('las piernas molidas', 'cansancio')
    expect(r.notas).toMatchObject([{ tipo: 'recuperacion_zona', zona: 'piernas' }])
    expect(r.campos).toEqual({})
  })
  it('negado no se anota: «no estoy molida de las piernas»', () => {
    expect(ver('no estoy molida de las piernas').notas).toEqual([])
    expect(ver('nunca quedo molida de las piernas').notas).toEqual([])
  })
  it('la cita nunca pasa de 300 caracteres (la base rechaza más)', () => {
    const r = ver('molida de las piernas' + ' bla'.repeat(150))
    expect(r.notas).toHaveLength(1)
    expect(r.notas[0].cita.length).toBeLessThanOrEqual(300)
  })
})

describe('«pesada» y la comida', () => {
  it('lo negado NO se anota (guardar lo contrario de lo dicho)', () => {
    expect(ver('no me sentí pesada después del almuerzo', 'rendimiento')).toEqual({ campos: {}, notas: [] })
    expect(ver('el almuerzo no me cayó pesado').notas).toEqual([])
    expect(ver('la cena no me cayó nada pesada').notas).toEqual([])
  })
  it('almorzar y cenar también son comida', () => {
    expect(ver('después de almorzar me sentí pesada').notas).toMatchObject([{ tipo: 'reaccion_comida', momento: 'almuerzo' }])
    expect(ver('quedé llena y pesada después de cenar').notas).toMatchObject([{ tipo: 'reaccion_comida', momento: 'cena' }])
  })
  it('«comí frijoles y me sentí pesada»: la comida está en el trozo de antes, y el alimento se rescata de ahí', () => {
    expect(ver('comí frijoles y me sentí pesada').notas).toMatchObject([{ tipo: 'reaccion_comida', momento: 'otro', alimento: 'frijoles' }])
  })
  it('control: sin comida cerca, «me sentí pesada» sigue siendo del entreno si la pregunta era del entreno', () => {
    expect(ver('me sentí pesada', 'rendimiento')).toEqual({ campos: { rendimiento: 'MALA' }, notas: [] })
    expect(ver('el entreno me cayó pesado', 'rendimiento')).toEqual({ campos: { rendimiento: 'MALA' }, notas: [] })
  })
})

describe('«con toda», «fresca» y «a tope» no se dejan engañar', () => {
  it('«con toda la pereza» / «la flojera» no es ganas ni energía', () => {
    expect(ver('ando con toda la pereza', 'motivacion').campos).toEqual({})
    expect(ver('ando con toda la flojera', 'cansancio').campos).toEqual({})
  })
  it('control: «con toda la energía» sigue siendo POCO cansancio', () => {
    expect(ver('con toda la energía', 'cansancio').campos).toEqual({ cansancio: 'POCO' })
    expect(ver('ando con toda', 'motivacion').campos).toEqual({ motivacion: 'MUCHO' })
  })
  it('«fresco» del clima o de la ensalada no es descanso de la persona', () => {
    expect(ver('el clima está fresco', 'cansancio').campos).toEqual({})
    expect(ver('el clima está fresco', 'estres').campos).toEqual({})
  })
  it('control: la persona fresca sí', () => {
    expect(ver('me siento fresca', 'cansancio').campos).toEqual({ cansancio: 'POCO' })
    expect(ver('amanecí fresco', 'cansancio').campos).toEqual({ cansancio: 'POCO' })
    expect(ver('fresca como una lechuga', 'cansancio').campos).toEqual({ cansancio: 'POCO' })
  })
  it('«energía a tope» es POCO cansancio', () => {
    expect(ver('energía a tope', 'cansancio').campos).toEqual({ cansancio: 'POCO' })
  })
})
