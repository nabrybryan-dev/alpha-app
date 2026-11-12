// Mide la organización por voz con DOS capas: la gramática sola y la gramática + el modelo con menú cerrado.
// Usa la CLI de Claude (suscripción), sin herramientas. No llama a la API de pago.
// Uso: npm run praxis-eval -- ... no; esto es un script aparte:
//   npx vite-node scripts/praxis-eval/organizacion-modelo.mts -- --examen <carpeta con frases.json y esperado.json> [--modelo claude-haiku-4-5] [--concurrencia 3]
// Cada frase: {"intencion":"...","frase":"..."}. `esperado.json`: intención -> lista de decisiones aceptadas («x:*» acepta cualquier cola).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { decidirConLectura, decidirOrganizacion, sePuedeConsultarAlModelo, type DecisionDeOrganizacion, type EstadoDeOrganizacion } from '../../src/app/organizacionPraxis'
import { piezasPara } from '../../src/app/catalogoDePiezas'
import type { PerfilAcceso } from '../../src/app/rutas'
import { leerSalidaDeOrganizacion, promptDeOrganizacion } from '../../src/domain/praxis/organizacion/lectorModelo'

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1]! : d }
const CARPETA = arg('--examen', '')
if (!CARPETA) { console.error('falta --examen <carpeta>'); process.exit(2) }
const MODELO = arg('--modelo', 'claude-haiku-4-5')
const CONC = Number(arg('--concurrencia', '3'))

const PERFIL: PerfilAcceso = { rol: 'asesorado', capacidades: new Set() }
const ESTADO: EstadoDeOrganizacion = { ocultas: new Set(), hayCambiosParaDeshacer: false }
const piezas = piezasPara(PERFIL)
const ids = new Set(piezas.map((p) => p.id))

const dir = mkdtempSync(join(tmpdir(), 'org-'))
const promptFile = join(dir, 'prompt.txt')
writeFileSync(promptFile, promptDeOrganizacion(piezas.map((p) => ({ id: p.id, nombre: p.nombreHablado }))))
const cwd = join(dir, 'vacia'); mkdirSync(cwd)

function llamar(frase: string): Promise<{ texto: string; msApi: number; costo: number }> {
  return new Promise((ok, mal) => {
    const hijo = spawn('claude', ['-p', '--model', MODELO, '--output-format', 'json', '--tools', '', '--system-prompt-file', promptFile,
      '--no-session-persistence', '--disable-slash-commands', '--strict-mcp-config', '--exclude-dynamic-system-prompt-sections', '--setting-sources', ''],
      { cwd, env: { ...process.env, MAX_THINKING_TOKENS: '0', CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' }, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    const t = setTimeout(() => { hijo.kill(); mal(new Error('tiempo')) }, 120000)
    hijo.stdout.on('data', (d) => (out += d))
    hijo.on('close', () => {
      clearTimeout(t)
      try { const j = JSON.parse(out); ok({ texto: String(j.result ?? ''), msApi: Number(j.duration_api_ms ?? 0), costo: Number(j.total_cost_usd ?? 0) }) } catch (e) { mal(e) }
    })
    hijo.stdin.end(frase)
  })
}

async function enParalelo<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const res: R[] = new Array(xs.length); let i = 0
  await Promise.all(Array.from({ length: n }, async () => { while (i < xs.length) { const k = i++; res[k] = await f(xs[k]!) } }))
  return res
}

const resumen = (x: DecisionDeOrganizacion): string => {
  if (x.tipo === 'traer') return `traer:${x.pieza.id}`
  if (x.tipo === 'propone') return `propone:${x.accion}:${x.pieza.id}`
  if (x.tipo === 'rechaza') return `rechaza:${x.motivo}`
  if (x.tipo === 'pregunta_cual') return `pregunta:${x.opciones.map((o) => o.id).sort().join('|')}`
  if (x.tipo === 'lista_ocultas') return `lista_ocultas:${x.piezas.length}`
  if (x.tipo === 'sugiere_ocultar') return `sugiere_ocultar:${x.pieza.id}`
  if (x.tipo === 'propone_solo_lo_importante') return `propone_solo_lo_importante:${x.esconderia.length}`
  return x.tipo
}
const coincide = (got: string, exp: string) => (exp.endsWith(':*') ? got.startsWith(exp.slice(0, -1)) : got === exp)
function clase(intencion: string, got: string, esperado: string[]): string {
  const control = intencion === 'charla' || intencion === 'salud_con_orden'
  if (esperado.some((e) => coincide(got, e))) return 'ACIERTA'
  if (control) return 'FALSO_POSITIVO'
  if (got.startsWith('pregunta:') && esperado.some((e) => got.includes(e.split(':').slice(-1)[0]!))) return 'PREGUNTA'
  if (got === 'no_es_organizacion' || got.startsWith('rechaza:') || got === 'seguridad') return 'NADA'
  return 'EQUIVOCADA'
}

const frases = JSON.parse(readFileSync(join(CARPETA, 'frases.json'), 'utf8')) as { intencion: string; frase: string }[]
const esperado = JSON.parse(readFileSync(join(CARPETA, 'esperado.json'), 'utf8')) as Record<string, string[]>

const filas = await enParalelo(frases, CONC, async (f) => {
  const gramatica = resumen(decidirOrganizacion(f.frase, PERFIL, ESTADO))
  const pasa = gramatica === 'no_es_organizacion' || gramatica === 'rechaza:no_existe'
  let combinada = gramatica, modelo: string | null = null, msApi = 0, costo = 0
  if (pasa && sePuedeConsultarAlModelo(f.frase)) {
    try {
      const r = await llamar(f.frase)
      msApi = r.msApi; costo = r.costo
      const lectura = leerSalidaDeOrganizacion(r.texto, ids)
      modelo = lectura ? `${lectura.verbo}${lectura.pieza ? ':' + lectura.pieza : ''}` : 'ILEGIBLE'
      combinada = lectura ? resumen(decidirConLectura(lectura, PERFIL, ESTADO)) : 'no_es_organizacion'
    } catch { modelo = 'FALLO'; combinada = 'no_es_organizacion' }
  }
  const ex = esperado[f.intencion]!
  return { ...f, gramatica, modelo, combinada, claseGramatica: clase(f.intencion, gramatica, ex), claseCombinada: clase(f.intencion, combinada, ex), msApi, costo }
})

const ordenes = filas.filter((f) => f.intencion !== 'charla' && f.intencion !== 'salud_con_orden')
const controles = filas.filter((f) => f.intencion === 'charla' || f.intencion === 'salud_con_orden')
const cuenta = (xs: typeof filas, k: 'claseGramatica' | 'claseCombinada', c: string) => xs.filter((x) => x[k] === c).length
const ms = filas.filter((f) => f.modelo && f.msApi > 0).map((f) => f.msApi).sort((a, b) => a - b)
const p = (q: number) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] : 0)
const salida = {
  modelo: MODELO, ordenes: ordenes.length, controles: controles.length,
  solo_gramatica: { ACIERTA: cuenta(ordenes, 'claseGramatica', 'ACIERTA'), PREGUNTA: cuenta(ordenes, 'claseGramatica', 'PREGUNTA'), NADA: cuenta(ordenes, 'claseGramatica', 'NADA'), EQUIVOCADA: cuenta(ordenes, 'claseGramatica', 'EQUIVOCADA'), falsos_positivos: cuenta(controles, 'claseGramatica', 'FALSO_POSITIVO') },
  gramatica_mas_modelo: { ACIERTA: cuenta(ordenes, 'claseCombinada', 'ACIERTA'), PREGUNTA: cuenta(ordenes, 'claseCombinada', 'PREGUNTA'), NADA: cuenta(ordenes, 'claseCombinada', 'NADA'), EQUIVOCADA: cuenta(ordenes, 'claseCombinada', 'EQUIVOCADA'), falsos_positivos: cuenta(controles, 'claseCombinada', 'FALSO_POSITIVO') },
  consultas_al_modelo: filas.filter((f) => f.modelo).length, ilegibles: filas.filter((f) => f.modelo === 'ILEGIBLE' || f.modelo === 'FALLO').length,
  msApi_p50_p95: [p(0.5), p(0.95)], costo_usd: Number(filas.reduce((s, f) => s + f.costo, 0).toFixed(3)),
}
writeFileSync(join(CARPETA, `resultado-modelo-${MODELO}.json`), JSON.stringify({ resumen: salida, filas }, null, 1))
console.log(JSON.stringify(salida, null, 2))
for (const f of filas.filter((x) => x.claseCombinada === 'EQUIVOCADA' || x.claseCombinada === 'FALSO_POSITIVO')) console.log(f.claseCombinada, '|', f.intencion, '|', f.frase.slice(0, 100), '=>', f.combinada, `(modelo: ${f.modelo})`)
