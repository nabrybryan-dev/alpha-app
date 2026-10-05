// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contextoDeCorpus } from './contexto-corpus.ts'
import { puntuarCE, type Caso } from './puntuar.ts'
import { validarExtraccion } from '../../src/domain/praxis/registro/esquema.ts'
import { resolverPropuesta } from '../../src/domain/praxis/registro/resolver.ts'
import { caminoRapido } from '../../src/domain/praxis/registro/rapido.ts'
import { filtrarClinico } from '../../src/domain/praxis/registro/filtroClinico.ts'
import { filtroDeRiesgo } from '../../src/domain/praxis/riesgo.ts'

/**
 * El camino rápido contra el corpus de 240 casos (sin API): en TODA frase que acepta, la
 * propuesta tiene cero diferencias frente a lo esperado del corpus y frente a lo que sacó
 * Haiku en el último informe del banco. Si alguien ensancha la gramática y el corpus se
 * rompe, esta prueba lo dice con el id del caso.
 */
const corpus = JSON.parse(readFileSync('scripts/praxis-eval/corpus.json', 'utf8')) as Caso[]
const informe = JSON.parse(readFileSync('scripts/praxis-eval/informes/ultimo/informe.json', 'utf8')) as { casos: { id: string; bruto?: unknown }[] }

const aceptados = corpus.filter((c) => !filtrarClinico(c.frase) && !filtroDeRiesgo(c.frase) && caminoRapido(c.frase, contextoDeCorpus(c.contexto)) !== null)

describe('camino rápido · corpus de Praxis', () => {
  it('toma al menos las 4 frases simples conocidas, y solo de entreno', () => {
    expect(aceptados.map((c) => c.id)).toEqual(expect.arrayContaining(['CE-003', 'CE-032', 'CE-034', 'CE-035']))
    for (const c of aceptados) expect(c.id.startsWith('CE-'), c.id).toBe(true)
  })

  it.each(aceptados.map((c) => [c.id, c] as const))('%s: cero diferencias frente a lo esperado', (_id, c) => {
    const ctx = contextoDeCorpus(c.contexto)
    const r = caminoRapido(c.frase, ctx)!
    const v = validarExtraccion(c.frase, r.bruto)
    const p = resolverPropuesta(c.frase, v.extraccion, ctx, v.citasInvalidas)
    expect(puntuarCE(c, p, false).campos.filter((x) => !x.ok)).toEqual([])
  })

  it.each(aceptados.map((c) => [c.id, c] as const))('%s: la misma propuesta que sacó Haiku', (id, c) => {
    const ctx = contextoDeCorpus(c.contexto)
    const r = caminoRapido(c.frase, ctx)!
    const mio = resolverPropuesta(c.frase, validarExtraccion(c.frase, r.bruto).extraccion, ctx, [])
    const bruto = informe.casos.find((x) => x.id === id)?.bruto
    if (!bruto) return // el informe no trae la salida cruda de este caso
    const vm = validarExtraccion(c.frase, bruto)
    expect(JSON.stringify(mio)).toBe(JSON.stringify(resolverPropuesta(c.frase, vm.extraccion, ctx, vm.citasInvalidas)))
  })
})
