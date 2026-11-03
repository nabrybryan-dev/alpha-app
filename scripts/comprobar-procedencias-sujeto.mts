// A-procedencias, la corrida real: cada constante del dominio del sujeto contra PROCEDENCIAS.tsv.
//   npm run procedencias-sujeto
// El libro vive en el repo del cerebro; se busca junto a este (../cerebro-alpha/...) o en la ruta
// de PROCEDENCIAS_TSV. Si no está, FALLA: un arnés que se salta en silencio es un falso verde.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { verificarValoresRegistrados } from '../src/domain/sujeto/procedencias'
import { VALORES_REGISTRADOS } from '../src/domain/sujeto/registro'

const candidatas = [
  process.env.PROCEDENCIAS_TSV,
  join(process.cwd(), '..', 'cerebro-alpha', 'herramientas', 'encoder-camara', 'PROCEDENCIAS.tsv'),
].filter((r): r is string => Boolean(r))
const ruta = candidatas.find((r) => existsSync(r))
if (!ruta) {
  console.error('No encuentro PROCEDENCIAS.tsv. Probé:\n  ' + candidatas.join('\n  '))
  process.exit(2)
}
const problemas = verificarValoresRegistrados(VALORES_REGISTRADOS, readFileSync(ruta, 'utf8'))
const n = Object.keys(VALORES_REGISTRADOS).length
for (const p of problemas) console.log(`${p.problema}  ${p.id}  ${p.detalle}`)
console.log(`${n} constantes vigiladas · ${problemas.length} problemas · libro: ${ruta}`)
process.exit(problemas.length > 0 ? 1 : 0)
