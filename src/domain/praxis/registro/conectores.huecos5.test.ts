// @vitest-environment node
/**
 * Quinta ronda (prueba de Claude del 9-nov): «salió bien / salió mal» como rendimiento y «me desperté N veces» como sueño partido.
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

describe('«salió bien» / «salió mal» del entreno', () => {
  it('«durísimo pero salió bien» = rendimiento BUENA (lo duro no es el resultado)', () => {
    expect(ver('hoy el entreno estuvo durísimo pero salió bien', 'rendimiento').campos).toEqual({ rendimiento: 'BUENA' })
  })
  it('«salió bien» y «salió súper bien» = BUENA; «salió mal» = MALA', () => {
    expect(ver('el entreno salió bien', 'rendimiento').campos).toEqual({ rendimiento: 'BUENA' })
    expect(ver('me salió súper bien', 'rendimiento').campos).toEqual({ rendimiento: 'BUENA' })
    expect(ver('el entreno salió mal', 'rendimiento').campos).toEqual({ rendimiento: 'MALA' })
  })
  it('lo negado no se invierte a la ligera: «no salió bien» = MALA', () => {
    expect(ver('no me salió bien el entreno', 'rendimiento').campos).toEqual({ rendimiento: 'MALA' })
  })
  it('control: «salió bien» de otra cosa, sin pregunta ni área, no es rendimiento', () => {
    expect(ver('el examen salió bien').campos).toEqual({})
  })
  it('control: sin «salió», «estuvo durísimo» solo no se inventa un valor', () => {
    expect(ver('hoy el entreno estuvo durísimo', 'rendimiento').campos).toEqual({})
  })
})

describe('«me desperté N veces» = sueño partido', () => {
  it('con el sueño preguntado: la persona elige entre REGULAR y MALA', () => {
    expect(ver('me desperté dos veces', 'calidadSueno').campos).toEqual({ calidadSueno: ['REGULAR', 'MALA'] })
    expect(ver('me desperté varias veces en la noche', 'calidadSueno').campos).toEqual({ calidadSueno: ['REGULAR', 'MALA'] })
  })
  it('dentro de un mensaje largo conserva las horas', () => {
    const r = ver('dormí como seis horas y me desperté dos veces')
    expect(r.campos.horasSueno).toBe(6)
    expect(r.campos.calidadSueno).toEqual(['REGULAR', 'MALA'])
  })
  it('negativas: «no me desperté» y «me desperté temprano» no son sueño partido', () => {
    expect(ver('no me desperté en toda la noche', 'calidadSueno').campos).toEqual({})
    expect(ver('me desperté temprano', 'calidadSueno').campos).toEqual({})
  })
})
