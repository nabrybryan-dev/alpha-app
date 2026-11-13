import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MAX_FRASE_HUECO, normalizarHueco } from './hueco.ts'
import { limpiarFrase } from './limpiador.ts'
import { soloVocabulario } from './vocabularioPermitido.ts'
import { VOCABULARIO_CHARLA } from './vocabularioCharla.generado.ts'

const limpia = (f: string): string => soloVocabulario(limpiarFrase(f, [], { mayusculas: false }).texto, new Set(VOCABULARIO_CHARLA))

describe('normalizarHueco', () => {
  it('dos frases equivalentes (otro orden, tildes, mayúsculas, signos) dan la misma clave', () => {
    const a = normalizarHueco('¿Cuántas series por semana para el pecho?')
    const b = normalizarHueco('para el pecho, cuantas SERIES por semana')
    expect(a.temaClave).toBe(b.temaClave)
    expect(a.temaClave.length).toBeGreaterThan(0)
  })
  it('frases de otro tema dan otra clave', () => {
    expect(normalizarHueco('¿cuántas series por semana para el pecho?').temaClave).not.toBe(normalizarHueco('¿cuánto descanso entre sentadillas?').temaClave)
  })
  it('es determinista', () => {
    const f = '¿cuántas series por semana para el pecho?'
    expect(normalizarHueco(f)).toEqual(normalizarHueco(f))
  })
  it('la frase sale con tope de 300 caracteres', () => {
    const larga = 'series '.repeat(200)
    expect(normalizarHueco(larga).frase.length).toBeLessThanOrEqual(MAX_FRASE_HUECO)
    expect(MAX_FRASE_HUECO).toBe(300)
  })
  it('solo trae temaClave y frase: sin id de persona', () => {
    expect(Object.keys(normalizarHueco('¿cuántas series?')).sort()).toEqual(['frase', 'temaClave'])
  })
  it('ninguna salida contiene el nombre sembrado, por el camino real de la función', () => {
    const sembrados = ['Zulema', 'Ofelia', 'Eustaquia', 'Berenice']
    const h = normalizarHueco(limpia('Soy Zulema y entreno con mi esposa Ofelia, Eustaquia y Berenice. ¿cuántas series por semana para el pecho?'))
    const salida = JSON.stringify(h).toLowerCase()
    for (const n of sembrados) expect(salida).not.toContain(n.toLowerCase())
  })
  it('las marcas del limpiador y […] no entran en la clave', () => {
    const h = normalizarHueco('[NOMBRE] […] series [PESO] semana')
    expect(h.temaClave).toBe('semana series')
  })
})

describe('nombres de las pruebas (custodio, hallazgo 4)', () => {
  it('ninguna prueba de la charla usa nombres de pila de asesoradas reales', () => {
    const reales = new RegExp(String.raw`\b(` + ['kar' + 'in', 'li' + 'na'].join('|') + String.raw`)\b`, 'i')
    const dir = 'src/domain/praxis/charla/'
    const usan = readdirSync(dir).filter((f) => f.endsWith('.test.ts') && reales.test(readFileSync(dir + f, 'utf8')))
    expect(usan).toEqual([])
  })
})
