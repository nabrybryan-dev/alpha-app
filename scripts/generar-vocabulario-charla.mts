// Genera src/domain/praxis/charla/vocabularioCharla.generado.ts: el vocabulario permitido de la charla con DeepSeek.
//   npx vite-node scripts/generar-vocabulario-charla.mts <piezas.json> [ampliacion.json|-] [salida.ts]
// <ampliacion.json>: lista de palabras aprobada por el dueño (11-nov: scripts/vocabulario-charla-AMPLIACION.json, 534 palabras).
// Por omisión se usa ese archivo; «-» = sin ampliación. Los nombres de NOMBRES_COMUNES se excluyen también de la ampliación.
// <piezas.json>: lista de piezas con los campos de praxis_conceptos (hoy la fuente es
// F:\alpha-corridas\REDISENO-APP-20261021\biblioteca-praxis\piezas-v2.json; en la app salen de praxis_conceptos).
// Una pieza = pregunta_que_responde, contexto, respuesta, de_que_depende, estudios, criterio_de_practica.
// Se suman las palabras comunes de vocabularioComun.ts y se EXCLUYEN los nombres de NOMBRES_COMUNES (limpiador.ts).
// Léxico de riesgo/salud: NO se incluye (se filtra con saludEnFrase); `riesgo.ts` solo exporta filtros (regex sin exportar), y no se copia ni se toca.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { saludEnFrase } from '../src/domain/praxis/charla/saludEnFrase.ts'
import { NOMBRES_COMUNES } from '../src/domain/praxis/charla/limpiador.ts'
import { PALABRAS_COMUNES } from '../src/domain/praxis/charla/vocabularioComun.ts'
import { armarVocabulario, type PiezaParaVocabulario } from '../src/domain/praxis/charla/vocabularioPermitido.ts'

const AMPLIACION_FIJA = join(process.cwd(), 'scripts/vocabulario-charla-AMPLIACION.json')
const [entrada, rutaAmpliacion = AMPLIACION_FIJA, salida = join(process.cwd(), 'src/domain/praxis/charla/vocabularioCharla.generado.ts')] = process.argv.slice(2)
if (!entrada) {
  console.error('Uso: vite-node scripts/generar-vocabulario-charla.mts <piezas.json> [ampliacion.json|-] [salida.ts]')
  process.exit(2)
}
const piezas = JSON.parse(readFileSync(entrada, 'utf8')) as PiezaParaVocabulario[]
if (!Array.isArray(piezas) || piezas.length === 0) {
  console.error('El JSON no es una lista de piezas, o está vacía.')
  process.exit(2)
}
const ampliacion = rutaAmpliacion === '-' ? [] : (JSON.parse(readFileSync(rutaAmpliacion, 'utf8')) as string[])
if (!Array.isArray(ampliacion) || ampliacion.some((p) => typeof p !== 'string')) {
  console.error('La ampliación no es una lista de palabras.')
  process.exit(2)
}
// Las palabras que marca el léxico de salud de la charla NO entran (custodio, hallazgo 2): esas frases van al coach, no a DeepSeek.
const vocab = armarVocabulario(piezas, PALABRAS_COMUNES, NOMBRES_COMUNES, ampliacion).filter((p) => saludEnFrase(p) === null)
const lineas: string[] = []
let actual = '  '
for (const p of vocab) {
  const item = `'${p}', `
  if (actual.length + item.length > 118) {
    lineas.push(actual.trimEnd())
    actual = '  '
  }
  actual += item
}
if (actual.trim()) lineas.push(actual.trimEnd())
const cuerpo =
  '// GENERADO: no editar a mano. Lo escribe scripts/generar-vocabulario-charla.mts a partir de las piezas aprobadas y de la ampliación del dueño.\n' +
  `// Piezas leídas: ${piezas.length}. Ampliación aprobada: ${ampliacion.length}. Palabras: ${vocab.length}. Sin nombres de persona (NOMBRES_COMUNES). Sin léxico de riesgo (ver el script).\n` +
  '// Rutas con «.ts»: este módulo lo importa la Edge Function `praxis-charla` (Deno).\n\n' +
  `export const VOCABULARIO_CHARLA: readonly string[] = [\n${lineas.join('\n')}\n]\n`
writeFileSync(salida, cuerpo, 'utf8')
console.log(`vocabulario: ${vocab.length} palabras de ${piezas.length} piezas -> ${salida}`)
