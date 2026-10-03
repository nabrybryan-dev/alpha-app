/**
 * Sin API. Toma las salidas CRUDAS del modelo de un informe del banco (`informe.json`), les quita lo que
 * el esquema de salida corta ya no pide (null, [], false, neutros) y comprueba dos cosas:
 *  1. que la propuesta resuelta es IDÉNTICA con y sin esos campos (no cambia el significado);
 *  2. cuántos caracteres/tokens de salida se ahorran (estimado por proporción de caracteres).
 *
 *   npx vite-node scripts/praxis-eval/simular-salida-corta.mts -- [informe.json]
 */
import { readFileSync } from 'node:fs'
import { contextoDeCorpus } from './contexto-corpus.ts'
import { validarExtraccion } from '../../src/domain/praxis/registro/esquema.ts'
import { resolverPropuesta } from '../../src/domain/praxis/registro/resolver.ts'

type J = Record<string, unknown>
const NEUTROS = new Set(['no_dicha', 'no_dicho'])

/** Quita del bruto lo que el esquema nuevo manda omitir. */
export function sinNeutros(v: unknown, clave = '', padre: J | null = null): unknown {
  if (Array.isArray(v)) {
    const xs = v.map((x) => sinNeutros(x, clave, padre))
    return xs
  }
  if (v && typeof v === 'object') {
    const o = v as J
    const sal: J = {}
    for (const [k, x] of Object.entries(o)) {
      if (k === 'ref_sugerida') continue
      if (x === null || x === false || (typeof x === 'string' && NEUTROS.has(x))) continue
      if (k === 'referencia' && x === 'no') continue
      if (k === 'segun_plan' && x === 'no_dicho') continue
      if (k === 'cocinado_por_ella' && x === 'no_dicho') continue
      if (Array.isArray(x) && x.length === 0 && k !== 'intencion' && k !== 'bloques') continue
      const y = sinNeutros(x, k, o)
      if (y && typeof y === 'object' && !Array.isArray(y) && Object.keys(y as J).length === 0 && !['ejercicio', 'carga', 'comida', 'vida', 'sesion'].includes(k)) continue
      sal[k] = y
    }
    // clinico sin nada: fuera
    if (clave === '' && (sal.clinico as J | undefined) && (sal.clinico as J).hay === undefined) delete sal.clinico
    return sal
  }
  return v
}

const ruta = process.argv.slice(2).filter((a) => a !== '--')[0] ?? 'scripts/praxis-eval/informes/ultimo/informe.json'
const corpus = JSON.parse(readFileSync('scripts/praxis-eval/corpus.json', 'utf8')) as { id: string; contexto: string; frase: string }[]
const informe = JSON.parse(readFileSync(ruta, 'utf8')) as { casos: { id: string; bruto?: unknown; tokensSalida?: number }[] }
let distintos = 0
let n = 0
let charsAntes = 0
let charsDespues = 0
const tokensAntes: number[] = []
const tokensDespues: number[] = []
for (const c of informe.casos) {
  if (!c.bruto || !c.tokensSalida) continue
  const k = corpus.find((x) => x.id === c.id)
  if (!k) continue
  n++
  const ctx = contextoDeCorpus(k.contexto)
  const corto = sinNeutros(c.bruto)
  const a = validarExtraccion(k.frase, c.bruto)
  const b = validarExtraccion(k.frase, corto)
  const pa = JSON.stringify(resolverPropuesta(k.frase, a.extraccion, ctx, a.citasInvalidas))
  const pb = JSON.stringify(resolverPropuesta(k.frase, b.extraccion, ctx, b.citasInvalidas))
  if (pa !== pb) {
    distintos++
    console.log('DIFIERE', c.id, k.frase)
  }
  const ca = JSON.stringify(c.bruto).length
  const cb = JSON.stringify(corto).length
  charsAntes += ca
  charsDespues += cb
  tokensAntes.push(c.tokensSalida)
  tokensDespues.push(Math.round((c.tokensSalida * cb) / ca))
}
const q = (xs: number[], p: number) => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(p * xs.length))]
console.log(`casos ${n} · propuestas distintas ${distintos}`)
console.log(`caracteres ${charsAntes} -> ${charsDespues} (${((1 - charsDespues / charsAntes) * 100).toFixed(1)} % menos)`)
console.log(`tokens salida (real) mediana ${q(tokensAntes, 0.5)} p95 ${q(tokensAntes, 0.95)} max ${Math.max(...tokensAntes)}`)
console.log(`tokens salida (ESTIMADO por proporción) mediana ${q(tokensDespues, 0.5)} p95 ${q(tokensDespues, 0.95)} max ${Math.max(...tokensDespues)}`)
