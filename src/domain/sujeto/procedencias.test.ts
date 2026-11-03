import { describe, expect, it } from 'vitest'
import type { Cifra } from './contrato'
import { VERSION_DEL_MODELO } from './convenciones'
import { leerProcedencias, verificarFuentesDeCifras, verificarValoresRegistrados } from './procedencias'

/** El libro de pruebas: mismo formato que `PROCEDENCIAS.tsv`, con una fila por cifra. */
const TSV = [
  'cifra\tque_es\tcomando_que_la_produce\testado\tfecha\tnota',
  '0.25\t[tabla.a] valor a\tlibro p.1\ttranscrito\t2026-10-20\tn',
  '0.75\t[tabla.b] valor b\tlibro p.1\ttranscrito\t2026-10-20\tn',
  '12.2\t[inventada.c] cifra sin origen\t-\tINVENTADO\t2026-10-08\tn',
  '441.9\tbrazo de momento, fila antigua sin id\tpy x.py\tANCLA AJENA\t2026-10-08\tn',
].join('\n')

const cifra = (fuente: string[]): Cifra => ({
  id: 'c',
  valor: 1,
  unidad: 'kg',
  estado: 'calculado',
  fuente,
  supuestos: [],
  banda: null,
  version: VERSION_DEL_MODELO,
})

describe('leerProcedencias', () => {
  it('lee solo las filas cuya segunda columna empieza por [id]', () => {
    expect(leerProcedencias(TSV).map((f) => f.id)).toEqual(['tabla.a', 'tabla.b', 'inventada.c'])
  })
})

describe('verificarValoresRegistrados (código contra libro)', () => {
  it('control: valores que coinciden pasan', () => {
    expect(verificarValoresRegistrados({ 'tabla.a': 0.25, 'tabla.b': 0.75 }, TSV)).toEqual([])
  })
  it('plantado 1: constante sin fila en el libro', () => {
    expect(verificarValoresRegistrados({ 'tabla.z': 1 }, TSV).map((p) => p.problema)).toEqual(['sin_fila'])
  })
  it('plantado 2: el código cambió y el libro no', () => {
    expect(verificarValoresRegistrados({ 'tabla.a': 0.26 }, TSV).map((p) => p.problema)).toEqual(['valor_distinto'])
  })
  it('plantado 3: fila marcada INVENTADO', () => {
    const p = verificarValoresRegistrados({ 'inventada.c': 12.2 }, TSV)
    expect(p.map((x) => x.problema)).toEqual(['estado_que_no_respalda'])
  })
  it('plantado 4: fila duplicada', () => {
    const doble = TSV + '\n0.25\t[tabla.a] otra vez\tlibro\ttranscrito\t2026-10-20\tn'
    expect(verificarValoresRegistrados({ 'tabla.a': 0.25 }, doble).map((p) => p.problema)).toEqual(['fila_duplicada'])
  })
  it('compara como número: 0.250 es 0.25', () => {
    const tsv = TSV.replace('0.25\t', '0.250\t')
    expect(verificarValoresRegistrados({ 'tabla.a': 0.25 }, tsv)).toEqual([])
  })
})

describe('verificarFuentesDeCifras (cifra contra libro)', () => {
  it('control: fuente que existe', () => {
    expect(verificarFuentesDeCifras([cifra(['tabla.a'])], TSV)).toEqual([])
  })
  it('plantado: fuente que el libro no tiene', () => {
    expect(verificarFuentesDeCifras([cifra(['no.existe'])], TSV).map((p) => p.problema)).toEqual(['sin_fila'])
  })
  it('plantado: fuente marcada INVENTADO', () => {
    expect(verificarFuentesDeCifras([cifra(['inventada.c'])], TSV).map((p) => p.problema)).toEqual([
      'estado_que_no_respalda',
    ])
  })
})
