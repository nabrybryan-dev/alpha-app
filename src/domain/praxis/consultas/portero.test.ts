import { describe, expect, it } from 'vitest'
import { fichasNecesarias, leerPortero, respuestaDeConsulta, type FichaParaPraxis } from './portero.ts'

const ficha = (id: string, extra: Partial<FichaParaPraxis> = {}): FichaParaPraxis => ({
  id,
  titulo: `Título de ${id}`,
  bandera_salud: false,
  cuerpo: { respuesta_directa: `Respuesta **directa** de ${id}.`, senal_alarma: '' },
  ...extra,
})
const mapa = (...f: FichaParaPraxis[]) => new Map(f.map((x) => [x.id, x]))
const portero = (decision: string, fichaId = 'a', tres = ['a', 'b', 'c']) => ({
  decision, ficha: fichaId, titulo: 'x', prob: 0.9, tres_primeras: tres.map((t) => ({ ficha: t, titulo: t, prob: 0.3 })), quien: 'camilin',
})

describe('leerPortero', () => {
  it('lee las tres decisiones', () => {
    expect(leerPortero(portero('atender'))).toEqual({ decision: 'atender', ficha: 'a', tresPrimeras: ['a', 'b', 'c'] })
    expect(leerPortero(portero('aclarar'))?.decision).toBe('aclarar')
    expect(leerPortero(portero('ninguna'))?.decision).toBe('ninguna')
  })
  it('cualquier forma rara → null', () => {
    for (const x of [null, undefined, 'atender', 3, [], {}, { decision: 'otra', ficha: 'a' }, { decision: 'atender' }, { decision: 'atender', ficha: 'A B' }, { decision: 'atender', ficha: '../x' }]) {
      expect(leerPortero(x)).toBeNull()
    }
  })
  it('descarta ids raros de las tres primeras y se queda con 3', () => {
    const l = leerPortero({ decision: 'aclarar', ficha: 'a', tres_primeras: [{ ficha: 'a' }, { ficha: 'B!' }, null, { ficha: 'b' }, { ficha: 'c' }, { ficha: 'd' }] })
    expect(l?.tresPrimeras).toEqual(['a', 'b', 'c'])
  })
})

describe('fichasNecesarias', () => {
  it('atender: una; aclarar: las tres sin repetir; ninguna: cero', () => {
    expect(fichasNecesarias({ decision: 'atender', ficha: 'a', tresPrimeras: ['a', 'b'] })).toEqual(['a'])
    expect(fichasNecesarias({ decision: 'aclarar', ficha: 'a', tresPrimeras: ['a', 'b', 'a'] })).toEqual(['a', 'b'])
    expect(fichasNecesarias({ decision: 'ninguna', ficha: 'a', tresPrimeras: ['a'] })).toEqual([])
  })
})

describe('respuestaDeConsulta', () => {
  it('atender: la respuesta directa sin asteriscos, y la nota para el coach', () => {
    const r = respuestaDeConsulta(leerPortero(portero('atender'))!, mapa(ficha('a')))
    expect(r?.respuesta).toBe('Respuesta directa de a.')
    expect(r?.nota).toContain('ficha a')
    expect(r?.fichas).toEqual(['a'])
  })
  it('atender: la señal de alarma va siempre debajo si existe', () => {
    const r = respuestaDeConsulta(leerPortero(portero('atender'))!, mapa(ficha('a', { cuerpo: { respuesta_directa: 'Sí.', senal_alarma: 'Si duele al apoyar, para.' } })))
    expect(r?.respuesta).toBe('Sí.\n\nSi duele al apoyar, para.')
  })
  it('NUNCA usa otras partes de la ficha (pueden llevar ranuras con datos de la persona)', () => {
    const f = ficha('a', { cuerpo: { respuesta_directa: 'Sí.', senal_alarma: '', por_que: 'Tu {{microciclo_actual}}' } as FichaParaPraxis['cuerpo'] })
    expect(respuestaDeConsulta(leerPortero(portero('atender'))!, mapa(f))?.respuesta).toBe('Sí.')
  })
  it('ficha con bandera de salud → null: sigue al coach', () => {
    expect(respuestaDeConsulta(leerPortero(portero('atender'))!, mapa(ficha('a', { bandera_salud: true })))).toBeNull()
  })
  it('ficha no publicada (no llegó) o sin respuesta → null', () => {
    expect(respuestaDeConsulta(leerPortero(portero('atender'))!, mapa())).toBeNull()
    expect(respuestaDeConsulta(leerPortero(portero('atender'))!, mapa(ficha('a', { cuerpo: { respuesta_directa: '  ' } })))).toBeNull()
    expect(respuestaDeConsulta(leerPortero(portero('atender'))!, mapa(ficha('a', { cuerpo: null })))).toBeNull()
  })
  it('aclarar: lista numerada solo con fichas contestables', () => {
    const r = respuestaDeConsulta(leerPortero(portero('aclarar'))!, mapa(ficha('a'), ficha('b', { bandera_salud: true }), ficha('c')))
    expect(r?.respuesta).toContain('1) Título de a\n2) Título de c')
    expect(r?.respuesta).not.toContain('Título de b')
    expect(r?.fichas).toEqual(['a', 'c'])
  })
  it('aclarar con menos de 2 opciones contestables → null', () => {
    expect(respuestaDeConsulta(leerPortero(portero('aclarar'))!, mapa(ficha('a')))).toBeNull()
  })
  it('ninguna → null', () => {
    expect(respuestaDeConsulta(leerPortero(portero('ninguna'))!, mapa(ficha('a'), ficha('b'), ficha('c')))).toBeNull()
  })
})
