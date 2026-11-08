// @vitest-environment node
/**
 * Cuarta ronda: lo que la sonda del 8-nov dejó como «no leído» o «ruido»:
 * «voy con toda al gym», «me cayó pesado el helado» (comida sin palabra de comida) y «X pero Y» sobre el mismo campo.
 * ESCRITAS POR IA: SOLO PRUEBA, NO SIRVEN PARA ENTRENAR EL MODELO PROPIO.
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

describe('«con toda» hacia el gimnasio es motivación', () => {
  it.each(['voy con toda al gym', 'voy con toda al gimnasio', 'voy con toda a entrenar', 'ando con toda para el entreno'])(
    '«%s» = motivación MUCHO', (f) => expect(ver(f, 'motivacion').campos).toEqual({ motivacion: 'MUCHO' }))
  it('con la pregunta de rendimiento tampoco se cuela como rendimiento', () => {
    expect(ver('voy con toda al gym', 'rendimiento').campos).toEqual({ motivacion: 'MUCHO' })
  })
  it('negativas: negado, o «con toda» pegado a otra cosa, no es ganas de entrenar', () => {
    expect(ver('no voy con toda al gym', 'motivacion').campos).toEqual({})
    expect(ver('voy con toda la pereza al gym', 'motivacion').campos).toEqual({})
  })
  it('«con todas las ganas» sí; «con todas las ganas de dormir» no', () => {
    expect(ver('con todas las ganas', 'motivacion').campos).toEqual({ motivacion: 'MUCHO' })
    expect(ver('con todas las ganas de dormir', 'motivacion').campos).toEqual({})
  })
})

describe('«me cayó pesado» + un alimento, sin palabra de comida', () => {
  it('alimento antes o después', () => {
    expect(ver('me cayó pesado el helado').notas).toMatchObject([{ tipo: 'reaccion_comida', momento: 'otro', alimento: 'helado' }])
    expect(ver('el helado me cayó pesado').notas).toMatchObject([{ tipo: 'reaccion_comida', alimento: 'helado' }])
    expect(ver('las empanadas me cayeron pesadas').notas).toMatchObject([{ tipo: 'reaccion_comida', alimento: 'empanadas' }])
  })
  it('no se confunde con el rendimiento si la pregunta era del entreno', () => {
    expect(ver('me cayó pesado el helado', 'rendimiento')).toMatchObject({ campos: {}, notas: [{ alimento: 'helado' }] })
  })
  it('negativas: el entreno, el jefe o lo negado NO son comida', () => {
    expect(ver('el entreno me cayó pesado', 'rendimiento')).toEqual({ campos: { rendimiento: 'MALA' }, notas: [] })
    expect(ver('el jefe me cayó pesado').notas).toEqual([])
    expect(ver('el helado no me cayó pesado').notas).toEqual([])
    expect(ver('comí pasta y el entreno me cayó pesado', 'rendimiento')).toEqual({ campos: { rendimiento: 'MALA' }, notas: [] })
  })
})

describe('«X pero Y» sobre el mismo campo: pesa lo de después del «pero»', () => {
  it('«dormí bien pero descansé poco» ya no ofrece las tres opciones', () => {
    expect(ver('dormí bien pero descansé poco').campos).toEqual({ calidadSueno: ['REGULAR', 'MALA'] })
  })
  it('«ayer dormí mal pero hoy descansé bien» = BUENA', () => {
    expect(ver('ayer dormí mal pero hoy descansé bien').campos).toEqual({ calidadSueno: ['BUENA'] })
  })
  it('sin «pero» el conflicto se queda como estaba (las tres opciones)', () => {
    expect(ver('dormí bien y descansé poco').campos.calidadSueno).toHaveLength(3)
  })
  it('campos distintos no se tocan: «dormí fatal pero el entreno bien»', () => {
    expect(ver('dormí fatal pero el entreno bien').campos).toEqual({ calidadSueno: 'MALA', rendimiento: 'BUENA' })
  })
})
