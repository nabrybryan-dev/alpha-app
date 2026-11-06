/**
 * ETAPA B2 del criterio firmado CRITERIO-PASO-A-FUNCION-20261104.md: DeepSeek real, revisor de juguete (no se llama).
 * Usa EL MISMO código de la rama (limpiador, tipo de pregunta, campos por tipo, redactor y guardas). La llave se toma de
 * la variable DEEPSEEK_API_KEY y nunca se imprime. Una sola corrida; si una respuesta sale vacía se reintenta UNA vez.
 *
 *   node scripts/praxis-voz/correr-b2.ts <carpeta-b2> <piezas-v2.json>          (corre)
 *   node scripts/praxis-voz/correr-b2.ts <carpeta-b2> <piezas-v2.json> --seco   (solo comprueba los tipos)
 *
 * Plazo de cada llamada: 30 s, para MEDIR la latencia real (el criterio exige mediana y 95 % por debajo de 8 s).
 * Parada de seguridad: 120.000 tokens de DeepSeek (el criterio no fija tope; se reporta lo gastado).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { revisarGuardas } from '../../supabase/functions/praxis-registro/voz/guardas.ts'
import { limpiarPregunta } from '../../supabase/functions/praxis-registro/voz/limpiador.ts'
import { redactar } from '../../supabase/functions/praxis-registro/voz/modelos.ts'
import { VERSION_PROMPT_REDACTOR } from '../../supabase/functions/praxis-registro/voz/promptRedactor.ts'
import { CAMPOS_POR_TIPO, tipoDePregunta } from '../../supabase/functions/praxis-registro/voz/tipoPregunta.ts'

const [carpeta, rutaPiezas] = process.argv.slice(2)
const seco = process.argv.includes('--seco')
const PARADA = 120_000
const PLAZO_MS = 30_000
const NOMBRES_CONOCIDOS = ['Anselmo', 'Gertrudis', 'Valentina', 'Ximena'] // en la función saldrán de usuarios_app

type Pregunta = { n: number; tipo: string; pieza: string; texto: string }
const material = JSON.parse(readFileSync(join(carpeta, 'preguntas-b2.json'), 'utf-8')) as { datos_sembrados: string[]; preguntas: Pregunta[] }
const piezas = new Map((JSON.parse(readFileSync(rutaPiezas, 'utf-8')) as Record<string, unknown>[]).map((p) => [p.id as string, p]))

const mal = material.preguntas.filter((q) => tipoDePregunta(q.texto) !== q.tipo)
console.log('tipo esperado distinto del detectado:', mal.length, mal.map((q) => q.n))
const faltan = material.preguntas.filter((q) => !piezas.has(q.pieza))
console.log('piezas que no existen:', faltan.length)
if (seco || mal.length || faltan.length) process.exit(mal.length || faltan.length ? 1 : 0)

const clave = process.env.DEEPSEEK_API_KEY
if (!clave) { console.log('Falta DEEPSEEK_API_KEY'); process.exit(1) }

const salida: Record<string, unknown>[] = []
let gasto = 0
for (const q of material.preguntas) {
  if (gasto >= PARADA) { console.log('PARADA por tope en la pregunta', q.n, 'gasto', gasto); break }
  const pieza = piezas.get(q.pieza)!
  const tipo = tipoDePregunta(q.texto)
  const campos = Object.fromEntries(CAMPOS_POR_TIPO[tipo].filter((k) => pieza[k]).map((k) => [k, pieza[k]]))
  const limpia = limpiarPregunta(q.texto, NOMBRES_CONOCIDOS)
  const d = { fetch, ahoraMs: () => Date.now() }
  const t0 = Date.now()
  let r = await redactar(d, clave, { pregunta: limpia.texto, tipo, campos }, PLAZO_MS)
  const primerIntento = r.estado
  let tokens = r.tokens
  let razonamiento = r.tokensRazonamiento ?? null
  if (r.estado === 'vacio') { r = await redactar(d, clave, { pregunta: limpia.texto, tipo, campos }, PLAZO_MS); tokens += r.tokens; razonamiento = (razonamiento ?? 0) + (r.tokensRazonamiento ?? 0) }
  const ms = Date.now() - t0
  gasto += tokens
  const guarda = r.respuesta ? revisarGuardas(r.respuesta, `${limpia.texto} ${JSON.stringify(campos)}`) : null
  salida.push({ n: q.n, pieza: q.pieza, tipo, pregunta: q.texto, enviada: limpia.texto, datos_quitados: limpia.quitados, estado: r.estado, primer_intento: primerIntento, respuesta: r.respuesta ?? '', hueco: r.hueco ?? null, guarda, tokens, tokens_razonamiento: razonamiento, ms })
  writeFileSync(join(carpeta, 'respuestas-b2.json'), JSON.stringify({ nota: 'Preguntas escritas por Claude; sin frases reales.', version_prompt_redactor: VERSION_PROMPT_REDACTOR, gasto, respuestas: salida }, null, 1))
  console.log(q.n, r.estado, primerIntento === r.estado ? '' : `(primer intento ${primerIntento})`, ms, 'ms', tokens, 'tokens')
}
console.log('fin; respuestas', salida.length, 'gasto', gasto)
