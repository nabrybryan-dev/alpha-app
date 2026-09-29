/**
 * Evaluador de Praxis: corre el corpus contra el MISMO prompt y el MISMO esquema
 * que usa la Edge Function, con la CLI de Claude en modo no interactivo y sin
 * herramientas, aplica los resolutores y puntúa por campo contra lo esperado.
 *
 *   npx vite-node scripts/praxis-eval/evaluar.mts -- [opciones]
 *
 * Opciones
 *   --corridas N        veces que se corre cada caso (default 1; el diseño pide 3 y
 *                       reporta la PEOR: «una corrida del banco no decide nada»)
 *   --casos a,b,c       solo esos ids (CE-001,N05...)
 *   --area entreno,...  solo esas áreas del corpus
 *   --limite N          solo los N primeros (para una prueba de humo barata)
 *   --grabadas          no llama al modelo: usa las extracciones grabadas a mano
 *                       (aísla el código del modelo; cuesta 0)
 *   --modelo alias      alias del modelo de la CLI (default haiku)
 *   --concurrencia N    llamadas a la CLI en paralelo (default 8)
 *   --salida dir        carpeta del informe (default scripts/praxis-eval/informes/ultimo)
 *   --claude ruta       ejecutable de la CLI (default `claude` del PATH, o CLAUDE_BIN)
 *
 * Qué NO hace: no toca la base, no usa credenciales, no lee .env. La CLI usa la
 * sesión que ya tenga la persona que lo corre; se arranca en una carpeta vacía
 * (sin CLAUDE.md ni memoria) y sin herramientas, servidores MCP ni skills, para
 * que el contexto sea solo el prompt de Praxis.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { contextoDeCorpus } from './contexto-corpus.ts'
import { DISCREPANCIAS_CONOCIDAS, EXTRACCIONES_GRABADAS, EXTRACCIONES_GRABADAS_RELAJADAS } from './extracciones-grabadas.ts'
import { numerosInventados, puntuarCE, puntuarRelajado, type Caso, type ResultadoCaso } from './puntuar.ts'
import { validarExtraccion } from '../../src/domain/praxis/registro/esquema.ts'
import { derivarPorFiltro, filtrarClinico } from '../../src/domain/praxis/registro/filtroClinico.ts'
import { armarMensajeUsuario, PROMPT_SISTEMA, VERSION_PROMPT } from '../../src/domain/praxis/registro/prompt.ts'
import { ESQUEMA_REGISTRO, VERSION_ESQUEMA } from '../../src/domain/praxis/registro/esquema.ts'
import { resolverPropuesta, VERSION_RESOLUTORES } from '../../src/domain/praxis/registro/resolver.ts'
import type { Propuesta } from '../../src/domain/praxis/registro/tipos.ts'

// ---------------------------------------------------------------------------
// Argumentos
// ---------------------------------------------------------------------------

interface Opciones {
  corridas: number
  casos: string[] | null
  areas: string[] | null
  limite: number | null
  grabadas: boolean
  modelo: string
  concurrencia: number
  salida: string
  claude: string
}

export function leerArgumentos(argv: string[]): Opciones {
  const o: Opciones = {
    corridas: 1, casos: null, areas: null, limite: null, grabadas: false, modelo: 'haiku', concurrencia: 8,
    salida: resolve('scripts/praxis-eval/informes/ultimo'), claude: process.env.CLAUDE_BIN ?? 'claude',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const v = () => argv[++i]
    if (a === '--corridas') o.corridas = Math.max(1, Number(v()))
    else if (a === '--casos') o.casos = v().split(',').map((x) => x.trim()).filter(Boolean)
    else if (a === '--area') o.areas = v().split(',').map((x) => x.trim()).filter(Boolean)
    else if (a === '--limite') o.limite = Number(v())
    else if (a === '--grabadas') o.grabadas = true
    else if (a === '--modelo') o.modelo = v()
    else if (a === '--concurrencia') o.concurrencia = Math.max(1, Number(v()))
    else if (a === '--salida') o.salida = resolve(v())
    else if (a === '--claude') o.claude = v()
  }
  return o
}

// ---------------------------------------------------------------------------
// La CLI de Claude
// ---------------------------------------------------------------------------

interface RespuestaModelo {
  salida: unknown
  costoUsd: number
  ms: number
  tokensEntrada: number
  tokensSalida: number
  modelo: string
}

/** Una llamada `claude -p` sin herramientas y con el esquema como salida estructurada. */
export function llamarClaude(mensaje: string, o: Pick<Opciones, 'modelo' | 'claude'>, cwd: string): Promise<RespuestaModelo> {
  const args = [
    '-p', '--model', o.modelo, '--output-format', 'json',
    '--tools', '',
    '--json-schema', JSON.stringify(ESQUEMA_REGISTRO),
    '--system-prompt', PROMPT_SISTEMA,
    '--no-session-persistence', '--disable-slash-commands', '--strict-mcp-config',
    '--exclude-dynamic-system-prompt-sections', '--setting-sources', '',
  ]
  return new Promise((ok, mal) => {
    const t0 = Date.now()
    const hijo = spawn(o.claude, args, {
      cwd,
      env: { ...process.env, MAX_THINKING_TOKENS: '0', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let out = ''
    let err = ''
    const reloj = setTimeout(() => { hijo.kill(); mal(new Error('tiempo agotado (150 s)')) }, 150_000)
    hijo.stdout.on('data', (d) => (out += d))
    hijo.stderr.on('data', (d) => (err += d))
    hijo.on('error', (e) => { clearTimeout(reloj); mal(e) })
    hijo.on('close', (codigo) => {
      clearTimeout(reloj)
      try {
        const j = JSON.parse(out)
        if (j.is_error) throw new Error(`la CLI respondió error: ${String(j.result).slice(0, 200)}`)
        let salida: unknown = j.structured_output
        if (!salida && typeof j.result === 'string') {
          const limpio = j.result.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
          salida = JSON.parse(limpio)
        }
        const uso = j.usage ?? {}
        ok({
          salida,
          costoUsd: Number(j.total_cost_usd ?? 0),
          ms: Number(j.duration_ms ?? Date.now() - t0),
          tokensEntrada: Number(uso.input_tokens ?? 0) + Number(uso.cache_creation_input_tokens ?? 0) + Number(uso.cache_read_input_tokens ?? 0),
          tokensSalida: Number(uso.output_tokens ?? 0),
          modelo: Object.keys(j.modelUsage ?? {})[0] ?? o.modelo,
        })
      } catch (e) {
        mal(new Error(`salida ilegible (código ${codigo}): ${(e as Error).message}. stderr: ${err.slice(0, 200)}`))
      }
    })
    hijo.stdin.end(mensaje)
  })
}

// ---------------------------------------------------------------------------
// Un caso, una corrida
// ---------------------------------------------------------------------------

export interface CorridaCaso extends ResultadoCaso {
  corrida: number
  ms?: number
  costoUsd?: number
  tokensEntrada?: number
  tokensSalida?: number
  modeloId?: string
  /** Lo que devolvió el modelo, sin tocar (para diagnosticar). */
  bruto?: unknown
  citas_invalidas: string[]
  propuesta_resumen: string
  omitido?: string
}

function resumen(p: Propuesta): string {
  if (p.accion === 'preguntar') return `preguntar: ${p.pregunta?.texto}`
  if (p.accion === 'derivar') return `derivar (${p.filtro})`
  if (p.accion === 'nada') return `nada (${p.motivo ?? 'sin datos'})`
  return p.registros
    .map((r) => (r.campo === 'series' ? `${r.ejercicio_id}: ${r.valor.map((s) => `${s.cargaKg}x${s.reps ?? '?'}${s.rir !== undefined ? '@' + s.rir : ''}`).join(', ')} ${r.unidad}` : r.campo))
    .join(' | ')
}

async function correrCaso(c: Caso, corrida: number, o: Opciones, cwd: string): Promise<CorridaCaso> {
  const ctx = contextoDeCorpus(c.contexto)
  let propuesta: Propuesta
  let derivada = false
  let modelo: RespuestaModelo | null = null
  let citas: string[] = []
  let brutoGuardado: unknown

  const marca = filtrarClinico(c.frase)
  if (marca) {
    // Igual que en producción: la frase clínica NO llega al modelo.
    propuesta = derivarPorFiltro(marca)
    derivada = true
  } else {
    let bruto: unknown
    if (o.grabadas) {
      bruto = EXTRACCIONES_GRABADAS[c.id] ?? EXTRACCIONES_GRABADAS_RELAJADAS[c.id]
      if (!bruto) {
        return {
          id: c.id, area: c.area, frase: c.frase, puntuado_por_campo: false, accion_esperada: 'nada', accion_obtenida: 'nada',
          campos: [], confianza: [], inventados: [], derivada_sin_modelo: false, corrida, citas_invalidas: [], propuesta_resumen: '',
          omitido: 'sin extracción grabada',
        }
      }
    } else {
      let ultimoError: Error | null = null
      for (let intento = 0; intento < 2 && !modelo; intento++) {
        try {
          modelo = await llamarClaude(armarMensajeUsuario(ctx, c.frase), o, cwd)
        } catch (e) {
          ultimoError = e as Error
        }
      }
      if (!modelo) {
        return {
          id: c.id, area: c.area, frase: c.frase, puntuado_por_campo: false, accion_esperada: 'nada', accion_obtenida: 'nada',
          campos: [{ campo: 'llamada', esperado: 'respuesta', obtenido: 'error', ok: false }], confianza: [], inventados: [],
          derivada_sin_modelo: false, corrida, citas_invalidas: [], propuesta_resumen: '', error: ultimoError?.message ?? 'error',
        }
      }
      bruto = modelo.salida
    }
    const v = validarExtraccion(c.frase, bruto)
    brutoGuardado = bruto
    citas = v.citasInvalidas
    propuesta = resolverPropuesta(c.frase, v.extraccion, ctx, v.citasInvalidas)
  }

  const r = c.id.startsWith('CE-') ? puntuarCE(c, propuesta, derivada) : puntuarRelajado(c, propuesta, derivada)
  r.inventados = numerosInventados(c.frase, ctx, propuesta)
  return {
    ...r, corrida, bruto: brutoGuardado, citas_invalidas: citas, propuesta_resumen: resumen(propuesta),
    ms: modelo?.ms, modeloId: modelo?.modelo, costoUsd: modelo?.costoUsd, tokensEntrada: modelo?.tokensEntrada, tokensSalida: modelo?.tokensSalida,
  }
}

async function enParalelo<T, R>(items: T[], n: number, f: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(items.length)
  let siguiente = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (siguiente < items.length) {
        const i = siguiente++
        salida[i] = await f(items[i], i)
      }
    }),
  )
  return salida
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

const pct = (a: number, b: number): number | null => (b === 0 ? null : Math.round((a / b) * 1000) / 10)
const percentil = (xs: number[], p: number): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

export interface MetricasCorrida {
  corrida: number
  casos: number
  omitidos: number
  errores: number
  exactitud_campos_ce: number | null
  exactitud_campos_series: number | null
  exactitud_accion: Record<string, number | null>
  derivacion_clinica: { derivados: number; total: number; pct: number | null }
  preguntas_necesarias: { bien: number; total: number; pct: number | null }
  preguntas_justas: { bien: number; total: number; pct: number | null }
  confianza_alta_exacta: { bien: number; total: number; pct: number | null }
  inventados: number
  citas_invalidas: number
  latencia_ms: { p50: number | null; p95: number | null }
  costo_usd: number
}

export function calcularMetricas(rs: CorridaCaso[], corrida: number): MetricasCorrida {
  const validas = rs.filter((r) => !r.omitido && !r.error)
  const ce = validas.filter((r) => r.puntuado_por_campo)
  const campos = ce.flatMap((r) => r.campos)
  const series = campos.filter((c) => !['accion', 'sesion_id'].includes(c.campo))
  const grupo = (f: (r: CorridaCaso) => boolean) => {
    const g = validas.filter(f)
    return pct(g.filter((r) => r.accion_esperada === r.accion_obtenida).length, g.length)
  }
  const clinicos = validas.filter((r) => r.accion_esperada === 'clinico')
  const esperaPreg = validas.filter((r) => r.accion_esperada === 'preguntar')
  const hizoPreg = validas.filter((r) => r.accion_obtenida === 'preguntar')
  const altas = ce.filter((r) => r.confianza.some((c) => c.obtenida === 'alta'))
  const ms = validas.map((r) => r.ms).filter((x): x is number => typeof x === 'number')
  return {
    corrida,
    casos: rs.length,
    omitidos: rs.filter((r) => r.omitido).length,
    errores: rs.filter((r) => r.error).length,
    exactitud_campos_ce: pct(campos.filter((c) => c.ok).length, campos.length),
    exactitud_campos_series: pct(series.filter((c) => c.ok).length, series.length),
    exactitud_accion: {
      todos: grupo(() => true),
      entreno_CE: grupo((r) => r.id.startsWith('CE-')),
      nutricion_N: grupo((r) => r.id.startsWith('N')),
      vida_V: grupo((r) => r.id.startsWith('V')),
      dificiles_D: grupo((r) => r.id.startsWith('D')),
    },
    derivacion_clinica: {
      derivados: clinicos.filter((r) => r.accion_obtenida === 'clinico' && r.derivada_sin_modelo).length,
      total: clinicos.length,
      pct: pct(clinicos.filter((r) => r.accion_obtenida === 'clinico' && r.derivada_sin_modelo).length, clinicos.length),
    },
    preguntas_necesarias: {
      bien: esperaPreg.filter((r) => r.accion_obtenida !== 'tarjeta').length,
      total: esperaPreg.length,
      pct: pct(esperaPreg.filter((r) => r.accion_obtenida !== 'tarjeta').length, esperaPreg.length),
    },
    preguntas_justas: {
      bien: hizoPreg.filter((r) => r.accion_esperada === 'preguntar').length,
      total: hizoPreg.length,
      pct: pct(hizoPreg.filter((r) => r.accion_esperada === 'preguntar').length, hizoPreg.length),
    },
    confianza_alta_exacta: {
      bien: altas.filter((r) => r.campos.every((c) => c.ok)).length,
      total: altas.length,
      pct: pct(altas.filter((r) => r.campos.every((c) => c.ok)).length, altas.length),
    },
    inventados: validas.reduce((n, r) => n + r.inventados.length, 0),
    citas_invalidas: validas.reduce((n, r) => n + r.citas_invalidas.length, 0),
    latencia_ms: { p50: percentil(ms, 0.5), p95: percentil(ms, 0.95) },
    costo_usd: Math.round(rs.reduce((n, r) => n + (r.costoUsd ?? 0), 0) * 10000) / 10000,
  }
}

// ---------------------------------------------------------------------------
// Informe
// ---------------------------------------------------------------------------

interface Puerta { nombre: string; meta: string; obtenido: string; ok: boolean; dura: boolean }

export function evaluarPuertas(peor: MetricasCorrida, todas: MetricasCorrida[]): Puerta[] {
  const min = (f: (m: MetricasCorrida) => number | null): number | null => {
    const xs = todas.map(f).filter((x): x is number => x !== null)
    return xs.length ? Math.min(...xs) : null
  }
  const exacSeries = min((m) => m.exactitud_campos_series)
  const deriv = min((m) => m.derivacion_clinica.pct)
  const necesarias = min((m) => m.preguntas_necesarias.pct)
  const justas = min((m) => m.preguntas_justas.pct)
  const inventados = Math.max(...todas.map((m) => m.inventados))
  const conf = min((m) => m.confianza_alta_exacta.pct)
  return [
    { nombre: 'Exactitud por campo, entreno (series)', meta: '≥ 95 %', obtenido: exacSeries === null ? 'sin datos' : `${exacSeries} %`, ok: exacSeries !== null && exacSeries >= 95, dura: false },
    { nombre: 'Derivación clínica sin llamar al modelo', meta: '100 %', obtenido: deriv === null ? 'sin datos' : `${deriv} %`, ok: deriv === 100, dura: true },
    { nombre: 'Registros con números inventados', meta: '0', obtenido: String(inventados), ok: inventados === 0, dura: true },
    { nombre: 'Preguntas necesarias (no adivinó)', meta: '100 %', obtenido: necesarias === null ? 'sin datos' : `${necesarias} %`, ok: necesarias === 100, dura: true },
    { nombre: 'Preguntas justas (no preguntó de más)', meta: '≥ 90 %', obtenido: justas === null ? 'sin datos' : `${justas} %`, ok: justas !== null && justas >= 90, dura: false },
    { nombre: 'Confianza alta exacta', meta: '≥ 98 %', obtenido: conf === null ? 'sin datos' : `${conf} %`, ok: conf !== null && conf >= 98, dura: false },
    { nombre: 'Latencia p95 (solo modelo)', meta: '≤ 3,5 s de punta a punta', obtenido: peor.latencia_ms.p95 === null ? 'n/a' : `${Math.round(peor.latencia_ms.p95)} ms (CLI, incluye arranque)`, ok: true, dura: false },
  ]
}

function informeMd(meta: Record<string, unknown>, todas: MetricasCorrida[], puertas: Puerta[], corridas: CorridaCaso[][]): string {
  const L: string[] = []
  L.push(`# Informe del evaluador de Praxis`, '')
  L.push(`- Fecha: ${meta.fecha}`)
  L.push(`- Modo: ${meta.modo}  ·  modelo: ${meta.modelo}  ·  corridas: ${meta.corridas}`)
  L.push(`- Versiones: prompt \`${VERSION_PROMPT}\` · esquema \`${VERSION_ESQUEMA}\` · resolutores \`${VERSION_RESOLUTORES}\``)
  L.push(`- Casos: ${meta.casos} (corpus de ${meta.corpus})  ·  costo total: ${meta.costo_usd} USD`, '')
  L.push('## Puertas (peor corrida)', '', '| Puerta | Meta | Obtenido | Estado |', '|---|---|---|---|')
  for (const p of puertas) L.push(`| ${p.nombre} | ${p.meta} | ${p.obtenido} | ${p.ok ? 'verde' : p.dura ? '**ROJA (dura)**' : 'roja'} |`)
  L.push('', '## Métricas por corrida', '', '| Corrida | Campos CE | Series | Acción (todos) | CE | N | V | D | Inventados | Citas inválidas | Errores | p50 ms | p95 ms | USD |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const m of todas) {
    const a = m.exactitud_accion
    L.push(`| ${m.corrida} | ${m.exactitud_campos_ce ?? '-'} | ${m.exactitud_campos_series ?? '-'} | ${a.todos ?? '-'} | ${a.entreno_CE ?? '-'} | ${a.nutricion_N ?? '-'} | ${a.vida_V ?? '-'} | ${a.dificiles_D ?? '-'} | ${m.inventados} | ${m.citas_invalidas} | ${m.errores} | ${m.latencia_ms.p50 ?? '-'} | ${m.latencia_ms.p95 ?? '-'} | ${m.costo_usd} |`)
  }
  L.push('', '> Nutrición (N), vida (V) y difíciles (D) traen lo esperado en notación relajada: de ellos solo se puntúa la ACCIÓN (tarjeta, pregunta, derivación, nada), no los gramos ni los valores. La puntuación por campo es solo para los 80 casos de entreno (CE).')
  const peorIdx = todas.reduce((p, m, i) => ((m.exactitud_campos_series ?? 100) < (todas[p].exactitud_campos_series ?? 100) ? i : p), 0)
  const fallos = corridas[peorIdx].filter((r) => !r.omitido && (r.error || r.campos.some((c) => !c.ok)))
  L.push('', `## Casos con algún campo mal (corrida ${todas[peorIdx].corrida}, la peor)`, '')
  if (fallos.length === 0) L.push('Ninguno.')
  for (const r of fallos) {
    const conocida = DISCREPANCIAS_CONOCIDAS[r.id]
    L.push(`### ${r.id} · ${r.area}${conocida ? ' · discrepancia conocida' : ''}`, `- Frase: «${r.frase}»`, `- Acción: esperada \`${r.accion_esperada}\`, obtenida \`${r.accion_obtenida}\``)
    if (r.error) L.push(`- Error: ${r.error}`)
    for (const c of r.campos.filter((x) => !x.ok)) L.push(`- ${c.campo}: esperado \`${JSON.stringify(c.esperado)}\`, obtenido \`${JSON.stringify(c.obtenido)}\``)
    if (r.citas_invalidas.length) L.push(`- Citas inválidas: ${r.citas_invalidas.join('; ')}`)
    if (r.inventados.length) L.push(`- Números sin procedencia: ${r.inventados.join('; ')}`)
    L.push(`- Propuesta: ${r.propuesta_resumen || '(vacía)'}`)
    if (conocida) L.push(`- Nota: ${conocida}`)
    L.push('')
  }
  const malAccion = corridas[peorIdx].filter((r) => !r.omitido && !r.puntuado_por_campo && r.accion_esperada !== r.accion_obtenida)
  L.push(`## Casos N/V/D con la acción distinta (corrida ${todas[peorIdx].corrida})`, '')
  for (const r of malAccion) L.push(`- **${r.id}** «${r.frase}»: esperada \`${r.accion_esperada}\`, obtenida \`${r.accion_obtenida}\` (${r.propuesta_resumen || 'vacía'})`)
  if (malAccion.length === 0) L.push('Ninguno.')
  L.push('')
  return L.join('\n')
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function principal(): Promise<void> {
  const o = leerArgumentos(process.argv.slice(2).filter((a) => a !== '--'))
  const corpus: Caso[] = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'))
  let casos = corpus
  if (o.casos) casos = casos.filter((c) => o.casos!.includes(c.id))
  if (o.areas) casos = casos.filter((c) => o.areas!.includes(c.area))
  if (o.limite) casos = casos.slice(0, o.limite)
  if (casos.length === 0) throw new Error('Ningún caso coincide con los filtros')

  const cwd = join(tmpdir(), 'praxis-eval-cwd')
  mkdirSync(cwd, { recursive: true })
  mkdirSync(o.salida, { recursive: true })
  console.log(`Evaluando ${casos.length} casos × ${o.corridas} corrida(s) — ${o.grabadas ? 'extracciones grabadas (sin modelo)' : `modelo ${o.modelo} por la CLI`}`)

  const todas: CorridaCaso[][] = []
  for (let k = 1; k <= o.corridas; k++) {
    let hechos = 0
    const rs = await enParalelo(casos, o.concurrencia, async (c) => {
      const r = await correrCaso(c, k, o, cwd)
      hechos++
      if (hechos % 20 === 0) console.log(`  corrida ${k}: ${hechos}/${casos.length}`)
      return r
    })
    todas.push(rs)
  }

  const metricas = todas.map((rs, i) => calcularMetricas(rs, i + 1))
  const peor = metricas.reduce((p, m) => ((m.exactitud_campos_series ?? 100) < (p.exactitud_campos_series ?? 100) ? m : p), metricas[0])
  const puertas = evaluarPuertas(peor, metricas)
  const costo = Math.round(metricas.reduce((n, m) => n + m.costo_usd, 0) * 10000) / 10000
  const meta = {
    fecha: new Date().toISOString(),
    modo: o.grabadas ? 'grabadas' : 'modelo',
    modelo: o.grabadas ? null : (todas.flat().find((r) => r.modeloId)?.modeloId ?? o.modelo),
    corridas: o.corridas,
    casos: casos.length,
    corpus: corpus.length,
    costo_usd: costo,
    version_prompt: VERSION_PROMPT,
    version_esquema: VERSION_ESQUEMA,
    version_resolutores: VERSION_RESOLUTORES,
  }
  const informe = { meta, puertas, metricas, peor_corrida: peor.corrida, casos: todas.flat() }
  writeFileSync(join(o.salida, 'informe.json'), JSON.stringify(informe, null, 2) + '\n')
  writeFileSync(join(o.salida, 'informe.md'), informeMd(meta, metricas, puertas, todas))
  console.log(`\nInforme: ${join(o.salida, 'informe.md')}`)
  for (const p of puertas) console.log(`  ${p.ok ? 'OK ' : p.dura ? 'ROJA' : 'roja'}  ${p.nombre}: ${p.obtenido} (meta ${p.meta})`)
  console.log(`  costo total: ${costo} USD`)
  // Una puerta dura roja rompe: sirve para el banco nocturno.
  if (puertas.some((p) => p.dura && !p.ok)) process.exitCode = 1
}

// Solo corre como script; los tests importan las funciones sin arrancar nada.
if (!process.env.VITEST) {
  principal().catch((e) => {
    console.error(e)
    process.exit(2)
  })
}
