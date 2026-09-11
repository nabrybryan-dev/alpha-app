/**
 * Los factores de techo y escalón para unas combinaciones de rango, y SOLO eso.
 *
 *   npx vite-node scripts/factores-de-escalera.mjs 8/10/2 12/15/2 ...
 *
 * PARA QUÉ EXISTE, que es lo único importante de este archivo. Para escribir las
 * escaleras en la base hace falta el factor `coef(rango.min)/coef(diana)`, y ese
 * sale de la tabla de coeficientes %1RM de `ondulacion.ts`. La tentación era
 * transcribir la tabla a SQL: **15 filas por 7 columnas de números que deciden
 * cargas**, y un dedo torcido ahí no da un error, da una carga creíble y
 * equivocada.
 *
 * Así que la tabla no se copia. Se pide aquí el puñado de factores que la carga
 * concreta necesita —en la cartera activa del 2026-09-04 eran **48 para 219
 * ejercicios**— y SQL recibe una tabla de valores ya calculados. La regla sigue
 * viviendo en un solo sitio; lo que viaja es su resultado.
 *
 * Se vuelven a generar cuando cambie la tabla o cuando aparezcan combinaciones
 * nuevas. No se editan a mano: para eso están las de arriba.
 */
import { coeficiente1rm } from '../src/domain/ondulacion.ts'

const triples = process.argv.slice(2)
if (triples.length === 0) {
  console.error('Uso: npx vite-node scripts/factores-de-escalera.mjs <min>/<diana>/<rir> ...')
  process.exit(2)
}

const filas = triples.map((t) => {
  const [rmin, diana, rir] = t.split('/').map(Number)
  if (![rmin, diana, rir].every(Number.isFinite)) {
    console.error(`No entiendo "${t}": se espera <min>/<diana>/<rir>`)
    process.exit(2)
  }
  const base = coeficiente1rm(diana, rir)
  return (
    `(${rmin},${diana},${rir},` +
    `${(coeficiente1rm(rmin, rir) / base).toFixed(6)},` +
    `${(coeficiente1rm(diana - 1, rir) / base).toFixed(6)})`
  )
})

console.log(filas.join(','))
console.error(
  `\n${filas.length} factores. Columnas: rango_min, diana, rir, factor_techo, factor_peldano.` +
    '\nOJO con los que salen en 1.000000: la tabla acota en 15 repeticiones, así que por' +
    '\nencima de ahí el techo y la diana comparten coeficiente y NO hay escalón. Es' +
    '\ncorrecto —no hay dato para esas reps— y hay que leerlo como «sin escalera», no' +
    '\ncomo «escalera de cero».',
)
