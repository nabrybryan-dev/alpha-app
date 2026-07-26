import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import {
  LARGO_IDEAL_MAX,
  LARGO_IDEAL_MIN,
  palabrasDelCuerpo,
  parsearFicha,
  validarFicha,
} from '../src/domain/ficha.ts'

const CARPETA = resolve(process.cwd(), '..', 'wiki', 'centro-respuestas')
const TOTAL_ESPERADO = 50

const archivos = (await readdir(CARPETA))
  .filter((n) => n.endsWith('.md') && n !== 'README.md')
  .sort()

let conErrores = 0
let avisos = 0
const idsVistos = new Map()
const porBloque = new Map()

for (const archivo of archivos) {
  const texto = await readFile(join(CARPETA, archivo), 'utf8')

  let ficha
  try {
    ficha = parsearFicha(texto)
  } catch (error) {
    console.error(`✖ ${archivo}\n    ${error.message}`)
    conErrores++
    continue
  }

  const errores = validarFicha(ficha)

  const duplicado = idsVistos.get(ficha.id)
  if (duplicado) errores.push(`id duplicado, ya usado en ${duplicado}`)
  idsVistos.set(ficha.id, archivo)

  porBloque.set(ficha.bloque, (porBloque.get(ficha.bloque) ?? 0) + 1)

  if (errores.length) {
    console.error(`✖ ${archivo}`)
    for (const e of errores) console.error(`    ${e}`)
    conErrores++
    continue
  }

  const palabras = palabrasDelCuerpo(ficha.cuerpo)
  if (palabras < LARGO_IDEAL_MIN || palabras > LARGO_IDEAL_MAX) {
    console.warn(`⚠ ${archivo} — ${palabras} palabras (ideal ${LARGO_IDEAL_MIN}-${LARGO_IDEAL_MAX})`)
    avisos++
  } else {
    console.log(`✔ ${archivo}`)
  }
}

console.log(`\n${archivos.length} fichas · ${conErrores} con errores · ${avisos} avisos`)
for (const [bloque, n] of [...porBloque].sort()) {
  console.log(`  ${bloque}: ${n}`)
}

if (archivos.length !== TOTAL_ESPERADO) {
  console.warn(`\n⚠ Hay ${archivos.length} fichas, se esperan ${TOTAL_ESPERADO}.`)
}

process.exit(conErrores > 0 ? 1 : 0)
