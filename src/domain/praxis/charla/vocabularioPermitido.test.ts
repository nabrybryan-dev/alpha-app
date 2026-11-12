import { describe, expect, it } from 'vitest'
import { limpiarFrase, NOMBRES_COMUNES } from './limpiador.ts'
import { VOCABULARIO_CHARLA } from './vocabularioCharla.generado.ts'
import { PALABRAS_COMUNES } from './vocabularioComun.ts'
import { armarVocabulario, normalizarPalabra, soloVocabulario } from './vocabularioPermitido.ts'

const VOCAB = new Set(VOCABULARIO_CHARLA)
/** El camino real de la función: limpiador de patrones (sin la regla de mayúsculas) y luego el vocabulario. */
const filtrar = (f: string): string => soloVocabulario(limpiarFrase(f, [], { mayusculas: false }).texto, VOCAB)

describe('soloVocabulario: unidad', () => {
  const v = new Set(['cuantas', 'series', 'sentadilla', 'schoenfeld', 'por', 'semana'])
  it('conserva lo permitido sin tildes ni mayúsculas y cambia lo demás por […] colapsado', () => {
    expect(soloVocabulario('¿Cuántas series por semana?', v)).toBe('¿cuantas series por semana?')
    expect(soloVocabulario('entreno con zulema ramirez series', v)).toBe('[…] series')
  })
  it('(c) los términos de pieza con mayúscula NO se tapan', () => {
    expect(soloVocabulario('La Sentadilla de Schoenfeld', new Set([...v, 'la', 'de']))).toBe('la sentadilla de schoenfeld')
  })
  it('(d) una palabra rara fuera del vocabulario se tapa (falla seguro)', () => {
    expect(soloVocabulario('series xilofonista semana', v)).toBe('series […] semana')
  })
  it('números de una o dos cifras pasan; de tres o más, no', () => {
    expect(soloVocabulario('series 3 por 12 y 3x10 o 120 o 2026', v)).toBe('series 3 por 12 […] 3x10 […]')
  })
  it('mantiene ¿ ? y la puntuación básica; descarta el resto de símbolos', () => {
    expect(soloVocabulario('¡series, por semana! @juan #x', v)).toBe('¡series, por semana! […]')
  })
  it('las marcas del limpiador de patrones se respetan', () => {
    expect(soloVocabulario('series [PESO] por [NOMBRE]', v)).toBe('series [PESO] por [NOMBRE]')
  })
})

describe('armarVocabulario', () => {
  const piezas = [
    { pregunta_que_responde: '¿Qué es el RIR?', contexto: 'Repeticiones en reserva', respuesta: 'Lo que sobra', de_que_depende: ['nivel', 'objetivo'], estudios: 'Schoenfeld 2017', criterio_de_practica: null, citas: 'no entra' },
  ]
  it('toma solo los campos de la pieza, sin tildes, y excluye los nombres', () => {
    const v = armarVocabulario(piezas, ['el', 'que'], ['Schoenfeld', 'Nivel'])
    expect(v).toContain('rir')
    expect(v).toContain('reserva')
    expect(v).toContain('objetivo')
    expect(v).not.toContain('no')
    expect(v).not.toContain('entra')
    expect(v).not.toContain('schoenfeld')
    expect(v).not.toContain('nivel')
    expect(v).toEqual([...v].sort())
  })
})

describe('(a) nombres inventados que antes pasaban', () => {
  const casos: [string, string[]][] = [
    ['entreno con zulema', ['zulema']],
    ['Zacarias pregunta cuantas series', ['zacarias']],
    ['mi correo es juan punto perez arroba correo punto com', ['juan', 'perez']],
    ['vivo en el barrio las acacias', ['acacias', 'barrio']],
    ['entreno con Wenceslao y Ofelia en el gimnasio', ['wenceslao', 'ofelia']],
  ]
  for (const [frase, prohibidas] of casos) {
    it(frase, () => {
      const sale = filtrar(frase).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      for (const p of prohibidas) expect(sale).not.toContain(p)
    })
  }
})

describe('(b) preguntas de dominio legítimas salen casi intactas', () => {
  const preguntas = [
    '¿Cuántas series por músculo a la semana?',
    '¿Cuánto descanso entre series?',
    '¿Qué es el RIR?',
    '¿Cuántas repeticiones conviene hacer para ganar músculo?',
    '¿La sentadilla sirve para el glúteo?',
    '¿Cuántas veces por semana debo entrenar cada músculo?',
    '¿Cuánto tarda en notarse la hipertrofia?',
    '¿Es mejor entrenar al fallo o dejar repeticiones en reserva?',
    '¿Cuánta proteína necesito al día?',
    '¿Importa el tempo de la repetición?',
  ]
  it('conserva al menos el 80 % de las palabras', () => {
    let total = 0
    let tapadas = 0
    for (const p of preguntas) {
      const sale = filtrar(p)
      const palabras = p.match(/\p{L}+/gu)!.length
      const marcas = (sale.match(/\[…\]/g) ?? []).length
      total += palabras
      tapadas += Math.min(marcas, palabras)
    }
    console.log(`conservadas: ${(((total - tapadas) / total) * 100).toFixed(1)} % (${total - tapadas}/${total})`)
    expect((total - tapadas) / total).toBeGreaterThanOrEqual(0.8)
  })
})

describe('(e) el vocabulario no contiene nombres de persona', () => {
  it('ninguno de NOMBRES_COMUNES', () => {
    for (const n of NOMBRES_COMUNES) expect(VOCAB.has(normalizarPalabra(n))).toBe(false)
  })
  it('ni las palabras comunes ni las de las piezas traen un nombre', () => {
    for (const n of NOMBRES_COMUNES) expect(PALABRAS_COMUNES.map(normalizarPalabra)).not.toContain(normalizarPalabra(n))
  })
  it('el módulo generado lleva la cabecera de no editar', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('src/domain/praxis/charla/vocabularioCharla.generado.ts', 'utf8').startsWith('// GENERADO: no editar a mano')).toBe(true)
  })
})
