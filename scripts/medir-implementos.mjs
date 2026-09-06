/**
 * ¿CUÁNTOS EJERCICIOS REALES NO DICEN CON QUÉ SE HACEN?
 *
 * `implementoDe()` lee el implemento del NOMBRE del ejercicio. Cuando el nombre no lo
 * declara, la escena venía suponiendo barra —y por eso a una sentadilla que no lleva
 * barra le salía una barra—. Antes de cambiar esa suposición hay que saber a cuántos
 * afecta: si son cuatro, se arreglan los nombres; si son la mitad, el arreglo es otro.
 *
 * Lee los nombres del seed (Valentina y los demás perfiles de prueba), que es lo único
 * que hay en el repo — las prescripciones reales viven en Supabase y no se commitean.
 *
 *     node scripts/medir-implementos.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const CARPETA = 'src/data/seed'

/** Los mismos patrones que `src/domain/biomecanica/implementos.ts`, en el mismo orden. */
const DETECCION = [
  [/TOBILLERA|EN EL TOBILLO/, 'polea-tobillera'],
  [/SMITH|MULTIPOWER|MULTIFUERZA/, 'guiado-vertical'],
  [/PRENSA|HACK/, 'guiado-inclinado'],
  [/MANCUERNA/, 'mancuernas'],
  [/GOBLET|COPA|CON DISCO|CON PLACA/, 'disco'],
  [/POLEA|CABLE|JALON|CRUCE/, 'polea'],
  [/MAQUINA|SELECTORIZAD/, 'maquina'],
  [/PESO CORPORAL|SIN PESO|LASTRE/, 'peso-corporal'],
  [/BARRA|BARBELL/, 'barra'],
]

const normalizar = (t) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()

const implementoDe = (nombre) => {
  const n = normalizar(nombre)
  if (!n) return undefined
  return DETECCION.find(([p]) => p.test(n))?.[1]
}

// Los ejercicios del seed van en llamadas `ej({ ... categoria: 'X' ... nombre: 'Y' ... })`.
// Se emparejan los dos campos de la MISMA llamada: sin eso, un nombre suelto no dice de
// qué patrón es y la cuenta por categoría saldría inventada.
const ejercicios = []
for (const archivo of readdirSync(CARPETA).filter((f) => f.endsWith('.ts'))) {
  const texto = readFileSync(join(CARPETA, archivo), 'utf8')
  for (const m of texto.matchAll(/categoria:\s*'([^']+)',\s*nombre:\s*'([^']+)'/g)) {
    ejercicios.push({ categoria: m[1], nombre: m[2] })
  }
}
const nombres = new Set(ejercicios.map((e) => e.nombre))

const porImplemento = new Map()
const sinDeclarar = []
for (const e of ejercicios) {
  const i = implementoDe(e.nombre) ?? '(no declara)'
  porImplemento.set(i, (porImplemento.get(i) ?? 0) + 1)
  if (i === '(no declara)') sinDeclarar.push(`${e.nombre}   [${e.categoria}]`)
}

console.log(`ejercicios en el seed: ${ejercicios.length} (${nombres.size} nombres distintos)\n`)
for (const [i, c] of [...porImplemento].sort((a, b) => b[1] - a[1])) {
  const pct = ((c / ejercicios.length) * 100).toFixed(0)
  console.log(`  ${String(c).padStart(3)}  ${pct.padStart(3)}%  ${i}`)
}
console.log(`\nlos que HOY salen con una barra que nadie pidió (${sinDeclarar.length}):`)
for (const n of sinDeclarar.slice(0, 25)) console.log('   ', n)
if (sinDeclarar.length > 25) console.log(`    ... y ${sinDeclarar.length - 25} más`)
