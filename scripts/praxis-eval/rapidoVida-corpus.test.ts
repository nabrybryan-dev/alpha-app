// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contextoDeCorpus } from './contexto-corpus.ts'
import { puntuarRelajado, type Caso } from './puntuar.ts'
import { validarExtraccion } from '../../src/domain/praxis/registro/esquema.ts'
import { resolverPropuesta } from '../../src/domain/praxis/registro/resolver.ts'
import { resolverVida } from '../../src/domain/praxis/registro/vida.ts'
import { armarContexto } from '../../src/domain/praxis/registro/contexto.ts'
import { caminoRapidoVida, extraerRapidoVida } from '../../src/domain/praxis/registro/rapidoVida.ts'
import type { VidaExtraida } from '../../src/domain/praxis/registro/tipos.ts'

/**
 * EXPERIMENTO PREVIO del camino rápido local de agua, sueño y pasos (sin API, sin servidor):
 *  1. Corpus de 240 casos: toda frase que la gramática acepta debe dar la MISMA propuesta que el camino de siempre
 *     (la extracción cruda que sacó Haiku en el último informe, pasada por `resolverPropuesta`) y la misma acción
 *     que lo esperado. Lo que no acepta es `null` y sigue al servidor: no se mide, solo se cuenta.
 *  2. Casos «duros» (`__duros__/duros.test.ts`, 203): con la cita que el caso fija para el modelo, `resolverVida`
 *     debe dar el mismo resultado que con la cita que arma la gramática, en cada frase que acepta.
 */
const corpus = JSON.parse(readFileSync('scripts/praxis-eval/corpus.json', 'utf8')) as Caso[]
const informe = JSON.parse(readFileSync('scripts/praxis-eval/informes/ultimo/informe.json', 'utf8')) as { casos: { id: string; bruto?: unknown }[] }

const aceptadosCorpus = corpus.filter((c) => caminoRapidoVida(c.frase, contextoDeCorpus(c.contexto)) !== null)

describe('rapidoVida · corpus de Praxis', () => {
  it('cobertura: cuántos acepta y cuántos rechaza (cifras del experimento)', () => {
    const vida = corpus.filter((c) => c.area === 'vida')
    const aceptadosVida = vida.filter((c) => aceptadosCorpus.includes(c))
    console.log(`CORPUS: ${corpus.length} casos; acepta ${aceptadosCorpus.length}, rechaza ${corpus.length - aceptadosCorpus.length}; ` +
      `casos V (vida): ${vida.length}, acepta ${aceptadosVida.length}, rechaza ${vida.length - aceptadosVida.length}; ` +
      `aceptados: ${aceptadosCorpus.map((c) => `${c.id} «${c.frase}»`).join(' | ')}`)
    expect(aceptadosCorpus.length).toBeGreaterThan(0)
  })

  it('nunca acepta una frase de entreno, comida ni clínica del corpus', () => {
    for (const c of aceptadosCorpus) expect(['vida', 'nutricion'].includes(c.area) && /^(V|N)\d/.test(c.id), c.id).toBe(true)
  })

  it.each(aceptadosCorpus.map((c) => [c.id, c] as const))('%s: misma propuesta que sacó Haiku y misma acción esperada', (id, c) => {
    const ctx = contextoDeCorpus(c.contexto)
    const r = caminoRapidoVida(c.frase, ctx)!
    const vm = validarExtraccion(c.frase, r.bruto)
    const mio = resolverPropuesta(c.frase, vm.extraccion, ctx, vm.citasInvalidas)
    expect(puntuarRelajado(c, mio, false).campos.filter((x) => !x.ok)).toEqual([])
    const bruto = informe.casos.find((x) => x.id === id)?.bruto
    if (!bruto) return
    const vh = validarExtraccion(c.frase, bruto)
    expect(JSON.stringify(mio)).toBe(JSON.stringify(resolverPropuesta(c.frase, vh.extraccion, ctx, vh.citasInvalidas)))
  })
})

// --- Casos duros: frases y citas fijadas a mano (se leen del archivo, que no exporta sus casos) ---
const fuenteDuros = readFileSync('src/domain/praxis/registro/__duros__/duros.test.ts', 'utf8')
const duros: { frase: string; ext: Record<string, unknown> }[] = []
for (const m of fuenteDuros.matchAll(/^c\('[^']*', '((?:[^'\\]|\\.)*)', (\{.*?\}), \{/gm)) {
  try {
    const ext = new Function(`return (${m[2]})`)() as Record<string, unknown>
    duros.push({ frase: m[1].replace(/\\'/g, "'"), ext })
  } catch { /* una línea que no es literal simple: no entra al experimento */ }
}
const ctxDuros = () => armarContexto({ ahora: '2026-11-07T12:00:00-05:00', activo: null, hidratacionHoyMl: 0 })
const vacio = (): VidaExtraida => ({
  sueno_horas: null, hora_acostarse: null, hora_levantarse: null, calidad_sueno: null, pasos: null,
  actividad_sin_numero: null, agua: null, escalas: [], senales: [],
})
const aceptadosDuros = duros.filter((d) => extraerRapidoVida(d.frase) !== null)

describe('rapidoVida · casos duros', () => {
  it('cobertura: cuántos acepta y cuántos rechaza (cifras del experimento)', () => {
    console.log(`DUROS: ${duros.length} frases leídas; acepta ${aceptadosDuros.length}, rechaza ${duros.length - aceptadosDuros.length}; ` +
      `aceptadas: ${aceptadosDuros.map((d) => `«${d.frase}»`).join(' | ')}`)
    expect(duros.length).toBeGreaterThan(150)
  })

  it.each(aceptadosDuros.map((d) => [d.frase, d] as const))('«%s»: mismo resultado con la cita del caso y con la de la gramática', (_f, d) => {
    const bruto = extraerRapidoVida(d.frase) as { vida: { sueno_horas?: string; pasos?: string; agua?: { cantidad: string; medida: string | null } } }
    const e = d.ext
    const delModelo: VidaExtraida = {
      ...vacio(),
      sueno_horas: (e.s as string) ?? null, pasos: (e.p as string) ?? null,
      agua: e.w ? { cantidad: (e.w as [string, string | null])[0], medida: (e.w as [string, string | null])[1] } : null,
      senales: (e.sen as VidaExtraida['senales']) ?? [],
    }
    const mia: VidaExtraida = { ...vacio(), ...bruto.vida }
    expect(JSON.stringify(resolverVida(mia, ctxDuros(), d.frase))).toBe(JSON.stringify(resolverVida(delModelo, ctxDuros(), d.frase)))
  })
})
