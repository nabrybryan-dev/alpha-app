/**
 * Mide el filtro de salida de la respuesta provisional con salidas REALES de DeepSeek.
 *   npx vite-node scripts/praxis-eval/provisional-deepseek.mts -- <A|B|A2|C> [--solo-filtrar] [--tope N]
 * Lee examen-<X>.json (A2 usa examen-A.json) y escribe salidas-<X>.json (fuera del repo). A2 = el examen A con el vocabulario
 * ampliado, la salud en la frase y las rotundas (11-nov). C es el examen LIMPIO: se corre UNA sola vez (se niega si ya existe salidas-C.json). Con --solo-filtrar no llama a DeepSeek: reusa la
 * salida cruda de salidas-<X>.json y vuelve a decidir (sirve para afinar sin gastar).
 * El lector de riesgo (Anthropic) NO se llama: se simula «sin riesgo». Los filtros locales de salud de la frase (filtro de la app
 * + lexico de la charla, `saludAntesDeDeepseek`) SI se aplican, como en la funcion: la frase con sintoma va al coach sin llamar a DeepSeek.
 * La clave viene de DEEPSEEK_API_KEY y nunca se imprime ni se guarda.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { limpiarFrase } from '../../src/domain/praxis/charla/limpiador.ts'
import { soloVocabulario } from '../../src/domain/praxis/charla/vocabularioPermitido.ts'
import { VOCABULARIO_CHARLA } from '../../src/domain/praxis/charla/vocabularioCharla.generado.ts'
import { URL_DEEPSEEK } from '../../src/domain/praxis/charla/pedidoCharla.ts'
import { saludAntesDeDeepseek } from '../../src/domain/praxis/charla/saludEnFrase.ts'
import { armarPedidoProvisional, decidirProvisional, tieneContenido } from '../../src/domain/praxis/charla/provisional.ts'

const DIR = 'F:/alpha-corridas/REDISENO-APP-20261021/biblioteca-praxis/piloto-destilacion/f3-preparacion/examen-provisional'
const args = process.argv.slice(2).filter((a) => a !== '--')
const examen = args[0]
const soloFiltrar = args.includes('--solo-filtrar')
const iTope = args.indexOf('--tope')
const TOPE = iTope >= 0 ? Number(args[iTope + 1]) : 90000
if (!['A', 'B', 'A2', 'C'].includes(examen ?? '') || !Number.isFinite(TOPE)) throw new Error('uso: <A|B|A2|C> [--solo-filtrar] [--tope N]')
const archivoExamen = examen === 'A2' ? 'A' : examen

interface Pregunta { id: string; pregunta: string; trampa: string }
interface Salida {
  id: string; trampa: string; pregunta: string; frase_limpia: string; salida_cruda: string | null
  decision: 'provisional' | 'al_coach'; motivo: string | null; tokens: number; error?: string
}
const preguntas = JSON.parse(readFileSync(`${DIR}/examen-${archivoExamen}.json`, 'utf8')) as Pregunta[]
const ruta = `${DIR}/salidas-${examen}.json`
const previas: Salida[] = soloFiltrar && existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : []
const VOCAB: ReadonlySet<string> = new Set(VOCABULARIO_CHARLA)
const clave = process.env.DEEPSEEK_API_KEY
if (examen === 'C' && !soloFiltrar && existsSync(ruta)) throw new Error('el examen C ya se corrio: es el limpio, no se repite')
if (!soloFiltrar && !clave) throw new Error('falta DEEPSEEK_API_KEY')

const salidas: Salida[] = []
let total = 0
for (const p of preguntas) {
  const patrones = limpiarFrase(p.pregunta, [], { mayusculas: false })
  const limpia = soloVocabulario(patrones.texto, VOCAB)
  let cruda: string | null = null
  let tokens = 0
  let error: string | undefined
  const salud = saludAntesDeDeepseek(p.pregunta)
  if (salud) {
    // como la funcion: la frase con sintoma va al coach SIN llamar a DeepSeek
    salidas.push({ id: p.id, trampa: p.trampa, pregunta: p.pregunta, frase_limpia: limpia, salida_cruda: null, decision: 'al_coach', motivo: `salud_antes:${salud}`, tokens: 0 })
    continue
  }
  if (!tieneContenido(limpia)) {
    salidas.push({ id: p.id, trampa: p.trampa, pregunta: p.pregunta, frase_limpia: limpia, salida_cruda: null, decision: 'al_coach', motivo: 'frase_vacia', tokens: 0 })
    continue
  }
  if (soloFiltrar) {
    cruda = previas.find((s) => s.id === p.id)?.salida_cruda ?? null
  } else {
    const r = await fetch(URL_DEEPSEEK, {
      method: 'POST',
      headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json' },
      body: JSON.stringify(armarPedidoProvisional(limpia)),
    })
    if (!r.ok) {
      console.error(`ERROR ${p.id}: HTTP ${r.status} ${(await r.text()).slice(0, 400)}`)
      writeFileSync(ruta, JSON.stringify(salidas, null, 2))
      process.exit(2)
    }
    const cuerpo = (await r.json()) as { choices?: { message?: { content?: unknown }; finish_reason?: unknown }[]; usage?: { total_tokens?: number } }
    const c = cuerpo.choices?.[0]?.message?.content
    cruda = typeof c === 'string' ? c : null
    if (cuerpo.choices?.[0]?.finish_reason === 'length') { error = 'cortado_por_largo'; cruda = null } // igual que la funcion
    tokens = cuerpo.usage?.total_tokens ?? 0
    total += tokens
    if (total >= TOPE) { console.error(`TOPE de ${TOPE} tokens alcanzado`); break }
  }
  const dec = decidirProvisional(cruda, limpia)
  salidas.push({
    id: p.id, trampa: p.trampa, pregunta: p.pregunta, frase_limpia: limpia, salida_cruda: cruda,
    decision: dec.tipo, motivo: dec.tipo === 'al_coach' ? dec.motivo : null, tokens: soloFiltrar ? (previas.find((s) => s.id === p.id)?.tokens ?? 0) : tokens, ...(error ? { error } : {}),
  })
}
writeFileSync(ruta, JSON.stringify(salidas, null, 2))
const por = (k: (s: Salida) => string) => {
  const o: Record<string, number> = {}
  for (const s of salidas) o[k(s)] = (o[k(s)] ?? 0) + 1
  return o
}
console.log(`examen ${examen}: ${salidas.length} preguntas, tokens esta corrida ${total}`)
console.log('decision', por((s) => s.decision))
console.log('motivo', por((s) => s.motivo ?? 'pasa'))
console.log('trampa x decision', por((s) => `${s.trampa}:${s.decision}`))
if ((examen === 'B' || examen === 'C') && !soloFiltrar) {
  writeFileSync(`${DIR}/salidas-${examen}-pasaron.json`, JSON.stringify(salidas.filter((s) => s.decision === 'provisional').map((s) => ({ id: s.id, pregunta: s.pregunta, salida: s.salida_cruda })), null, 2))
}
