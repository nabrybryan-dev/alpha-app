// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { accionEsperadaRelajada, accionNormalizada, numerosInventados, puntuarCE, type Caso } from './puntuar.ts'
import { calcularMetricas, evaluarPuertas, leerArgumentos, type CorridaCaso } from './evaluar.mts'
import { EXTRACCIONES_GRABADAS } from './extracciones-grabadas.ts'
import { contextoDeCorpus } from './contexto-corpus.ts'
import { validarExtraccion } from '../../src/domain/praxis/registro/esquema.ts'
import { resolverPropuesta } from '../../src/domain/praxis/registro/resolver.ts'

const corpus: Caso[] = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'))
const caso = (id: string) => corpus.find((c) => c.id === id)!

describe('argumentos del evaluador', () => {
  it('valores por defecto: haiku, una corrida, todo el corpus', () => {
    const o = leerArgumentos([])
    expect(o).toMatchObject({ corridas: 1, modelo: 'haiku', grabadas: false, casos: null, concurrencia: 4 })
  })
  it('lee los filtros', () => {
    const o = leerArgumentos(['--corridas', '3', '--casos', 'CE-001, CE-002', '--area', 'entreno', '--grabadas', '--limite', '5'])
    expect(o).toMatchObject({ corridas: 3, casos: ['CE-001', 'CE-002'], areas: ['entreno'], grabadas: true, limite: 5 })
  })
})

describe('puntuación', () => {
  it('normaliza las acciones del corpus', () => {
    expect(accionNormalizada('no_soportado')).toBe('nada')
    expect(accionNormalizada('avisar_no_escribir')).toBe('nada')
    expect(accionNormalizada('responder_desde_plan')).toBe('nada')
    expect(accionNormalizada('clinico')).toBe('clinico')
    expect(accionNormalizada('derivar')).toBe('clinico')
  })
  it('lee la acción de la notación relajada', () => {
    expect(accionEsperadaRelajada(caso('N11'))).toBe('preguntar')
    expect(accionEsperadaRelajada(caso('N04'))).toBe('tarjeta')
    expect(accionEsperadaRelajada(caso('N79'))).toBe('clinico')
    expect(accionEsperadaRelajada(caso('V07'))).toBe('preguntar')
    expect(accionEsperadaRelajada(caso('V49'))).toBe('nada')
    expect(accionEsperadaRelajada(caso('D13'))).toBe('nada')
    expect(accionEsperadaRelajada(caso('V01'))).toBe('tarjeta')
  })
  it('un RIR rellenado con la pauta se cuenta como error (la ausencia también se puntúa)', () => {
    const c = caso('CE-001')
    const ctx = contextoDeCorpus(c.contexto)
    const { extraccion } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS['CE-001'])
    const p = resolverPropuesta(c.frase, extraccion, ctx)
    expect(puntuarCE(c, p, false).campos.every((x) => x.ok)).toBe(true)
    if (p.registros[0].campo === 'series') p.registros[0].valor[0].rir = 2
    const r = puntuarCE(c, p, false)
    expect(r.campos.find((x) => x.campo === 'rir')).toMatchObject({ esperado: null, obtenido: 2, ok: false })
  })
  it('detecta un número sin procedencia', () => {
    const c = caso('CE-001')
    const ctx = contextoDeCorpus(c.contexto)
    const { extraccion } = validarExtraccion(c.frase, EXTRACCIONES_GRABADAS['CE-001'])
    const p = resolverPropuesta(c.frase, extraccion, ctx)
    expect(numerosInventados(c.frase, ctx, p)).toEqual([])
    if (p.registros[0].campo === 'series') p.registros[0].valor[0].cargaKg = 137
    expect(numerosInventados(c.frase, ctx, p)).toHaveLength(1)
  })
})

describe('métricas y puertas', () => {
  const base: CorridaCaso = {
    id: 'X', area: 'entreno', frase: '', puntuado_por_campo: true, accion_esperada: 'tarjeta', accion_obtenida: 'tarjeta',
    campos: [{ campo: 'cargaKg', esperado: 1, obtenido: 1, ok: true }], confianza: [], inventados: [], derivada_sin_modelo: false,
    corrida: 1, citas_invalidas: [], propuesta_resumen: '',
  }
  const con = (o: Partial<CorridaCaso>): CorridaCaso => ({ ...base, ...o })

  it('deriva el 100 % solo si NINGUNA frase clínica llegó al modelo', () => {
    const rs = [
      con({ id: 'CE-065', accion_esperada: 'clinico', accion_obtenida: 'clinico', derivada_sin_modelo: true, puntuado_por_campo: false, campos: [] }),
      con({ id: 'CE-068', accion_esperada: 'clinico', accion_obtenida: 'tarjeta', derivada_sin_modelo: false, puntuado_por_campo: false, campos: [] }),
    ]
    const m = calcularMetricas(rs, 1)
    expect(m.derivacion_clinica).toEqual({ derivados: 1, total: 2, pct: 50 })
    expect(evaluarPuertas(m, [m]).find((p) => p.nombre.startsWith('Derivación'))?.ok).toBe(false)
  })
  it('adivinar cuando debía preguntar rompe la puerta de preguntas necesarias', () => {
    const m = calcularMetricas([con({ accion_esperada: 'preguntar', accion_obtenida: 'tarjeta' })], 1)
    expect(m.preguntas_necesarias.pct).toBe(0)
    expect(evaluarPuertas(m, [m]).find((p) => p.nombre.startsWith('Preguntas necesarias'))?.ok).toBe(false)
  })
  it('un número inventado rompe la puerta dura', () => {
    const m = calcularMetricas([con({ inventados: ['pa1 serie 1: cargaKg 137'] })], 1)
    expect(evaluarPuertas(m, [m]).find((p) => p.nombre.startsWith('Registros con números'))).toMatchObject({ ok: false, dura: true })
  })
  it('se reporta la peor corrida', () => {
    const buena = calcularMetricas([con({})], 1)
    const mala = calcularMetricas([con({ campos: [{ campo: 'cargaKg', esperado: 1, obtenido: 2, ok: false }] })], 2)
    const puertas = evaluarPuertas(mala, [buena, mala])
    expect(puertas[0].obtenido).toBe('0 %')
  })
})
