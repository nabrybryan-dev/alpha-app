// @vitest-environment node
/**
 * Los seis huecos de los conectores, firmados por Bryan el 8-nov-2026
 * (biblioteca-praxis/CAMBIO-PROPUESTO-HUECOS-CONECTORES-20261108.md). ESCRITAS POR IA: SOLO PRUEBA, NO ENTRENAN.
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

describe('1. «descansé» (sueño, solo con el área de sueño)', () => {
  it('bien = BUENA; poco = REGULAR o MALA', () => {
    expect(salida('descansé bien', 'calidadSueno')).toEqual({ calidadSueno: 'BUENA' })
    expect(salida('descansé poco', 'calidadSueno')).toEqual({ calidadSueno: ['REGULAR', 'MALA'] })
  })
  it('negativas: sin área de sueño no llena nada; «no descansé bien» sigue MALA', () => {
    expect(salida('descansé bien')).toEqual({})
    expect(salida('descansé bien', 'rendimiento')).toEqual({})
    expect(salida('no descansé bien', 'calidadSueno')).toEqual({ calidadSueno: 'MALA' })
  })
})

describe('2. «molida» (cansancio)', () => {
  it('sola = MUCHO', () => {
    expect(salida('estoy molida', 'cansancio')).toEqual({ cansancio: 'MUCHO' })
  })
  it('con parte del cuerpo no llena el cansancio', () => {
    expect(salida('estoy molida de las piernas', 'cansancio')).toEqual({})
    expect(salida('quedé molido del pecho', 'cansancio')).toEqual({})
  })
})

describe('3. «pesada» después de comer no es rendimiento', () => {
  it('no da MALA en rendimiento', () => {
    expect(salida('me sentí pesada después del almuerzo', 'rendimiento')).toEqual({})
    expect(salida('me sentí pesado después de la cena', 'rendimiento')).toEqual({})
  })
  it('control: «lo sentí pesado» del entreno sigue siendo MALA', () => {
    expect(salida('el entreno lo sentí pesado')).toEqual({ rendimiento: 'MALA' })
  })
})

describe('4. «a tope»', () => {
  it('rendimiento BUENA; motivación MUCHO; estrés sigue MUCHO', () => {
    expect(salida('estuve a tope en el entreno')).toEqual({ rendimiento: 'BUENA' })
    expect(salida('motivada a tope', 'motivacion')).toEqual({ motivacion: 'MUCHO' })
    expect(salida('estrés a tope')).toEqual({ estres: 'MUCHO' })
  })
})

describe('5. «ando con toda» depende de la pregunta', () => {
  it('motivación MUCHO; cansancio POCO', () => {
    expect(salida('ando con toda', 'motivacion')).toEqual({ motivacion: 'MUCHO' })
    expect(salida('ando con toda', 'cansancio')).toEqual({ cansancio: 'POCO' })
  })
  it('negativas: rendimiento, sin área y negado no llenan nada', () => {
    expect(salida('ando con toda', 'rendimiento')).toEqual({})
    expect(salida('ando con toda')).toEqual({})
    expect(salida('no ando con toda', 'motivacion')).toEqual({})
  })
})

describe('6. «fresca»', () => {
  it('cansancio POCO; estrés POCO si la pregunta es de estrés', () => {
    expect(salida('me siento fresca', 'cansancio')).toEqual({ cansancio: 'POCO' })
    expect(salida('me siento fresca', 'estres')).toEqual({ estres: 'POCO' })
  })
  it('sin área no llena nada', () => {
    expect(salida('me siento fresca')).toEqual({})
  })
})
