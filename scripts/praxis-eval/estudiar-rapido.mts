/**
 * Sin API. ¿Qué parte del corpus toma el camino rápido y se equivoca en algo?
 *   npx vite-node scripts/praxis-eval/estudiar-rapido.mts -- [informe.json]
 * Compara, en cada frase que acepta: (a) contra la acción y los campos ESPERADOS del corpus (puntuarCE)
 * y (b) contra lo que resolvió el modelo (el `bruto` del informe).
 */
import { readFileSync } from 'node:fs'
import { contextoDeCorpus } from './contexto-corpus.ts'
import { puntuarCE, type Caso } from './puntuar.ts'
import { validarExtraccion } from '../../src/domain/praxis/registro/esquema.ts'
import { resolverPropuesta } from '../../src/domain/praxis/registro/resolver.ts'
import { caminoRapido } from '../../src/domain/praxis/registro/rapido.ts'
import { filtrarClinico } from '../../src/domain/praxis/registro/filtroClinico.ts'
import { filtroDeRiesgo } from '../../src/domain/praxis/riesgo.ts'

const ruta = process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'scripts/praxis-eval/informes/ultimo/informe.json'
const corpus = JSON.parse(readFileSync('scripts/praxis-eval/corpus.json', 'utf8')) as Caso[]
const informe = JSON.parse(readFileSync(ruta, 'utf8')) as { casos: { id: string; bruto?: unknown }[] }
let aceptadas = 0
let mal = 0
let candidatas = 0
for (const c of corpus) {
  const ctx = contextoDeCorpus(c.contexto)
  if (filtrarClinico(c.frase) || filtroDeRiesgo(c.frase)) continue
  candidatas++
  const r = caminoRapido(c.frase, ctx)
  if (!r) continue
  aceptadas++
  const v = validarExtraccion(c.frase, r.bruto)
  const p = resolverPropuesta(c.frase, v.extraccion, ctx, v.citasInvalidas)
  const esperado = c.id.startsWith('CE-') ? puntuarCE(c, p, false) : null
  const malCampos = esperado ? esperado.campos.filter((x) => !x.ok) : [{ campo: 'no-CE' }]
  const modelo = informe.casos.find((x) => x.id === c.id)?.bruto
  let difModelo = '-'
  if (modelo) {
    const vm = validarExtraccion(c.frase, modelo)
    difModelo = JSON.stringify(resolverPropuesta(c.frase, vm.extraccion, ctx, vm.citasInvalidas)) === JSON.stringify(p) ? 'igual' : 'DISTINTA'
  }
  if (malCampos.length || difModelo === 'DISTINTA') mal++
  console.log(`${c.id.padEnd(7)} esperado:${malCampos.length ? 'MAL ' + JSON.stringify(malCampos) : 'ok'}  modelo:${difModelo}  «${c.frase}»`)
}
console.log(`\ncandidatas (tras filtros) ${candidatas} de ${corpus.length} · aceptadas ${aceptadas} (${((aceptadas / corpus.length) * 100).toFixed(1)} % del corpus, ${((aceptadas / 80) * 100).toFixed(1)} % de los 80 CE) · con diferencia ${mal}`)
