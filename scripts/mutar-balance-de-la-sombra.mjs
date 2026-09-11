/**
 * Devuelve el fallo a su sitio, una pieza cada vez, y exige que la bateria de
 * `balanceDeLaSombra.test.ts` se ponga ROJA.
 *
 *   node scripts/mutar-balance-de-la-sombra.mjs
 *
 * Las que mas importan son las de los DESCARTES. Un balance que mete de matute
 * los casos que no puede medir —un rojo que no movio carga contado como «error
 * cero»— da un numero precioso y falso, y encima favorable.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const BATERIA = 'src/domain/balanceDeLaSombra.test.ts'
const CR = String.fromCharCode(13)
const FUENTE = 'src/domain/balanceDeLaSombra.ts'

const MUTACIONES = [
  {
    nombre: 'un rojo que no movio carga se cuela como error cero',
    archivo: FUENTE,
    viejo: "if (typeof ajuste.cargaKg !== 'number') {",
    nuevo: 'if (false) {',
  },
  {
    nombre: 'se comparan los errores al reves (alejar cuenta como acercar)',
    archivo: FUENTE,
    viejo: 'acerca: errorAjustado < errorOriginal,',
    nuevo: 'acerca: errorAjustado > errorOriginal,',
  },
  {
    nombre: 'el par se mide contra SI MISMO y no contra la vez siguiente',
    archivo: FUENTE,
    viejo: 'const siguiente = apariciones[i + 1]',
    nuevo: 'const siguiente = apariciones[i]',
  },
  {
    nombre: 'los nombres repetidos dejan de descartarse y se emparejan a ciegas',
    archivo: FUENTE,
    viejo: 'for (const clave of ambiguos) mapa.delete(clave)',
    nuevo: 'void ambiguos',
  },
  {
    nombre: 'sin escaleras se sigue adelante en vez de descartar',
    archivo: FUENTE,
    viejo: 'if (!hoy.ejercicio.escenarios) {',
    nuevo: 'if (false) {',
  },
  {
    nombre: 'la variante sin recorte deja de quitar la palanca',
    archivo: FUENTE,
    viejo: 'rojo: { ...hoy.ejercicio.escenarios.rojo, quitarUltimaSerie: false },',
    nuevo: 'rojo: { ...hoy.ejercicio.escenarios.rojo },',
  },
]

function corre() {
  try {
    execFileSync('npx', ['vitest', 'run', BATERIA], { stdio: 'pipe', shell: true })
    return true
  } catch {
    return false
  }
}

if (!corre()) {
  console.log('FALLO  la bateria no pasa SIN mutar. Arregla eso antes de mutar nada.')
  process.exit(2)
}

let fallos = 0
for (const m of MUTACIONES) {
  const enDisco = readFileSync(m.archivo, 'utf8')
  const original = enDisco.split(CR).join('')
  const veces = original.split(m.viejo).length - 1
  if (veces !== 1) {
    console.log(`ROTO   ${m.nombre}: el ancla aparece ${veces} veces`)
    fallos += 1
    continue
  }
  let paso
  try {
    writeFileSync(m.archivo, original.replace(m.viejo, m.nuevo))
    paso = corre()
  } finally {
    writeFileSync(m.archivo, enDisco)
  }
  if (paso) {
    console.log(`VERDE  ${m.nombre}  <- LA MUTACION SOBREVIVIO: el check no protege nada`)
    fallos += 1
  } else {
    console.log(`rojo   ${m.nombre}`)
  }
}

console.log(`\n${MUTACIONES.length - fallos}/${MUTACIONES.length} mutaciones cazadas.`)
if (!corre()) {
  console.log('FALLO  la bateria NO vuelve a verde: algo quedo mal restaurado.')
  process.exit(2)
}
process.exit(fallos === 0 ? 0 : 1)
