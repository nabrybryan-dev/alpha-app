import { describe, expect, it } from 'vitest'
import { noAfirmable, verificarCifra, verificarCifras, type Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'

/**
 * ARNÉS DE LA FASE 0 (M9). La verdad conocida aquí son los ERRORES PLANTADOS: cifras
 * fabricadas a propósito con un defecto concreto, que el verificador tiene que rechazar con
 * el código de ese defecto y no con otro. Y los CONTROLES: cifras sin defecto que tiene que
 * dejar pasar, porque un verificador que rechaza todo también "pasa" los plantados.
 */

const base: Cifra = {
  id: 'prueba.masa',
  valor: 80,
  unidad: 'kg',
  estado: 'calculado',
  fuente: ['prueba.fuente'],
  supuestos: [],
  banda: null,
  version: VERSION_DEL_MODELO,
}
const con = (cambio: Partial<Cifra>): Cifra => ({ ...base, ...cambio })
const codigos = (c: Cifra) => verificarCifra(c).map((e) => e.codigo)

describe('controles: cifras sin defecto pasan', () => {
  it('una cifra calculada con fuente y unidad', () => {
    expect(verificarCifra(base)).toEqual([])
  })
  it('una estimación con banda que contiene el valor', () => {
    const c = con({ estado: 'estimado', banda: { inf: 70, sup: 90, nivel: 'p5-p95' }, valor: 80 })
    expect(verificarCifra(c)).toEqual([])
  })
  it('un cero legítimo (momento que de verdad vale 0) con estado calculado y fuente', () => {
    expect(verificarCifra(con({ valor: 0, unidad: 'N·m' }))).toEqual([])
  })
  it('un no_afirmable bien hecho: null, motivo y sin fuente', () => {
    expect(verificarCifra(noAfirmable('x', 'N·m', 'falta la talla', VERSION_DEL_MODELO))).toEqual([])
  })
  it('una cifra que depende de otra con valor', () => {
    const c = con({ dependeDe: [base] })
    expect(verificarCifra(c)).toEqual([])
  })
})

describe('plantados: los tres errores del criterio de la fase 0', () => {
  it('1. cero donde va null: no_afirmable con valor 0', () => {
    const c = con({ estado: 'no_afirmable', valor: 0, motivo: 'falta la masa', fuente: [] })
    expect(codigos(c)).toEqual(['E_CERO_POR_NULL'])
  })
  it('2. unidad sin declarar: texto fuera del conjunto cerrado', () => {
    const c = con({ unidad: 'kilos' as unknown as Cifra['unidad'] })
    expect(codigos(c)).toEqual(['E_UNIDAD_NO_DECLARADA'])
  })
  it('2b. unidad sin declarar: undefined', () => {
    const c = con({ unidad: undefined as unknown as Cifra['unidad'] })
    expect(codigos(c)).toEqual(['E_UNIDAD_NO_DECLARADA'])
  })
  it('3. cifra sin procedencia: valor y sin fuente', () => {
    expect(codigos(con({ fuente: [] }))).toEqual(['E_SIN_PROCEDENCIA'])
  })
  it('3b. cifra sin procedencia: fuente vacía en blanco', () => {
    expect(codigos(con({ fuente: ['  '] }))).toEqual(['E_SIN_PROCEDENCIA'])
  })
})

describe('plantados extra: el null no se convierte en número por el camino', () => {
  const faltante = noAfirmable('entrada', 'kg', 'sin masa', VERSION_DEL_MODELO)
  it('un cero calculado a partir de una entrada null se rechaza', () => {
    const c = con({ valor: 0, dependeDe: [faltante] })
    expect(codigos(c)).toEqual(['E_NULL_NO_SE_PROPAGA'])
  })
  it('valor null sin declararlo no_afirmable', () => {
    expect(codigos(con({ valor: null }))).toEqual(['E_NULL_SIN_ESTADO'])
  })
  it('no_afirmable sin motivo', () => {
    expect(codigos(con({ estado: 'no_afirmable', valor: null, motivo: '', fuente: [] }))).toEqual(['E_SIN_MOTIVO'])
  })
  it('NaN e infinito no son números', () => {
    expect(codigos(con({ valor: NaN }))).toContain('E_VALOR_NO_FINITO')
    expect(codigos(con({ valor: Infinity }))).toContain('E_VALOR_NO_FINITO')
  })
  it('una estimación sin banda', () => {
    expect(codigos(con({ estado: 'estimado' }))).toEqual(['E_ESTIMADO_SIN_BANDA'])
  })
  it('banda que no contiene el valor, o invertida', () => {
    expect(codigos(con({ banda: { inf: 10, sup: 20, nivel: 'x' } }))).toEqual(['E_BANDA_INCOHERENTE'])
    expect(codigos(con({ banda: { inf: 90, sup: 70, nivel: 'x' } }))).toEqual(['E_BANDA_INCOHERENTE'])
  })
  it('banda invertida aunque no haya valor que contener (la comprobación de orden es propia)', () => {
    const c = { ...noAfirmable('x', 'N·m', 'falta la talla', VERSION_DEL_MODELO), banda: { inf: 9, sup: 3, nivel: 'x' } }
    expect(codigos(c)).toEqual(['E_BANDA_INCOHERENTE'])
  })
  it('estado inventado, sin versión y sin id', () => {
    expect(codigos(con({ estado: 'seguro' as unknown as Cifra['estado'] }))).toEqual(['E_ESTADO_DESCONOCIDO'])
    expect(codigos(con({ version: '' }))).toEqual(['E_SIN_VERSION'])
    expect(codigos(con({ id: '' }))).toEqual(['E_SIN_ID'])
  })
})

describe('un conjunto', () => {
  it('junta los errores de todas las cifras', () => {
    const malas = [con({ id: 'a', fuente: [] }), con({ id: 'b', unidad: 'x' as never })]
    const errores = verificarCifras(malas)
    expect(errores.map((e) => `${e.cifra}:${e.codigo}`)).toEqual(['a:E_SIN_PROCEDENCIA', 'b:E_UNIDAD_NO_DECLARADA'])
  })
})
